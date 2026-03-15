import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { useSocketEvent } from '../hooks/useSocket';
import CameraScanner from '../components/CameraScanner';

const STAGE_ORDER = ['Received','Quality Check','In Production','Finished','Packed','Dispatched','Delivered'];
const STAGE_COLOR = { Received:'#00d4ff', 'Quality Check':'#a855f7', 'In Production':'#f59e0b', Finished:'#00e676', Packed:'#10b981', Dispatched:'#6366f1', Delivered:'#00e676' };

function LifecycleTimeline({ lifecycle }) {
  if (!lifecycle?.length) return <div style={{color:'var(--text-2)',fontSize:12,padding:'8px 0'}}>No lifecycle events</div>;
  return (
    <div style={{position:'relative',paddingLeft:20}}>
      <div style={{position:'absolute',left:7,top:0,bottom:0,width:2,background:'var(--border)'}}/>
      {lifecycle.map((ev, i) => (
        <div key={i} style={{position:'relative',marginBottom:12,paddingLeft:16}}>
          <div style={{position:'absolute',left:-7,top:4,width:10,height:10,borderRadius:'50%',background:STAGE_COLOR[ev.stage]||'var(--accent)',border:'2px solid var(--bg-card)'}}/>
          <div style={{fontSize:12,fontWeight:600,color:STAGE_COLOR[ev.stage]||'var(--text-0)'}}>{ev.stage}</div>
          <div style={{fontSize:11,color:'var(--text-2)'}}>
            {ev.location} {ev.performedBy && `· ${ev.performedBy}`}
          </div>
          {ev.note && <div style={{fontSize:11,color:'var(--text-1)',fontStyle:'italic'}}>{ev.note}</div>}
          <div style={{fontSize:10,color:'var(--text-2)'}}>{new Date(ev.timestamp).toLocaleString('en-IN')}</div>
        </div>
      ))}
    </div>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [moveForm, setMoveForm] = useState({ barcode:'', newLocation:'', stage:'', note:'' });
  const [showMove, setShowMove] = useState(null);
  const [form, setForm] = useState({ itemName:'', vendorName:'', category:'Raw Material', stockLevel:'', reorderPoint:'', unit:'meters', location:'Warehouse A', barcode:'' });
  const [msg, setMsg] = useState('');
  const [qrView, setQrView] = useState(null);
  // Camera scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const { user } = useAuth();
  const canEdit = user?.role !== 'worker';

  useSocketEvent('low_stock_alert', (d) => { setMsg(`📦 Low stock alert sent to supplier for: ${d.itemName}`); load(); });

  const load = async () => {
    const [inv, ls] = await Promise.all([API.get('/inventory'), API.get('/inventory/low-stock')]);
    setItems(inv.data);
    setLowStock(ls.data.alerts || []);
  };
  useEffect(() => { load(); }, []);

  const addItem = async (e) => {
    e.preventDefault();
    await API.post('/inventory', form);
    setShowModal(false);
    setForm({ itemName:'', vendorName:'', category:'Raw Material', stockLevel:'', reorderPoint:'', unit:'meters', location:'Warehouse A', barcode:'' });
    load();
  };

  const generateQR = async (item) => {
    const { data } = await API.post(`/inventory/${item._id}/qr`);
    setQrView({ ...item, qrCode: data.qrCode });
  };

  const scanBarcode = async () => {
    if (!scanInput.trim()) return;
    try {
      // Try as QR JSON or plain barcode
      let barcode = scanInput;
      try { const p = JSON.parse(scanInput); barcode = p.barcode || scanInput; } catch {}
      const { data } = await API.get(`/inventory/barcode/${barcode}`);
      setScanResult(data);
      setSelected(data);
    } catch { setScanResult({ error: 'Item not found for: ' + scanInput }); }
  };

  const submitMove = async (e) => {
    e.preventDefault();
    await API.post('/inventory/track', moveForm);
    setShowMove(null);
    load();
    if (selected) {
      const { data } = await API.get(`/inventory/barcode/${selected.barcode}`);
      setSelected(data);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete?')) return;
    await API.delete(`/inventory/${id}`);
    load();
  };

  const currentProgress = (item) => {
    if (!item.lifecycle?.length) return 0;
    const last = item.lifecycle[item.lifecycle.length-1].stage;
    const idx = STAGE_ORDER.indexOf(last);
    return idx >= 0 ? Math.round(((idx+1)/STAGE_ORDER.length)*100) : 0;
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700}}>Inventory & Item Tracking</h1>
          <p style={{color:'var(--text-2)',fontSize:13,marginTop:4}}>{items.length} items · {lowStock.length} low stock · QR code tracking</p>
        </div>
        {canEdit&&<button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Add Item</button>}
      </div>

      {msg&&<div className="alert alert-success" style={{marginBottom:16}}>{msg}</div>}

      {lowStock.length>0&&(
        <div style={{background:'rgba(255,211,42,0.06)',border:'1px solid rgba(255,211,42,0.2)',borderRadius:10,padding:14,marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <span>⚠️</span><span style={{fontFamily:'var(--font-display)',fontWeight:600,color:'var(--yellow)',fontSize:14}}>LOW STOCK ALERTS — Auto email sent to best supplier</span>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {lowStock.map(a=>(
              <div key={a.barcode} style={{background:'rgba(255,211,42,0.08)',border:'1px solid rgba(255,211,42,0.2)',borderRadius:8,padding:'6px 12px',fontSize:12}}>
                <span style={{color:'var(--yellow)',fontWeight:600}}>{a.itemName}</span> — {a.stockLevel} left
                {a.bestSupplier&&<span style={{color:'var(--text-2)',marginLeft:6}}>→ {a.bestSupplier.name} ({a.bestSupplier.score}% reliable)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 380px',gap:20}}>
        {/* Main table */}
        <div>
          {/* Scanner */}
          <div className="card" style={{marginBottom:16}}>
            <h3 style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:14,marginBottom:12}}>📷 Barcode / QR Scanner</h3>
            <div style={{display:'flex',gap:10}}>
              <input className="form-input" placeholder="Type barcode or use 📷 Camera scan"
                value={scanInput} onChange={e=>setScanInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&scanBarcode()} style={{flex:1}}/>
              <button className="btn btn-primary" onClick={scanBarcode}>Lookup</button>
              <button className="btn btn-ghost"
                onClick={()=>setScannerOpen(true)}
                style={{fontSize:12,padding:'8px 14px',borderColor:'var(--accent)',color:'var(--accent)'}}
                title="Scan with USB phone camera or webcam">
                📷 Camera
              </button>
            </div>
            {scanResult&&(
              <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{marginTop:12,background:'var(--bg-2)',borderRadius:8,padding:12,
                border:`1px solid ${scanResult.error?'rgba(255,71,87,0.3)':'var(--border)'}`}}>
                {scanResult.error
                  ?<span style={{color:'var(--red)'}}>{scanResult.error}</span>
                  :<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{scanResult.itemName}</div>
                      <div style={{fontSize:12,color:'var(--text-2)'}}>{scanResult.barcode} · {scanResult.location} · {scanResult.stockLevel} {scanResult.unit}</div>
                    </div>
                    <button className="btn btn-ghost" onClick={()=>setSelected(scanResult)} style={{fontSize:11}}>View Details</button>
                  </div>
                }
              </motion.div>
            )}
          </div>

          <div className="card">
            <div style={{overflowX:'auto'}}>
              <table className="table">
                <thead><tr><th>QR/Barcode</th><th>Item</th><th>Stock</th><th>Location</th><th>Stage</th><th>Progress</th>{canEdit&&<th>Actions</th>}</tr></thead>
                <tbody>
                  {items.map(item=>{
                    const isLow = item.stockLevel <= item.reorderPoint;
                    const pct = currentProgress(item);
                    const lastStage = item.lifecycle?.length ? item.lifecycle[item.lifecycle.length-1].stage : 'Received';
                    return(
                      <tr key={item._id} onClick={()=>setSelected(item)} style={{cursor:'pointer'}}>
                        <td>
                          {item.qrCode
                            ?<img src={item.qrCode} alt="QR" style={{width:40,height:40,borderRadius:4,cursor:'pointer'}} onClick={e=>{e.stopPropagation();setQrView(item);}}/>
                            :<span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--accent)'}}>{item.barcode}</span>
                          }
                        </td>
                        <td>
                          <div style={{fontWeight:500}}>{item.itemName}</div>
                          <div style={{fontSize:11,color:'var(--text-2)'}}>{item.vendorName||'—'}</div>
                        </td>
                        <td>
                          <span style={{color:isLow?'var(--red)':'var(--green)',fontFamily:'var(--font-display)',fontWeight:700}}>{item.stockLevel}</span>
                          <span style={{fontSize:11,color:'var(--text-2)',marginLeft:4}}>{item.unit}</span>
                          {isLow&&<div style={{fontSize:10,color:'var(--red)'}}>▼ LOW</div>}
                        </td>
                        <td style={{fontSize:12,color:'var(--text-2)'}}>{item.location}</td>
                        <td>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:`${STAGE_COLOR[lastStage]||'#8fa8c8'}22`,color:STAGE_COLOR[lastStage]||'var(--text-2)',fontWeight:600}}>
                            {lastStage}
                          </span>
                        </td>
                        <td style={{minWidth:120}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div className="progress-bar" style={{flex:1}}>
                              <div className="progress-fill" style={{width:`${pct}%`,background:`linear-gradient(90deg,var(--accent),var(--green))`}}/>
                            </div>
                            <span style={{fontSize:10,color:'var(--text-2)'}}>{pct}%</span>
                          </div>
                        </td>
                        {canEdit&&(
                          <td onClick={e=>e.stopPropagation()} style={{display:'flex',gap:4}}>
                            <button className="btn btn-ghost" onClick={()=>{ setMoveForm({barcode:item.barcode,newLocation:item.location,stage:'',note:''}); setShowMove(item); }}
                              style={{padding:'4px 8px',fontSize:11}}>Move</button>
                            <button className="btn btn-ghost" onClick={()=>generateQR(item)} style={{padding:'4px 8px',fontSize:11}}>QR</button>
                            <button className="btn btn-danger" onClick={()=>deleteItem(item._id)} style={{padding:'4px 8px',fontSize:11}}>✕</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selected&&(
          <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} className="card"
            style={{height:'fit-content',position:'sticky',top:80}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16}}>{selected.itemName}</h3>
              <button onClick={()=>setSelected(null)} style={{background:'transparent',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:18}}>✕</button>
            </div>

            {selected.qrCode&&(
              <div style={{textAlign:'center',marginBottom:14}}>
                <img src={selected.qrCode} alt="QR" style={{width:140,height:140,borderRadius:8,border:'1px solid var(--border)'}}/>
                <div style={{fontSize:11,color:'var(--text-2)',marginTop:4}}>QR Code — {selected.barcode}</div>
              </div>
            )}

            <div className="grid-2" style={{gap:8,marginBottom:16}}>
              {[['Barcode',selected.barcode],['Stock',`${selected.stockLevel} ${selected.unit}`],
                ['Vendor',selected.vendorName||'—'],['Location',selected.location]].map(([l,v])=>(
                <div key={l} style={{background:'var(--bg-2)',borderRadius:6,padding:'8px 10px'}}>
                  <div style={{fontSize:10,color:'var(--text-2)'}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:500,marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Stage progress */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:'var(--text-2)',marginBottom:8}}>LIFECYCLE STAGES</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {STAGE_ORDER.map(stage=>{
                  const done = selected.lifecycle?.some(l=>l.stage===stage);
                  const isCurrent = selected.lifecycle?.length && selected.lifecycle[selected.lifecycle.length-1].stage===stage;
                  return(
                    <div key={stage} style={{padding:'3px 8px',borderRadius:10,fontSize:10,fontWeight:600,
                      background:isCurrent?`${STAGE_COLOR[stage]}22`:done?'rgba(0,230,118,0.1)':'var(--bg-2)',
                      color:isCurrent?STAGE_COLOR[stage]:done?'var(--green)':'var(--text-2)',
                      border:`1px solid ${isCurrent?STAGE_COLOR[stage]:done?'rgba(0,230,118,0.3)':'var(--border)'}`}}>
                      {done&&!isCurrent&&'✓ '}{stage}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{fontSize:11,color:'var(--text-2)',marginBottom:8}}>FULL TIMELINE</div>
            <LifecycleTimeline lifecycle={selected.lifecycle}/>
          </motion.div>
        )}
      </div>

      {/* Add item modal */}
      {showModal&&(
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:600,marginBottom:20}}>Add Inventory Item</h3>
            <form onSubmit={addItem}>
              <div className="form-group">
                <label className="form-label">Barcode / Batch ID (leave blank to auto-generate)</label>
                <input className="form-input" value={form.barcode}
                  onChange={e=>setForm({...form,barcode:e.target.value})}
                  placeholder="e.g. TXTL-1007 or BATCH-20260315-0042 (auto if empty)"/>
              </div>
              <div className="grid-2">
                {[['itemName','Item Name','text'],['vendorName','Vendor Name','text'],['stockLevel','Stock Level','number'],['reorderPoint','Reorder Point','number']].map(([k,l,t])=>(
                  <div key={k} className="form-group">
                    <label className="form-label">{l}</label>
                    <input type={t} className="form-input" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required={k!=='vendorName'}/>
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-input" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
                    {['meters','kg','liters','pieces','rolls'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
                </div>
              </div>
              <div style={{display:'flex',gap:10,marginTop:8}}>
                <button type="submit" className="btn btn-primary" style={{flex:1,justifyContent:'center'}}>Add Item + Generate QR</button>
                <button type="button" className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move/track modal */}
      {showMove&&(
        <div className="modal-overlay" onClick={()=>setShowMove(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:600,marginBottom:16}}>Track Movement — {showMove.itemName}</h3>
            <form onSubmit={submitMove}>
              <div className="form-group">
                <label className="form-label">New Location</label>
                <input className="form-input" value={moveForm.newLocation} onChange={e=>setMoveForm({...moveForm,newLocation:e.target.value})} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Lifecycle Stage</label>
                <select className="form-input" value={moveForm.stage} onChange={e=>setMoveForm({...moveForm,stage:e.target.value})}>
                  <option value="">-- Select Stage --</option>
                  {STAGE_ORDER.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input className="form-input" value={moveForm.note} onChange={e=>setMoveForm({...moveForm,note:e.target.value})} placeholder="e.g. Moved to dye station"/>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button type="submit" className="btn btn-primary" style={{flex:1,justifyContent:'center'}}>Update Movement</button>
                <button type="button" className="btn btn-ghost" onClick={()=>setShowMove(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR view modal */}
      {qrView&&(
        <div className="modal-overlay" onClick={()=>setQrView(null)}>
          <div className="modal" style={{maxWidth:340,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:18,marginBottom:16}}>{qrView.itemName}</h3>
            <img src={qrView.qrCode} alt="QR Code" style={{width:'100%',maxWidth:280,borderRadius:8}}/>
            <div style={{fontSize:12,color:'var(--text-2)',marginTop:8,fontFamily:'var(--font-mono)'}}>{qrView.barcode}</div>
            <div style={{fontSize:11,color:'var(--text-2)',marginTop:4}}>Scan to track this item</div>
            <button className="btn btn-primary" style={{marginTop:16,width:'100%',justifyContent:'center'}}
              onClick={()=>{ const a=document.createElement('a'); a.href=qrView.qrCode; a.download=`QR-${qrView.barcode}.png`; a.click(); }}>
              ⬇ Download QR Code
            </button>
            <button className="btn btn-ghost" style={{marginTop:8,width:'100%',justifyContent:'center'}} onClick={()=>setQrView(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Camera Scanner — USB phone or webcam */}
      <CameraScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={(value) => {
          setScanInput(value);
          // Auto-lookup after scan
          setTimeout(async () => {
            try {
              let barcode = value;
              try { const p = JSON.parse(value); barcode = p.barcode || value; } catch {}
              const { data } = await API.get('/inventory/barcode/' + barcode);
              setScanResult(data);
              setSelected(data);
            } catch {
              setScanResult({ error: 'Item not found: ' + value });
            }
          }, 100);
        }}
        title="Scan Inventory QR / Barcode"
      />
    </div>
  );
}
