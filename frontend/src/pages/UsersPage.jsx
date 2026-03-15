import { useState, useEffect } from 'react';
import API from '../utils/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'worker' });
  const [msg, setMsg] = useState('');

  const load = async () => { const { data } = await API.get('/auth/users'); setUsers(data); };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    await API.post('/auth/register', form);
    setShowModal(false);
    setForm({ name: '', email: '', password: '', role: 'worker' });
    load();
    setMsg('User created successfully');
    setTimeout(() => setMsg(''), 3000);
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await API.delete(`/auth/users/${id}`);
    load();
  };

  const roleColors = { admin: 'badge-red', manager: 'badge-yellow', worker: 'badge-blue' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>User Management</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>{users.length} registered users</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add User</button>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.email}</td>
                <td><span className={`badge ${roleColors[u.role]}`}>{u.role}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                <td>
                  <button className="btn btn-danger" onClick={() => deleteUser(u._id)} style={{ padding: '4px 10px', fontSize: 11 }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Add New User</h3>
            <form onSubmit={save}>
              {[['name', 'Full Name', 'text'], ['email', 'Email Address', 'email'], ['password', 'Password', 'password']].map(([k, l, t]) => (
                <div key={k} className="form-group">
                  <label className="form-label">{l}</label>
                  <input type={t} className="form-input" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} required />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="worker">Worker</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Create User</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
