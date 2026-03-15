import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import API from '../utils/api';

const COLORS = ['#00d4ff','#00e676','#f59e0b','#f43f5e','#a855f7','#ff6b35','#10b981','#ffd32a'];

function downloadCSV(data, filename) {
  if (!data || !data.length) return;
  const keys = Object.keys(data[0]);
  const rows = data.map(row => keys.map(k => '"' + String(row[k] ?? '').replace(/"/g, '""') + '"').join(','));
  const csv = [keys.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function printReport(title, data) {
  if (!data || !data.length) { alert('No data to print'); return; }
  const keys = Object.keys(data[0]);
  const tableRows = data.map(row =>
    '<tr>' + keys.map(k => '<td>' + String(row[k] ?? '') + '</td>').join('') + '</tr>'
  ).join('');
  const html = [
    '<!DOCTYPE html><html><head><title>' + title + '</title>',
    '<style>',
    'body{font-family:Arial,sans-serif;padding:24px;color:#111}',
    'h1{color:#1a2235;margin-bottom:4px}',
    'p{color:#666;font-size:13px;margin-bottom:16px}',
    'table{width:100%;border-collapse:collapse}',
    'th,td{border:1px solid #ddd;padding:8px 12px;font-size:12px;text-align:left}',
    'th{background:#f0f4ff;font-weight:700}',
    'tr:nth-child(even){background:#f8f9ff}',
    '@media print{button{display:none}}',
    '</style></head><body>',
    '<h1>' + title + '</h1>',
    '<p>Generated: ' + new Date().toLocaleString('en-IN') + '</p>',
    '<table><thead><tr>' + keys.map(k => '<th>' + k + '</th>').join('') + '</tr></thead>',
    '<tbody>' + tableRows + '</tbody></table>',
    '<br/><button onclick="window.print()">Print</button>',
    '</body></html>'
  ].join('');
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

export default function ReportsPage() {
  const [monthly, setMonthly] = useState([]);
  const [energy, setEnergy] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [activeTab, setActiveTab] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [energyPeriod, setEnergyPeriod] = useState(720);

  const load = async () => {
    try {
      const [m, e, p, l] = await Promise.all([
        API.get('/sales/monthly'),
        API.get('/energy/report?hours=' + energyPeriod),
        API.get('/sales/prediction'),
        API.get('/orders/ledger')
      ]);
      setMonthly(m.data.months || []);
      setEnergy(e.data);
      setPrediction(p.data);
      setLedger(l.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { setLoading(true); load(); }, [energyPeriod]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh', color:'var(--text-2)' }}>
      📊 Loading reports...
    </div>
  );

  const totalRevenue = monthly.reduce((s, m) => s + (m.revenue || 0), 0);
  const totalOrders = monthly.reduce((s, m) => s + (m.orders || 0), 0);
  const totalMeters = monthly.reduce((s, m) => s + (m.totalMeters || 0), 0);
  const totalCollected = monthly.reduce((s, m) => s + (m.paid || 0), 0);

  const tabs = [
    { id: 'monthly', label: '📅 Monthly' },
    { id: 'energy', label: '⚡ Energy' },
    { id: 'billing', label: '💰 Billing' },
    { id: 'prediction', label: '🔮 Prediction' },
  ];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700 }}>Reports & Analytics</h1>
          <p style={{ color:'var(--text-2)', fontSize:13, marginTop:4 }}>Monthly · Energy · Billing · Sales Prediction — all downloadable</p>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:24, background:'var(--bg-2)', padding:6, borderRadius:10, width:'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding:'8px 18px', borderRadius:8, border:'none', fontFamily:'var(--font-display)', fontWeight:600, fontSize:13, cursor:'pointer',
              background: activeTab===t.id ? 'var(--accent)' : 'transparent',
              color: activeTab===t.id ? '#000' : 'var(--text-1)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MONTHLY ── */}
      {activeTab === 'monthly' && (
        <div>
          <div className="grid-4" style={{ marginBottom:24 }}>
            {[
              { l:'Total Revenue (12m)', v:'₹' + totalRevenue.toLocaleString('en-IN'), c:'var(--green)' },
              { l:'Total Orders', v:totalOrders, c:'var(--accent)' },
              { l:'Meters Produced', v:totalMeters.toLocaleString() + ' m', c:'var(--yellow)' },
              { l:'Total Collected', v:'₹' + totalCollected.toLocaleString('en-IN'), c:'var(--purple)' },
            ].map(s => (
              <div key={s.l} className="stat-card">
                <div style={{ fontSize:11, color:'var(--text-2)' }}>{s.l}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:700, color:s.c, marginTop:6 }}>{s.v}</div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginBottom:20 }}>
            <div className="card">
              <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:15, marginBottom:16 }}>Monthly Revenue (₹)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00e676" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00e676" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize:10, fill:'var(--text-2)' }}/>
                  <YAxis tick={{ fontSize:10, fill:'var(--text-2)' }} tickFormatter={v => '₹' + (v/1000).toFixed(0) + 'k'}/>
                  <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', fontSize:11 }}
                    formatter={v => ['₹' + v.toLocaleString('en-IN'), 'Revenue']}/>
                  <Area type="monotone" dataKey="revenue" stroke="#00e676" fill="url(#revGrad)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:15, marginBottom:16 }}>Orders & Meters by Month</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthly}>
                  <XAxis dataKey="month" tick={{ fontSize:9, fill:'var(--text-2)' }}/>
                  <YAxis tick={{ fontSize:10, fill:'var(--text-2)' }}/>
                  <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', fontSize:11 }}/>
                  <Bar dataKey="orders" fill="#00d4ff" radius={[3,3,0,0]} name="Orders"/>
                  <Bar dataKey="totalMeters" fill="#f59e0b" radius={[3,3,0,0]} name="Meters" opacity={0.8}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:15 }}>Monthly Breakdown</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost" style={{ fontSize:12 }}
                  onClick={() => downloadCSV(monthly, 'monthly-report.csv')}>⬇ CSV</button>
                <button className="btn btn-ghost" style={{ fontSize:12 }}
                  onClick={() => downloadJSON(monthly, 'monthly-report.json')}>⬇ JSON</button>
                <button className="btn btn-primary" style={{ fontSize:12 }}
                  onClick={() => printReport('Monthly Sales Report', monthly.map(m => ({
                    Month: m.month, Orders: m.orders,
                    'Meters (m)': m.totalMeters,
                    'Revenue (₹)': m.revenue,
                    'Collected (₹)': m.paid,
                    'Collection %': m.revenue > 0 ? Math.round((m.paid/m.revenue)*100) + '%' : '0%'
                  })))}>🖨 Print / PDF</button>
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>Month</th><th>Orders</th><th>Meters</th><th>Revenue</th><th>Collected</th><th>Collection %</th></tr>
                </thead>
                <tbody>
                  {monthly.map(m => (
                    <tr key={m.month}>
                      <td style={{ fontWeight:500 }}>{m.month}</td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>{m.orders}</td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>{m.totalMeters.toLocaleString()} m</td>
                      <td style={{ fontFamily:'var(--font-display)', color:'var(--green)', fontWeight:600 }}>₹{m.revenue.toLocaleString('en-IN')}</td>
                      <td style={{ fontFamily:'var(--font-display)', color:'var(--accent)', fontWeight:600 }}>₹{m.paid.toLocaleString('en-IN')}</td>
                      <td>
                        <span className={'badge ' + (m.revenue > 0 && (m.paid/m.revenue) >= 0.8 ? 'badge-green' : m.revenue > 0 && (m.paid/m.revenue) >= 0.5 ? 'badge-yellow' : 'badge-red')}>
                          {m.revenue > 0 ? Math.round((m.paid/m.revenue)*100) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background:'rgba(0,212,255,0.05)', fontWeight:700 }}>
                    <td>TOTAL</td>
                    <td style={{ fontFamily:'var(--font-mono)' }}>{totalOrders}</td>
                    <td style={{ fontFamily:'var(--font-mono)' }}>{totalMeters.toLocaleString()} m</td>
                    <td style={{ color:'var(--green)', fontFamily:'var(--font-display)', fontWeight:700 }}>₹{totalRevenue.toLocaleString('en-IN')}</td>
                    <td style={{ color:'var(--accent)', fontFamily:'var(--font-display)', fontWeight:700 }}>₹{totalCollected.toLocaleString('en-IN')}</td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ENERGY ── */}
      {activeTab === 'energy' && energy && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            {[[168,'7 Days'],[336,'14 Days'],[720,'30 Days'],[2160,'90 Days']].map(([h,l]) => (
              <button key={h} className={'btn ' + (energyPeriod===h ? 'btn-primary' : 'btn-ghost')}
                onClick={() => setEnergyPeriod(h)} style={{ fontSize:12 }}>{l}</button>
            ))}
          </div>
          <div className="grid-4" style={{ marginBottom:24 }}>
            {[
              { l:'Total Consumed', v: energy.summary.totalKwh + ' kWh', c:'var(--accent)' },
              { l:'Estimated Cost', v:'₹' + energy.summary.estimatedCost.toLocaleString('en-IN'), c:'var(--yellow)' },
              { l:'Current Load', v: energy.summary.currentTotalKw + ' kW', c:'var(--green)' },
              { l:'Tariff Status', v: energy.summary.isPeakHour ? 'PEAK' : 'OFF-PEAK', c: energy.summary.isPeakHour ? 'var(--red)' : 'var(--green)' },
            ].map(s => (
              <div key={s.l} className="stat-card">
                <div style={{ fontSize:11, color:'var(--text-2)' }}>{s.l}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:700, color:s.c, marginTop:6 }}>{s.v}</div>
                {s.l === 'Tariff Status' && (
                  <div style={{ fontSize:11, color:'var(--text-2)', marginTop:4 }}>{energy.summary.peakStatus}</div>
                )}
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginBottom:20 }}>
            <div className="card">
              <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:15, marginBottom:16 }}>Hourly Energy Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={energy.hourlyTrend}>
                  <defs>
                    <linearGradient id="eGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fontSize:9, fill:'var(--text-2)' }} tickFormatter={v => v + 'h'}/>
                  <YAxis tick={{ fontSize:9, fill:'var(--text-2)' }} unit="kW"/>
                  <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', fontSize:11 }}/>
                  <Area type="monotone" dataKey="avgKw" stroke="#00d4ff" fill="url(#eGrad)" strokeWidth={2} name="Avg kW"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:15, marginBottom:16 }}>Cost per Machine</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={energy.byMachine.slice(0,8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize:9, fill:'var(--text-2)' }} tickFormatter={v => '₹' + v}/>
                  <YAxis type="category" dataKey="machineId" tick={{ fontSize:9, fill:'var(--text-2)' }} width={65}/>
                  <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', fontSize:11 }}
                    formatter={v => ['₹' + v, 'Cost']}/>
                  <Bar dataKey="cost" radius={[0,4,4,0]}>
                    {energy.byMachine.slice(0,8).map((_, i) => <Cell key={i} fill={COLORS[i % 8]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:15 }}>Machine Energy Breakdown</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost" style={{ fontSize:12 }}
                  onClick={() => downloadCSV(energy.byMachine, 'energy-report.csv')}>⬇ CSV</button>
                <button className="btn btn-primary" style={{ fontSize:12 }}
                  onClick={() => printReport('Energy Consumption Report', energy.byMachine.map(m => ({
                    Machine: m.machineId, 'Avg kW': m.avgKw, 'Max kW': m.maxKw,
                    'Total kWh': m.totalKwh, 'Cost (₹)': m.cost, Anomalies: m.anomalies
                  })))}>🖨 Print / PDF</button>
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>Machine</th><th>Avg kW</th><th>Max kW</th><th>Total kWh</th><th>Cost (₹)</th><th>Anomalies</th></tr>
                </thead>
                <tbody>
                  {energy.byMachine.map(m => (
                    <tr key={m.machineId}>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent)' }}>{m.machineId}</td>
                      <td>{m.avgKw}</td>
                      <td style={{ color:'var(--red)' }}>{m.maxKw}</td>
                      <td style={{ fontWeight:600 }}>{m.totalKwh}</td>
                      <td style={{ color:'var(--yellow)', fontWeight:600 }}>₹{m.cost}</td>
                      <td>{m.anomalies > 0 ? <span className="badge badge-red">{m.anomalies}</span> : <span className="badge badge-green">0</span>}</td>
                    </tr>
                  ))}
                  <tr style={{ background:'rgba(0,212,255,0.05)' }}>
                    <td style={{ fontWeight:700 }}>TOTAL</td><td/><td/>
                    <td style={{ fontWeight:700 }}>{energy.byMachine.reduce((s, m) => +(s + m.totalKwh).toFixed(2), 0)}</td>
                    <td style={{ color:'var(--yellow)', fontWeight:700 }}>₹{energy.summary.estimatedCost.toLocaleString('en-IN')}</td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── BILLING ── */}
      {activeTab === 'billing' && (
        <div>
          <div className="grid-4" style={{ marginBottom:24 }}>
            {[
              { l:'Total Inflow', v:'₹' + ledger.filter(l => l.type==='INFLOW').reduce((s,l) => s+l.amount,0).toLocaleString('en-IN'), c:'var(--green)' },
              { l:'Total Outflow', v:'₹' + ledger.filter(l => l.type==='OUTFLOW').reduce((s,l) => s+l.amount,0).toLocaleString('en-IN'), c:'var(--red)' },
              { l:'Completed', v:ledger.filter(l => l.status==='Completed').length, c:'var(--accent)' },
              { l:'Pending', v:ledger.filter(l => l.status==='Pending').length, c:'var(--yellow)' },
            ].map(s => (
              <div key={s.l} className="stat-card">
                <div style={{ fontSize:11, color:'var(--text-2)' }}>{s.l}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:700, color:s.c, marginTop:6 }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:15 }}>All Billing Entries</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost" style={{ fontSize:12 }}
                  onClick={() => downloadCSV(
                    ledger.map(l => ({ Type:l.type, Description:l.description, Party:l.party, Category:l.category, Amount:l.amount, DueDate:l.dueDate ? new Date(l.dueDate).toLocaleDateString('en-IN') : '', Status:l.status })),
                    'billing-report.csv'
                  )}>⬇ CSV</button>
                <button className="btn btn-primary" style={{ fontSize:12 }}
                  onClick={() => printReport('Billing Report',
                    ledger.map(l => ({ Type:l.type, Description:l.description, Party:l.party, 'Amount (Rs)':l.amount, Status:l.status, DueDate:l.dueDate ? new Date(l.dueDate).toLocaleDateString('en-IN') : '' }))
                  )}>🖨 Print / PDF</button>
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>Type</th><th>Description</th><th>Party</th><th>Category</th><th>Amount</th><th>Due Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {ledger.map(e => (
                    <tr key={e._id}>
                      <td><span className={'badge ' + (e.type==='INFLOW' ? 'badge-green' : 'badge-red')}>{e.type}</span></td>
                      <td style={{ fontSize:12 }}>{e.description}</td>
                      <td style={{ fontSize:12, color:'var(--text-2)' }}>{e.party}</td>
                      <td style={{ fontSize:12 }}>{e.category}</td>
                      <td style={{ fontFamily:'var(--font-display)', fontWeight:600, color:e.type==='INFLOW' ? 'var(--green)' : 'var(--red)' }}>
                        ₹{(e.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontSize:12, color:'var(--text-2)' }}>{e.dueDate ? new Date(e.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                      <td><span className={'badge ' + (e.status==='Completed' ? 'badge-green' : e.status==='Overdue' ? 'badge-red' : 'badge-yellow')}>{e.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PREDICTION ── */}
      {activeTab === 'prediction' && prediction && (
        <div>
          <div style={{ background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.15)', borderRadius:10, padding:16, marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:18 }}>Forecast: {prediction.nextMonth}</div>
              <div style={{ color:'var(--text-2)', fontSize:13, marginTop:4 }}>{prediction.recommendation}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:36, color:'var(--accent)' }}>{prediction.totalPredictedMeters.toLocaleString()} m</div>
              <div style={{ fontSize:12, color:'var(--text-2)' }}>total predicted production</div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:16 }}>
            {(prediction.predictions || []).map((p, pi) => (
              <div key={p.fabricType} className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16 }}>{p.fabricType}</div>
                    <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
                      <span className={'badge ' + (p.trend==='Growing' ? 'badge-green' : p.trend==='Declining' ? 'badge-red' : 'badge-blue')}>
                        {p.trend === 'Growing' ? '↑' : p.trend === 'Declining' ? '↓' : '→'} {p.trend}
                        {p.trendPct !== 0 ? ' (' + (p.trendPct > 0 ? '+' : '') + p.trendPct + '%)' : ''}
                      </span>
                      <span className="badge badge-blue">Confidence: {(p.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:28, color:'var(--accent)' }}>{p.predictedNextMonth} m</div>
                    <div style={{ fontSize:11, color:'var(--yellow)', marginTop:2 }}>Produce {p.suggestedProduction} m (10% buffer)</div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={p.monthlyHistory}>
                    <defs>
                      <linearGradient id={'pg' + pi} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[pi % 8]} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS[pi % 8]} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize:9, fill:'var(--text-2)' }}/>
                    <YAxis hide/>
                    <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', fontSize:11 }}
                      formatter={v => [v + ' m', 'Sales']}/>
                    <Area type="monotone" dataKey="sales" stroke={COLORS[pi % 8]} fill={'url(#pg' + pi + ')'} strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn btn-ghost" style={{ fontSize:12 }}
              onClick={() => downloadCSV(
                (prediction.predictions || []).map(p => ({ Fabric:p.fabricType, Predicted:p.predictedNextMonth, Suggested:p.suggestedProduction, Trend:p.trend, Confidence:p.confidence })),
                'sales-prediction.csv'
              )}>⬇ CSV</button>
            <button className="btn btn-primary" style={{ fontSize:12 }}
              onClick={() => printReport('Sales Prediction Report',
                (prediction.predictions || []).map(p => ({ Fabric:p.fabricType, 'Predicted (m)':p.predictedNextMonth, 'Suggested (m)':p.suggestedProduction, Trend:p.trend, Confidence:(p.confidence*100).toFixed(0)+'%' }))
              )}>🖨 Print / PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}
