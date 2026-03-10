// import React, { useEffect, useState } from 'react';
// import { AdminAPI } from '../services/api';
// import { PageHeader, Card, Table, Badge } from '../components/ui';
// import { COLORS } from '../constants';

// export default function AuditPage() {
//   const [logs, setLogs] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [page, setPage] = useState(1);

//   useEffect(() => {
//     AdminAPI.getAuditLogs(page)
//       .then((r) => setLogs(r.data.data || []))
//       .catch(console.error)
//       .finally(() => setLoading(false));
//   }, [page]);

//   const actionColors: Record<string, { color: string; bg: string }> = {
//     AUTH_LOGIN:           { color: COLORS.primary,  bg: COLORS.primary + '18' },
//     SESSION_START:        { color: COLORS.success,  bg: COLORS.successLight },
//     SESSION_END:          { color: COLORS.warning,  bg: COLORS.warningLight },
//     MANUAL_OVERRIDE:      { color: COLORS.suspicious, bg: COLORS.suspiciousLight },
//     DEVICE_RESET_APPROVED:{ color: COLORS.success,  bg: COLORS.successLight },
//     DEVICE_RESET_REJECTED:{ color: COLORS.danger,   bg: COLORS.dangerLight },
//     FACE_ENROLLMENT:      { color: COLORS.primary,  bg: COLORS.primary + '18' },
//   };

//   return (
//     <div>
//       <PageHeader title="🔍 Audit Logs" subtitle="Full system activity trail" />
//       <Card>
//         {loading
//           ? <p style={{ textAlign: 'center', color: COLORS.textMuted, padding: 40 }}>Loading...</p>
//           : <>
//               <Table
//                 headers={['Timestamp', 'User', 'Role', 'Action', 'IP']}
//                 emptyText="No audit logs"
//                 rows={logs.map((log) => {
//                   const ac = actionColors[log.action] || {
//                     color: COLORS.textSecondary, bg: COLORS.border,
//                   };
//                   return [
//                     <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
//                       {new Date(log.created_at).toLocaleString()}
//                     </span>,
//                     <span style={{ fontSize: 13 }}>{log.email || '—'}</span>,
//                     log.role
//                       ? <Badge label={log.role} color={COLORS.textSecondary} bg={COLORS.border} />
//                       : '—',
//                     <Badge label={log.action} color={ac.color} bg={ac.bg} />,
//                     <span style={{ fontSize: 12, color: COLORS.textMuted }}>
//                       {log.ip_address || '—'}
//                     </span>,
//                   ];
//                 })}
//               />
//               <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
//                 <button
//                   onClick={() => setPage(Math.max(1, page - 1))}
//                   disabled={page === 1}
//                   style={pgBtn}
//                 >
//                   ← Prev
//                 </button>
//                 <span style={{ padding: '6px 12px', fontSize: 13 }}>Page {page}</span>
//                 <button
//                   onClick={() => setPage(page + 1)}
//                   disabled={logs.length < 100}
//                   style={pgBtn}
//                 >
//                   Next →
//                 </button>
//               </div>
//             </>
//         }
//       </Card>
//     </div>
//   );
// }

// const pgBtn: React.CSSProperties = {
//   padding: '6px 16px', border: `1.5px solid ${COLORS.border}`,
//   borderRadius: 8, cursor: 'pointer', fontSize: 13,
//   backgroundColor: COLORS.white,
// };












import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../services/api';
import { BASE_CSS, D } from '../components/design-tokens'; // adjust path as needed

const ACTION_STYLE: Record<string, { cls: string }> = {
  AUTH_LOGIN:            { cls: 'badge-purple' },
  SESSION_START:         { cls: 'badge-green'  },
  SESSION_END:           { cls: 'badge-muted'  },
  MANUAL_OVERRIDE:       { cls: 'badge-amber'  },
  DEVICE_RESET_APPROVED: { cls: 'badge-green'  },
  DEVICE_RESET_REJECTED: { cls: 'badge-red'    },
  FACE_ENROLLMENT:       { cls: 'badge-blue'   },
  FACE_RESET_APPROVED:   { cls: 'badge-green'  },
  FACE_RESET_REJECTED:   { cls: 'badge-red'    },
};

const ROLE_STYLE: Record<string, string> = {
  ADMIN:     'badge-purple',
  PROFESSOR: 'badge-blue',
  STUDENT:   'badge-green',
  SYSTEM:    'badge-muted',
};

export default function AuditPage() {
  const [logs, setLogs]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    AdminAPI.getAuditLogs(page, search)
      .then(r => setLogs(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search]);

  const filtered = search
    ? logs.filter(l =>
        (l.email||'').toLowerCase().includes(search.toLowerCase()) ||
        (l.action||'').toLowerCase().includes(search.toLowerCase()) ||
        (l.role||'').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <><style>{BASE_CSS}</style>
    <div className="sa-page">
      <div className="sa-blob1"/><div className="sa-blob2"/>
      <div className="sa-inner">

        {/* Header */}
        <div className="sa-header">
          <div>
            <div className="sa-eyebrow">SmartAttend Admin</div>
            <div><span className="sa-title">Audit Logs</span><span className="sa-chip">{filtered.length}</span></div>
            <p className="sa-subtitle">Full system activity trail</p>
          </div>
          <div className="sa-actions">
            <div className="sa-search-wrap">
              <svg className="sa-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="sa-search" placeholder="Search user, action, role…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="sa-card">
          <div className="sa-card-header"><div><p className="sa-card-title">Activity Log</p><p className="sa-card-sub">{filtered.length} entries · Page {page}</p></div></div>
          {loading ? (
            <div className="sa-loading" style={{minHeight:200}}><div className="spinner"/>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="sa-empty"><div className="sa-empty-icon">🔍</div><div className="sa-empty-text">No audit logs</div></div>
          ) : (
            <table className="sa-table">
              <thead><tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>IP Address</th></tr></thead>
              <tbody>
                {filtered.map((log, idx) => {
                  const ac = ACTION_STYLE[log.action] || { cls:'badge-muted' };
                  const rc = ROLE_STYLE[log.role] || 'badge-muted';
                  return (
                    <tr key={log.audit_id || idx} style={{animationDelay:`${idx*15}ms`}}>
                      <td><span style={{fontSize:12,fontVariantNumeric:'tabular-nums',color:D.textMuted,whiteSpace:'nowrap'}}>{new Date(log.created_at).toLocaleString()}</span></td>
                      <td><span style={{fontSize:13,fontWeight:500,color:D.textPrimary}}>{log.email||'—'}</span></td>
                      <td>{log.role ? <span className={rc}>{log.role}</span> : <span style={{color:D.textMuted,fontSize:12}}>—</span>}</td>
                      <td><span className={ac.cls} style={{fontFamily:'Courier New',letterSpacing:'.02em'}}>{log.action}</span></td>
                      <td><span style={{fontSize:12,color:D.textMuted,fontFamily:'Courier New'}}>{log.ip_address||'—'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && (
            <div className="sa-pg">
              <span className="sa-pg-info">Page {page}</span>
              <div className="sa-pg-btns">
                <button className="sa-pg-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
                <button className="sa-pg-btn" disabled={logs.length<100} onClick={()=>setPage(p=>p+1)}>Next →</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
    </>
  );
}