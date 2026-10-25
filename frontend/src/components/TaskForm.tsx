import React, { useState } from 'react';

interface Props {
  onCreate: (title: string, description: string) => Promise<void>;
}

export const TaskForm: React.FC<Props> = ({ onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setLoading(true);
      setError(null);
      await onCreate(title.trim(), description.trim());
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Create New Task</h2>
      {error && <div style={{ color: 'var(--danger)', marginBottom: '8px', fontSize: '0.85rem' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Task Title</label>
          <input
            className="form-input"
            type="text"
            placeholder="e.g. Prepare Invoice"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div className="form-group">
          <label>Description (Optional)</label>
          <textarea
            className="form-textarea"
            placeholder="Enter details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading || !title.trim()}>
          {loading ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  );
};
