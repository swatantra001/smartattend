
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AdminAPI } from '../services/api';
import { BASE_CSS, D } from '../components/design-tokens'; // adjust path as needed

interface Student {
  student_id: string; name: string; roll_number: string; semester: number;
  pending_email: string | null; email: string | null; dept_name: string;
  dept_id: string;
  is_active: boolean; awaiting_registration: boolean; face_enrolled_at: string | null;
}
interface Department { dept_id: string; name: string; code: string; }

const avatarGradients = [
  'linear-gradient(135deg,#10B981,#3B82F6)',
  'linear-gradient(135deg,#7C3AED,#10B981)',
  'linear-gradient(135deg,#F59E0B,#EF4444)',
  'linear-gradient(135deg,#3B82F6,#7C3AED)',
  'linear-gradient(135deg,#EC4899,#F59E0B)',
  'linear-gradient(135deg,#14B8A6,#7C3AED)',
];

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Import tooltip data ───────────────────────────────────────────────────
const STUDENT_FORMAT_FIELDS = [
  { name: 'email',       type: 'string', desc: 'Student email address',         req: true  },
  { name: 'roll_number', type: 'string', desc: 'Unique roll / enrolment number', req: true  },
  { name: 'name',        type: 'string', desc: 'Full name',                      req: true  },
  { name: 'dept_id',     type: 'uuid',   desc: 'Department UUID or name/code',   req: true  },
  { name: 'semester',    type: 'number', desc: 'Current semester (1–10)',         req: false },
];

const STUDENT_FORMAT_EXAMPLES: Record<string, string> = {
  CSV: `email,name,roll_number,dept_id,semester
alice@uni.edu,Alice Kumar,22CS001,3fa85f64-...,3
bob@uni.edu,Bob Singh,22CS002,3fa85f64-...,3`,

  JSON: `[
  {
    "email": "alice@uni.edu",
    "name": "Alice Kumar",
    "roll_number": "22CS001",
    "dept_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "semester": 3
  },
  {
    "email": "bob@uni.edu",
    "name": "Bob Singh",
    "roll_number": "22CS002",
    "dept_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "semester": 3
  }
]`,

  Excel: `Column headers in Row 1 (case-insensitive):
  email | name | roll_number | dept_id | semester

Row 2 onwards — one student per row.
"dept_id" also accepts dept name or short code
(e.g. "Computer Science" or "CS").
"semester" defaults to 1 if omitted.`,
};

