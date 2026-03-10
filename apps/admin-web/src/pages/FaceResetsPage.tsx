

import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../services/api';
import { BASE_CSS, D } from '../components/design-tokens'; // adjust path as needed

export default function FaceResetsPage() {
  const [requests, setRequests]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setFilter]   = useState('PENDING');
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await AdminAPI.listFaceResets(statusFilter);
      setRequests(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadRequests(); }, [statusFilter]);

  async function handleApprove(id: string) {
    if (!confirm("Approve this face reset? The student's current face data will be wiped.")) return;
    setProcessing(id);
    try { await AdminAPI.approveFaceReset(id); await loadRequests(); }
    catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setProcessing(null); }
  }

  async function handleReject() {
    if (!rejectModal || !rejectNote.trim()) { alert('Please provide a reason.'); return; }
    setProcessing(rejectModal);
    try {
      await AdminAPI.rejectFaceReset(rejectModal, rejectNote.trim());
      setRejectModal(null); setRejectNote(''); await loadRequests();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setProcessing(null); }
  }

  const statusBadge = (status: string) => {
    if (status === 'APPROVED') return <span className="badge-green"><span className="status-dot dot-green"/>Approved</span>;
    if (status === 'REJECTED') return <span className="badge-red"><span className="status-dot dot-red"/>Rejected</span>;
    return <span className="badge-amber"><span className="status-dot dot-amber"/>Pending</span>;
  };

  return (
    <><style>{BASE_CSS}</style>
    <div className="sa-page">
      <div className="sa-blob1"/><div className="sa-blob2"/>
      <div className="sa-inner">

        {/* Header */}
        <div className="sa-header">
          <div>
            <div className="sa-eyebrow">SmartAttend Admin</div>
            <div><span className="sa-title">Face Resets</span><span className="sa-chip">{requests.length}</span></div>
            <p className="sa-subtitle">Review and approve student face re-enrollment requests</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs">
          {(['PENDING','APPROVED','REJECTED'] as const).map(s => (
            <button key={s} className={`filter-tab${statusFilter===s?' active':''}`} onClick={()=>setFilter(s)}>
              {s==='PENDING'&&<span style={{color:D.amber,marginRight:5}}>●</span>}
              {s==='APPROVED'&&<span style={{color:D.green,marginRight:5}}>●</span>}
              {s==='REJECTED'&&<span style={{color:D.red,marginRight:5}}>●</span>}
              {s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="sa-card">
          <div className="sa-card-header"><div><p className="sa-card-title">Face Reset Requests</p><p className="sa-card-sub">{requests.length} {statusFilter.toLowerCase()} request{requests.length!==1?'s':''}</p></div></div>
          {loading ? (
            <div className="sa-loading" style={{minHeight:200}}><div className="spinner"/>Loading…</div>
          ) : requests.length === 0 ? (
            <div className="sa-empty"><div className="sa-empty-icon">🪞</div><div className="sa-empty-text">No {statusFilter.toLowerCase()} requests</div></div>
          ) : (
            <table className="sa-table">
              <thead><tr><th>Student</th><th>Roll No</th><th>Reason</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {requests.map((req,idx)=>(
                  <tr key={req.request_id} style={{animationDelay:`${idx*20}ms`}}>
                    <td>
                      <span style={{fontWeight:700,color:D.textPrimary,fontSize:14,fontFamily:'Syne',display:'block'}}>{req.student_name}</span>
                      <span style={{fontSize:11,color:D.textMuted}}>{req.email}</span>
                    </td>
                    <td><span className="code-tag">{req.roll_number}</span></td>
                    <td><span style={{fontSize:12,color:D.textSecondary,display:'block',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={req.reason}>{req.reason}</span></td>
                    <td><span style={{fontSize:12,fontVariantNumeric:'tabular-nums',color:D.textMuted}}>{new Date(req.created_at).toLocaleDateString()}</span></td>
                    <td>{statusBadge(req.status)}</td>
                    <td>
                      {req.status==='PENDING' ? (
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn-success" disabled={processing===req.request_id} onClick={()=>handleApprove(req.request_id)}>{processing===req.request_id?'…':'✓ Approve'}</button>
                          <button className="btn-danger"  disabled={processing===req.request_id} onClick={()=>{setRejectModal(req.request_id);setRejectNote('');}}>✕ Reject</button>
                        </div>
                      ) : (
                        <span style={{fontSize:12,color:D.textMuted}}>{req.admin_note||req.resolved_at?.split('T')[0]||'—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Reject Modal */}
        {rejectModal && (
          <div className="sa-modal-overlay" onClick={e=>e.target===e.currentTarget&&setRejectModal(null)}>
            <div className="sa-modal-box">
              <div className="sa-modal-title">Reject Request</div>
              <div className="sa-modal-sub">Provide a reason. This will be recorded in the audit log.</div>
              <div className="sa-form-group"><label className="sa-form-label">Rejection Reason *</label>
                <textarea className="sa-form-textarea" rows={4} value={rejectNote} onChange={e=>setRejectNote(e.target.value)} placeholder="e.g. Please provide a valid reason or contact admin directly."/>
              </div>
              <div className="sa-form-actions">
                <button className="sa-btn-submit" style={{background:D.red}} disabled={!!processing} onClick={handleReject}>{processing?'Rejecting…':'Reject Request'}</button>
                <button className="sa-btn-cancel" onClick={()=>setRejectModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
    </>
  );
}