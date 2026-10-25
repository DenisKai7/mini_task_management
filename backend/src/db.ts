import fs from 'fs';
import path from 'path';
import { Task, AuditLog, TaskStatus } from './types';
import { isSameStatus, isValidTransition } from './stateMachine';

const dbFilePath = process.env.NODE_ENV === 'test'
  ? path.resolve(__dirname, '..', 'data', 'test-tasks.json')
  : path.resolve(__dirname, '..', 'data', 'tasks.json');

interface Schema {
  tasks: Task[];
  audit_logs: AuditLog[];
}

function ensureDataFile() {
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(dbFilePath)) {
    const initial: Schema = { tasks: [], audit_logs: [] };
    fs.writeFileSync(dbFilePath, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

export class JsonDb {
  constructor() {
    ensureDataFile();
  }

  private read(): Schema {
    ensureDataFile();
    try {
      const content = fs.readFileSync(dbFilePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { tasks: [], audit_logs: [] };
    }
  }

  private write(data: Schema): void {
    const tempFile = `${dbFilePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, dbFilePath); // Atomic file write
  }

  getTasks(): Task[] {
    const data = this.read();
    return [...data.tasks].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getTaskById(id: string): Task | undefined {
    const data = this.read();
    return data.tasks.find((t) => t.id === id);
  }

  createTask(task: Task): void {
    const data = this.read();
    data.tasks.push(task);
    this.write(data);
  }

  /**
   * Atomic update with strict validation and audit log creation
   */
  updateTaskStatus(
    id: string,
    targetStatus: TaskStatus,
    actor: string
  ): { task: Task; unchanged: boolean; auditLog?: AuditLog } {
    const data = this.read();
    const taskIndex = data.tasks.findIndex((t) => t.id === id);

    if (taskIndex === -1) {
      throw new Error('TASK_NOT_FOUND');
    }

    const currentTask = data.tasks[taskIndex];

    // Idempotent: same status
    if (isSameStatus(currentTask.status, targetStatus)) {
      return { task: currentTask, unchanged: true };
    }

    // Strict domain validation
    if (!isValidTransition(currentTask.status, targetStatus)) {
      throw new Error(`INVALID_TRANSITION:${currentTask.status}->${targetStatus}`);
    }

    const now = new Date().toISOString();
    const auditLog: AuditLog = {
      id: Math.random().toString(36).substring(2, 11),
      task_id: currentTask.id,
      actor,
      from_status: currentTask.status,
      to_status: targetStatus,
      timestamp: now,
    };

    const updatedTask: Task = {
      ...currentTask,
      status: targetStatus,
      updated_at: now,
    };

    // Atomic update
    data.tasks[taskIndex] = updatedTask;
    data.audit_logs.push(auditLog);
    this.write(data);

    return { task: updatedTask, unchanged: false, auditLog };
  }

  deleteTask(id: string): boolean {
    const data = this.read();
    const initialLen = data.tasks.length;
    data.tasks = data.tasks.filter((t) => t.id !== id);
    if (data.tasks.length === initialLen) return false;
    // NOTE: Audit logs are preserved permanently for compliance/audit trail!
    this.write(data);
    return true;
  }

  getAuditLogs(taskId: string): AuditLog[] {
    const data = this.read();
    return data.audit_logs
      .filter((log) => log.task_id === taskId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  clearAll(): void {
    this.write({ tasks: [], audit_logs: [] });
  }
}

export const db = new JsonDb();