// ─── Inline CSS additions beyond BASE_CSS ─────────────────────────────────
const PAGE_CSS = `
/* ── Import tooltip (mirrors ProfessorsPage) ─────────────────────────── */
.sp-import-wrap { position: relative; }
.sp-import-tooltip {
  position: absolute; top: calc(100% + 10px); right: 0;
  width: 420px; background: #fff;
  border: 1.5px solid #E5E7EB; border-radius: 14px;
  box-shadow: 0 10px 24px rgba(0,0,0,.10);
  z-index: 300; overflow: hidden;
  animation: spTTIn .18s ease;
}
@keyframes spTTIn {
  from { opacity:0; transform:translateY(-6px); }
  to   { opacity:1; transform:translateY(0); }
}
.sp-import-tooltip::before {
  content:''; position:absolute; top:-7px; right:18px;
  width:12px; height:12px; background:#fff;
  border-left:1.5px solid #E5E7EB; border-top:1.5px solid #E5E7EB;
  transform:rotate(45deg);
}
.sp-tt-header { padding:14px 18px 10px; border-bottom:1px solid #F3F4F6; }
.sp-tt-title  { font-family:'Syne',sans-serif; font-size:13px; font-weight:700; color:#111827; margin:0 0 2px; }
.sp-tt-sub    { font-size:11px; color:#9CA3AF; margin:0; }
.sp-tt-tabs   { display:flex; border-bottom:1px solid #F3F4F6; }
.sp-tt-tab {
  flex:1; padding:8px 0; text-align:center;
  font-size:11px; font-weight:600; cursor:pointer; color:#9CA3AF;
  transition:all .15s ease; border-bottom:2px solid transparent;
  background:none; border-top:none; border-left:none; border-right:none;
  font-family:'DM Sans',sans-serif; letter-spacing:.04em; text-transform:uppercase;
}
.sp-tt-tab:hover  { color:#7C3AED; }
.sp-tt-tab.active { color:#7C3AED; border-bottom-color:#7C3AED; background:rgba(124,58,237,.05); }
.sp-tt-body { padding:14px 18px 16px; }
.sp-tt-desc { font-size:12px; color:#6B7280; margin:0 0 10px; line-height:1.5; }
.sp-tt-fields { margin-bottom:12px; }
.sp-tt-fields-title { font-size:10px; font-weight:600; letter-spacing:.10em; text-transform:uppercase; color:#9CA3AF; margin-bottom:6px; }
.sp-tt-field-row {
  display:flex; align-items:baseline; gap:8px;
  padding:4px 0; border-bottom:1px solid #F3F4F6; font-size:12px;
}
.sp-tt-field-row:last-child { border-bottom:none; }
.sp-tt-field-name { font-family:'Courier New',monospace; font-weight:700; color:#7C3AED; min-width:110px; }
.sp-tt-field-type { font-size:10px; background:#F3F4F6; color:#9CA3AF; border-radius:4px; padding:1px 5px; font-family:monospace; }
.sp-tt-field-desc { color:#6B7280; flex:1; }
.sp-tt-req        { color:#EF4444; font-size:10px; font-weight:700; }
.sp-tt-example-title { font-size:10px; font-weight:600; letter-spacing:.10em; text-transform:uppercase; color:#9CA3AF; margin-bottom:6px; }
.sp-tt-code {
  background:#1e1e2e; border-radius:8px; padding:10px 12px;
  font-family:'Courier New',monospace; font-size:11px; color:#cdd6f4;
  line-height:1.7; overflow-x:auto; white-space:pre;
  max-height:160px; overflow-y:auto;
}
.sp-tt-tip {
  display:flex; align-items:flex-start; gap:7px;
  background:#FEF3C7; border:1px solid rgba(245,158,11,.3);
  border-radius:8px; padding:8px 12px;
  font-size:11px; color:#92400e; margin-top:10px; line-height:1.5;
}
.sp-tt-choose {
  width:100%; margin-top:12px; justify-content:center;
  display:inline-flex; align-items:center; gap:6px;
  padding:9px 18px; background:#111827; color:#fff;
  border:none; border-radius:8px; font-family:'Syne',sans-serif;
  font-size:13px; font-weight:700; cursor:pointer;
  transition:all .18s ease; letter-spacing:.02em;
  box-shadow:0 4px 14px rgba(17,24,39,.2);
}
.sp-tt-choose:hover { background:#1f2937; transform:translateY(-1px); }

/* ── Action buttons in table row ─────────────────────────────────────── */
.sp-act-cell { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
.sp-btn-act {
  display:inline-flex; align-items:center; gap:4px;
  padding:4px 9px; border-radius:6px; font-size:11px; font-weight:600;
  cursor:pointer; transition:all .14s ease; border:1.5px solid transparent;
  font-family:'DM Sans',sans-serif; white-space:nowrap;
}
.sp-btn-deactivate { background:#FEE2E2; color:#DC2626; border-color:rgba(239,68,68,.2); }
.sp-btn-deactivate:hover { background:#DC2626; color:#fff; box-shadow:0 2px 8px rgba(239,68,68,.4); }
.sp-btn-activate   { background:#D1FAE5; color:#059669; border-color:rgba(16,185,129,.2); }
.sp-btn-activate:hover   { background:#059669; color:#fff; box-shadow:0 2px 8px rgba(16,185,129,.4); }
.sp-btn-edit { background:#EDE9FE; color:#7C3AED; border-color:rgba(124,58,237,.2); }
.sp-btn-edit:hover { background:#7C3AED; color:#fff; box-shadow:0 2px 8px rgba(124,58,237,.4); }
.sp-btn-face { background:#FFF7ED; color:#D97706; border-color:rgba(217,119,6,.2); }
.sp-btn-face:hover { background:#D97706; color:#fff; box-shadow:0 2px 8px rgba(217,119,6,.4); }
.sp-btn-device { background:#DBEAFE; color:#2563EB; border-color:rgba(37,99,235,.2); }
.sp-btn-device:hover { background:#2563EB; color:#fff; box-shadow:0 2px 8px rgba(37,99,235,.4); }
.sp-btn-act:disabled { opacity:.5; cursor:not-allowed; transform:none !important; box-shadow:none !important; }

/* ── Edit modal extras ───────────────────────────────────────────────── */
.sem-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-top:4px; }
.sem-btn {
  padding:6px; border:1.5px solid #E5E7EB; border-radius:8px;
  background:#F9FAFB; font-family:'Syne',sans-serif;
  font-size:11px; font-weight:700; color:#6B7280;
  cursor:pointer; transition:all .12s ease; text-align:center;
}
.sem-btn:hover { border-color:#10B981; color:#10B981; }
.sem-btn.active { border-color:#10B981; background:#ECFDF5; color:#065F46; box-shadow:0 0 0 2px rgba(16,185,129,.15); }

/* ── Delete/confirm modal ────────────────────────────────────────────── */
.sp-delete-icon { font-size:36px; text-align:center; margin-bottom:12px; }
.sp-delete-msg { font-size:14px; color:#6B7280; text-align:center; line-height:1.6; margin:0 0 20px; }
.sp-delete-name { font-family:'Syne',sans-serif; font-weight:700; color:#111827; }
`;

