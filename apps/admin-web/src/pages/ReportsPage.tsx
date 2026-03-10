

import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../services/api';
import { BASE_CSS, D } from '../components/design-tokens';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';

const PIE_COLORS = [D.green, D.red, D.amber];

function ScoreCell({ value, threshold }: { value?: number; threshold: number }) {
  if (value == null) return <span style={{color:D.textMuted}}>—</span>;
  const pct = Math.round(value * 100);
  const ok = value >= threshold;
  return (
    <span style={{
      fontFamily:'Syne',fontWeight:700,fontSize:13,
      color: ok ? D.green : D.red,
      background: ok ? D.greenLight : D.redLight,
      padding:'2px 8px',borderRadius:6,
    }}>{pct}%</span>
  );
}

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:10,padding:'10px 14px',boxShadow:D.shadowMd,fontSize:12}}>
      <p style={{fontFamily:'Syne',fontWeight:700,color:D.textPrimary,margin:'0 0 6px'}}>{label}</p>
      {payload.map((p:any) => (
        <p key={p.name} style={{margin:0,color:p.fill,display:'flex',alignItems:'center',gap:6}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:p.fill,display:'inline-block'}}/>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');

  async function loadReport() {
    setLoading(true);
    try {
      const params: Record<string,string> = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate)   params.to_date   = toDate + 'T23:59:59';
      const res = await AdminAPI.getAttendanceReport(params);
      setReport(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadReport(); }, []);

  const totalPresent = report.filter(r => r.status === 'PRESENT').length;
  const totalAbsent  = report.filter(r => r.status === 'ABSENT').length;
  const totalManual  = report.filter(r => r.marked_by === 'PROFESSOR').length;

  const pieData = [
    { name:'Present', value:totalPresent },
    { name:'Absent',  value:totalAbsent  },
    { name:'Manual',  value:totalManual  },
  ];

  const byCourse: Record<string,{present:number;absent:number}> = {};
  report.forEach(r => {
    const k = r.course_code;
    if (!byCourse[k]) byCourse[k] = {present:0,absent:0};
    if (r.status === 'PRESENT') byCourse[k].present++; else byCourse[k].absent++;
  });
  const courseData = Object.entries(byCourse).map(([code, counts]) => ({ course:code, ...counts }));

  function exportCSV() {
    const headers = ['Student','Roll No','Course','Professor','Date','Status','Face Score','Liveness Score','Scene Score','Marked By'];
    const rows = report.map(r => [r.student_name,r.roll_number,r.course_name,r.professor_name,r.session_date?.split('T')[0],r.status,r.face_score?.toFixed(3)||'',r.liveness_score?.toFixed(3)||'',r.scene_score?.toFixed(3)||'',r.marked_by]);
    const csv = [headers,...rows].map(r=>r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `attendance_report_${Date.now()}.csv`; a.click();
  }

  const css = BASE_CSS + `
  .rp-stat-card { background:${D.surface}; border:1px solid ${D.border}; border-radius:${D.radius}px; padding:20px 24px; box-shadow:${D.shadow}; display:flex; align-items:center; gap:14px; }
  .rp-stat-val { font-family:'Syne',sans-serif; font-size:32px; font-weight:800; line-height:1; letter-spacing:-1px; }
  .rp-stat-label { font-size:11px; color:${D.textMuted}; font-weight:500; letter-spacing:.08em; text-transform:uppercase; margin-top:3px; }
  .rp-stat-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
  .date-input { padding:9px 12px; background:${D.surface}; border:1.5px solid ${D.border}; border-radius:${D.radiusSm}px; font-family:'DM Sans',sans-serif; font-size:13px; color:${D.textPrimary}; outline:none; transition:all .15s ease; }
  .date-input:focus { border-color:${D.purple}; box-shadow:0 0 0 3px ${D.purpleLight}; }
  `;

  return (
    <><style>{css}</style>
    <div className="sa-page">
      <div className="sa-blob1"/><div className="sa-blob2"/>
      <div className="sa-inner">

        {/* Header */}
        <div className="sa-header">
          <div>
            <div className="sa-eyebrow">SmartAttend Admin</div>
            <div><span className="sa-title">Reports</span><span className="sa-chip">{report.length} records</span></div>
            <p className="sa-subtitle">Attendance data with verification scores</p>
          </div>
          <div className="sa-actions">
            <button className="btn-ghost" onClick={exportCSV}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="sa-card" style={{marginBottom:20,padding:'16px 24px'}}>
          <div style={{display:'flex',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:D.textMuted,marginBottom:5}}>From Date</label><input type="date" className="date-input" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:D.textMuted,marginBottom:5}}>To Date</label><input type="date" className="date-input" value={toDate} onChange={e=>setToDate(e.target.value)}/></div>
            <button className="btn-primary" onClick={loadReport}>Apply Filter</button>
            <button className="btn-ghost" onClick={()=>{setFromDate('');setToDate('');}}>Clear</button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,marginBottom:20}}>
          {[
            {label:'Present',value:totalPresent,icon:'✅',color:D.green,light:D.greenLight},
            {label:'Absent', value:totalAbsent, icon:'❌',color:D.red,  light:D.redLight},
            {label:'Manual', value:totalManual, icon:'✏️',color:D.amber,light:D.amberLight},
            {label:'Total',  value:report.length,icon:'📊',color:D.purple,light:D.purpleLight},
          ].map(s=>(
            <div key={s.label} className="rp-stat-card">
              <div className="rp-stat-icon" style={{background:s.light}}>{s.icon}</div>
              <div><div className="rp-stat-val" style={{color:s.color}}>{s.value}</div><div className="rp-stat-label">{s.label}</div></div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:20}}>
          {/* Pie */}
          <div className="sa-card" style={{flex:1,minWidth:260,padding:'20px 24px'}}>
            <p className="sa-card-title" style={{marginBottom:4}}>Overall Distribution</p>
            <p className="sa-card-sub" style={{marginBottom:16}}>Present vs Absent vs Manual</p>
            {report.length === 0 ? <div className="sa-empty" style={{padding:'32px 0'}}><div className="sa-empty-icon">📊</div><div className="sa-empty-text">No data</div></div> : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                    {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:10,fontSize:12}}/>
                  <Legend wrapperStyle={{fontSize:12}}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Bar */}
          <div className="sa-card" style={{flex:2,minWidth:300,padding:'20px 24px'}}>
            <p className="sa-card-title" style={{marginBottom:4}}>Attendance by Course</p>
            <p className="sa-card-sub" style={{marginBottom:16}}>Present vs Absent breakdown per course</p>
            {courseData.length === 0 ? <div className="sa-empty" style={{padding:'32px 0'}}><div className="sa-empty-icon">📈</div><div className="sa-empty-text">No data for range</div></div> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={courseData}>
                  <defs>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={D.purple}/><stop offset="100%" stopColor={D.purpleMid} stopOpacity={.7}/></linearGradient>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={D.red} stopOpacity={.85}/><stop offset="100%" stopColor={D.red} stopOpacity={.4}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={D.border} vertical={false}/>
                  <XAxis dataKey="course" tick={{fontSize:11,fill:D.textMuted}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:11,fill:D.textMuted}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomBarTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:12,paddingTop:8}}/>
                  <Bar dataKey="present" fill="url(#gP)" name="Present" radius={[6,6,0,0]} maxBarSize={28}/>
                  <Bar dataKey="absent"  fill="url(#gA)" name="Absent"  radius={[6,6,0,0]} maxBarSize={28}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Detail table */}
        <div className="sa-card">
          <div className="sa-card-header"><div><p className="sa-card-title">Detailed Records</p><p className="sa-card-sub">Full attendance log with AI verification scores</p></div></div>
          {loading ? (
            <div className="sa-loading" style={{minHeight:160}}><div className="spinner"/>Loading…</div>
          ) : report.length === 0 ? (
            <div className="sa-empty"><div className="sa-empty-icon">📋</div><div className="sa-empty-text">No records found</div></div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table className="sa-table">
                <thead><tr><th>Student</th><th>Course</th><th>Date</th><th>Status</th><th>Face</th><th>Live</th><th>Scene</th><th>By</th></tr></thead>
                <tbody>
                  {report.map((r,idx)=>(
                    <tr key={idx} style={{animationDelay:`${idx*15}ms`}}>
                      <td>
                        <span style={{fontWeight:600,color:D.textPrimary,fontSize:13,display:'block'}}>{r.student_name}</span>
                        <span className="code-tag" style={{marginTop:3,display:'inline-block'}}>{r.roll_number}</span>
                      </td>
                      <td>
                        <span style={{fontWeight:600,color:D.textPrimary,fontSize:13,display:'block'}}>{r.course_code}</span>
                        <span style={{fontSize:11,color:D.textMuted}}>{r.professor_name}</span>
                      </td>
                      <td><span style={{fontSize:12,fontVariantNumeric:'tabular-nums'}}>{r.session_date?.split('T')[0]}</span></td>
                      <td>
                        {r.status==='PRESENT'
                          ? <span className="badge-green"><span className="status-dot dot-green"/>Present</span>
                          : r.status==='MANUAL_OVERRIDE'
                            ? <span className="badge-amber"><span className="status-dot dot-amber"/>Manual</span>
                            : <span className="badge-red"><span className="status-dot dot-red"/>Absent</span>
                        }
                      </td>
                      <td><ScoreCell value={r.face_score}     threshold={0.65}/></td>
                      <td><ScoreCell value={r.liveness_score} threshold={0.70}/></td>
                      <td><ScoreCell value={r.scene_score}    threshold={0.60}/></td>
                      <td>
                        {r.marked_by==='PROFESSOR'
                          ? <span className="badge-amber">Manual</span>
                          : <span className="badge-purple">System</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
    </>
  );
}