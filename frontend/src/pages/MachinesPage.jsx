import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import API from '../utils/api';
import { useSocketEvent } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';

const statusColor = { Running: 'var(--green)', Idle: 'var(--yellow)', Maintenance: 'var(--red)', Fault: 'var(--orange)' };
const statusBadge = { Running: 'badge-green', Idle: 'badge-yellow', Maintenance: 'badge-red', Fault: 'badge-red' };

function MachineCard({ machine, onSimulate, canEdit }) {
  const health = machine.healthScore || 0;
  const healthColor = health > 75 ? 'var(--green)' : health > 50 ? 'var(--yellow)' : 'var(--red)';

  return (
    <motion.div className="card" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      style={{ borderColor: machine.status === 'Running' ? 'rgba(0,230,118,0.2)' : 'var(--border)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>{machine.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{machine.machineId} · {machine.type}</div>
        </div>
        <span className={`badge ${statusBadge[machine.status] || 'badge-blue'}`}>
          {machine.status === 'Running' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }}></span>}
          {machine.status}
        </span>
      </div>

      {/* Health Score */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>HEALTH SCORE</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: healthColor, fontSize: 18 }}>{health.toFixed(0)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${health}%`, background: `linear-gradient(90deg, ${healthColor}, ${healthColor}88)` }} />
        </div>
      </div>

      {/* Sensor readings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { l: 'Temp', v: `${(machine.temperature || 35).toFixed(1)}°C`, c: '#f43f5e' },
          { l: 'Vibration', v: (machine.vibration || 0.2).toFixed(3), c: '#00d4ff' },
          { l: 'Energy', v: `${(machine.energyKw || 3.5).toFixed(2)} kW`, c: '#f59e0b' },
          { l: 'RPM', v: machine.rpm?.toFixed(0) || '—', c: '#a855f7' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: s.c, fontWeight: 500 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Location & Runtime */}
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14 }}>
        📍 {machine.location} · ⏱ {machine.totalRuntimeHours}h runtime
      </div>

      {canEdit && (
        <button className="btn btn-ghost" onClick={() => onSimulate(machine.machineId)}
          style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
          ⚡ Simulate Sensor Reading
        </button>
      )}
    </motion.div>
  );
}

export default function MachinesPage() {
  const [machines, setMachines] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ machineId: '', name: '', type: 'Loom', location: 'Floor A', productionPerHour: 50 });
  const [msg, setMsg] = useState('');
  const { user } = useAuth();
  const canEdit = user?.role !== 'worker';

  const load = async () => {
    const { data } = await API.get('/machines');
    setMachines(data);
  };

  useEffect(() => { load(); }, []);

  useSocketEvent('machine_updated', (data) => {
    setMachines(prev => prev.map(m => m.machineId === data.machineId ? { ...m, ...data } : m));
  });

  useSocketEvent('sensor_stream', (data) => {
    setMachines(prev => prev.map(m => m.machineId === data.machineId
      ? { ...m, temperature: data.temperature, vibration: data.vibration, energyKw: data.energyKw, rpm: data.rpm }
      : m
    ));
  });

  const simulate = async (id) => {
    const { data } = await API.post(`/machines/${id}/simulate`);
    setMsg(`📡 Sensor data logged for ${id}: Temp ${data.temperature}°C, Vibration ${data.vibration}`);
    setTimeout(() => setMsg(''), 4000);
  };

  const loadForecast = async (id) => {
    const { data } = await API.get(`/machines/${id}/maintenance`);
    setForecast(data);
  };

  const addMachine = async (e) => {
    e.preventDefault();
    await API.post('/machines', form);
    setShowAddModal(false);
    setForm({ machineId: '', name: '', type: 'Loom', location: 'Floor A', productionPerHour: 50 });
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Machine Management</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>{machines.length} machines · {machines.filter(m => m.status === 'Running').length} running</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Machine</button>}
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}</div>}

      {/* Status summary */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {['Running', 'Idle', 'Maintenance', 'Fault'].map(s => {
          const count = machines.filter(m => m.status === s).length;
          return (
            <div key={s} className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor[s] }} />
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{s}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: statusColor[s], marginTop: 8 }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Machine Cards Grid */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {machines.map(m => <MachineCard key={m.machineId} machine={m} onSimulate={simulate} canEdit={canEdit} />)}
      </div>

      {/* Maintenance Forecasting */}
      <div className="card">
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, marginBottom: 16 }}>🔧 Predictive Maintenance Forecast</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {machines.map(m => (
            <button key={m.machineId} className="btn btn-ghost" onClick={() => loadForecast(m.machineId)} style={{ fontSize: 12 }}>
              {m.machineId}
            </button>
          ))}
        </div>
        {forecast && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 20, border: '1px solid var(--border)' }}>
            <div className="grid-4">
              {[
                { l: 'Machine', v: forecast.name || forecast.machineId },
                { l: 'Runtime Hours', v: `${forecast.currentHours}h` },
                { l: 'Until Next Service', v: `${forecast.hoursUntilNextService}h` },
                { l: 'Predicted Date', v: forecast.predictedServiceDate },
              ].map(s => (
                <div key={s.l}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <span className={`badge ${forecast.priority === 'HIGH' ? 'badge-red' : forecast.priority === 'MEDIUM' ? 'badge-yellow' : 'badge-green'}`}>
                {forecast.priority} PRIORITY
              </span>
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-2)' }}>
                Health Score: <strong style={{ color: forecast.healthScore > 75 ? 'var(--green)' : 'var(--yellow)' }}>{forecast.healthScore}%</strong>
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Add Machine Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Add New Machine</h3>
            <form onSubmit={addMachine}>
              {[['machineId', 'Machine ID (e.g. LOOM-07)'], ['name', 'Machine Name']].map(([k, p]) => (
                <div key={k} className="form-group">
                  <label className="form-label">{p}</label>
                  <input className="form-input" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} required />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {['Loom', 'Spinning', 'Dyeing', 'Cutting', 'Finishing'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Add Machine</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
