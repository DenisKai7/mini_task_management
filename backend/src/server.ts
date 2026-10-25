import express, { Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { db } from './db';
import { Task, TaskStatus, PREDEFINED_ACTORS } from './types';

export const app = express();

app.use(cors());
app.use(express.json());

// 1. Get predefined actors
app.get('/api/users', (_req: Request, res: Response) => {
  res.json({ users: PREDEFINED_ACTORS });
});

// 2. List all tasks
app.get('/api/tasks', (_req: Request, res: Response) => {
  const tasks = db.getTasks();
  res.json({ tasks });
});

// 3. Create task (default: to_do)
app.post('/api/tasks', (req: Request, res: Response) => {
  const { title, description } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const now = new Date().toISOString();
  const newTask: Task = {
    id: randomUUID ? randomUUID() : Math.random().toString(36).substring(2, 11),
    title: title.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    status: 'to_do',
    created_at: now,
    updated_at: now,
  };

  db.createTask(newTask);
  res.status(201).json({ task: newTask });
});

// 4. Update task status (strict transition + atomic audit log + idempotent)
app.patch('/api/tasks/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status: targetStatus, actor } = req.body as { status: TaskStatus; actor: string };

  if (!actor || typeof actor !== 'string' || !actor.trim()) {
    return res.status(400).json({ error: 'Actor is required to change status' });
  }

  if (!targetStatus || !['to_do', 'pending', 'in_progress', 'done'].includes(targetStatus)) {
    return res.status(400).json({ error: 'Invalid target status' });
  }

  try {
    const result = db.updateTaskStatus(id, targetStatus, actor.trim());
    return res.json(result);
  } catch (err: any) {
    if (err.message === 'TASK_NOT_FOUND') {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (err.message.startsWith('INVALID_TRANSITION')) {
      return res.status(400).json({
        error: `Invalid transition requested. Status must strictly follow: to_do -> pending -> in_progress -> done.`
      });
    }
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// 5. Delete task
app.delete('/api/tasks/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = db.deleteTask(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ message: 'Task deleted successfully', id });
});

// 6. Get audit logs for task
app.get('/api/tasks/:id/audit-logs', (req: Request, res: Response) => {
  const { id } = req.params;
  const logs = db.getAuditLogs(id);
  res.json({ auditLogs: logs });
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}
