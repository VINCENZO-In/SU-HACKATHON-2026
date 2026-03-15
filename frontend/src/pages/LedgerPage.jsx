import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import API from '../utils/api';
import { useAuth } from '../hooks/useAuth';

export default function LedgerPage() {
  const [entries, setEntries] = useState([]);
  const [cashflow, setCashflow] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ type: 'INFLOW', amount: '', description: '', party: '', category: 'Order', dueDate: '' });
  const { user } = useAuth();
  const canEdit = user?.role !== 'worker';

  const load = async () => {
    const [l, cf] = await Promise.all([API.get('/orders/ledger'), API.get('/orders/cashflow?days=30')]);
    setEntries(l.data);
    setCashflow(cf.data);
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    await API.post('/orders/ledger', form);
    setShowModal(false);
    setForm({ type: 'INFLOW', amount: '', description: '', party: '', category: 'Order', dueDate: '' });
    load();
  };

  const byCategory = cashflow.byCategory || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Ledger & Finance</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>Cash flow tracking and financial records</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Entry</button>}
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { l: 'Expected Inflow (30d)', v: `₹${(cashflow.expectedInflow || 0).toLocaleString('en-IN')}`, c: 'var(--green)' },
          { l: 'Expected Outflow (30d)', v: `₹${(cashflow.expectedOutflow || 0).toLocaleString('en-IN')}`, c: 'var(--red)' },
          { l: 'Net Position', v: `₹${Math.abs(cashflow.net || 0).toLocaleString('en-IN')} ${(cashflow.net || 0) >= 0 ? '↑' : '↓'}`, c: (cashflow.net || 0) >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: s.c, marginTop: 8 }}>{s.v}</div>
            {s.l === 'Net Position' && <span className={`badge ${cashflow.riskLevel === 'SAFE' ? 'badge-green' : 'badge-red'}`} style={{ marginTop: 8 }}>{cashflow.riskLevel}</span>}
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Spending by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCategory}>
              <XAxis dataKey="_id" tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }} formatter={v => `₹${v.toLocaleString('en-IN')}`} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {byCategory.map((e, i) => <Cell key={i} fill={['#00d4ff', '#00e676', '#f59e0b', '#f43f5e', '#a855f7', '#ff6b35'][i % 6]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Recent Transactions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.slice(0, 6).map(e => (
              <div key={e._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{e.party} · {e.category}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: e.type === 'INFLOW' ? 'var(--green)' : 'var(--red)', fontSize: 15 }}>
                    {e.type === 'INFLOW' ? '+' : '-'}₹{(e.amount || 0).toLocaleString('en-IN')}
                  </div>
                  <span className={`badge ${e.status === 'Completed' ? 'badge-green' : e.status === 'Overdue' ? 'badge-red' : 'badge-yellow'}`}>{e.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>All Ledger Entries</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Type</th><th>Description</th><th>Party</th><th>Category</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e._id}>
                  <td><span className={`badge ${e.type === 'INFLOW' ? 'badge-green' : 'badge-red'}`}>{e.type}</span></td>
                  <td>{e.description}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{e.party}</td>
                  <td style={{ fontSize: 12 }}>{e.category}</td>
                  <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: e.type === 'INFLOW' ? 'var(--green)' : 'var(--red)' }}>
                    {e.type === 'INFLOW' ? '+' : '-'}₹{(e.amount || 0).toLocaleString('en-IN')}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{e.dueDate ? new Date(e.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                  <td><span className={`badge ${e.status === 'Completed' ? 'badge-green' : e.status === 'Overdue' ? 'badge-red' : 'badge-yellow'}`}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Add Ledger Entry</h3>
            <form onSubmit={save}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option>INFLOW</option><option>OUTFLOW</option>
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Amount (₹)</label>
                  <input type="number" className="form-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {['Material', 'Salary', 'Utility', 'Order', 'Maintenance', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Party</label>
                  <input className="form-input" value={form.party} onChange={e => setForm({ ...form, party: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save Entry</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
