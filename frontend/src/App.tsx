import React, { useEffect, useState } from 'react';
import { Task, AuditLog, TaskStatus } from './types';
import * as api from './api';
import { TaskForm } from './components/TaskForm';
import { TaskItem } from './components/TaskItem';
import { AuditLogModal } from './components/AuditLogModal';

export const App: React.FC = () => {
  const [users, setUsers] = useState<string[]>([]);
  const [currentActor, setCurrentActor] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTaskForLogs, setActiveTaskForLogs] = useState<Task | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [userList, taskList] = await Promise.all([
          api.fetchUsers(),
          api.fetchTasks(),
        ]);
        setUsers(userList);
        if (userList.length > 0) {
          setCurrentActor(userList[0]);
        }
        setTasks(taskList);
      } catch (err: any) {
        setErrorNotification(err.message || 'Initialization error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleCreateTask = async (title: string, description: string) => {
    const newTask = await api.createTask(title, description);
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleAdvanceStatus = async (taskId: string, nextStatus: TaskStatus) => {
    try {
      setErrorNotification(null);
      const res = await api.updateTaskStatus(taskId, nextStatus, currentActor);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? res.task : t))
      );
    } catch (err: any) {
      setErrorNotification(err.message || 'Failed to update status');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      setErrorNotification(null);
      await api.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err: any) {
      setErrorNotification(err.message || 'Failed to delete task');
    }
  };

  const handleViewLogs = async (task: Task) => {
    try {
      setErrorNotification(null);
      const logs = await api.fetchAuditLogs(task.id);
      setAuditLogs(logs);
      setActiveTaskForLogs(task);
    } catch (err: any) {
      setErrorNotification(err.message || 'Failed to load audit logs');
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div>
          <h1>Mini Task Manager</h1>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Audit trail & strict state lifecycle
          </div>
        </div>

        <div className="actor-box">
          <label htmlFor="actor-select">Current Actor:</label>
          <select
            id="actor-select"
            className="actor-select"
            value={currentActor}
            onChange={(e) => setCurrentActor(e.target.value)}
          >
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Global Error Banner */}
      {errorNotification && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #ef4444',
          color: '#991b1b',
          padding: '10px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{errorNotification}</span>
          <button
            onClick={() => setErrorNotification(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Task Creation Form */}
      <TaskForm onCreate={handleCreateTask} />

      {/* Task List */}
      <div>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>
          Tasks ({tasks.length})
        </h2>

        {loading ? (
          <div className="empty-state">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state card">No tasks found. Create one above!</div>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onAdvanceStatus={handleAdvanceStatus}
                onDelete={handleDeleteTask}
                onViewLogs={handleViewLogs}
              />
            ))}
          </div>
        )}
      </div>

      {/* Audit Log Modal */}
      {activeTaskForLogs && (
        <AuditLogModal
          taskTitle={activeTaskForLogs.title}
          auditLogs={auditLogs}
          onClose={() => setActiveTaskForLogs(null)}
        />
      )}
    </div>
  );
};
export default App;