// ─── Toast hook (self-contained) ──────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' }|null>(null);
  function show(msg: string, type: 'success'|'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }
  return { toast, show };
}

export default function StudentsPage() {
  const [students, setStudents]         = useState<Student[]>([]);
  const [departments, setDepts]         = useState<Department[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [pagination, setPagination]     = useState({ total: 0, pages: 1 });

  // modals
  const [showAdd, setShowAdd]           = useState(false);
  const [editStudent, setEditStudent]   = useState<Student | null>(null);
  const [deviceReset, setDeviceReset]   = useState<Student | null>(null);
  const [faceReset, setFaceReset]       = useState<Student | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  // misc state
  const [submitting, setSubmitting]     = useState(false);
  const [processing, setProcessing]     = useState<string | null>(null);
  const [showTooltip, setShowTooltip]   = useState(false);
  const [tooltipTab, setTooltipTab]     = useState<'CSV'|'JSON'|'Excel'>('CSV');

  const [addForm, setAddForm]   = useState({ email:'', roll_number:'', name:'', dept_id:'', semester:1 });
  const [editForm, setEditForm] = useState({ email:'', roll_number:'', name:'', dept_id:'', semester:1 });

  const fileRef      = useRef<HTMLInputElement>(null);
  const tooltipRef   = useRef<HTMLDivElement>(null);
  const { toast, show: showToast } = useToast();

  // ── Close tooltip on outside click ──────────────────────────────────────
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node))
        setShowTooltip(false);
    }
    if (showTooltip) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showTooltip]);

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadStudents = useCallback(async (p = page, q = search) => {
    setLoading(true);
    try {
      const res = await AdminAPI.listStudents(p, q);
      setStudents(res.data.data || []);
      setPagination(res.data.pagination || { total:0, pages:1 });
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => {
    AdminAPI.listDepartments().then(r => setDepts(r.data.data || []));
  }, []);

  useEffect(() => { loadStudents(); }, [page]);

  // ── Search ───────────────────────────────────────────────────────────────
  async function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value; setSearch(q); setPage(1);
    const res = await AdminAPI.listStudents(1, q);
    setStudents(res.data.data || []);
    setPagination(res.data.pagination || { total:0, pages:1 });
  }

  // ── Add student ──────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await AdminAPI.preRegisterStudent(addForm);
      setShowAdd(false);
      setAddForm({ email:'', roll_number:'', name:'', dept_id:'', semester:1 });
      await loadStudents();
      showToast('Student added successfully!');
    } catch (err: any) { showToast('Error: ' + (err.response?.data?.error || err.message), 'error'); }
    finally { setSubmitting(false); }
  }

  // ── Edit student ─────────────────────────────────────────────────────────
  function openEdit(s: Student) {
    setEditStudent(s);
    setEditForm({
      email:       s.pending_email || s.email || '',
      roll_number: s.roll_number,
      name:        s.name,
      dept_id:     s.dept_id,
      semester:    s.semester,
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await AdminAPI.updateStudent(editStudent!.student_id, editForm);
      setEditStudent(null);
      await loadStudents();
      showToast('Student updated successfully!');
    } catch (err: any) { showToast('Error: ' + (err.response?.data?.error || err.message), 'error'); }
    finally { setSubmitting(false); }
  }

  // ── Device reset (admin force-clear) ─────────────────────────────────────
  async function handleDeviceReset() {
    setSubmitting(true);
    try {
      await AdminAPI.adminClearDeviceBinding(deviceReset!.student_id);
      setDeviceReset(null);
      await loadStudents();
      showToast(`Device binding cleared for ${deviceReset!.name}.`);
    } catch (err: any) { showToast('Error: ' + (err.response?.data?.error || err.message), 'error'); }
    finally { setSubmitting(false); }
  }
  // ── Face reset (admin force-clear) ───────────────────────────────────────
  async function handleFaceReset() {
    setSubmitting(true);
    try {
      await AdminAPI.resetFaceEnrollment(faceReset!.student_id);
      setFaceReset(null);
      await loadStudents();
      showToast(`Face enrollment reset for ${faceReset!.name}.`);
    } catch (err: any) { showToast('Error: ' + (err.response?.data?.error || err.message), 'error'); }
    finally { setSubmitting(false); }
  }
  


  // ── Toggle active ─────────────────────────────────────────────────────────
  async function toggleActive(s: Student) {
    setProcessing(s.student_id);
    try {
      s.is_active ? await AdminAPI.deactivateStudent(s.student_id) : await AdminAPI.activateStudent(s.student_id);
      await loadStudents();
      showToast(`${s.name} ${s.is_active ? 'deactivated' : 'activated'}.`);
    } catch (err: any) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    finally { setProcessing(null); }
  }

  // ── Reset face ────────────────────────────────────────────────────────────
  async function resetFace(s: Student) {
    if (!confirm(`Reset face enrollment for ${s.name}?`)) return;
    setProcessing(s.student_id + '_face');
    try {
      await AdminAPI.resetFaceEnrollment(s.student_id);
      await loadStudents();
      showToast('Face enrollment reset.');
    } catch (err: any) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    finally { setProcessing(null); }
  }

  // ── File import ────────────────────────────────────────────────────────────
  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      let rows: any[] = [];
      if (ext === 'json') { rows = JSON.parse(await file.text()); }
      else if (ext === 'csv') {
        const lines = (await file.text()).trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_'));
        rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
          const obj: any = {}; headers.forEach((h,i) => { obj[h]=vals[i]??''; }); return obj;
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const { read, utils } = await import('xlsx');
        const wb = read(await file.arrayBuffer());
        rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else { showToast('Use CSV, Excel, or JSON.', 'error'); return; }

      const deptByName = new Map(departments.map(d => [d.name.toLowerCase(), d.dept_id]));
      const deptByCode = new Map(departments.map(d => [d.code.toLowerCase(), d.dept_id]));
      const normalized: any[] = []; const errors: string[] = [];

      rows.forEach((row, i) => {
        const email    = row.email || row.Email || '';
        const roll     = row.roll_number || row['Roll Number'] || row.roll || '';
        const name     = row.name || row.Name || '';
        const deptRaw  = (row.dept || row.department || row.Department || '').toString().toLowerCase();
        const semester = parseInt(row.semester || row.Semester || '1');
        if (!email || !roll || !name) { errors.push(`Row ${i+2}: Missing email, roll_number, or name`); return; }
        const deptId = deptByName.get(deptRaw) || deptByCode.get(deptRaw) || row.dept_id || '';
        if (!deptId) { errors.push(`Row ${i+2} (${roll}): Unknown dept "${deptRaw}"`); return; }
        normalized.push({ email, roll_number:roll, name, dept_id:deptId, semester:isNaN(semester)?1:semester });
      });

      if (errors.length) { showToast(errors.slice(0,3).join('\n'), 'error'); return; }
      setSubmitting(true);
      const res = await AdminAPI.bulkImportStudents(normalized);
      setImportResult(res.data.data);
      await loadStudents();
    } catch (err: any) { showToast('Import failed: ' + (err.response?.data?.message || err.message), 'error'); }
    finally { setSubmitting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{BASE_CSS}</style>
      <style>{PAGE_CSS}</style>

      <div className="sa-page">
        <div className="sa-blob1" /><div className="sa-blob2" />
        <div className="sa-inner">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="sa-header">
            <div>
              <div className="sa-eyebrow">SmartAttend Admin</div>
              <div>
                <span className="sa-title">Students</span>
                <span className="sa-chip">{pagination.total}</span>
              </div>
              <p className="sa-subtitle">Manage enrolled students across all departments</p>
            </div>

            <div className="sa-actions">
              {/* Search */}
              <div className="sa-search-wrap">
                <svg className="sa-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input className="sa-search" placeholder="Name, roll number, email…" value={search} onChange={handleSearch} />
              </div>

              {/* Import + Tooltip */}
              <div className="sp-import-wrap" ref={tooltipRef}>
                <label
                  className="btn-ghost"
                  style={{ cursor:'pointer' }}
                  onMouseEnter={() => setShowTooltip(true)}
                  onClick={() => setShowTooltip(v => !v)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Import
                  <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.json" style={{display:'none'}}
                    onChange={e => { setShowTooltip(false); handleFileImport(e); }} />
                </label>

                {/* ── Format Tooltip ────────────────────────────────── */}
                {showTooltip && (
                  <div className="sp-import-tooltip" onClick={e => e.stopPropagation()}>
                    <div className="sp-tt-header">
                      <p className="sp-tt-title">📋 Import File Format</p>
                      <p className="sp-tt-sub">Supported: CSV, JSON, Excel (.xlsx / .xls) — up to 500 rows</p>
                    </div>

                    {/* Tabs */}
                    <div className="sp-tt-tabs">
                      {(['CSV','JSON','Excel'] as const).map(t => (
                        <button key={t} className={`sp-tt-tab${tooltipTab===t?' active':''}`}
                          onClick={() => setTooltipTab(t)}>{t}</button>
                      ))}
                    </div>

                    <div className="sp-tt-body">
                      {/* Fields */}
                      <div className="sp-tt-fields">
                        <div className="sp-tt-fields-title">Fields</div>
                        {STUDENT_FORMAT_FIELDS.map(f => (
                          <div key={f.name} className="sp-tt-field-row">
                            <span className="sp-tt-field-name">{f.name}</span>
                            <span className="sp-tt-field-type">{f.type}</span>
                            <span className="sp-tt-field-desc">{f.desc}</span>
                            {f.req && <span className="sp-tt-req">*</span>}
                          </div>
                        ))}
                      </div>

                      {/* Example */}
                      <div className="sp-tt-example-title">Example ({tooltipTab})</div>
                      <pre className="sp-tt-code">{STUDENT_FORMAT_EXAMPLES[tooltipTab]}</pre>

                      {/* Tip */}
                      <div className="sp-tt-tip">
                        <span style={{flexShrink:0}}>💡</span>
                        <span>
                          For <strong>dept_id</strong> in CSV/Excel you can use the department name
                          or short code (e.g. <em>"CS"</em>) — the system will match it automatically.
                          Find UUIDs on the Departments page.
                        </span>
                      </div>

                      {/* CTA */}
                      <button className="sp-tt-choose"
                        onClick={() => { setShowTooltip(false); fileRef.current?.click(); }}>
                        Choose File to Import
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Add student */}
              <button className="btn-primary" onClick={() => setShowAdd(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Student
              </button>
            </div>
          </div>

          {/* ── Table Card ──────────────────────────────────────────────── */}
          <div className="sa-card">
            <div className="sa-card-header">
              <div>
                <p className="sa-card-title">Student Directory</p>
                <p className="sa-card-sub">{students.length} shown · {pagination.total} total</p>
              </div>
            </div>

            {loading ? (
              <div className="sa-loading" style={{minHeight:200}}><div className="spinner"/>Loading…</div>
            ) : students.length === 0 ? (
              <div className="sa-empty">
                <div className="sa-empty-icon">🎓</div>
                <div className="sa-empty-text">No students found</div>
              </div>
            ) : (
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Student</th><th>Email</th><th>Dept / Sem</th>
                    <th>Face</th><th>Status</th><th style={{textAlign:'right',paddingRight:24}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => (
                    <tr key={s.student_id} style={{animationDelay:`${idx*20}ms`}}>

                      {/* Name + Roll */}
                      <td>
                        <div className="sa-name-cell">
                          <div className="sa-avatar" style={{background:avatarGradients[idx%avatarGradients.length]}}>
                            {initials(s.name)}
                          </div>
                          <div>
                            <span className="sa-name">{s.name}</span>
                            <span className="sa-name-sub">
                              <span className="code-tag">{s.roll_number}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{fontSize:12}}>
                        {s.email
                          ? s.email
                          : <span style={{color:'#F59E0B',fontStyle:'italic',fontSize:11}}>⏳ {s.pending_email} (pending)</span>
                        }
                      </td>

                      {/* Dept / Sem */}
                      <td>
                        <span style={{fontWeight:600,color:'#111827',fontSize:13}}>{s.dept_name}</span>
                        <span style={{display:'block',fontSize:11,color:'#10B981',fontWeight:700,marginTop:2,fontFamily:'Syne,sans-serif'}}>
                          SEM {s.semester}
                        </span>
                      </td>

                      {/* Face */}
                      <td>
                        {s.face_enrolled_at
                          ? <span className="badge-green"><span className="status-dot dot-green"/>Enrolled</span>
                          : <span style={{fontSize:11,color:'#9CA3AF',fontStyle:'italic'}}>Not enrolled</span>
                        }
                      </td>

                      {/* Status */}
                      <td>
                        {s.awaiting_registration
                          ? <span className="badge-amber"><span className="status-dot dot-amber"/>Pending</span>
                          : s.is_active
                            ? <span className="badge-green"><span className="status-dot dot-green"/>Active</span>
                            : <span className="badge-red"><span className="status-dot dot-red"/>Inactive</span>
                        }
                      </td>

                      {/* Actions */}
                      <td style={{textAlign:'right',paddingRight:24}}>
                        <div className="sp-act-cell" style={{justifyContent:'flex-end'}}>
                          {/* Edit — always available */}
                          <button className="sp-btn-act sp-btn-edit"
                            onClick={() => openEdit(s)}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit
                          </button>

                          {/* Activate / Deactivate — only if registered */}
                          {!s.awaiting_registration && (
                            s.is_active
                              ? <button className="sp-btn-act sp-btn-deactivate"
                                  disabled={processing===s.student_id}
                                  onClick={() => toggleActive(s)}>
                                  Deactivate
                                </button>
                              : <button className="sp-btn-act sp-btn-activate"
                                  disabled={processing===s.student_id}
                                  onClick={() => toggleActive(s)}>
                                  Activate
                                </button>
                          )}

                          {/* Reset Face — only if enrolled */}
                          {s.face_enrolled_at && (
                            <button className="sp-btn-act sp-btn-face"
                              disabled={processing===s.student_id+'_face'}
                              onClick={() => setFaceReset(s)}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="8" r="4"/>
                                <path d="M8 14s-4 2-4 6h16c0-4-4-6-4-6"/>
                              </svg>
                              Face
                            </button>
                          )}

                          {/* Device Reset — only if registered */}
                          {!s.awaiting_registration && (
                            <button className="sp-btn-act sp-btn-device"
                              disabled={processing===s.student_id+'_dev'}
                              onClick={() => setDeviceReset(s)}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                                <line x1="12" y1="18" x2="12.01" y2="18"/>
                              </svg>
                              Device
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {!loading && pagination.pages > 1 && (
              <div className="sa-pg">
                <span className="sa-pg-info">Page {page} of {pagination.pages} · {pagination.total} students</span>
                <div className="sa-pg-btns">
                  <button className="sa-pg-btn" disabled={page<=1} onClick={() => setPage(p=>p-1)}>← Prev</button>
                  <button className="sa-pg-btn" disabled={page>=pagination.pages} onClick={() => setPage(p=>p+1)}>Next →</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Add Modal ────────────────────────────────────────────────── */}
          {showAdd && (
            <div className="sa-modal-overlay" onClick={e => e.target===e.currentTarget && setShowAdd(false)}>
              <div className="sa-modal-box">
                <div className="sa-modal-title">Add Student</div>
                <div className="sa-modal-sub">Pre-register a student. They'll create their password using email + roll number.</div>
                <form onSubmit={handleAdd}>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Email *</label>
                    <input required type="email" className="sa-form-input" placeholder="student@college.edu"
                      value={addForm.email} onChange={e=>setAddForm({...addForm,email:e.target.value})} />
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Roll Number *</label>
                    <input required type="text" className="sa-form-input" placeholder="22CS001"
                      value={addForm.roll_number} onChange={e=>setAddForm({...addForm,roll_number:e.target.value})} />
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Full Name *</label>
                    <input required type="text" className="sa-form-input" placeholder="Full name"
                      value={addForm.name} onChange={e=>setAddForm({...addForm,name:e.target.value})} />
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Department *</label>
                    <select required className="sa-form-input" value={addForm.dept_id}
                      onChange={e=>setAddForm({...addForm,dept_id:e.target.value})}>
                      <option value="">Select department…</option>
                      {departments.map(d=><option key={d.dept_id} value={d.dept_id}>{d.name} ({d.code})</option>)}
                    </select>
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Semester *</label>
                    <div className="sem-grid">
                      {[1,2,3,4,5,6,7,8].map(s=>(
                        <button key={s} type="button" className={`sem-btn${addForm.semester===s?' active':''}`}
                          onClick={()=>setAddForm({...addForm,semester:s})}>Sem {s}</button>
                      ))}
                    </div>
                  </div>
                  <div className="sa-form-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    Courses and device binding are configured separately after registration.
                  </div>
                  <div className="sa-form-actions">
                    <button type="submit" disabled={submitting} className="sa-btn-submit">
                      {submitting ? 'Adding…' : 'Add Student'}
                    </button>
                    <button type="button" className="sa-btn-cancel" onClick={()=>setShowAdd(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Edit Modal ───────────────────────────────────────────────── */}
          {editStudent && (
            <div className="sa-modal-overlay" onClick={e => e.target===e.currentTarget && setEditStudent(null)}>
              <div className="sa-modal-box">
                <div className="sa-modal-title">Edit Student</div>
                <div className="sa-modal-sub">Update details for <strong>{editStudent.name}</strong></div>
                <form onSubmit={handleEdit}>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Email</label>
                    <input type="email" className="sa-form-input" placeholder="student@college.edu"
                      value={editForm.email}
                      onChange={e => setEditForm({...editForm, email:e.target.value})}
                      disabled={!editStudent.awaiting_registration}
                    />
                    {!editStudent.awaiting_registration && (
                      <div className="sa-form-hint" style={{marginTop:6,background:'#FEF3C7',borderColor:'rgba(245,158,11,.3)',color:'#92400e'}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        Email cannot be changed after the student has registered.
                      </div>
                    )}
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Roll Number *</label>
                    <input required type="text" className="sa-form-input" placeholder="22CS001"
                      value={editForm.roll_number} onChange={e=>setEditForm({...editForm,roll_number:e.target.value})} />
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Full Name *</label>
                    <input required type="text" className="sa-form-input" placeholder="Full name"
                      value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} />
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Department *</label>
                    <select required className="sa-form-input" value={editForm.dept_id}
                      onChange={e=>setEditForm({...editForm,dept_id:e.target.value})}>
                      <option value="">Select department…</option>
                      {departments.map(d=><option key={d.dept_id} value={d.dept_id}>{d.name} ({d.code})</option>)}
                    </select>
                  </div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Semester *</label>
                    <div className="sem-grid">
                      {[1,2,3,4,5,6,7,8].map(s=>(
                        <button key={s} type="button" className={`sem-btn${editForm.semester===s?' active':''}`}
                          onClick={()=>setEditForm({...editForm,semester:s})}>Sem {s}</button>
                      ))}
                    </div>
                  </div>
                  <div className="sa-form-actions">
                    <button type="submit" disabled={submitting} className="sa-btn-submit">
                      {submitting ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button type="button" className="sa-btn-cancel" onClick={()=>setEditStudent(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Device Reset Confirm Modal ───────────────────────────────── */}
          {deviceReset && (
            <div className="sa-modal-overlay" onClick={e => e.target===e.currentTarget && setDeviceReset(null)}>
              <div className="sa-modal-box" style={{maxWidth:400,textAlign:'center'}}>
                <div className="sp-delete-icon">📱</div>
                <div className="sa-modal-title" style={{textAlign:'center',fontSize:18}}>Clear Device Binding?</div>
                <p className="sp-delete-msg">
                  This will immediately clear all registered devices for{' '}
                  <span className="sp-delete-name">{deviceReset.name}</span>{' '}
                  ({deviceReset.roll_number}). They will need to log in again to re-bind their device.
                </p>
                <div className="sa-form-actions">
                  <button disabled={submitting} className="sa-btn-submit"
                    style={{background:'#2563EB',boxShadow:'0 4px 14px rgba(37,99,235,.3)'}}
                    onClick={handleDeviceReset}>
                    {submitting ? 'Clearing…' : 'Clear Device'}
                  </button>
                  <button className="sa-btn-cancel" onClick={()=>setDeviceReset(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {/* ── Device Reset Confirm Modal ───────────────────────────────── */}
          {faceReset && (
            <div className="sa-modal-overlay" onClick={e => e.target===e.currentTarget && setDeviceReset(null)}>
              <div className="sa-modal-box" style={{maxWidth:400,textAlign:'center'}}>
                <div className="sp-delete-icon">📱</div>
                <div className="sa-modal-title" style={{textAlign:'center',fontSize:18}}>Clear Face Registration?</div>
                <p className="sp-delete-msg">
                  This will immediately clear all registered face data for{' '}
                  <span className="sp-delete-name">{faceReset.name}</span>{' '}
                  ({faceReset.roll_number}). They will need to log in again to re-register their face.
                </p>
                <div className="sa-form-actions">
                  <button disabled={submitting} className="sa-btn-submit"
                    style={{background:'#2563EB',boxShadow:'0 4px 14px rgba(37,99,235,.3)'}}
                    onClick={handleFaceReset}>
                    {submitting ? 'Clearing…' : 'Clear Face Data'}
                  </button>
                  <button className="sa-btn-cancel" onClick={()=>setFaceReset(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Import Result Modal ──────────────────────────────────────── */}
          {importResult && (
            <div className="sa-modal-overlay" onClick={e=>e.target===e.currentTarget&&setImportResult(null)}>
              <div className="sa-modal-box">
                <div className="sa-modal-title">Import Results</div>
                <div className="result-ok">✅ {importResult.imported} student(s) imported</div>
                {importResult.skipped?.length > 0 && (
                  <>
                    <span className="skip-label">⚠ Skipped ({importResult.skipped.length})</span>
                    <div className="skip-list">
                      {importResult.skipped.map((s:any,i:number)=>(
                        <div key={i} className="skip-item">
                          <span className="skip-code">{s.roll_number}</span>: {s.reason}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="sa-form-actions">
                  <button className="sa-btn-submit" onClick={()=>setImportResult(null)}>Done</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position:'fixed', bottom:28, right:28,
          background: toast.type==='error' ? '#991b1b' : '#065f46',
          color:'#fff', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:500,
          padding:'12px 20px', borderRadius:10,
          boxShadow:'0 10px 24px rgba(0,0,0,.10)', zIndex:9999,
          animation:'spTTIn .25s ease', maxWidth:340, lineHeight:1.4,
        }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}