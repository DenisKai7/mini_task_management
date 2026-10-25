import React from 'react';
import { Task, TaskStatus, NEXT_STATUS_MAP, STATUS_LABELS } from '../types';

interface Props {
  task: Task;
  onAdvanceStatus: (taskId: string, nextStatus: TaskStatus) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onViewLogs: (task: Task) => void;
  disabled?: boolean;
}

export const TaskItem: React.FC<Props> = ({
  task,
  onAdvanceStatus,
  onDelete,
  onViewLogs,
  disabled,
}) => {
  const nextStatus = NEXT_STATUS_MAP[task.status];

  return (
    <div className="task-item">
      <div className="task-top">
        <div>
          <div className="task-title">{task.title}</div>
          {task.description && <div className="task-desc">{task.description}</div>}
        </div>
        <span className={`badge badge-${task.status}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      <div className="task-actions">
        <div>Updated: {new Date(task.updated_at).toLocaleTimeString()}</div>
        <div className="task-buttons">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onViewLogs(task)}
          >
            Audit Log
          </button>

          {nextStatus && (
            <button
              className="btn btn-primary btn-sm"
              disabled={disabled}
              onClick={() => onAdvanceStatus(task.id, nextStatus)}
            >
              Move to {STATUS_LABELS[nextStatus]} →
            </button>
          )}

          <button
            className="btn btn-danger btn-sm"
            disabled={disabled}
            onClick={() => {
              if (confirm(`Delete task "${task.title}"?`)) {
                onDelete(task.id);
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
