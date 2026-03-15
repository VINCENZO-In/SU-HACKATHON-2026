import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';
import API from '../utils/api';
import { useSocketEvent } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';

const URGENCY_CONFIG = {
  OVERDUE:  { color: '#ff4757', badge: 'badge-red',    icon: '🔴', label: 'OVERDUE' },
  CRITICAL: { color: '#ff4757', badge: 'badge-red',    icon: '🚨', label: 'CRITICAL' },
  WARNING:  { color: '#ffd32a', badge: 'badge-yellow', icon: '⚠️', label: 'WARNING' },
  UPCOMING: { color: '#00d4ff', badge: 'badge-blue',   icon: '🔔', label: 'UPCOMING' },
  OK:       { color: '#00e676', badge: 'badge-green',  icon: '✅', label: 'OK' },
};

function HealthGauge({ score }) {
  const color = score > 75 ? '#00e676' : score > 50 ? '#ffd32a' : '#ff4757';
  const data = [{ value: score, fill: color }, { value: 100 - score, fill: 'transparent' }];
  return (
    <div style={{ position: 'relative', width: 100, height: 100 }}>
      <RadialBarChart width={100} height={100} cx={50} cy={50} innerRadius={30} outerRadius={45}
        data={[{ value: score, fill: color }]} startAngle={90} endAngle={-270}>
        <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'var(--bg-3)' }} />
      </RadialBarChart>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:18, color }}>{score?.toFixed(0)}%</div>
        <div style={{ fontSize:9, color:'var(--text-2)' }}>HEALTH</div>
      </div>
    </div>
  );
}

