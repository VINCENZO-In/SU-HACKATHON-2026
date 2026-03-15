import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import API from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const BADGE_CFG = { GOLD:{color:'#ffd32a',bg:'rgba(255,211,42,0.12)',icon:'🥇'}, SILVER:{color:'#c0c0c0',bg:'rgba(192,192,192,0.12)',icon:'🥈'}, BRONZE:{color:'#cd7f32',bg:'rgba(205,127,50,0.12)',icon:'🥉'}, REVIEW:{color:'#ff4757',bg:'rgba(255,71,87,0.12)',icon:'⚠️'} };
const RISK_BADGE = { Low:'badge-green', Medium:'badge-yellow', High:'badge-red' };

function TimelineBar({ timeline }) {
  if (!timeline?.length) return <div style={{color:'var(--text-2)',fontSize:12}}>No delivery history</div>;
  return (
    <div style={{overflowX:'auto'}}>
      <div style={{display:'flex',gap:4,paddingBottom:4,minWidth:400}}>
        {timeline.map((t,i)=>{
          const color = t.status==='Early/On-Time'?'#00e676':t.status==='Slightly Late'?'#ffd32a':'#ff4757';
          return(
            <div key={i} style={{flex:1,minWidth:60}}>
              <div style={{height:24,background:color+'33',border:`1px solid ${color}`,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color,fontWeight:600}}>
                {t.gapDays===null?'Pending':t.gapDays<=0?`+${Math.abs(t.gapDays)}d early`:`${t.gapDays}d late`}
              </div>
              <div style={{fontSize:9,color:'var(--text-2)',marginTop:2,textAlign:'center'}}>{t.orderId?.slice(-4)}</div>
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',gap:12,marginTop:6}}>
        <span style={{fontSize:10,color:'#00e676'}}>🟢 On-Time/Early</span>
        <span style={{fontSize:10,color:'#ffd32a'}}>🟡 Slightly Late</span>
        <span style={{fontSize:10,color:'#ff4757'}}>🔴 Late</span>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const [analysis, setAnalysis] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDelivery, setShowDelivery] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ supplierId:'', name:'', email:'', contact:'', materials:'' });
  const [delivForm, setDelivForm] = useState({ orderId:'', expectedDate:'', actualDate:'', onTime:true, qualityScore:90, amount:'', paidOnTime:true, paymentDate:'' });
  const { user } = useAuth();
  const canEdit = user?.role !== 'worker';

  const load = async () => {
    const { data } = await API.get('/suppliers/risk');
    setAnalysis(data);
  };
  useEffect(() => { load(); }, []);

  const addSupplier = async (e) => {
    e.preventDefault();
    try {
      await API.post('/suppliers', { ...form, materials: form.materials.split(',').map(s=>s.trim()) });
      setShowModal(false); 
      setForm({ supplierId:'', name:'', email:'', contact:'', materials:'' }); // Reset form
      load();
    } catch (err) {
      const msg = err.response?.data?.msg || err.message;
      alert(`Failed to add supplier: ${msg}`);
    }
  };

  const addDelivery = async (e) => {
    e.preventDefault();
    try {
      await API.post(`/suppliers/${showDelivery.id}/delivery`, delivForm);
      setShowDelivery(null); 
      setDelivForm({ orderId:'', expectedDate:'', actualDate:'', onTime:true, qualityScore:90, amount:'', paidOnTime:true, paymentDate:'' }); // Reset form
      load();
    } catch (err) {
      const msg = err.response?.data?.msg || err.message;
      alert(`Failed to add delivery: ${msg}`);
    }
  };

  const scoreColor = (s) => s>=80?'var(--green)':s>=60?'var(--yellow)':'var(--red)';

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700}}>Supplier Intelligence</h1>
          <p style={{color:'var(--text-2)',fontSize:13,marginTop:4}}>AI ranking · Delivery timeline · Payment history · Risk analysis</p>
        </div>
        {canEdit&&<button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Add Supplier</button>}
      </div>

      {/* Top 3 podium */}
      {analysis.length>=3&&(
        <div style={{display:'flex',gap:12,marginBottom:24}}>
          {[analysis[1],analysis[0],analysis[2]].filter(Boolean).map((s,i)=>{
            const badge = BADGE_CFG[s.badge]||BADGE_CFG.REVIEW;
            const isFirst = s.rank===1;
            return(
              <motion.div key={s.id} className="card" initial={{opacity:0,y:20}} animate={{opacity:1,y:isFirst?-8:0}}
                style={{flex:1,textAlign:'center',borderColor:badge.color+'44',background:isFirst?`${badge.color}08`:'var(--bg-card)',cursor:'pointer'}}
                onClick={()=>setSelected(selected?.id===s.id?null:s)}>
                <div style={{fontSize:isFirst?48:36}}>{badge.icon}</div>
                <div style={{fontFamily:'var(--font-display)',fontSize:15,fontWeight:700,marginTop:6}}>{s.name}</div>
                <div style={{fontFamily:'var(--font-display)',fontSize:32,fontWeight:700,color:scoreColor(s.reliabilityScore),margin:'8px 0'}}>{s.reliabilityScore}</div>
                <div style={{fontSize:11,color:'var(--text-2)'}}>Score · #{s.rank}</div>
                <div style={{marginTop:8,display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap'}}>
                  <span className={`badge ${RISK_BADGE[s.riskLevel]}`}>{s.riskLevel} Risk</span>
                  <span style={{padding:'3px 8px',borderRadius:10,fontSize:10,background:badge.bg,color:badge.color,fontWeight:700}}>{s.badge}</span>
                </div>
                {s.avgDeliveryGapDays!==0&&(
                  <div style={{marginTop:6,fontSize:11,color:s.avgDeliveryGapDays<0?'var(--green)':'var(--red)'}}>
                    {s.avgDeliveryGapDays<0?`${Math.abs(s.avgDeliveryGapDays)}d avg early`:`${s.avgDeliveryGapDays}d avg late`}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Bar chart comparison */}
      <div className="grid-2" style={{marginBottom:20}}>
        <div className="card">
          <h3 style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15,marginBottom:16}}>Reliability Score Comparison</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analysis} layout="vertical">
              <XAxis type="number" domain={[0,100]} tick={{fontSize:10,fill:'var(--text-2)'}}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'var(--text-2)'}} width={100}/>
              <Tooltip contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',fontSize:11}}/>
              <Bar dataKey="reliabilityScore" radius={[0,6,6,0]}>
                {analysis.map((s,i)=><Cell key={i} fill={scoreColor(s.reliabilityScore)}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15,marginBottom:16}}>Delivery Gap (Days Early/Late)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analysis} layout="vertical">
              <XAxis type="number" tick={{fontSize:10,fill:'var(--text-2)'}}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'var(--text-2)'}} width={100}/>
              <Tooltip contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',fontSize:11}} formatter={v=>[`${v>0?'+':''}${v} days`,'']}/>
              <Bar dataKey="avgDeliveryGapDays" radius={[0,6,6,0]}>
                {analysis.map((s,i)=><Cell key={i} fill={s.avgDeliveryGapDays<=0?'#00e676':'#ff4757'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Selected supplier timeline */}
      {selected&&(
        <motion.div className="card" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} style={{marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h3 style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16}}>{selected.name} — Delivery Timeline</h3>
            <button onClick={()=>setSelected(null)} style={{background:'transparent',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:18}}>✕</button>
          </div>
          <div className="grid-4" style={{marginBottom:16}}>
            {[['Total Deliveries',selected.totalDeliveries],['Early Payments',selected.earlyPayments],
              ['Late Delivery Rate',`${selected.lateDeliveryRate}%`],['Defect Rate',`${selected.defectRate}%`]].map(([l,v])=>(
              <div key={l} style={{background:'var(--bg-2)',borderRadius:8,padding:'10px 14px'}}>
                <div style={{fontSize:11,color:'var(--text-2)'}}>{l}</div>
                <div style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:700,marginTop:4}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:'var(--text-2)',marginBottom:8}}>DELIVERY TIMELINE ({selected.timeline.length} orders)</div>
            <TimelineBar timeline={selected.timeline}/>
          </div>
          {canEdit&&(
            <button className="btn btn-ghost" onClick={()=>setShowDelivery(selected)} style={{fontSize:12}}>+ Add Delivery Record</button>
          )}
        </motion.div>
      )}

      {/* Full table */}
      <div className="card">
        <div style={{overflowX:'auto'}}>
          <table className="table">
            <thead><tr><th>Rank</th><th>Supplier</th><th>Materials</th><th>Score</th><th>Risk</th><th>Avg Gap</th><th>Early Pays</th><th>Recommendation</th>{canEdit&&<th>Actions</th>}</tr></thead>
            <tbody>
              {analysis.map(s=>{
                const badge=BADGE_CFG[s.badge]||BADGE_CFG.REVIEW;
                return(
                  <tr key={s.id} onClick={()=>setSelected(selected?.id===s.id?null:s)} style={{cursor:'pointer'}}>
                    <td style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:18,color:scoreColor(s.reliabilityScore)}}>#{s.rank}</td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:16}}>{badge.icon}</span>
                        <div>
                          <div style={{fontWeight:600}}>{s.name}</div>
                          <div style={{fontSize:11,color:'var(--accent)',fontFamily:'var(--font-mono)'}}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{fontSize:11}}>{s.materials?.join(', ')}</td>
                    <td>
                      <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:20,color:scoreColor(s.reliabilityScore)}}>{s.reliabilityScore}</div>
                    </td>
                    <td><span className={`badge ${RISK_BADGE[s.riskLevel]}`}>{s.riskLevel}</span></td>
                    <td style={{color:s.avgDeliveryGapDays<=0?'var(--green)':'var(--red)',fontFamily:'var(--font-mono)',fontWeight:600}}>
                      {s.avgDeliveryGapDays>0?'+':''}{s.avgDeliveryGapDays}d
                    </td>
                    <td style={{fontFamily:'var(--font-display)',fontWeight:600,color:'var(--accent)'}}>{s.earlyPayments}</td>
                    <td style={{fontSize:12,color:'var(--text-2)'}}>{s.recommendation}</td>
                    {canEdit&&(
                      <td>
                        <button className="btn btn-ghost" onClick={e=>{e.stopPropagation();setShowDelivery(s);}} style={{fontSize:11,padding:'4px 8px'}}>+ Delivery</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add supplier modal */}
      {showModal&&(
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:600,marginBottom:20}}>Add Supplier</h3>
            <form onSubmit={addSupplier}>
              {[['supplierId','Supplier ID'],['name','Supplier Name'],['email','Email'],['contact','Contact'],['materials','Materials (comma separated)']].map(([k,l])=>(
                <div key={k} className="form-group"><label className="form-label">{l}</label>
                  <input className="form-input" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required={k!=='contact'&&k!=='materials'}/></div>
              ))}
              <div style={{display:'flex',gap:10,marginTop:8}}>
                <button type="submit" className="btn btn-primary" style={{flex:1,justifyContent:'center'}}>Add Supplier</button>
                <button type="button" className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add delivery modal */}
      {showDelivery&&(
        <div className="modal-overlay" onClick={()=>setShowDelivery(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:600,marginBottom:16}}>Add Delivery — {showDelivery.name}</h3>
            <form onSubmit={addDelivery}>
              <div className="grid-2">
                {[['orderId','Order ID','text'],['expectedDate','Expected Date','date'],['actualDate','Actual Date','date'],['qualityScore','Quality Score (0-100)','number'],['amount','Amount (₹)','number'],['paymentDate','Payment Date','date']].map(([k,l,t])=>(
                  <div key={k} className="form-group"><label className="form-label">{l}</label>
                    <input type={t} className="form-input" value={delivForm[k]} onChange={e=>setDelivForm({...delivForm,[k]:e.target.value})} min={t==='number'?0:undefined}/></div>
                ))}
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Delivered On Time?</label>
                  <select className="form-input" value={delivForm.onTime} onChange={e=>setDelivForm({...delivForm,onTime:e.target.value==='true'})}>
                    <option value="true">Yes</option><option value="false">No</option></select></div>
                <div className="form-group"><label className="form-label">Payment On Time?</label>
                  <select className="form-input" value={delivForm.paidOnTime} onChange={e=>setDelivForm({...delivForm,paidOnTime:e.target.value==='true'})}>
                    <option value="true">Yes</option><option value="false">No</option></select></div>
              </div>
              <div style={{display:'flex',gap:10,marginTop:8}}>
                <button type="submit" className="btn btn-primary" style={{flex:1,justifyContent:'center'}}>Save Record</button>
                <button type="button" className="btn btn-ghost" onClick={()=>setShowDelivery(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
