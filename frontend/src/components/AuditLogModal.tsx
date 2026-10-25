import React from 'react';
import { AuditLog, STATUS_LABELS } from '../types';

interface Props {
  taskTitle: string;
  auditLogs: AuditLog[];
  onClose: () => void;
}

export const AuditLogModal: React.FC<Props> = ({ taskTitle, auditLogs, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Audit Log History</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Task: <strong>{taskTitle}</strong>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {auditLogs.length === 0 ? (
            <div className="empty-state">No audit logs recorded for this task yet.</div>
          ) : (
            <div className="timeline">
              {auditLogs.map((log) => (
                <div key={log.id} className="timeline-item">
                  <div className="timeline-time">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                  <div className="timeline-desc">
                    User <strong>"{log.actor}"</strong> changed status from{' '}
                    <span className={`badge badge-${log.from_status}`}>
                      {STATUS_LABELS[log.from_status] || log.from_status}
                    </span>{' '}
                    to{' '}
                    <span className={`badge badge-${log.to_status}`}>
                      {STATUS_LABELS[log.to_status] || log.to_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
