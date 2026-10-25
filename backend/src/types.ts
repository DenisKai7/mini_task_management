export type TaskStatus = 'to_do' | 'pending' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  task_id: string;
  actor: string;
  from_status: TaskStatus;
  to_status: TaskStatus;
  timestamp: string;
}

export const PREDEFINED_ACTORS = [
  'john.doe',
  'jane.smith',
  'alice.wong',
  'bob.chen'
] as const;

export type Actor = (typeof PREDEFINED_ACTORS)[number] | string;
