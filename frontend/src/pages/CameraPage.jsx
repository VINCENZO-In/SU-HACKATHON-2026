/**
 * CameraPage — Live Defect Detection
 * Uses shared CameraScanner infrastructure for USB phone/webcam.
 * Supports: USB phone (DroidCam/EpocCam), built-in webcam, any USB camera.
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { ML_SERVICE_URL, WS_ML_URL } from '../utils/config';

const DEFECT_COLORS = {
  Hole: '#ff4757', Stain: '#ff6b35', BrokenYarn: '#ffd32a',
  Misweave: '#a855f7', OilSpot: '#06b6d4', ColorBleed: '#ec4899', Other: '#8fa8c8'
};
const GRADE_CFG = {
  A:      { color: '#00e676', bg: 'rgba(0,230,118,0.08)',  label: 'PASS — Grade A' },
  B:      { color: '#00d4ff', bg: 'rgba(0,212,255,0.08)',  label: 'MINOR DEFECTS — Grade B' },
  C:      { color: '#ffd32a', bg: 'rgba(255,211,42,0.08)', label: 'BELOW STANDARD — Grade C' },
  REJECT: { color: '#ff4757', bg: 'rgba(255,71,87,0.08)',  label: 'REJECTED' },
};

export default function CameraPage() {
  const [mlOnline,    setMlOnline]    = useState(false);
  const [cameras,     setCameras]     = useState([]);
  const [selectedCam, setSelectedCam] = useState('');
  const [camStatus,   setCamStatus]   = useState('idle'); // idle | starting | active | error
  const [camError,    setCamError]    = useState('');
  const [machineId,   setMachineId]   = useState('LOOM-01');
  const [conf,        setConf]        = useState(0.25);
  const [detecting,   setDetecting]   = useState(false);
  const [streamActive,setStreamActive]= useState(false);
  const [fps,         setFps]         = useState(0);
  const [result,      setResult]      = useState(null);
  const [history,     setHistory]     = useState([]);
  const [consecDef,   setConsecDef]   = useState(0);

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const wsRef       = useRef(null);
  const frameIntRef = useRef(null);
  const fpsTimerRef = useRef(null);
  const fpsCountRef = useRef(0);
  const fileRef     = useRef(null);

  // ── ML health check ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try { const r = await fetch(ML_SERVICE_URL + '/health'); const d = await r.json(); setMlOnline(d.status === 'ok'); }
      catch { setMlOnline(false); }
    };
    check();
    const t = setInterval(check, 10000);
    return () => { clearInterval(t); stopCamera(); stopStream(); };
  }, []);

  // ── Enumerate USB / webcam cameras ───────────────────────────────────────
  const enumCameras = async () => {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
      if (tmp) tmp.getTracks().forEach(t => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      setCameras(cams);
      // Auto-select USB phone if available
      const usb = cams.find(d => {
        const l = (d.label || '').toLowerCase();
        return l.includes('droidcam') || l.includes('epoccam') || l.includes('continuity') ||
               l.includes('iphone') || (l.includes('usb') && !l.includes('built'));
      });
      const preferred = usb || cams[cams.length - 1];
      if (preferred) setSelectedCam(preferred.deviceId);
    } catch {}
  };

  useEffect(() => { enumCameras(); }, []);

  const camLabel = (cam, i) => {
    const l = (cam.label || '').toLowerCase();
    if (!cam.label) return `Camera ${i + 1}`;
    if (l.includes('droidcam'))   return '📱 DroidCam (USB Android)';
    if (l.includes('epoccam'))    return '📱 EpocCam (USB iPhone)';
    if (l.includes('continuity')) return '📱 iPhone Continuity';
    if (l.includes('built-in') || l.includes('facetime')) return '💻 Built-in Webcam';
    if (l.includes('usb'))        return '🔌 USB Camera';
    return '📷 ' + cam.label.substring(0, 30);
  };

  // ── Start selected camera ─────────────────────────────────────────────────
  const startCamera = async () => {
    stopCamera();
    setCamStatus('starting');
    setCamError('');
    try {
      const constraints = {
        video: {
          ...(selectedCam ? { deviceId: { exact: selectedCam } } : { facingMode: 'environment' }),
          width: { ideal: 1280 }, height: { ideal: 720 }
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamStatus('active');
    } catch (err) {
      setCamStatus('error');
      setCamError(err.name === 'NotAllowedError' ? 'Camera permission denied.'
        : err.name === 'NotFoundError' ? 'Camera not found. Connect your USB phone and try again.'
        : 'Camera error: ' + err.message);
    }
  };

  const stopCamera = () => {
    stopStream();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamStatus('idle');
  };

  // ── Capture one frame ─────────────────────────────────────────────────────
  const captureFrame = (quality = 0.82) => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || v.readyState < 2) return null;
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext('2d').drawImage(v, 0, 0);
    return c.toDataURL('image/jpeg', quality);
  };

  // ── Single-shot detect ────────────────────────────────────────────────────
  const detectOnce = async () => {
    if (!mlOnline) return;
    setDetecting(true);
    try {
      const frame = captureFrame(0.88);
      if (!frame) throw new Error('No frame captured');
      const batchId = 'SNAP-' + Date.now();
      const res = await fetch(ML_SERVICE_URL + '/detect/frame', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame, conf, machine_id: machineId, batch_id: batchId })
      });
      const data = await res.json();
      setResult(data); addHistory(data); checkConsec(data);
    } catch (e) { setResult({ error: e.message }); }
    setDetecting(false);
  };

  // ── WebSocket live stream ─────────────────────────────────────────────────
  const startStream = () => {
    if (!mlOnline) return;
    const ws = new WebSocket(WS_ML_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      setStreamActive(true);
      frameIntRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const f = captureFrame(0.72);
          if (f) { ws.send(JSON.stringify({ frame: f, conf, machine_id: machineId })); fpsCountRef.current++; }
        }
      }, 320);
      fpsTimerRef.current = setInterval(() => { setFps(fpsCountRef.current); fpsCountRef.current = 0; }, 1000);
    };
    ws.onmessage = e => {
      try { const d = JSON.parse(e.data); if (!d.error) { setResult(d); addHistory(d); checkConsec(d); } } catch {}
    };
    ws.onclose = () => stopStream();
  };

  const stopStream = () => {
    wsRef.current?.close(); wsRef.current = null;
    clearInterval(frameIntRef.current); clearInterval(fpsTimerRef.current);
    setStreamActive(false); setFps(0);
  };

  // ── File upload detect ────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setDetecting(true); setResult(null);
    const fd = new FormData();
    fd.append('file', file); fd.append('conf', conf);
    fd.append('batch_id', 'UPLOAD-' + Date.now()); fd.append('machine_id', machineId);
    try {
      const res = await fetch(ML_SERVICE_URL + '/detect', { method: 'POST', body: fd });
      const data = await res.json();
      setResult(data); addHistory(data); checkConsec(data);
    } catch (e) { setResult({ error: e.message }); }
    setDetecting(false);
  };

  const addHistory = (d) => {
    if (d.total_defects === undefined) return;
    setHistory(p => [{ time: new Date().toLocaleTimeString('en-IN'), grade: d.grade, defects: d.total_defects }, ...p.slice(0, 19)]);
  };
  const checkConsec = (d) => {
    if (d.total_defects > 0) setConsecDef(n => n + 1); else setConsecDef(0);
  };

  const gc = result?.grade ? GRADE_CFG[result.grade] : null;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Live Defect Detection</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
          YOLOv8 real-time inspection · USB phone camera · Webcam · File upload
        </p>
      </div>

      {/* Machine stop alert */}
      <AnimatePresence>
        {consecDef >= 3 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(255,71,87,0.1)', border: '2px solid var(--red)', borderRadius: 10, padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>⛔</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--red)', fontSize: 15 }}>
                MACHINE STOP — {consecDef} consecutive defective batches on {machineId}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Stop machine and inspect immediately</div>
            </div>
            <button onClick={() => setConsecDef(0)} style={{ background: 'transparent', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', padding: '4px 12px', cursor: 'pointer', fontSize: 11 }}>Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top controls row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* ML status */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', flex: 1, minWidth: 220, borderColor: mlOnline ? 'rgba(0,230,118,0.2)' : 'rgba(255,71,87,0.2)' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: mlOnline ? 'var(--green)' : 'var(--red)', boxShadow: mlOnline ? '0 0 10px var(--green)' : 'none', animation: mlOnline ? 'pulse-dot 2s infinite' : 'none' }}/>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>YOLOv8 — {mlOnline ? 'Online ✓' : 'Offline'}</div>
            {!mlOnline && <div style={{ fontSize: 10, color: 'var(--red)' }}>cd ml_service && uvicorn main:app --port 8000</div>}
          </div>
        </div>

        {/* Camera selector */}
        <div className="card" style={{ padding: '12px 16px', minWidth: 240 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Camera ({cameras.length} found)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select className="form-input" value={selectedCam} onChange={e => setSelectedCam(e.target.value)} style={{ flex: 1, fontSize: 12 }}>
              {cameras.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{camLabel(c, i)}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={enumCameras} style={{ padding: '8px 10px', fontSize: 14 }} title="Refresh">↻</button>
          </div>
        </div>

        {/* Settings */}
        <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label className="form-label" style={{ marginBottom: 4 }}>Machine ID</label>
            <input className="form-input" value={machineId} onChange={e => setMachineId(e.target.value)} style={{ width: 100, fontSize: 12 }}/>
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: 4 }}>Conf: {(conf*100).toFixed(0)}%</label>
            <input type="range" min="0.1" max="0.9" step="0.05" value={conf}
              onChange={e => setConf(parseFloat(e.target.value))}
              style={{ width: 80, accentColor: 'var(--accent)' }}/>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Main camera area */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            {/* Camera controls */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {camStatus !== 'active' ? (
                <button className="btn btn-primary" onClick={startCamera} disabled={camStatus === 'starting' || cameras.length === 0}>
                  {camStatus === 'starting' ? '⏳ Starting...' : '▶ Start Camera'}
                </button>
              ) : (
                <button className="btn btn-danger" onClick={stopCamera}>⏹ Stop Camera</button>
              )}
              {camStatus === 'active' && !streamActive && (
                <button className="btn btn-primary" onClick={detectOnce} disabled={detecting || !mlOnline}
                  style={{ background: 'var(--purple)' }}>
                  {detecting ? '⏳' : '🔍'} Detect Once
                </button>
              )}
              {camStatus === 'active' && !streamActive && (
                <button className="btn btn-ghost" onClick={startStream} disabled={!mlOnline}
                  style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>▶ Live Stream</button>
              )}
              {streamActive && (
                <button className="btn btn-danger" onClick={stopStream}>⏸ Stop Stream</button>
              )}
              {streamActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'pulse-dot 0.8s infinite', display: 'inline-block' }}/>
                  <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>LIVE · {fps} fps</span>
                </div>
              )}
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={!mlOnline} style={{ marginLeft: 'auto' }}>
                📁 Upload
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload}/>
            </div>

            {/* USB phone setup info */}
            <div style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 11, color: 'var(--text-2)' }}>
              📱 <strong style={{ color: 'var(--accent)' }}>USB Phone:</strong> Android → Install <strong>DroidCam</strong> app → connect USB cable → select "DroidCam" above.
              iPhone → macOS: plug in (auto as "Continuity Camera") · Windows: install <strong>EpocCam</strong> + driver.
            </div>

            {/* Video viewport */}
            <div style={{ background: '#000', borderRadius: 10, overflow: 'hidden', position: 'relative', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Idle placeholder */}
              {camStatus === 'idle' && (
                <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: 32 }}>
                  <div style={{ fontSize: 60, marginBottom: 12 }}>📷</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>
                    {cameras.length === 0 ? 'No cameras detected' : 'Select camera & press Start'}
                  </div>
                </div>
              )}
              {camStatus === 'error' && (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
                  <div style={{ color: 'var(--red)', fontSize: 13 }}>{camError}</div>
                </div>
              )}

              <video ref={videoRef} autoPlay muted playsInline
                style={{ width: '100%', display: camStatus === 'active' ? 'block' : 'none', borderRadius: 10 }}/>
              <canvas ref={canvasRef} style={{ display: 'none' }}/>

              {/* Live stream annotated overlay */}
              {streamActive && result?.annotated_image && (
                <img src={'data:image/jpeg;base64,' + result.annotated_image}
                  alt="Live detection"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}/>
              )}

              {/* Grade badge overlay */}
              {result?.grade && !result.error && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: GRADE_CFG[result.grade]?.bg,
                  border: '2px solid ' + GRADE_CFG[result.grade]?.color, borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: GRADE_CFG[result.grade]?.color }}>{result.grade}</div>
                  <div style={{ fontSize: 10, color: GRADE_CFG[result.grade]?.color }}>{result.total_defects} DEFECTS</div>
                </div>
              )}

              {/* Live indicator */}
              {streamActive && (
                <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.65)', borderRadius: 6, padding: '4px 10px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', animation: 'pulse-dot 0.8s infinite', display: 'inline-block' }}/>
                  <span style={{ fontSize: 10, color: '#fff', fontFamily: 'var(--font-mono)' }}>LIVE · {fps} fps</span>
                </div>
              )}
            </div>
          </div>

          {/* Single detect result */}
          <AnimatePresence>
            {result && !result.error && !streamActive && (
              <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ borderColor: (gc?.color || 'var(--border)') + '44' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: gc?.color }}>{gc?.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{result.inference_ms}ms</div>
                </div>
                {result.annotated_image && (
                  <img src={'data:image/jpeg;base64,' + result.annotated_image} alt="annotated"
                    style={{ width: '100%', borderRadius: 8, marginBottom: 12, border: '1px solid var(--border)' }}/>
                )}
                {result.detections?.length > 0 ? result.detections.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: 'var(--bg-2)', borderRadius: 7, marginBottom: 5, borderLeft: '3px solid ' + (DEFECT_COLORS[d.class] || 'var(--accent)') }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: DEFECT_COLORS[d.class] }}/>
                      <span style={{ fontWeight: 600 }}>{d.class}</span>
                      <span className={'badge ' + (d.severity === 'High' ? 'badge-red' : 'badge-yellow')}>{d.severity}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>{(d.confidence*100).toFixed(1)}%</span>
                  </div>
                )) : (
                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--green)', fontFamily: 'var(--font-display)' }}>✅ No defects — Fabric is clean</div>
                )}
                {result.trigger_machine_stop && (
                  <div style={{ marginTop: 10, background: 'rgba(255,71,87,0.1)', border: '1px solid var(--red)', borderRadius: 6, padding: '8px 12px', color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>⛔ {result.alert_message}</div>
                )}
              </motion.div>
            )}
            {result?.error && <div className="alert alert-error">{result.error}</div>}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Live stats during stream */}
          {streamActive && result && (
            <div className="card" style={{ borderColor: result.total_defects > 0 ? 'rgba(255,71,87,0.3)' : 'rgba(0,230,118,0.3)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>LIVE SCAN</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 54, fontWeight: 700, textAlign: 'center', color: result.total_defects > 0 ? 'var(--red)' : 'var(--green)' }}>{result.total_defects}</div>
              <div style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 11, marginBottom: 8 }}>defects</div>
              {result.grade && <div style={{ textAlign: 'center' }}><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, color: GRADE_CFG[result.grade]?.color }}>{result.grade}</span></div>}
              {Object.entries(result.defect_summary || {}).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--border)', marginTop: 6, fontSize: 12 }}>
                  <span style={{ color: DEFECT_COLORS[type] }}>● {type}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{count}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 8, textAlign: 'right' }}>{result.inference_ms}ms</div>
            </div>
          )}

          {/* History */}
          <div className="card" style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
              Scan History ({history.length})
            </div>
            {history.length === 0 ? (
              <div style={{ color: 'var(--text-2)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No detections yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 320, overflowY: 'auto' }}>
                {history.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 11 }}>
                    <span className={'badge ' + (h.grade === 'A' ? 'badge-green' : h.grade === 'REJECT' ? 'badge-red' : 'badge-yellow')}>{h.grade}</span>
                    <span style={{ color: 'var(--text-2)' }}>{h.defects} defect{h.defects !== 1 ? 's' : ''}</span>
                    <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{h.time}</span>
                  </div>
                ))}
              </div>
            )}
            {history.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-2)' }}>Pass rate</span>
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                  {Math.round(history.filter(h => h.grade === 'A' || h.grade === 'B').length / history.length * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Quick guide */}
          <div className="card" style={{ padding: 14, fontSize: 12 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: 10 }}>📱 USB Setup</div>
            {[
              ['Android', 'Install DroidCam app → connect USB → pick DroidCam in dropdown'],
              ['iPhone (Mac)', 'Plug in iPhone → auto-appears as "Continuity Camera"'],
              ['iPhone (Win)', 'Install EpocCam app + Windows driver → connect USB'],
              ['Webcam', 'Auto-detected — just select from dropdown'],
            ].map(([l, v]) => (
              <div key={l} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 11 }}>{l}</div>
                <div style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
