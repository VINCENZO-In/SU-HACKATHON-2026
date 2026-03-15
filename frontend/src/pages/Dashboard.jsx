import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import API from '../utils/api';
import { useSocketEvent } from '../hooks/useSocket';

const COLORS = ['#00d4ff', '#00e676', '#f59e0b', '#f43f5e', '#a855f7'];

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }) };

export default function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [quality, setQuality] = useState({ total: 0, gradeA: 0, rejected: 0, passRate: 0, defectTypes: [] });
  const [cashflow, setCashflow] = useState({ expectedInflow: 0, expectedOutflow: 0, net: 0 });
  const [sensorStream, setSensorStream] = useState([]);
  const [loading, setLoading] = useState(true);

  useSocketEvent('sensor_stream', (data) => {
    setSensorStream(prev => {
      const updated = [...prev.filter(s => s.machineId !== data.machineId || prev.indexOf(s) < prev.length - 10), data];
      return updated.slice(-20);
    });
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [m, j, o, q, cf] = await Promise.all([
          API.get('/machines'), API.get('/jobs'), API.get('/orders'),
          API.get('/quality/stats'), API.get('/orders/cashflow')
        ]);
        setMachines(m.data);
        setJobs(j.data);
        setOrders(o.data);
        setQuality(q.data);
        setCashflow(cf.data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const running = machines.filter(m => m.status === 'Running').length;
  const idle = machines.filter(m => m.status === 'Idle').length;
  const maintenance = machines.filter(m => m.status === 'Maintenance').length;
  const activeJobs = jobs.filter(j => j.status === 'In-Progress').length;

  const machineStatusData = [
    { name: 'Running', value: running },
    { name: 'Idle', value: idle },
    { name: 'Maintenance', value: maintenance },
  ].filter(d => d.value > 0);

  const recentSensorData = sensorStream.slice(-10).map((s, i) => ({ i, ...s }));

  const statCards = [
    { label: 'Total Machines', value: machines.length, sub: `${running} Running`, color: 'var(--accent)', icon: '⚙' },
    { label: 'Active Jobs', value: activeJobs, sub: `${jobs.filter(j => j.status === 'Pending').length} Pending`, color: 'var(--yellow)', icon: '🏭' },
    { label: 'Orders', value: orders.length, sub: `${orders.filter(o => o.paymentStatus === 'Unpaid').length} Unpaid`, color: 'var(--green)', icon: '📋' },
    { label: 'Quality Pass Rate', value: `${quality.passRate}%`, sub: `${quality.rejected} Rejected`, color: 'var(--purple)', icon: '✅' },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧵</div>
        <div style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading factory data...</div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '0.04em' }}>Factory Control Center</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>Real-time overview of all factory operations</p>
      </div>

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {statCards.map((s, i) => (
          <motion.div key={s.label} className="stat-card" custom={i} variants={fadeUp} initial="hidden" animate="show">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-0)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Live Sensor Stream */}
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>Live IoT Sensor Stream</h3>
              <p style={{ fontSize: 11, color: 'var(--text-2)' }}>Real-time machine telemetry</p>
            </div>
            <span style={{ fontSize: 10, color: 'var(--green)', border: '1px solid var(--green)', padding: '2px 8px', borderRadius: 10, fontFamily: 'var(--font-mono)' }}>● LIVE</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={recentSensorData}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="vibGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="i" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Area type="monotone" dataKey="temperature" stroke="#f43f5e" fill="url(#tempGrad)" name="Temp °C" strokeWidth={2} />
              <Area type="monotone" dataKey="vibration" stroke="#00d4ff" fill="url(#vibGrad)" name="Vibration" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#f43f5e' }}>● Temperature</span>
            <span style={{ fontSize: 11, color: '#00d4ff' }}>● Vibration</span>
          </div>
        </motion.div>

        {/* Machine Status Pie */}
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Machine Status</h3>
          <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 16 }}>Fleet utilization overview</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ResponsiveContainer width={150} height={150}>
              <PieChart>
                <Pie data={machineStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                  {machineStatusData.map((_, i) => <Cell key={i} fill={[COLORS[0], COLORS[2], COLORS[3]][i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {[{ l: 'Running', v: running, c: 'var(--accent)' }, { l: 'Idle', v: idle, c: 'var(--yellow)' }, { l: 'Maintenance', v: maintenance, c: 'var(--red)' }].map(s => (
                <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.c }} />
                    <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{s.l}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: s.c, fontSize: 18 }}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Second row */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Cash Flow */}
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Cash Flow (30 Days)</h3>
          <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 16 }}>Expected inflows vs outflows</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { l: 'Inflow', v: cashflow.expectedInflow, c: 'var(--green)' },
              { l: 'Outflow', v: cashflow.expectedOutflow, c: 'var(--red)' },
            ].map(s => (
              <div key={s.l} style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.l}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: s.c }}>₹{s.v.toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Net Position</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: cashflow.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
              ₹{Math.abs(cashflow.net).toLocaleString('en-IN')} {cashflow.net >= 0 ? '↑' : '↓'}
            </div>
            <span className={`badge ${cashflow.riskLevel === 'SAFE' ? 'badge-green' : 'badge-red'}`}>{cashflow.riskLevel}</span>
          </div>
        </motion.div>

        {/* Quality Defect Types */}
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Defect Analysis</h3>
          <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 16 }}>Top defect categories detected</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={quality.defectTypes?.slice(0, 6) || []} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="_id" tick={{ fontSize: 11, fill: 'var(--text-2)' }} width={90} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }} />
              <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Active Jobs table */}
      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>Active Production Jobs</h3>
          <a href="/jobs" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>View All →</a>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Order ID</th><th>Fabric</th><th>Machine</th><th>Progress</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.filter(j => j.status === 'In-Progress').slice(0, 5).map(j => {
              const pct = j.totalMeters > 0 ? Math.round((j.completedMeters / j.totalMeters) * 100) : 0;
              return (
                <tr key={j._id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{j.orderId}</td>
                  <td>{j.fabricType}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{j.assignedMachine || '—'}</td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: j.color || 'var(--accent)' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-2)', minWidth: 30 }}>{pct}%</span>
                    </div>
                  </td>
                  <td><span className="badge badge-blue">In Progress</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
