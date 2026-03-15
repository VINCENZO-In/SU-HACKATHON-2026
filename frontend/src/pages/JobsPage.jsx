import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../utils/api';
import { useSocketEvent } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';

const STATUS_BADGE = { Pending: 'badge-yellow', 'In-Progress': 'badge-blue', Completed: 'badge-green', Cancelled: 'badge-red' };

function GanttChart({ jobs }) {
  if (!jobs || jobs.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>No scheduled jobs to display</div>
  );

  const now = Date.now();
  const startTime = Math.min(...jobs.map(j => new Date(j.start).getTime()));
  const endTime = Math.max(...jobs.map(j => new Date(j.end).getTime()));
  const totalDuration = endTime - startTime || 1;

  const machines = [...new Set(jobs.map(j => j.machine || 'Unassigned'))];

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Time header */}
      <div style={{ display: 'flex', marginLeft: 120, marginBottom: 8 }}>
        {[0, 25, 50, 75, 100].map(pct => (
          <div key={pct} style={{ flex: pct === 0 ? 0 : 1, fontSize: 10, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
            {new Date(startTime + (totalDuration * pct / 100)).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
          </div>
        ))}
      </div>

      {machines.map(machine => {
        const machineJobs = jobs.filter(j => (j.machine || 'Unassigned') === machine);
        return (
          <div key={machine} style={{ display: 'flex', alignItems: 'center', marginBottom: 10, minHeight: 36 }}>
            {/* Machine label */}
            <div style={{ width: 115, flexShrink: 0, fontSize: 11, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', paddingRight: 8, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {machine}
            </div>

            {/* Timeline row */}
            <div style={{ flex: 1, position: 'relative', height: 32, background: 'var(--bg-2)', borderRadius: 4, minWidth: 300 }}>
              {/* Now line */}
              {now >= startTime && now <= endTime && (
                <div style={{ position: 'absolute', left: `${((now - startTime) / totalDuration) * 100}%`, top: 0, bottom: 0, width: 2, background: 'var(--red)', zIndex: 10 }}>
                  <div style={{ position: 'absolute', top: -4, left: -4, width: 10, height: 10, background: 'var(--red)', borderRadius: '50%' }} />
                </div>
              )}

              {machineJobs.map(job => {
                const left = ((new Date(job.start).getTime() - startTime) / totalDuration) * 100;
                const width = ((new Date(job.end).getTime() - new Date(job.start).getTime()) / totalDuration) * 100;
                return (
                  <motion.div key={job.id}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    style={{
                      position: 'absolute',
                      left: `${Math.max(0, left)}%`,
                      width: `${Math.max(2, width)}%`,
                      top: 3, bottom: 3,
                      background: job.color || 'var(--accent)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 6,
                      transformOrigin: 'left'
                    }}
                    title={`${job.orderId} — ${job.fabricType} (${job.progress}%)`}
                  >
                    {/* Progress overlay */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${job.progress}%`, background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', position: 'relative', zIndex: 1, whiteSpace: 'nowrap' }}>
                      {job.orderId}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 8, display: 'flex', gap: 16, paddingLeft: 120 }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--red)', borderRadius: '50%', marginRight: 4 }} />
          Now
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Colored bars show job duration · Lighter fill = completion progress</span>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [gantt, setGantt] = useState([]);
  const [machines, setMachines] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState('list');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ orderId: '', fabricType: '', totalMeters: 100, priority: 2, deadline: '', estimatedHours: 8, color: '#6366f1', floor: 'Floor A', section: '', clientName: '', notes: '' });
  const { user } = useAuth();
  const canEdit = user?.role !== 'worker';

  const load = async () => {
    const [j, g, m] = await Promise.all([API.get('/jobs'), API.get('/jobs/gantt'), API.get('/machines')]);
    setJobs(j.data);
    setGantt(g.data);
    setMachines(m.data);
  };

  useEffect(() => { load(); }, []);

  useSocketEvent('job_created', (data) => setJobs(prev => [data, ...prev]));
  useSocketEvent('job_updated', (data) => setJobs(prev => prev.map(j => j._id === data._id ? data : j)));
  useSocketEvent('schedule_optimized', () => { setMsg('✅ Schedule optimized!'); load(); setTimeout(() => setMsg(''), 4000); });

  const createJob = async (e) => {
    e.preventDefault();
    await API.post('/jobs', form);
    setShowModal(false);
    setForm({ orderId: '', fabricType: '', totalMeters: 100, priority: 2, deadline: '', estimatedHours: 8, color: '#6366f1', floor: 'Floor A', section: '', clientName: '', notes: '' });
    load();
  };

  const updateStatus = async (id, status) => {
    await API.put(`/jobs/${id}`, { status });
    load();
  };

  const deleteJob = async (id) => {
    if (!window.confirm('Delete this job?')) return;
    await API.delete(`/jobs/${id}`);
    load();
  };

  const optimizeSchedule = async () => {
    await API.post('/jobs/optimize');
  };

  const assignMachine = async (jobId, machineId) => {
    await API.post(`/jobs/${jobId}/assign`, { machineId });
    load();
  };

  const pending = jobs.filter(j => j.status === 'Pending').length;
  const inProgress = jobs.filter(j => j.status === 'In-Progress').length;
  const completed = jobs.filter(j => j.status === 'Completed').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Production Jobs</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>{pending} pending · {inProgress} in progress · {completed} completed</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button className="btn btn-ghost" onClick={optimizeSchedule}>⚡ Auto-Optimize</button>}
          {canEdit && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Job</button>}
        </div>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}</div>}

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { l: 'Pending', v: pending, c: 'var(--yellow)' },
          { l: 'In Progress', v: inProgress, c: 'var(--accent)' },
          { l: 'Completed', v: completed, c: 'var(--green)' },
          { l: 'Total', v: jobs.length, c: 'var(--text-0)' },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['list', 'gantt'].map(v => (
          <button key={v} onClick={() => setView(v)}
            className={view === v ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: 12, textTransform: 'capitalize' }}>
            {v === 'list' ? '☰ List View' : '📊 Gantt Chart'}
          </button>
        ))}
      </div>

      {/* Gantt Chart */}
      {view === 'gantt' && (
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>Interactive Production Gantt Chart</h3>
            <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Showing {gantt.length} scheduled jobs</span>
          </div>
          <GanttChart jobs={gantt} />
        </motion.div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order ID</th><th>Fabric Type</th><th>Placement</th><th>Progress</th>
                <th>Machine</th><th>Priority</th><th>Deadline</th>
                <th>Status</th>{canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => {
                const pct = job.totalMeters > 0 ? Math.round((job.completedMeters / job.totalMeters) * 100) : 0;
                const overdue = job.deadline && new Date(job.deadline) < new Date() && job.status !== 'Completed';
                return (
                  <tr key={job._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: job.color, flexShrink: 0 }} />
                        <div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{job.orderId}</span>
                          {job.clientName && <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{job.clientName}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{job.fabricType}</td>
                    <td>
                      <div style={{ fontSize: 11 }}>
                        <div style={{ color: 'var(--text-0)', fontWeight: 500 }}>{job.floor || '—'}</div>
                        {job.section && <div style={{ color: 'var(--text-2)' }}>{job.section}</div>}
                        {job.notes && <div style={{ color: 'var(--text-2)', fontStyle: 'italic', fontSize: 10 }}>{job.notes}</div>}
                      </div>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ flex: 1 }}>
                          <div className="progress-fill" style={{ width: `${pct}%`, background: job.color || 'var(--accent)' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-2)', minWidth: 28 }}>{pct}%</span>
                      </div>
                    </td>
                    <td>
                      {canEdit && job.status === 'Pending' ? (
                        <select className="form-input" style={{ padding: '4px 8px', fontSize: 11 }}
                          value={job.assignedMachine || ''}
                          onChange={e => assignMachine(job._id, e.target.value)}>
                          <option value="">Assign...</option>
                          {machines.filter(m => m.status === 'Idle').map(m => <option key={m.machineId} value={m.machineId}>{m.machineId}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{job.assignedMachine || '—'}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[1, 2, 3].map(p => <div key={p} style={{ width: 8, height: 8, borderRadius: 2, background: p <= job.priority ? 'var(--yellow)' : 'var(--bg-3)' }} />)}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: overdue ? 'var(--red)' : 'var(--text-2)' }}>
                        {job.deadline ? new Date(job.deadline).toLocaleDateString('en-IN') : '—'}
                        {overdue && ' ⚠'}
                      </span>
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[job.status]}`}>{job.status}</span></td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {job.status === 'In-Progress' && (
                            <button className="btn btn-ghost" onClick={() => updateStatus(job._id, 'Completed')} style={{ padding: '3px 8px', fontSize: 11 }}>✓</button>
                          )}
                          <button className="btn btn-danger" onClick={() => deleteJob(job._id)} style={{ padding: '3px 8px', fontSize: 11 }}>✕</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Job Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>New Production Job</h3>
            <form onSubmit={createJob}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Order ID</label>
                  <input className="form-input" value={form.orderId} onChange={e => setForm({ ...form, orderId: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Fabric Type</label>
                  <input className="form-input" value={form.fabricType} onChange={e => setForm({ ...form, fabricType: e.target.value })} required />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Total Meters</label>
                  <input type="number" className="form-input" value={form.totalMeters} onChange={e => setForm({ ...form, totalMeters: +e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Estimated Hours</label>
                  <input type="number" className="form-input" value={form.estimatedHours} onChange={e => setForm({ ...form, estimatedHours: +e.target.value })} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Priority (1=High)</label>
                  <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: +e.target.value })}>
                    <option value={1}>1 - High</option>
                    <option value={2}>2 - Medium</option>
                    <option value={3}>3 - Low</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline</label>
                  <input type="date" className="form-input" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Job Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#a855f7', '#00d4ff', '#ff6b35'].map(c => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid white' : 'none', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              {/* Placement fields */}
              <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📍 Placement & Assignment</div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Floor</label>
                    <select className="form-input" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })}>
                      {['Floor A', 'Floor B', 'Floor C', 'Dye House', 'Finishing Unit'].map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Section / Bay</label>
                    <input className="form-input" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="e.g. Bay 3, Section B"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Client Name</label>
                    <input className="form-input" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} placeholder="e.g. Rajasthan Garments"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <input className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Special instructions..."/>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Create Job</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
