import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import API from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { useSocketEvent } from '../hooks/useSocket';
import CameraScanner from '../components/CameraScanner';

import { ML_SERVICE_URL } from '../utils/config';
const GRADE_COLOR  = { A:'var(--green)', B:'var(--accent)', C:'var(--yellow)', REJECT:'var(--red)' };
const GRADE_BADGE  = { A:'badge-green', B:'badge-blue', C:'badge-yellow', REJECT:'badge-red' };
const DEFECT_COLORS = {
  Hole:'#ff4757', Stain:'#ff6b35', BrokenYarn:'#ffd32a',
  Misweave:'#a855f7', OilSpot:'#06b6d4', ColorBleed:'#ec4899', Other:'#8fa8c8'
};
const DEFECT_TYPES = ['Hole','Stain','BrokenYarn','Misweave','OilSpot','ColorBleed','Other'];

function genBatchId() {
  const n = new Date();
  return 'BATCH-' + n.getFullYear()
    + String(n.getMonth()+1).padStart(2,'0')
    + String(n.getDate()).padStart(2,'0')
    + '-' + Math.floor(Math.random()*9000+1000);
}

export default function QualityPage() {
  const [logs, setLogs]       = useState([]);
  const [stats, setStats]     = useState({ total:0, gradeA:0, rejected:0, passRate:0, defectTypes:[] });
  const [mlOnline, setMlOnline]   = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detResult, setDetResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [liveAlert, setLiveAlert]  = useState(null);

  // Camera scanner state
  const [scannerOpen, setScannerOpen]     = useState(false);
  const [scannerField, setScannerField]   = useState(''); // 'batchId' | 'machineId'
  const [scannerTitle, setScannerTitle]   = useState('');

  // Manual form
  const [manualForm, setManualForm] = useState({
    batchId: genBatchId(), machineId:'', vendorName:'', defects:[{ type:'Hole', count:1, severity:'Medium' }]
  });

  // AI detect settings
  const [detectMachineId, setDetectMachineId] = useState('LOOM-01');
  const [detectConf, setDetectConf]           = useState(0.25);

  const fileRef = useRef();
  const { user } = useAuth();

  useSocketEvent('quality_alert', (d) => {
    setLiveAlert(d);
    setTimeout(() => setLiveAlert(null), 8000);
  });

  const load = async () => {
    const [l, s] = await Promise.all([API.get('/quality'), API.get('/quality/stats')]);
    setLogs(l.data);
    setStats(s.data);
  };

  const checkML = async () => {
    try {
      const [h, m] = await Promise.all([
        fetch(ML_SERVICE_URL + '/health').then(r => r.json()),
        fetch(ML_SERVICE_URL + '/model/info').then(r => r.json())
      ]);
      setMlOnline(h.status === 'ok');
      setModelInfo(m);
    } catch { setMlOnline(false); }
  };

  useEffect(() => { load(); checkML(); }, []);

  // Open scanner targeting a specific field
  const openScanner = (field) => {
    setScannerField(field);
    setScannerTitle(field === 'batchId' ? 'Scan Batch QR / Barcode' : 'Scan Machine ID Barcode');
    setScannerOpen(true);
  };

  // Called when scanner returns a value
  const handleScanResult = (value) => {
    if (scannerField === 'batchId') {
      setManualForm(f => ({ ...f, batchId: value }));
    } else if (scannerField === 'machineId') {
      setManualForm(f => ({ ...f, machineId: value }));
    }
  };

  // File upload detection
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setDetResult(null);
  };

  const runDetection = async () => {
    const file = fileRef.current?.files[0];
    if (!file) return;
    setDetecting(true);
    setDetResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const batchId = 'BATCH-' + Date.now();
      fd.append('batch_id', batchId);
      fd.append('machine_id', detectMachineId);
      fd.append('conf', String(detectConf));
      const res = await fetch(
        ML_SERVICE_URL + '/detect?batch_id=' + batchId + '&machine_id=' + detectMachineId + '&conf=' + detectConf,
        { method:'POST', body:fd }
      );
      const data = await res.json();
      setDetResult(data);
      load();
    } catch {
      setDetResult({ error:'ML service offline. Start: cd ml_service && uvicorn main:app --port 8000' });
    }
    setDetecting(false);
  };

  // Manual form submit
  const submitManual = async (e) => {
    e.preventDefault();
    const defects = manualForm.defects.filter(d => d.type && d.count > 0);
    await API.post('/quality', {
      batchId: manualForm.batchId,
      machineId: manualForm.machineId,
      vendorName: manualForm.vendorName,
      defects
    });
    setShowManual(false);
    setManualForm({ batchId:genBatchId(), machineId:'', vendorName:'', defects:[{ type:'Hole', count:1, severity:'Medium' }] });
    load();
  };

  const addDefect    = () => setManualForm(f => ({ ...f, defects:[...f.defects, { type:'Hole', count:1, severity:'Medium' }] }));
  const removeDefect = (i) => setManualForm(f => ({ ...f, defects:f.defects.filter((_,idx) => idx!==i) }));
  const updateDefect = (i, key, val) => setManualForm(f => {
    const nd = [...f.defects];
    nd[i] = { ...nd[i], [key]: key==='count' ? (parseInt(val)||0) : val };
    return { ...f, defects:nd };
  });

  return (
    <div>
      {/* Live alert */}
      <AnimatePresence>
        {liveAlert && (
          <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
            style={{ background:'rgba(255,71,87,0.1)', border:'1px solid var(--red)', borderRadius:10,
              padding:'12px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:20 }}>🚨</span>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, color:'var(--red)', fontSize:15 }}>MACHINE STOP</div>
              <div style={{ fontSize:12, color:'var(--text-1)', marginTop:2 }}>{liveAlert.msg}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700 }}>Quality Control</h1>
          <p style={{ color:'var(--text-2)', fontSize:13, marginTop:4 }}>
            AI defect detection (YOLOv8) · Manual inspection · USB phone / webcam barcode scan
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => setShowManual(true)}>+ Manual Inspection</button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom:24 }}>
        {[
          { l:'Total Inspections', v:stats.total,        c:'var(--accent)' },
          { l:'Grade A',          v:stats.gradeA,        c:'var(--green)'  },
          { l:'Rejected',         v:stats.rejected,      c:'var(--red)'    },
          { l:'Pass Rate',        v:stats.passRate+'%',  c:'var(--purple)' },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <div style={{ fontSize:11, color:'var(--text-2)' }}>{s.l}</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:700, color:s.c, marginTop:6 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* ML Status */}
      <div className="card" style={{ marginBottom:20, borderColor: mlOnline ? 'rgba(0,230,118,0.2)' : 'rgba(255,71,87,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:10, height:10, borderRadius:'50%',
              background: mlOnline ? 'var(--green)' : 'var(--red)',
              boxShadow: mlOnline ? '0 0 10px var(--green)' : 'none',
              animation: mlOnline ? 'pulse-dot 2s infinite' : 'none' }}/>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:14 }}>
                YOLOv8 — {mlOnline ? 'Online ✓' : 'Offline'}
              </div>
              {!mlOnline && (
                <div style={{ fontSize:11, color:'var(--red)', marginTop:2 }}>
                  cd ml_service && uvicorn main:app --port 8000
                </div>
              )}
            </div>
          </div>
          {modelInfo && (
            <div style={{ display:'flex', gap:20 }}>
              {[['mAP50',(modelInfo.final_metrics?.mAP50*100).toFixed(1)+'%'],
                ['Precision',(modelInfo.final_metrics?.precision*100).toFixed(1)+'%'],
                ['Recall',(modelInfo.final_metrics?.recall*100).toFixed(1)+'%']].map(([l,v]) => (
                <div key={l} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'var(--text-2)', textTransform:'uppercase' }}>{l}</div>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:700, color:'var(--accent)', fontSize:18 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-ghost" onClick={checkML} style={{ fontSize:12 }}>↻ Check</button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom:20 }}>
        {/* AI Detection */}
        <div className="card">
          <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:16, marginBottom:16 }}>🔬 AI Fabric Inspection</h3>
          <div style={{ display:'flex', gap:10, marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <label className="form-label">Machine ID</label>
              <input className="form-input" value={detectMachineId}
                onChange={e => setDetectMachineId(e.target.value)} placeholder="LOOM-01"/>
            </div>
            <div style={{ width:100 }}>
              <label className="form-label">Confidence</label>
              <input type="number" className="form-input" value={detectConf}
                min="0.1" max="0.9" step="0.05"
                onChange={e => setDetectConf(parseFloat(e.target.value))}/>
            </div>
          </div>

          <div onClick={() => fileRef.current?.click()}
            style={{ border:'2px dashed var(--border-bright)', borderRadius:10, padding:'24px 20px',
              textAlign:'center', cursor:'pointer', marginBottom:14, background:'var(--bg-2)', transition:'border-color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-bright)'}>
            {previewUrl ? (
              <img src={previewUrl} alt="preview"
                style={{ maxHeight:160, maxWidth:'100%', borderRadius:6, objectFit:'contain' }}/>
            ) : (
              <>
                <div style={{ fontSize:32, marginBottom:8 }}>📷</div>
                <div style={{ color:'var(--text-1)', fontSize:14 }}>Click to upload fabric image</div>
                <div style={{ color:'var(--text-2)', fontSize:11, marginTop:4 }}>JPG, PNG supported</div>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile}/>
          </div>

          <button className="btn btn-primary" onClick={runDetection}
            disabled={detecting || !previewUrl}
            style={{ width:'100%', justifyContent:'center', fontSize:14 }}>
            {detecting ? '⏳ Analyzing with YOLOv8...' : '🔍 Detect Defects'}
          </button>

          <AnimatePresence>
            {detResult && !detResult.error && (
              <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                style={{ marginTop:14, background:'var(--bg-2)', borderRadius:10, padding:14,
                  border:`1px solid ${GRADE_COLOR[detResult.grade]||'var(--border)'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:20, color:GRADE_COLOR[detResult.grade] }}>
                    GRADE: {detResult.grade}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:26,
                      color: detResult.total_defects > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {detResult.total_defects}
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-2)' }}>defects</div>
                  </div>
                </div>
                {detResult.detections?.map((d,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px',
                    background:'var(--bg-3)', borderRadius:6, marginBottom:4,
                    borderLeft:`3px solid ${DEFECT_COLORS[d.class]||'var(--accent)'}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:DEFECT_COLORS[d.class] }}/>
                      <span style={{ fontWeight:600, fontSize:13 }}>{d.class}</span>
                      <span className={'badge '+(d.severity==='High'?'badge-red':'badge-yellow')}>{d.severity}</span>
                    </div>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-2)' }}>
                      {(d.confidence*100).toFixed(1)}%
                    </span>
                  </div>
                ))}
                {detResult.trigger_machine_stop && (
                  <div style={{ marginTop:10, background:'rgba(255,71,87,0.1)', border:'1px solid var(--red)',
                    borderRadius:6, padding:'8px 12px', fontSize:12, color:'var(--red)', fontWeight:600 }}>
                    ⛔ {detResult.alert_message}
                  </div>
                )}
                <div style={{ fontSize:10, color:'var(--text-2)', marginTop:8 }}>⚡ {detResult.inference_ms}ms</div>
              </motion.div>
            )}
            {detResult?.error && (
              <div className="alert alert-error" style={{ marginTop:12 }}>{detResult.error}</div>
            )}
          </AnimatePresence>
        </div>

        {/* Annotated output */}
        <div className="card">
          <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:16, marginBottom:16 }}>🖼 Detection Output</h3>
          {detResult?.annotated_image ? (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
              <img src={'data:image/jpeg;base64,'+detResult.annotated_image} alt="detection"
                style={{ width:'100%', borderRadius:8, border:'1px solid var(--border)' }}/>
              <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                {Object.entries(DEFECT_COLORS).slice(0,4).map(([name,color]) => (
                  <div key={name} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                    <div style={{ width:10, height:10, background:color, borderRadius:2 }}/>
                    <span style={{ color:'var(--text-2)' }}>{name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div style={{ height:280, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', color:'var(--text-2)' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔬</div>
              <div style={{ fontSize:14 }}>Upload a fabric image to inspect</div>
            </div>
          )}
        </div>
      </div>

      {/* Defect chart + logs */}
      <div className="grid-2" style={{ marginBottom:20 }}>
        <div className="card">
          <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:14, marginBottom:14 }}>Defect Frequency</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.defectTypes?.slice(0,8)||[]}>
              <XAxis dataKey="_id" tick={{ fontSize:10, fill:'var(--text-2)' }}/>
              <YAxis hide/>
              <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border)', fontSize:11 }}/>
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {(stats.defectTypes||[]).map((d,i) => <Cell key={i} fill={DEFECT_COLORS[d._id]||'var(--accent)'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:14, marginBottom:14 }}>Recent Inspections</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {logs.slice(0,7).map(log => (
              <div key={log._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 12px', background:'var(--bg-2)', borderRadius:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{log.batchId}</div>
                  <div style={{ fontSize:11, color:'var(--text-2)' }}>
                    {log.machineId} · {log.totalDefects} defects
                    {log.aiDetected && <span style={{ marginLeft:6, color:'var(--accent)' }}>✦ AI</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span className={'badge '+GRADE_BADGE[log.grade]}>{log.grade}</span>
                  <span style={{ fontSize:10, color:'var(--text-2)' }}>
                    {new Date(log.inspectedAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MANUAL INSPECTION MODAL ── */}
      {showManual && (
        <div className="modal-overlay" onClick={() => setShowManual(false)}>
          <div className="modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:600, marginBottom:6 }}>
              Manual Quality Inspection
            </h3>
            <p style={{ fontSize:12, color:'var(--text-2)', marginBottom:20 }}>
              Scan QR / barcode from inventory (USB phone or webcam), or enter manually
            </p>
            <form onSubmit={submitManual}>

              {/* Batch ID */}
              <div className="form-group">
                <label className="form-label">Batch ID</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="form-input" value={manualForm.batchId}
                    onChange={e => setManualForm(f => ({ ...f, batchId:e.target.value }))}
                    placeholder="Scan QR or auto-generated" required style={{ flex:1 }}/>
                  <button type="button" className="btn btn-ghost"
                    onClick={() => openScanner('batchId')}
                    style={{ fontSize:12, padding:'8px 14px', flexShrink:0 }}
                    title="Scan QR code or barcode using USB phone / webcam">
                    📷 Scan
                  </button>
                  <button type="button" className="btn btn-ghost"
                    onClick={() => setManualForm(f => ({ ...f, batchId:genBatchId() }))}
                    style={{ fontSize:12, padding:'8px 10px', flexShrink:0 }} title="Generate new ID">
                    ↻
                  </button>
                </div>
              </div>

              {/* Machine ID */}
              <div className="form-group">
                <label className="form-label">Machine ID</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="form-input" value={manualForm.machineId}
                    onChange={e => setManualForm(f => ({ ...f, machineId:e.target.value }))}
                    placeholder="e.g. LOOM-01" required style={{ flex:1 }}/>
                  <button type="button" className="btn btn-ghost"
                    onClick={() => openScanner('machineId')}
                    style={{ fontSize:12, padding:'8px 14px', flexShrink:0 }}>
                    📷 Scan
                  </button>
                </div>
              </div>

              {/* Vendor */}
              <div className="form-group">
                <label className="form-label">Vendor Name (optional)</label>
                <input className="form-input" value={manualForm.vendorName}
                  onChange={e => setManualForm(f => ({ ...f, vendorName:e.target.value }))}
                  placeholder="e.g. Gujarat Cotton Co."/>
              </div>

              {/* Defects */}
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <label className="form-label" style={{ margin:0 }}>Defects Found</label>
                  <button type="button" className="btn btn-ghost" onClick={addDefect}
                    style={{ fontSize:11, padding:'4px 10px' }}>+ Add Defect</button>
                </div>
                {manualForm.defects.map((d,i) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
                    <select className="form-input" value={d.type}
                      onChange={e => updateDefect(i,'type',e.target.value)} style={{ flex:2 }}>
                      {DEFECT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <input type="number" className="form-input" placeholder="Count"
                      min="1" value={d.count}
                      onChange={e => updateDefect(i,'count',e.target.value)} style={{ width:80 }}/>
                    <select className="form-input" value={d.severity}
                      onChange={e => updateDefect(i,'severity',e.target.value)} style={{ flex:1 }}>
                      <option>Low</option><option>Medium</option><option>High</option>
                    </select>
                    <button type="button" onClick={() => removeDefect(i)}
                      style={{ background:'transparent', border:'none', color:'var(--red)',
                        cursor:'pointer', fontSize:18, padding:'0 4px' }}>✕</button>
                  </div>
                ))}
                {manualForm.defects.length === 0 && (
                  <div style={{ fontSize:12, color:'var(--green)', padding:'8px 0' }}>
                    No defects listed — will be graded A
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1, justifyContent:'center' }}>
                  ✅ Submit Inspection
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowManual(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Scanner — shared component */}
      <CameraScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={handleScanResult}
        title={scannerTitle}
      />
    </div>
  );
}
