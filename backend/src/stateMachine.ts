import { TaskStatus } from './types';

// Strict state transition: to_do -> pending -> in_progress -> done
export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus | null> = {
  to_do: 'pending',
  pending: 'in_progress',
  in_progress: 'done',
  done: null,
};

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from] === to;
}

export function isSameStatus(from: TaskStatus, to: TaskStatus): boolean {
  return from === to;
}
