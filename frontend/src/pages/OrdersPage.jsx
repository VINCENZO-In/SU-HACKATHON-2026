import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const statusColors = { Received: 'badge-blue', 'In Production': 'badge-yellow', 'Quality Check': 'badge-purple', Dispatched: 'badge-green', Delivered: 'badge-green' };
const payColors = { Unpaid: 'badge-red', Partial: 'badge-yellow', Paid: 'badge-green', Refunded: 'badge-purple' };

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [form, setForm] = useState({ clientName: '', clientEmail: '', fabricType: '', totalMeters: '', totalAmount: '', deadline: '' });
  const { user } = useAuth();
  const canEdit = user?.role !== 'worker';

  const load = async () => {
    const { data } = await API.get('/orders');
    setOrders(data);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditOrder(null); setForm({ clientName: '', clientEmail: '', fabricType: '', totalMeters: '', totalAmount: '', deadline: '' }); setShowModal(true); };
  const openEdit = (o) => { setEditOrder(o); setForm({ clientName: o.clientName, clientEmail: o.clientEmail, fabricType: o.fabricType, totalMeters: o.totalMeters, totalAmount: o.totalAmount, deadline: o.deadline ? o.deadline.slice(0, 10) : '' }); setShowModal(true); };

  const save = async (e) => {
    e.preventDefault();
    if (editOrder) await API.put(`/orders/${editOrder._id}`, form);
    else await API.post('/orders', form);
    setShowModal(false); load();
  };

  const updateStatus = async (id, status) => {
    await API.put(`/orders/${id}`, { status });
    load();
  };

  const totalRevenue = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const paid = orders.filter(o => o.paymentStatus === 'Paid').reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Orders</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>{orders.length} total orders</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={openAdd}>+ New Order</button>}
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { l: 'Total Orders', v: orders.length, c: 'var(--accent)' },
          { l: 'Total Revenue', v: `₹${totalRevenue.toLocaleString('en-IN')}`, c: 'var(--green)' },
          { l: 'Collected', v: `₹${paid.toLocaleString('en-IN')}`, c: 'var(--yellow)' },
          { l: 'Pending Dispatch', v: orders.filter(o => o.status !== 'Dispatched' && o.status !== 'Delivered').length, c: 'var(--purple)' },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: s.c, marginTop: 6 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr><th>Order ID</th><th>Client</th><th>Fabric</th><th>Meters</th><th>Amount</th><th>Payment</th><th>Status</th><th>Deadline</th>{canEdit && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o._id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{o.orderId}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{o.clientName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{o.clientEmail}</div>
                  </td>
                  <td>{o.fabricType}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{o.totalMeters}m</td>
                  <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--green)' }}>₹{(o.totalAmount || 0).toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${payColors[o.paymentStatus]}`}>{o.paymentStatus}</span></td>
                  <td><span className={`badge ${statusColors[o.status] || 'badge-blue'}`}>{o.status}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{o.deadline ? new Date(o.deadline).toLocaleDateString('en-IN') : '—'}</td>
                  {canEdit && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" onClick={() => openEdit(o)} style={{ padding: '4px 10px', fontSize: 11 }}>Edit</button>
                      <select style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-1)', padding: '4px 6px', fontSize: 11, cursor: 'pointer' }}
                        value={o.status} onChange={e => updateStatus(o._id, e.target.value)}>
                        {['Received', 'In Production', 'Quality Check', 'Dispatched', 'Delivered'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>{editOrder ? 'Edit Order' : 'New Order'}</h3>
            <form onSubmit={save}>
              <div className="grid-2">
                {[['clientName', 'Client Name', 'text'], ['clientEmail', 'Client Email', 'email'], ['fabricType', 'Fabric Type', 'text'], ['totalMeters', 'Total Meters', 'number'], ['totalAmount', 'Amount (₹)', 'number'], ['deadline', 'Deadline', 'date']].map(([k, l, t]) => (
                  <div key={k} className="form-group">
                    <label className="form-label">{l}</label>
                    <input type={t} className="form-input" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} required={k !== 'clientEmail' && k !== 'deadline'} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save Order</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
