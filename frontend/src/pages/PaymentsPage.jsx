import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../utils/api';
import { useSocketEvent } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';

const URGENCY = {
  CRITICAL: { color:'var(--red)',    badge:'badge-red',    icon:'🔴', label:'Critical — 14d+' },
  HIGH:     { color:'var(--red)',    badge:'badge-red',    icon:'⚠️', label:'High — 7-14d' },
  MEDIUM:   { color:'var(--yellow)', badge:'badge-yellow', icon:'🟡', label:'Medium — 3-7d' },
  LOW:      { color:'var(--accent)', badge:'badge-blue',   icon:'🔵', label:'Low — 0-3d' },
};

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="stat-card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        <div style={{ width:8, height:8, borderRadius:'50%', background:color, boxShadow:`0 0 8px ${color}` }}/>
      </div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:30, fontWeight:700, color, letterSpacing:'-0.02em' }}>{value}</div>
      <div style={{ fontSize:12, color:'var(--text-0)', fontWeight:600, marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text-2)', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

export default function PaymentsPage() {
  const [overdue,   setOverdue]   = useState({ entries:[], totalAmount:0, count:0 });
  const [upcoming,  setUpcoming]  = useState({ entries:[], count:0 });
  const [sending,   setSending]   = useState(null);
  const [msg,       setMsg]       = useState({ text:'', type:'' });
  const [toast,     setToast]     = useState(null);
  const [upDays,    setUpDays]    = useState(7);
  const [filterUrgency, setFilterUrgency] = useState('ALL');
  const { user } = useAuth();
  const canEdit = user?.role !== 'worker';

  const showMsg = (text, type='success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text:'', type:'' }), 5000);
  };

  useSocketEvent('payment_alert', (d) => {
    setToast({ msg: d.msg, party: d.party });
    setTimeout(() => setToast(null), 8000);
    load();
  });

  const load = async () => {
    try {
      const [o, u] = await Promise.all([
        API.get('/payments/overdue'),
        API.get('/payments/upcoming?days=' + upDays)
      ]);
      setOverdue(o.data);
      setUpcoming(u.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, [upDays]);

  const sendReminder = async (id, party) => {
    setSending(id);
    try {
      const { data } = await API.post('/payments/' + id + '/send-reminder');
      showMsg('✉️ Email sent to admin' + (data.msg?.includes('supplier') ? ' & supplier' : '') + ' — ' + party);
    } catch (e) {
      showMsg('❌ Email failed: ' + (e.response?.data?.msg || e.message), 'error');
    }
    setSending(null);
  };

  const runAutoReminders = async () => {
    setSending('all');
    try {
      const { data } = await API.post('/payments/auto-reminders');
      showMsg('✉️ Auto-reminders complete — ' + data.count + ' emails sent');
      load();
    } catch (e) {
      showMsg('❌ Failed: ' + (e.response?.data?.msg || e.message), 'error');
    }
    setSending(null);
  };

  const markPaid = async (id, desc) => {
    if (!window.confirm('Mark "' + desc + '" as paid?')) return;
    await API.put('/payments/' + id + '/mark-paid');
    showMsg('✅ Marked as paid');
    load();
  };

  const filtered = filterUrgency === 'ALL'
    ? (overdue.entries || [])
    : (overdue.entries || []).filter(e => e.urgency === filterUrgency);

  const criticalCount = (overdue.entries||[]).filter(e => e.urgency==='CRITICAL').length;
  const highCount     = (overdue.entries||[]).filter(e => e.urgency==='HIGH').length;

  return (
    <div>
      {/* Live payment alert */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
            style={{ background:'rgba(255,71,87,0.08)', border:'1px solid rgba(255,71,87,0.3)', borderRadius:10,
              padding:'12px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:20 }}>💸</span>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, color:'var(--red)', fontSize:14 }}>PAYMENT OVERDUE ALERT</div>
              <div style={{ fontSize:12, color:'var(--text-1)', marginTop:2 }}>{toast.msg}</div>
            </div>
            <button onClick={() => setToast(null)} style={{ marginLeft:'auto', background:'transparent', border:'none', color:'var(--text-2)', cursor:'pointer', fontSize:18 }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700 }}>Payment Reminders</h1>
          <p style={{ color:'var(--text-2)', fontSize:13, marginTop:4 }}>
            Overdue tracking · Auto email to admin &amp; supplier · Dual notification system
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={runAutoReminders} disabled={!!sending}
            style={{ gap:8 }}>
            {sending === 'all' ? '⏳ Sending...' : '✉️ Run Auto Reminders'}
          </button>
        )}
      </div>

      {msg.text && (
        <div className={'alert alert-' + (msg.type === 'error' ? 'error' : 'success')} style={{ marginBottom:16 }}>
          {msg.text}
        </div>
      )}

      {/* Email config notice */}
      <div className="alert alert-info" style={{ marginBottom:20 }}>
        <strong>📧 Dual Email:</strong> Every reminder sends to <strong>admin</strong> + <strong>the supplier</strong> (if they have email set).
        Configure SMTP in <code style={{ background:'var(--bg-2)', padding:'1px 6px', borderRadius:4 }}>backend/.env</code> →
        SMTP_USER, SMTP_PASS, ADMIN_EMAIL. Auto-runs daily at 8am via cron.
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom:24 }}>
        <StatCard label="Overdue Payments"   value={overdue.count||0}  color="var(--red)"    icon="⚠️" sub={`₹${(overdue.totalAmount||0).toLocaleString('en-IN')} total`}/>
        <StatCard label="Critical (14d+)"    value={criticalCount}      color="var(--red)"    icon="🔴" sub="Immediate action needed"/>
        <StatCard label="High Priority (7d)" value={highCount}           color="var(--orange)" icon="🟠" sub="Send reminder today"/>
        <StatCard label="Upcoming"           value={upcoming.count||0}  color="var(--yellow)" icon="🔔" sub={`Next ${upDays} days`}/>
      </div>

      {/* Overdue table */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:16 }}>🔴 Overdue Payments</h3>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            {/* Filter chips */}
            {['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(u => (
              <button key={u} onClick={() => setFilterUrgency(u)}
                style={{ padding:'4px 12px', borderRadius:16, border:'1px solid', fontSize:11, fontFamily:'var(--font-display)', fontWeight:600, cursor:'pointer',
                  borderColor: filterUrgency===u ? 'var(--accent)' : 'var(--border)',
                  background:  filterUrgency===u ? 'var(--accent-glow)' : 'transparent',
                  color:       filterUrgency===u ? 'var(--accent)' : 'var(--text-2)' }}>
                {u}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px', color:'var(--green)', fontFamily:'var(--font-display)', fontSize:16 }}>
            ✅ No overdue payments
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Urgency</th><th>Supplier / Party</th><th>Description</th>
                  <th>Amount</th><th>Due Date</th><th>Days Late</th>
                  <th>Email</th>{canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const uc = URGENCY[e.urgency] || URGENCY.LOW;
                  return (
                    <motion.tr key={e._id}
                      initial={{ opacity:0, x:-10 }}
                      animate={{ opacity:1, x:0 }}
                      transition={{ delay: i * 0.04 }}>
                      <td>
                        <span className={'badge ' + uc.badge}>{uc.icon} {e.urgency}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight:600, fontSize:13 }}>{e.party}</div>
                        {e.supplierEmail && (
                          <div style={{ fontSize:11, color:'var(--accent)', fontFamily:'var(--font-mono)' }}>{e.supplierEmail}</div>
                        )}
                      </td>
                      <td style={{ fontSize:12, color:'var(--text-1)', maxWidth:200 }}>{e.description}</td>
                      <td>
                        <span style={{ fontFamily:'var(--font-display)', fontWeight:700, color:uc.color, fontSize:16 }}>
                          ₹{(e.amount||0).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td style={{ fontSize:12, color:'var(--text-2)' }}>
                        {new Date(e.dueDate).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:uc.color, animation:'pulse-dot 1.5s infinite' }}/>
                          <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:18, color:uc.color }}>{e.daysOverdue}</span>
                          <span style={{ fontSize:11, color:'var(--text-2)' }}>days</span>
                        </div>
                      </td>
                      <td>
                        {e.supplierEmail ? (
                          <div style={{ fontSize:11, color:'var(--green)', display:'flex', alignItems:'center', gap:4 }}>
                            <span>✓</span> {e.supplierEmail}
                          </div>
                        ) : (
                          <div style={{ fontSize:11, color:'var(--text-2)' }}>Admin only</div>
                        )}
                      </td>
                      {canEdit && (
                        <td>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            <button className="btn btn-ghost"
                              onClick={() => sendReminder(e._id, e.party)}
                              disabled={!!sending}
                              style={{ fontSize:11, padding:'4px 10px', borderColor:'var(--accent)', color:'var(--accent)' }}>
                              {sending === e._id ? '⏳' : '✉️'} Send
                            </button>
                            <button className="btn btn-success"
                              onClick={() => markPaid(e._id, e.description)}
                              style={{ fontSize:11, padding:'4px 10px' }}>
                              ✅ Paid
                            </button>
                          </div>
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:16 }}>🔔 Upcoming Payments</h3>
          <div style={{ display:'flex', gap:6 }}>
            {[3,7,14,30].map(d => (
              <button key={d} className={'btn ' + (upDays===d ? 'btn-primary' : 'btn-ghost')}
                onClick={() => setUpDays(d)} style={{ padding:'5px 12px', fontSize:11 }}>{d}d</button>
            ))}
          </div>
        </div>

        {!upcoming.entries?.length ? (
          <div style={{ textAlign:'center', padding:'24px', color:'var(--text-2)', fontSize:14 }}>
            No payments due in next {upDays} days
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {upcoming.entries.map(e => (
              <motion.div key={e._id} initial={{ opacity:0 }} animate={{ opacity:1 }}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'12px 16px', background:'var(--bg-2)', borderRadius:10,
                  borderLeft:`3px solid ${e.daysLeft <= 2 ? 'var(--red)' : e.daysLeft <= 5 ? 'var(--yellow)' : 'var(--border-bright)'}` }}>
                <div>
                  <div style={{ fontWeight:500, fontSize:13 }}>{e.description}</div>
                  <div style={{ fontSize:11, color:'var(--text-2)', marginTop:2 }}>{e.party} · {e.category}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:17,
                      color: e.type==='INFLOW' ? 'var(--green)' : 'var(--yellow)' }}>
                      {e.type === 'INFLOW' ? '+' : '-'}₹{(e.amount||0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-2)' }}>
                      {new Date(e.dueDate).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div style={{ textAlign:'center', minWidth:52 }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:24,
                      color: e.daysLeft <= 2 ? 'var(--red)' : e.daysLeft <= 5 ? 'var(--yellow)' : 'var(--accent)' }}>
                      {e.daysLeft}
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-2)' }}>days left</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
