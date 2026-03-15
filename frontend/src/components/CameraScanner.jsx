/**
 * CameraScanner — Universal USB / Webcam / Phone Camera Scanner
 *
 * USB Phone Setup:
 *  Android → Install "DroidCam" app → connect USB → select "DroidCam" in dropdown
 *  iPhone  → macOS: plug in → "Continuity Camera" auto-appears
 *            Windows: install "EpocCam" app + driver → connect USB
 *
 * Barcode detection uses Chrome's native BarcodeDetector API (Chrome 88+/Edge).
 * Fallback: manual text input.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CameraScanner({ isOpen, onClose, onResult, title = 'Scan QR / Barcode' }) {
  const [cameras,     setCameras]     = useState([]);
  const [selectedCam, setSelectedCam] = useState('');
  const [status,      setStatus]      = useState('idle'); // idle | starting | active | error
  const [errorMsg,    setErrorMsg]    = useState('');
  const [scanning,    setScanning]    = useState(false);
  const [lastScan,    setLastScan]    = useState('');
  const [manualInput, setManualInput] = useState('');
  const [torchOn,     setTorchOn]     = useState(false);
  const [hasBarcodeAPI, setHasBarcodeAPI] = useState(false);
  const [frameCount,  setFrameCount]  = useState(0);

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const intervalRef = useRef(null);
  const detectorRef = useRef(null);

  // ── Init on open ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setLastScan('');
    setManualInput('');
    setErrorMsg('');
    setStatus('idle');
    setTorchOn(false);
    const hasAPI = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    setHasBarcodeAPI(hasAPI);
    if (hasAPI) {
      try { detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code','code_128','code_39','ean_13','ean_8','data_matrix','aztec','pdf417','code_93'] }); }
      catch {}
    }
    enumerateCameras();
    return () => stopCamera();
  }, [isOpen]);

  // ── Enumerate all video devices (USB phone shows here) ────────────────────
  const enumerateCameras = async () => {
    try {
      // Ask permission first so labels populate
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
      if (tmp) tmp.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      setCameras(cams);

      // Smart auto-select priority: USB phone > external USB > last listed > first
      const usbPhone = cams.find(d => {
        const l = (d.label || '').toLowerCase();
        return l.includes('droidcam') || l.includes('epoccam') ||
               l.includes('continuity') || l.includes('iphone') ||
               l.includes('android') || (l.includes('usb') && !l.includes('built'));
      });
      const external = cams.find(d => {
        const l = (d.label || '').toLowerCase();
        return l.includes('usb') || (!l.includes('built-in') && !l.includes('facetime') && !l.includes('integrated'));
      });
      const auto = usbPhone || external || cams[cams.length - 1];
      if (auto) setSelectedCam(auto.deviceId);
    } catch (err) {
      setErrorMsg('Camera access denied: ' + err.message);
    }
  };

  // ── Start camera with chosen deviceId ────────────────────────────────────
  const startCamera = async (deviceId) => {
    stopCamera();
    setStatus('starting');
    setErrorMsg('');
    setLastScan('');
    try {
      const constraints = {
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }),
          width: { ideal: 1280 }, height: { ideal: 720 }
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus('active');
      if (hasBarcodeAPI && detectorRef.current) startAutoScan();
    } catch (err) {
      setStatus('error');
      const msg = err.name === 'NotAllowedError'
        ? 'Camera permission denied. Allow access in browser settings.'
        : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
          ? 'Camera not found. Connect your USB phone (DroidCam/EpocCam) and refresh.'
          : `Camera error: ${err.message}`;
      setErrorMsg(msg);
    }
  };

  const stopCamera = () => {
    clearInterval(intervalRef.current);
    setScanning(false);
    setStatus('idle');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // ── Auto-scan loop using BarcodeDetector ─────────────────────────────────
  const startAutoScan = () => {
    setScanning(true);
    intervalRef.current = setInterval(async () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return;
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      setFrameCount(n => n + 1);
      try {
        const results = await detectorRef.current.detect(canvas);
        if (results.length > 0) handleResult(results[0].rawValue);
      } catch {}
    }, 350);
  };

  // ── Handle scan result ────────────────────────────────────────────────────
  const handleResult = useCallback((raw) => {
    clearInterval(intervalRef.current);
    setScanning(false);
    let value = raw;
    // Parse JSON QR from WeaveMind inventory system
    try { const p = JSON.parse(raw); value = p.barcode || p.batchId || p.machineId || raw; } catch {}
    setLastScan(value);
    setTimeout(() => { stopCamera(); onResult(value); onClose(); }, 700);
  }, [onResult, onClose]);

  // ── Torch toggle ─────────────────────────────────────────────────────────
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(t => !t);
    } catch {}
  };

  // ── Manual apply ─────────────────────────────────────────────────────────
  const applyManual = () => {
    if (!manualInput.trim()) return;
    handleResult(manualInput.trim());
  };

  // ── Camera label helper ──────────────────────────────────────────────────
  const camLabel = (cam, idx) => {
    const l = (cam.label || '').toLowerCase();
    if (!cam.label) return `📷 Camera ${idx + 1}`;
    if (l.includes('droidcam'))   return '📱 DroidCam — USB Android Phone';
    if (l.includes('epoccam'))    return '📱 EpocCam — USB iPhone';
    if (l.includes('continuity')) return '📱 iPhone Continuity Camera';
    if (l.includes('iphone'))     return '📱 iPhone Camera';
    if (l.includes('android'))    return '📱 Android Camera';
    if (l.includes('back') || l.includes('rear'))     return '📸 Rear Camera';
    if (l.includes('front') || l.includes('facetime')) return '🤳 Front Camera';
    if (l.includes('built-in') || l.includes('integrated')) return '💻 Built-in Webcam';
    if (l.includes('usb'))        return '🔌 USB Camera';
    return `📷 ${cam.label.substring(0, 36)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="modal"
        style={{ maxWidth: 480, width: '96%' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, margin: 0 }}>{title}</h3>
            <p style={{ fontSize: 11, color: 'var(--text-2)', margin: '3px 0 0' }}>USB phone · Webcam · Any camera device</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>✕</button>
        </div>

        {/* Camera selector */}
        {cameras.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Camera Device ({cameras.length} found)</label>
            <select className="form-input" value={selectedCam}
              onChange={e => setSelectedCam(e.target.value)}>
              {cameras.map((cam, i) => (
                <option key={cam.deviceId} value={cam.deviceId}>{camLabel(cam, i)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {status !== 'active' ? (
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => startCamera(selectedCam)} disabled={status === 'starting'}>
              {status === 'starting' ? '⏳ Starting...' : '▶ Start Camera'}
            </button>
          ) : (
            <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={stopCamera}>
              ⏹ Stop
            </button>
          )}
          {status === 'active' && (
            <button className="btn btn-ghost" onClick={toggleTorch}
              style={{ fontSize: 18, padding: '8px 14px', borderColor: torchOn ? 'var(--yellow)' : 'var(--border)', color: torchOn ? 'var(--yellow)' : 'var(--text-1)' }}
              title="Toggle flashlight">
              {torchOn ? '🔦' : '🔆'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={enumerateCameras}
            style={{ fontSize: 12, padding: '8px 12px' }} title="Refresh camera list">↻</button>
        </div>

        {/* Video viewport */}
        <div style={{
          background: '#000', borderRadius: 12, overflow: 'hidden',
          position: 'relative', minHeight: 220, marginBottom: 12,
          border: lastScan ? '2px solid var(--green)' : status === 'error' ? '2px solid var(--red)' : '1px solid var(--border)',
          transition: 'border-color 0.3s'
        }}>
          {/* Idle / error state */}
          {status === 'idle' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>📷</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{cameras.length === 0 ? 'No cameras found' : 'Select camera & press Start'}</div>
              {cameras.length > 0 && <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-2)' }}>{cameras.length} camera{cameras.length > 1 ? 's' : ''} available</div>}
            </div>
          )}
          {status === 'error' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
              <div style={{ color: 'var(--red)', fontSize: 13, lineHeight: 1.6 }}>{errorMsg}</div>
            </div>
          )}

          {/* Video */}
          <video ref={videoRef} autoPlay muted playsInline
            style={{ width: '100%', display: status === 'active' ? 'block' : 'none', borderRadius: 12 }}/>
          <canvas ref={canvasRef} style={{ display: 'none' }}/>

          {/* Scan guide overlay */}
          {status === 'active' && !lastScan && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ position: 'relative', width: 210, height: 210 }}>
                {/* Dimmed border */}
                <div style={{ position: 'absolute', inset: -9999, boxShadow: '0 0 0 9999px rgba(0,0,0,0.42)' }}/>
                {/* Corner brackets */}
                {[
                  { top:0, left:0, borderTop:'3px solid var(--accent)', borderLeft:'3px solid var(--accent)' },
                  { top:0, right:0, borderTop:'3px solid var(--accent)', borderRight:'3px solid var(--accent)' },
                  { bottom:0, left:0, borderBottom:'3px solid var(--accent)', borderLeft:'3px solid var(--accent)' },
                  { bottom:0, right:0, borderBottom:'3px solid var(--accent)', borderRight:'3px solid var(--accent)' },
                ].map((s, i) => (
                  <div key={i} style={{ position: 'absolute', width: 24, height: 24, borderRadius: 2, ...s }}/>
                ))}
                {/* Animated laser line */}
                <div style={{
                  position: 'absolute', left: 6, right: 6, height: 2,
                  background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
                  boxShadow: '0 0 8px var(--accent)',
                  animation: 'scannerLaser 2s ease-in-out infinite'
                }}/>
              </div>
            </div>
          )}

          {/* Success flash */}
          {lastScan && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,230,118,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
              <div style={{ fontSize: 48 }}>✅</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--green)', marginTop: 8 }}>Scanned!</div>
              <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{lastScan}</div>
            </motion.div>
          )}

          {/* Live scanning indicator */}
          {scanning && status === 'active' && !lastScan && (
            <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.65)', borderRadius: 6, padding: '4px 10px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', animation: 'pulse-dot 0.8s infinite', display: 'inline-block' }}/>
              <span style={{ fontSize: 10, color: '#fff', fontFamily: 'var(--font-mono)' }}>SCANNING · {frameCount % 100}</span>
            </div>
          )}
        </div>

        {/* Status info box */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          {!hasBarcodeAPI ? (
            <span style={{ color: 'var(--yellow)' }}>⚠️ BarcodeDetector not available. Use <strong>Chrome 88+</strong> or <strong>Edge</strong>. Or enter barcode manually below.</span>
          ) : status === 'active' ? (
            <span style={{ color: 'var(--green)' }}>✅ Auto-scanning — point camera at QR code or barcode. Supported: QR, Code-128, Code-39, EAN-13, DataMatrix, Aztec</span>
          ) : (
            <span style={{ color: 'var(--text-2)' }}>
              💡 <strong style={{ color: 'var(--accent)' }}>USB Phone:</strong> Install <strong>DroidCam</strong> (Android) or <strong>EpocCam</strong> (iPhone) → connect USB → your phone appears in the dropdown above.
            </span>
          )}
        </div>

        {/* Manual fallback */}
        <div>
          <label className="form-label">Or enter / paste manually</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              placeholder="Barcode, batch ID, machine ID..."
              onKeyDown={e => e.key === 'Enter' && applyManual()}
              style={{ flex: 1 }}/>
            <button className="btn btn-primary" onClick={applyManual} style={{ fontSize: 12, padding: '8px 16px' }}>Apply</button>
          </div>
        </div>

        {/* Laser animation CSS */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes scannerLaser {
            0%   { top: 8px;  opacity: 1; }
            49%  { top: calc(100% - 10px); opacity: 0.8; }
            50%  { opacity: 0; top: calc(100% - 10px); }
            51%  { opacity: 0; top: 8px; }
            52%  { opacity: 1; top: 8px; }
            100% { top: 8px;  opacity: 1; }
          }
        `}}/>
      </motion.div>
    </div>
  );
}
