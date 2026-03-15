import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import API from '../utils/api';
import { useSocketEvent } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';

const LOAD_COLOR = {
  OVERLOADED: '#ff4757',
  NORMAL: '#00e676',
  UNDERLOADED: '#ffd32a',
  IDLE: '#4a6080'
};

export default function EnergyPage() {
  const [report, setReport] = useState(null);
  const [load, setLoad] = useState(null);
  const [period, setPeriod] = useState(24);
  const [loading, setLoading] = useState(true);
  const [loadAlert, setLoadAlert] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [switchMsg, setSwitchMsg] = useState('');
  const [selectedForSwitch, setSelectedForSwitch] = useState([]);
  const { user } = useAuth();
  const canEdit = user?.role !== 'worker';

  useSocketEvent('load_alert', (data) => {
    setLoadAlert(data);
    setTimeout(() => setLoadAlert(null), 8000);
  });

  useSocketEvent('sensor_stream', () => {
    // Refresh load data every ~10s (debounce via counter)
  });

  useSocketEvent('machine_updated', () => {
    loadData();
  });

  const loadData = async () => {
    try {
      const [r, l] = await Promise.all([
        API.get('/energy/report?hours=' + period),
        API.get('/energy/load')
      ]);
      setReport(r.data);
      setLoad(l.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    loadData();
    const interval = setInterval(loadData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [period]);

  const toggleSwitch = (machineId) => {
    setSelectedForSwitch(prev =>
      prev.includes(machineId)
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    );
  };

  const executeSwitchOff = async () => {
    if (!selectedForSwitch.length) return;
    setSwitching(true);
    try {
      const { data } = await API.post('/energy/auto-switch', {
        machineIds: selectedForSwitch,
        action: 'off'
      });
      setSwitchMsg('✅ ' + data.msg);
      setSelectedForSwitch([]);
      setTimeout(() => setSwitchMsg(''), 4000);
      loadData();
    } catch (e) {
      setSwitchMsg('❌ Switch failed: ' + (e.response?.data?.msg || e.message));
    }
    setSwitching(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-2)' }}>
      ⚡ Loading energy data...
    </div>
  );

  const { summary = {}, byMachine = [], hourlyTrend = [], liveLoads = [] } = report || {};
  const { loads = [], totalKw = 0, overloadedCount = 0, switchOffCandidates = [] } = load || {};

  const pieData = [
    { name: 'Running', value: load?.runningCount || 0, color: '#00e676' },
    { name: 'Idle', value: load?.idleCount || 0, color: '#4a6080' },
  ].filter(d => d.value > 0);

  const totalSavings = switchOffCandidates.reduce((s, c) => s + (c.savingsKwh || 0), 0);

  return (
    <div>
      {/* Load alert banner */}
      <AnimatePresence>
        {loadAlert && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid var(--yellow)', borderRadius: 10,
              padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--yellow)', fontSize: 14 }}>LOAD IMBALANCE</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{loadAlert.msg}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {switchMsg && (
        <div className={'alert ' + (switchMsg.startsWith('✅') ? 'alert-success' : 'alert-error')} style={{ marginBottom: 16 }}>
          {switchMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Energy & Load Management</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>Live consumption · Load distribution · Auto machine switching</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[6, 12, 24, 48].map(h => (
            <button key={h} className={'btn ' + (period === h ? 'btn-primary' : 'btn-ghost')}
              onClick={() => setPeriod(h)} style={{ padding: '6px 14px', fontSize: 12 }}>{h}h</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { l: 'Total Energy', v: (summary.totalKwh || 0) + ' kWh', c: 'var(--accent)', sub: summary.period },
          { l: 'Est. Cost', v: '₹' + (summary.estimatedCost || 0).toLocaleString('en-IN'), c: 'var(--yellow)', sub: (summary.costPerKwh || 8) + '/kWh' },
          { l: 'Current Load', v: (summary.currentTotalKw || 0) + ' kW', c: 'var(--green)', sub: (summary.runningMachines || 0) + ' machines running' },
          { l: 'Overloaded', v: overloadedCount, c: overloadedCount > 0 ? 'var(--red)' : 'var(--green)', sub: overloadedCount > 0 ? '⚠ Redistribute load' : '✓ Load balanced' },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: s.c, marginTop: 6 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>{s.sub}</div>
            {s.l === 'Current Load' && (
              <span className={'badge ' + (summary.isPeakHour ? 'badge-red' : 'badge-green')} style={{ marginTop: 8 }}>
                {summary.isPeakHour ? '🔴 PEAK' : '🟢 OFF-PEAK'}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Hourly trend */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Hourly Energy Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hourlyTrend}>
              <defs>
                <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-2)' }}
                tickFormatter={v => { const parts = v.split(' '); return parts[1] || v; }}
                interval="preserveStartEnd"/>
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-2)' }} unit="kW"/>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 11 }}
                formatter={v => [v + ' kW', 'Avg Power']}/>
              <Area type="monotone" dataKey="avgKw" stroke="#00d4ff" fill="url(#energyGrad)" strokeWidth={2} name="Avg kW"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Live load distribution */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Live Load Distribution</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} dataKey="value" paddingAngle={4}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>
                {(load?.totalKw || 0).toFixed(1)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>kW total load</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
                Avg {(load?.avgKwPerMachine || 0).toFixed(2)} kW/machine
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 130, overflowY: 'auto' }}>
            {loads.slice(0, 8).map(m => (
              <div key={m.machineId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 10px', background: 'var(--bg-2)', borderRadius: 6 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{m.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 6 }}>{m.location}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: LOAD_COLOR[m.loadStatus] }}>
                    {m.energyKw} kW
                  </span>
                  <span className={'badge ' + (
                    m.loadStatus === 'OVERLOADED' ? 'badge-red' :
                    m.loadStatus === 'NORMAL' ? 'badge-green' :
                    m.loadStatus === 'UNDERLOADED' ? 'badge-yellow' : 'badge-blue'
                  )} style={{ fontSize: 9 }}>{m.loadStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SMART SWITCH-OFF RECOMMENDATIONS ── */}
      {switchOffCandidates.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(0,212,255,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
                💡 Smart Load Optimization — Switch-Off Recommendations
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                These machines are idle or underloaded. Switching them off saves ~{totalSavings.toFixed(2)} kWh/hour
                (₹{(totalSavings * (summary.isPeakHour ? 8 : 5)).toFixed(0)}/hr).
              </p>
            </div>
            {canEdit && selectedForSwitch.length > 0 && (
              <button className="btn btn-primary" onClick={executeSwitchOff} disabled={switching}
                style={{ fontSize: 12, background: 'var(--yellow)', color: '#000' }}>
                {switching ? '⏳ Switching...' : '⚡ Power Off Selected (' + selectedForSwitch.length + ')'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {switchOffCandidates.map(c => {
              const isSelected = selectedForSwitch.includes(c.machineId);
              return (
                <div key={c.machineId} onClick={() => canEdit && toggleSwitch(c.machineId)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: isSelected ? 'rgba(0,212,255,0.08)' : 'var(--bg-2)',
                    border: '1px solid ' + (isSelected ? 'var(--accent)' : 'var(--border)'),
                    borderRadius: 10, cursor: canEdit ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4,
                      background: isSelected ? 'var(--accent)' : 'var(--bg-3)',
                      border: '2px solid ' + (isSelected ? 'var(--accent)' : 'var(--border-bright)'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#000' }}>
                      {isSelected ? '✓' : ''}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.machineId}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{c.reason}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)', fontSize: 18 }}>
                        -{c.savingsKwh} kWh
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>saved/hour</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--yellow)', fontSize: 16 }}>
                        ₹{(c.savingsKwh * (summary.isPeakHour ? 8 : 5)).toFixed(0)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>₹/hour saved</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {canEdit && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-2)' }}>
              ✓ Click machines to select · Then click "Power Off Selected"
            </div>
          )}
        </div>
      )}

      {/* Energy per machine */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Energy per Machine (kWh)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byMachine.slice(0, 8)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--text-2)' }} unit="kWh"/>
              <YAxis type="category" dataKey="machineId" tick={{ fontSize: 9, fill: 'var(--text-2)' }} width={65}/>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 11 }}
                formatter={v => [v + ' kWh', 'Consumed']}/>
              <Bar dataKey="totalKwh" radius={[0, 4, 4, 0]}>
                {byMachine.slice(0, 8).map((_, i) => (
                  <Cell key={i} fill={['#00d4ff','#00e676','#f59e0b','#a855f7','#f43f5e','#ff6b35'][i % 6]}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Cost Breakdown</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Machine</th><th>kWh</th><th>Cost (₹)</th><th>Anomalies</th></tr></thead>
              <tbody>
                {byMachine.slice(0, 8).map(m => (
                  <tr key={m.machineId}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{m.machineId}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{m.totalKwh}</td>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--yellow)' }}>₹{m.cost}</td>
                    <td>
                      {m.anomalies > 0
                        ? <span className="badge badge-red">{m.anomalies}</span>
                        : <span className="badge badge-green">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Total ({summary.period})</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--yellow)' }}>
              ₹{(summary.estimatedCost || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Optimization tips */}
      <div className="card">
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 14 }}>⚡ Energy Optimization Tips</h3>
        <div className="grid-3">
          {[
            {
              icon: '🌙',
              title: 'Schedule Off-Peak',
              desc: 'Run heavy dyeing/finishing jobs after 10pm. Current rate: ' + (summary.isPeakHour ? '₹8/kWh (PEAK — consider deferring)' : '₹5/kWh (OFF-PEAK — ideal time to run)')
            },
            {
              icon: '⚖️',
              title: 'Load Balance',
              desc: overloadedCount > 0
                ? overloadedCount + ' machines are overloaded. Shift jobs to idle machines to avoid motor strain and energy spikes.'
                : 'Load is well balanced across all running machines. Good distribution!'
            },
            {
              icon: '🔧',
              title: 'Maintenance Saves Energy',
              desc: 'Machines with health <70% consume 15–25% more energy. Scheduled maintenance reduces energy waste significantly.'
            }
          ].map(tip => (
            <div key={tip.title} style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{tip.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{tip.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{tip.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