function MachineCard({ m, onLogMaintenance, canEdit }) {
  const uc = URGENCY_CONFIG[m.urgency] || URGENCY_CONFIG.OK;
  const isAlert = m.urgency === 'CRITICAL' || m.urgency === 'OVERDUE';

  return (
    <motion.div className="card" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      style={{ borderColor: isAlert ? 'rgba(255,71,87,0.3)' : m.urgency==='WARNING' ? 'rgba(255,211,42,0.2)' : 'var(--border)',
               boxShadow: isAlert ? '0 0 20px rgba(255,71,87,0.08)' : 'none' }}>

      {/* Alert banner */}
      {isAlert && (
        <div style={{ background:'rgba(255,71,87,0.08)', borderRadius:6, padding:'6px 12px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ animation:'pulse-dot 1s infinite', display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--red)' }}/>
          <span style={{ fontSize:12, color:'var(--red)', fontWeight:600 }}>
            {m.urgency === 'OVERDUE' ? 'MAINTENANCE OVERDUE — Stop machine immediately' : `CRITICAL — Service in ${m.hoursRemaining}h`}
          </span>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:17, fontWeight:700 }}>{m.name}</div>
          <div style={{ fontSize:11, color:'var(--text-2)', fontFamily:'var(--font-mono)', marginTop:2 }}>
            {m.machineId} · {m.type} · {m.location}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span className={`badge ${uc.badge}`}>{uc.icon} {uc.label}</span>
        </div>
      </div>

      <div style={{ display:'flex', gap:16, marginBottom:16, alignItems:'center' }}>
        <HealthGauge score={m.healthScore || 0} />
        <div style={{ flex:1 }}>
          {/* Runtime progress */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:11, color:'var(--text-2)' }}>RUNTIME TO SERVICE</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color: uc.color }}>
                {m.hoursRemaining}h remaining
              </span>
            </div>
            <div className="progress-bar" style={{ height:8 }}>
              <div className="progress-fill" style={{
                width: `${m.progressPct}%`,
                background: `linear-gradient(90deg, var(--green), ${uc.color})`
              }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
              <span style={{ fontSize:10, color:'var(--text-2)' }}>0h</span>
              <span style={{ fontSize:10, color:'var(--text-2)' }}>{m.serviceThreshold}h service interval</span>
            </div>
          </div>

          <div className="grid-2" style={{ gap:8 }}>
            {[
              ['Total Runtime', `${m.totalRuntimeHours?.toFixed(0)}h`],
              ['Days to Service', `${m.daysRemaining} days`],
              ['Last Service', m.lastServiceDate ? new Date(m.lastServiceDate).toLocaleDateString('en-IN') : 'Never'],
              ['Next Service', m.predictedServiceDate ? new Date(m.predictedServiceDate).toLocaleDateString('en-IN') : '—'],
            ].map(([l,v]) => (
              <div key={l} style={{ background:'var(--bg-2)', borderRadius:6, padding:'6px 10px' }}>
                <div style={{ fontSize:10, color:'var(--text-2)' }}>{l}</div>
                <div style={{ fontSize:13, fontWeight:600, marginTop:1 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Maintenance history */}
      {m.maintenanceLogs?.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:'var(--text-2)', marginBottom:6 }}>RECENT MAINTENANCE</div>
          {m.maintenanceLogs.slice(-2).reverse().map((log, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'var(--bg-2)', borderRadius:6, marginBottom:4, fontSize:12 }}>
              <div>
                <span className={`badge ${log.type==='Emergency'?'badge-red':log.type==='Inspection'?'badge-blue':'badge-green'}`} style={{ marginRight:6 }}>{log.type}</span>
                {log.description}
              </div>
              <div style={{ color:'var(--text-2)', fontSize:11 }}>
                {new Date(log.date).toLocaleDateString('en-IN')} · {log.performedBy}
                {log.cost > 0 && <span style={{ color:'var(--yellow)', marginLeft:6 }}>₹{log.cost}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <button className="btn btn-primary" onClick={() => onLogMaintenance(m)}
          style={{ width:'100%', justifyContent:'center', fontSize:12 }}>
          🔧 Log Maintenance
        </button>
      )}
    </motion.div>
  );
}

export default function MaintenancePage() {
  const [machines, setMachines] = useState([]);
  const [summary, setSummary] = useState({});
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [logModal, setLogModal] = useState(null);
  const [logForm, setLogForm] = useState({ type:'Scheduled', description:'', performedBy:'', cost:'' });
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const { user } = useAuth();
  const canEdit = user?.role !== 'worker';

  const load = async () => {
    const [ms, sum] = await Promise.all([API.get('/maintenance'), API.get('/maintenance/summary')]);
    setMachines(ms.data);
    setSummary(sum.data);
  };

  useEffect(() => { load(); }, []);

  // Auto-check alerts every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => API.get('/maintenance/check-alerts').catch(()=>{}), 30000);
    return () => clearInterval(interval);
  }, []);

  useSocketEvent('maintenance_alert', (data) => {
    const id = Date.now();
    setLiveAlerts(prev => [...prev.slice(-4), { ...data, id }]);
    load(); // refresh machine list
    setTimeout(() => setLiveAlerts(prev => prev.filter(a => a.id !== id)), 12000);
  });

  useSocketEvent('maintenance_logged', () => load());

  const openDetail = async (machineId) => {
    setSelected(machineId);
    const { data } = await API.get(`/maintenance/${machineId}`);
    setDetail(data);
  };

  const openLogModal = (m) => {
    setLogModal(m);
    setLogForm({ type:'Scheduled', description:'', performedBy:user?.name || '', cost:'' });
  };

  const submitLog = async (e) => {
    e.preventDefault();
    await API.post(`/maintenance/${logModal.machineId}/log`, logForm);
    setLogModal(null);
    load();
    if (selected === logModal.machineId) openDetail(logModal.machineId);
  };

  const filtered = filter === 'ALL' ? machines : machines.filter(m => m.urgency === filter);

  return (
    <div>
      {/* Live Alert Toasts */}
      <div style={{ position:'fixed', top:70, right:20, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
        <AnimatePresence>
          {liveAlerts.map(a => (
            <motion.div key={a.id} initial={{ opacity:0, x:80 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:80 }}
              style={{ background:'var(--bg-card)', border:`2px solid ${a.urgency==='CRITICAL'||a.urgency==='OVERDUE'?'var(--red)':'var(--yellow)'}`,
                borderRadius:10, padding:'12px 18px', maxWidth:340, boxShadow:'0 8px 32px rgba(255,71,87,0.2)' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:14,
                color: a.urgency==='CRITICAL'||a.urgency==='OVERDUE' ? 'var(--red)' : 'var(--yellow)' }}>
                🔧 MAINTENANCE ALERT — {a.urgency}
              </div>
              <div style={{ fontSize:13, color:'var(--text-1)', marginTop:4 }}>{a.name}</div>
              <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>
                {a.hoursRemaining}h remaining · {a.daysRemaining} days
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700 }}>Machine Maintenance</h1>
          <p style={{ color:'var(--text-2)', fontSize:13, marginTop:4 }}>Runtime tracking, predictive alerts & service logs</p>
        </div>
        <button className="btn btn-ghost" onClick={() => API.get('/maintenance/check-alerts').then(()=>load())} style={{ fontSize:12 }}>
          🔍 Check All Alerts
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid-4" style={{ marginBottom:24 }}>
        {[
          { l:'Overdue', v: summary.overdue||0, c:'var(--red)', u:'OVERDUE' },
          { l:'Critical', v: summary.critical||0, c:'var(--red)', u:'CRITICAL' },
          { l:'Warning', v: summary.warning||0, c:'var(--yellow)', u:'WARNING' },
          { l:'OK', v: summary.ok||0, c:'var(--green)', u:'OK' },
        ].map(s => (
          <div key={s.l} className="stat-card" onClick={() => setFilter(filter===s.u?'ALL':s.u)}
            style={{ cursor:'pointer', borderColor: filter===s.u ? s.c : 'var(--border)', transition:'all 0.2s' }}>
            <div style={{ fontSize:11, color:'var(--text-2)' }}>{s.l}</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:36, fontWeight:700, color:s.c, marginTop:6 }}>{s.v}</div>
            <div style={{ fontSize:11, color:'var(--text-2)', marginTop:4 }}>machines</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap:20 }}>
        {/* Machine list */}
        <div>
          {filter !== 'ALL' && (
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <span style={{ fontSize:13, color:'var(--text-2)' }}>Showing: <strong style={{ color:'var(--text-0)' }}>{filter}</strong></span>
              <button className="btn btn-ghost" onClick={() => setFilter('ALL')} style={{ fontSize:11, padding:'4px 10px' }}>Clear filter</button>
            </div>
          )}
          <div className="grid-2">
            {filtered.map(m => (
              <div key={m.machineId} onClick={() => openDetail(m.machineId)}
                style={{ cursor:'pointer', outline: selected===m.machineId ? '2px solid var(--accent)' : 'none', borderRadius:14 }}>
                <MachineCard m={m} onLogMaintenance={openLogModal} canEdit={canEdit} />
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selected && detail && (
          <motion.div initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }}
            style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, padding:20, height:'fit-content', position:'sticky', top:80 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:17 }}>{detail.machine.name}</h3>
              <button onClick={() => { setSelected(null); setDetail(null); }}
                style={{ background:'transparent', border:'none', color:'var(--text-2)', cursor:'pointer', fontSize:18 }}>✕</button>
            </div>

            {/* Sensor trend */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:8 }}>SENSOR TREND (Last 50 readings)</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={detail.sensorTrend}>
                  <XAxis hide />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', fontSize:11 }} />
                  <Line type="monotone" dataKey="temperature" stroke="#f43f5e" dot={false} strokeWidth={2} name="Temp °C" />
                  <Line type="monotone" dataKey="vibration" stroke="#00d4ff" dot={false} strokeWidth={1.5} name="Vibration" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', gap:12, marginTop:4 }}>
                <span style={{ fontSize:11, color:'#f43f5e' }}>● Temperature</span>
                <span style={{ fontSize:11, color:'#00d4ff' }}>● Vibration</span>
                {detail.anomalies24h > 0 && (
                  <span style={{ fontSize:11, color:'var(--red)' }}>⚠ {detail.anomalies24h} anomalies (24h)</span>
                )}
              </div>
            </div>

            {/* Key stats */}
            <div className="grid-2" style={{ gap:8, marginBottom:16 }}>
              {[
                ['Runtime', `${detail.machine.totalRuntimeHours?.toFixed(0)}h`],
                ['Health', `${detail.machine.healthScore?.toFixed(0)}%`],
                ['Hours Left', `${detail.maintenance.hoursRemaining}h`],
                ['Service Due', new Date(detail.maintenance.predictedServiceDate).toLocaleDateString('en-IN')],
              ].map(([l,v]) => (
                <div key={l} style={{ background:'var(--bg-2)', borderRadius:6, padding:'8px 10px' }}>
                  <div style={{ fontSize:10, color:'var(--text-2)' }}>{l}</div>
                  <div style={{ fontSize:14, fontWeight:600, marginTop:2 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Maintenance log history */}
            <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:8 }}>ALL MAINTENANCE LOGS</div>
            <div style={{ maxHeight:200, overflowY:'auto', marginBottom:12 }}>
              {detail.machine.maintenanceLogs?.length > 0 ? (
                [...detail.machine.maintenanceLogs].reverse().map((log, i) => (
                  <div key={i} style={{ borderBottom:'1px solid var(--border)', padding:'8px 0', fontSize:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span className={`badge ${log.type==='Emergency'?'badge-red':log.type==='Inspection'?'badge-blue':'badge-green'}`}>{log.type}</span>
                      <span style={{ color:'var(--text-2)' }}>{new Date(log.date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div style={{ color:'var(--text-1)', marginTop:4 }}>{log.description}</div>
                    <div style={{ color:'var(--text-2)', marginTop:2 }}>By: {log.performedBy} · {log.hoursAtService?.toFixed(0)}h · ₹{log.cost}</div>
                  </div>
                ))
              ) : (
                <div style={{ color:'var(--text-2)', fontSize:12, padding:'12px 0' }}>No maintenance logs yet</div>
              )}
            </div>

            {canEdit && (
              <button className="btn btn-primary" onClick={() => openLogModal(detail.machine)}
                style={{ width:'100%', justifyContent:'center' }}>🔧 Log Maintenance</button>
            )}
          </motion.div>
        )}
      </div>

      {/* Log Maintenance Modal */}
      {logModal && (
        <div className="modal-overlay" onClick={() => setLogModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:600, marginBottom:6 }}>Log Maintenance</h3>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:20 }}>{logModal.name} — {logModal.machineId}</div>
            <form onSubmit={submitLog}>
              <div className="form-group">
                <label className="form-label">Maintenance Type</label>
                <select className="form-input" value={logForm.type} onChange={e => setLogForm({...logForm, type:e.target.value})}>
                  <option>Scheduled</option>
                  <option>Emergency</option>
                  <option>Inspection</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={logForm.description}
                  onChange={e => setLogForm({...logForm, description:e.target.value})}
                  placeholder="e.g. Replaced worn bearings, oiled gears..." required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Performed By</label>
                  <input className="form-input" value={logForm.performedBy}
                    onChange={e => setLogForm({...logForm, performedBy:e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost (₹)</label>
                  <input type="number" className="form-input" value={logForm.cost}
                    onChange={e => setLogForm({...logForm, cost:e.target.value})} placeholder="0" />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1, justifyContent:'center' }}>✅ Save & Reset Timer</button>
                <button type="button" className="btn btn-ghost" onClick={() => setLogModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
