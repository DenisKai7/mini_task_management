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

export const NEXT_STATUS_MAP: Record<TaskStatus, TaskStatus | null> = {
  to_do: 'pending',
  pending: 'in_progress',
  in_progress: 'done',
  done: null,
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: 'To Do',
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};
