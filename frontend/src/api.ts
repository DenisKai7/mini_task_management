import { Task, AuditLog, TaskStatus } from './types';

const API_BASE = '/api';

export async function fetchUsers(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  const data = await res.json();
  return data.users;
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  const data = await res.json();
  return data.tasks;
}

export async function createTask(title: string, description: string): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to create task');
  }
  const data = await res.json();
  return data.task;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  actor: string
): Promise<{ task: Task; unchanged: boolean; auditLog?: AuditLog }> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, actor }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to update status');
  }
  return res.json();
}

export async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to delete task');
  }
}

export async function fetchAuditLogs(taskId: string): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/audit-logs`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  const data = await res.json();
  return data.auditLogs;
}
