

import React, { useState, useEffect, useRef } from 'react';
import { AdminAPI } from '../services/api';

interface Professor {
  professor_id: string;
  name: string;
  employee_code: string;
  email: string | null;
  pending_email: string | null;
  dept_name: string;
  dept_id: string;
  is_active: boolean;
  awaiting_registration: boolean;
}
interface Department { dept_id: string; name: string; code: string; }

/* ─── Design tokens ─────────────────────────────────────────── */
const D = {
  bg: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  green: '#10B981',
  greenLight: '#D1FAE5',
  red: '#EF4444',
  redLight: '#FEE2E2',
  amber: '#F59E0B',
  amberLight: '#FEF3C7',
  blue: '#3B82F6',
  blueLight: '#DBEAFE',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  shadow: '0 1px 3px rgba(0,0,0,.08),0 1px 2px -1px rgba(0,0,0,.06)',
  shadowMd: '0 4px 6px -1px rgba(0,0,0,.07)',
  shadowLg: '0 10px 24px rgba(0,0,0,.10)',
  radius: 12,
  radiusSm: 8,
};

const avatarGradients = [
  'linear-gradient(135deg,#7C3AED,#A78BFA)',
  'linear-gradient(135deg,#3B82F6,#7C3AED)',
  'linear-gradient(135deg,#F59E0B,#EF4444)',
  'linear-gradient(135deg,#10B981,#3B82F6)',
  'linear-gradient(135deg,#EC4899,#7C3AED)',
  'linear-gradient(135deg,#10B981,#A78BFA)',
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

.pp-page {
  font-family: 'DM Sans', sans-serif;
  min-height: 100vh;
  background: ${D.bg};
  background-image: radial-gradient(circle, ${D.border} 1px, transparent 1px);
  background-size: 28px 28px;
  padding: 32px;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}
.pp-blob1 {
  position: fixed; top: -140px; right: -180px;
  width: 500px; height: 500px; border-radius: 50%;
  background: radial-gradient(circle, rgba(124,58,237,.10) 0%, transparent 70%);
  pointer-events: none; z-index: 0;
}
.pp-blob2 {
  position: fixed; bottom: -80px; left: -100px;
  width: 380px; height: 380px; border-radius: 50%;
  background: radial-gradient(circle, rgba(16,185,129,.07) 0%, transparent 70%);
  pointer-events: none; z-index: 0;
}
.pp-inner { position: relative; z-index: 1; max-width: 1200px; }

/* header */
.pp-header {
  display: flex; align-items: flex-end; justify-content: space-between;
  flex-wrap: wrap; gap: 12px; margin-bottom: 28px;
}
.pp-eyebrow {
  font-size: 11px; font-weight: 500; letter-spacing: .18em;
  text-transform: uppercase; color: ${D.textMuted}; margin-bottom: 5px;
}
.pp-title {
  font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 700;
  color: ${D.textPrimary}; letter-spacing: -.5px; margin: 0;
}
.pp-chip {
  display: inline-flex; align-items: center; background: ${D.textPrimary};
  color: #f9fafb; font-family: 'Syne', sans-serif; font-size: 11px;
  font-weight: 700; padding: 3px 10px; border-radius: 999px;
  margin-left: 10px; vertical-align: middle; position: relative; top: -3px;
}
.pp-subtitle { margin: 4px 0 0; font-size: 13px; color: ${D.textMuted}; }
.pp-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

/* buttons */
.btn-import-wrap { position: relative; }
.btn-import {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; background: ${D.surface}; color: ${D.textSecondary};
  border: 1.5px solid ${D.border}; border-radius: ${D.radiusSm}px;
  font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all .15s ease;
}
.btn-import:hover { border-color: ${D.purple}; color: ${D.purple}; }
.btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; background: ${D.textPrimary}; color: #fff;
  border: none; border-radius: ${D.radiusSm}px;
  font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
  cursor: pointer; transition: all .18s ease; letter-spacing: .02em;
  box-shadow: 0 4px 14px rgba(17,24,39,.2);
}
.btn-primary:hover { background: #1f2937; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(17,24,39,.28); }

/* ── Import Format Tooltip ──────────────────────────────────── */
.import-tooltip {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 420px;
  background: ${D.surface};
  border: 1.5px solid ${D.border};
  border-radius: 14px;
  box-shadow: ${D.shadowLg};
  z-index: 200;
  padding: 0;
  overflow: hidden;
  animation: tooltipIn .18s ease;
}
@keyframes tooltipIn {
  from { opacity:0; transform: translateY(-6px); }
  to   { opacity:1; transform: translateY(0); }
}
.import-tooltip::before {
  content: '';
  position: absolute;
  top: -7px; right: 18px;
  width: 12px; height: 12px;
  background: ${D.surface};
  border-left: 1.5px solid ${D.border};
  border-top: 1.5px solid ${D.border};
  transform: rotate(45deg);
}
.tt-header {
  padding: 14px 18px 10px;
  border-bottom: 1px solid ${D.borderLight};
}
.tt-title {
  font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
  color: ${D.textPrimary}; margin: 0 0 2px;
}
.tt-sub { font-size: 11px; color: ${D.textMuted}; margin: 0; }

.tt-tabs {
  display: flex; gap: 0;
  border-bottom: 1px solid ${D.borderLight};
}
.tt-tab {
  flex: 1; padding: 8px 0; text-align: center;
  font-size: 11px; font-weight: 600; cursor: pointer;
  color: ${D.textMuted}; transition: all .15s ease;
  border-bottom: 2px solid transparent; background: none; border-top: none;
  border-left: none; border-right: none; font-family: 'DM Sans', sans-serif;
  letter-spacing: .04em; text-transform: uppercase;
}
.tt-tab:hover { color: ${D.purple}; }
.tt-tab.active { color: ${D.purple}; border-bottom-color: ${D.purple}; background: ${D.purpleLight}20; }

.tt-body { padding: 14px 18px 16px; }
.tt-desc { font-size: 12px; color: ${D.textSecondary}; margin: 0 0 10px; line-height: 1.5; }

.tt-fields { margin-bottom: 12px; }
.tt-fields-title {
  font-size: 10px; font-weight: 600; letter-spacing: .10em; text-transform: uppercase;
  color: ${D.textMuted}; margin-bottom: 6px;
}
.tt-field-row {
  display: flex; align-items: baseline; gap: 8px;
  padding: 4px 0; border-bottom: 1px solid ${D.borderLight};
  font-size: 12px;
}
.tt-field-row:last-child { border-bottom: none; }
.tt-field-name {
  font-family: 'Courier New', monospace; font-weight: 700;
  color: ${D.purple}; min-width: 110px;
}
.tt-field-type {
  font-size: 10px; background: ${D.borderLight}; color: ${D.textMuted};
  border-radius: 4px; padding: 1px 5px; font-family: monospace;
}
.tt-field-desc { color: ${D.textSecondary}; flex: 1; }
.tt-req { color: ${D.red}; font-size: 10px; font-weight: 700; }

.tt-example-title {
  font-size: 10px; font-weight: 600; letter-spacing: .10em; text-transform: uppercase;
  color: ${D.textMuted}; margin-bottom: 6px;
}
.tt-code {
  background: #1e1e2e; border-radius: 8px; padding: 10px 12px;
  font-family: 'Courier New', monospace; font-size: 11px;
  color: #cdd6f4; line-height: 1.7; overflow-x: auto;
  white-space: pre; max-height: 160px; overflow-y: auto;
}
.tt-code .kw { color: #cba6f7; }   /* keyword / key */
.tt-code .str { color: #a6e3a1; }  /* string value */
.tt-code .num { color: #fab387; }  /* number */
.tt-code .cm { color: #6c7086; }   /* comment */
.tt-tip {
  display: flex; align-items: flex-start; gap: 7px;
  background: ${D.amberLight}; border: 1px solid ${D.amber}30;
  border-radius: 8px; padding: 8px 12px;
  font-size: 11px; color: #92400e; margin-top: 10px; line-height: 1.5;
}

/* search */
.pp-search-wrap { position: relative; }
.pp-search {
  padding: 9px 12px 9px 36px;
  background: ${D.surface}; border: 1.5px solid ${D.border};
  border-radius: ${D.radiusSm}px; font-family: 'DM Sans', sans-serif;
  font-size: 13px; color: ${D.textPrimary}; outline: none;
  transition: all .15s ease; width: 200px; box-sizing: border-box;
}
.pp-search:focus { border-color: ${D.purple}; box-shadow: 0 0 0 3px ${D.purpleLight}; width: 240px; }
.pp-search::placeholder { color: ${D.textMuted}; }
.pp-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: ${D.textMuted}; pointer-events: none; }

/* card + table */
.pp-card {
  background: ${D.surface}; border: 1px solid ${D.border};
  border-radius: ${D.radius}px; box-shadow: ${D.shadow}; overflow: hidden;
}
.pp-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px 16px; border-bottom: 1px solid ${D.borderLight};
}
.pp-card-title { font-family:'Syne',sans-serif; font-size:15px; font-weight:600; color:${D.textPrimary}; margin:0; }
.pp-card-sub { font-size:12px; color:${D.textMuted}; margin:3px 0 0; }

.pp-table { width: 100%; border-collapse: collapse; }
.pp-table thead tr { background: ${D.borderLight}; border-bottom: 1px solid ${D.border}; }
.pp-table th {
  padding: 10px 16px; font-size: 11px; font-weight: 600;
  letter-spacing: .10em; text-transform: uppercase; color: ${D.textMuted};
  text-align: left; font-family: 'DM Sans', sans-serif; white-space: nowrap;
}
.pp-table th:first-child { padding-left: 24px; }
.pp-table th:last-child { padding-right: 24px; text-align: right; }
.pp-table tbody tr {
  border-bottom: 1px solid ${D.borderLight};
  transition: background .12s ease;
  animation: rowIn .3s ease both;
}
.pp-table tbody tr:last-child { border-bottom: none; }
.pp-table tbody tr:hover { background: #FAFAFA; }
@keyframes rowIn {
  from { opacity:0; transform: translateY(5px); }
  to   { opacity:1; transform: translateY(0); }
}
.pp-table td {
  padding: 12px 16px; vertical-align: middle;
  font-size: 13px; color: ${D.textSecondary};
}
.pp-table td:first-child { padding-left: 24px; }
.pp-table td:last-child { padding-right: 24px; text-align: right; }

/* avatar + name */
.name-cell { display: flex; align-items: center; gap: 10px; }
.avatar {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 12px;
  color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.15);
}
.prof-name {
  font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
  color: ${D.textPrimary}; display: block;
}
.prof-dept { font-size: 11px; color: ${D.textMuted}; display: block; margin-top: 1px; }

/* code tag */
.code-tag {
  background: ${D.borderLight}; color: ${D.textSecondary};
  font-family: 'Courier New', monospace; font-size: 11px; font-weight: 600;
  padding: 3px 8px; border-radius: 5px; letter-spacing: .04em;
  border: 1px solid ${D.border};
}

/* email */
.email-pending { color: ${D.amber}; font-style: italic; font-size: 12px; }

/* status */
.badge-active {
  display: inline-flex; align-items: center; gap: 5px;
  background: ${D.greenLight}; color: #065f46;
  font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
}
.badge-pending {
  display: inline-flex; align-items: center; gap: 5px;
  background: ${D.amberLight}; color: #92400e;
  font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.dot-green { background: ${D.green}; box-shadow: 0 0 0 2px ${D.green}30; }
.dot-amber { background: ${D.amber}; }

/* ── Action buttons ───────────────────────────────────────── */
.actions-cell { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }
.btn-action {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 11px; border-radius: 7px; font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all .15s ease; border: 1.5px solid transparent;
  font-family: 'DM Sans', sans-serif; white-space: nowrap;
}
.btn-edit {
  background: ${D.purpleLight}; color: ${D.purple};
  border-color: ${D.purple}20;
}
.btn-edit:hover { background: ${D.purple}; color: #fff; border-color: ${D.purple}; transform: translateY(-1px); box-shadow: 0 3px 10px ${D.purple}40; }
.btn-delete {
  background: ${D.redLight}; color: ${D.red};
  border-color: ${D.red}20;
}
.btn-delete:hover { background: ${D.red}; color: #fff; border-color: ${D.red}; transform: translateY(-1px); box-shadow: 0 3px 10px ${D.red}40; }

/* empty */
.pp-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 64px 24px;
  color: ${D.textMuted};
}
.pp-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: .4; }
.pp-empty-text { font-family:'Syne',sans-serif; font-size:15px; font-weight:600; color:${D.border}; }

/* modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(17,24,39,.45);
  backdrop-filter: blur(6px); display: flex;
  align-items: center; justify-content: center;
  z-index: 500; animation: fadeIn .15s ease;
}
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes slideUp {
  from{opacity:0;transform:translateY(20px) scale(.98)}
  to  {opacity:1;transform:translateY(0)   scale(1)  }
}
.modal-box {
  background: ${D.surface}; border-radius: 20px;
  padding: 28px; width: 100%; max-width: 460px;
  box-shadow: ${D.shadowLg}; animation: slideUp .2s ease;
  max-height: 90vh; overflow-y: auto;
  border: 1px solid ${D.border};
  z-index: 1000 !important;
}
.modal-box-sm { max-width: 400px; }
.modal-title {
  font-family:'Syne',sans-serif; font-size:20px; font-weight:800;
  color:${D.textPrimary}; margin:0 0 4px; letter-spacing:-.02em;
}
.modal-subtitle { font-size:13px; color:${D.textMuted}; margin:0 0 20px; }

.form-group { margin-bottom: 14px; }
.form-label {
  display:block; font-size:11px; font-weight:500;
  letter-spacing:.10em; text-transform:uppercase;
  color:${D.textMuted}; margin-bottom:5px;
}
.form-input {
  width:100%; padding:10px 12px;
  background:${D.borderLight}; border:1.5px solid ${D.border};
  border-radius:10px; font-family:'DM Sans',sans-serif;
  font-size:14px; color:${D.textPrimary};
  transition:all .15s ease; box-sizing:border-box; outline:none;
}
.form-input:focus { border-color:${D.purple}; background:#fff; box-shadow:0 0 0 3px ${D.purpleLight}; }
.form-input::placeholder { color:${D.textMuted}; }
.form-input:disabled { opacity: .55; cursor: not-allowed; background: ${D.borderLight}; }

.form-hint {
  display:flex; align-items:flex-start; gap:8px;
  background:${D.blueLight}; border:1px solid ${D.blue}30;
  border-radius:10px; padding:10px 14px;
  font-size:12px; color:#1D4ED8; line-height:1.5; margin:10px 0;
}
.form-warn {
  display:flex; align-items:flex-start; gap:8px;
  background:${D.amberLight}; border:1px solid ${D.amber}30;
  border-radius:10px; padding:10px 14px;
  font-size:12px; color:#92400e; line-height:1.5; margin:10px 0;
}

/* delete confirm */
.delete-icon { font-size: 36px; text-align: center; margin-bottom: 12px; }
.delete-msg { font-size: 14px; color: ${D.textSecondary}; text-align: center; line-height: 1.6; margin: 0 0 20px; }
.delete-name { font-family: 'Syne', sans-serif; font-weight: 700; color: ${D.textPrimary}; }

.form-actions { display:flex; gap:10px; margin-top:18px; }
.btn-submit {
  flex:1; padding:11px; background:${D.textPrimary}; color:#fff;
  border:none; border-radius:10px; font-family:'Syne',sans-serif;
  font-size:13px; font-weight:700; cursor:pointer;
  transition:all .15s ease; letter-spacing:.02em;
}
.btn-submit:hover:not(:disabled) { background:#1f2937; box-shadow:0 4px 14px rgba(0,0,0,.2); }
.btn-submit:disabled { opacity:.55; cursor:not-allowed; }
.btn-submit-red {
  flex:1; padding:11px; background:${D.red}; color:#fff;
  border:none; border-radius:10px; font-family:'Syne',sans-serif;
  font-size:13px; font-weight:700; cursor:pointer;
  transition:all .15s ease; letter-spacing:.02em;
}
.btn-submit-red:hover:not(:disabled) { background:#dc2626; box-shadow:0 4px 14px rgba(239,68,68,.35); }
.btn-submit-red:disabled { opacity:.55; cursor:not-allowed; }
.btn-cancel {
  flex:1; padding:11px; background:${D.borderLight}; color:${D.textSecondary};
  border:none; border-radius:10px; font-family:'DM Sans',sans-serif;
  font-size:13px; font-weight:500; cursor:pointer; transition:all .15s ease;
}
.btn-cancel:hover { background:${D.border}; }

/* import result */
.result-ok {
  background:${D.greenLight}; border:1px solid #a7f3d0;
  border-radius:10px; padding:12px 16px;
  font-family:'Syne',sans-serif; font-weight:700;
  font-size:15px; color:#065f46; margin-bottom:14px;
}
.skip-label { font-size:11px; font-weight:700; color:${D.red}; margin-bottom:6px; display:block; letter-spacing:.06em; text-transform:uppercase; }
.skip-list { max-height:180px; overflow-y:auto; border:1px solid ${D.redLight}; border-radius:10px; background:#fff; margin-bottom:10px; }
.skip-item { padding:8px 12px; border-bottom:1px solid ${D.redLight}; font-size:12px; color:${D.textSecondary}; }
.skip-item:last-child { border-bottom:none; }
.skip-code { font-family:monospace; font-weight:700; color:${D.red}; }

/* loading */
.pp-loading { display:flex; align-items:center; justify-content:center; min-height:60vh; gap:10px; color:${D.textMuted}; font-family:'Syne',sans-serif; font-weight:600; font-size:14px; }
.spinner { width:20px; height:20px; border:2.5px solid ${D.border}; border-top-color:${D.purple}; border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* toast */
.pp-toast {
  position: fixed; bottom: 28px; right: 28px;
  background: ${D.textPrimary}; color: #fff;
  font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
  padding: 12px 20px; border-radius: 10px;
  box-shadow: ${D.shadowLg}; z-index: 9999;
  animation: toastIn .25s ease;
  max-width: 340px; line-height: 1.4;
}
.pp-toast.success { background: #065f46; }
.pp-toast.error { background: #991b1b; }
@keyframes toastIn {
  from { opacity:0; transform: translateY(10px); }
  to   { opacity:1; transform: translateY(0); }
}
`;

// ─── Format examples for tooltip ─────────────────────────────────────────────
const FORMAT_FIELDS = [
  { name: 'email',         type: 'string', desc: 'Work email address', req: true },
  { name: 'name',          type: 'string', desc: 'Full name',          req: true },
  { name: 'employee_code', type: 'string', desc: 'Unique employee ID', req: true },
  { name: 'dept_id',       type: 'uuid',   desc: 'Department UUID (from Departments page)', req: true },
];

const FORMAT_EXAMPLES: Record<string, string> = {
  CSV: `email,name,employee_code,dept_id
dr.smith@uni.edu,Dr. Jane Smith,EMP-CS-001,3fa85f64-...
prof.jones@uni.edu,Prof. Alan Jones,EMP-CS-002,3fa85f64-...`,

  JSON: `[
  {
    "email": "dr.smith@uni.edu",
    "name": "Dr. Jane Smith",
    "employee_code": "EMP-CS-001",
    "dept_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  },
  {
    "email": "prof.jones@uni.edu",
    "name": "Prof. Alan Jones",
    "employee_code": "EMP-CS-002",
    "dept_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
]`,

  Excel: `Column headers in Row 1 (case-insensitive):
  email | name | employee_code | dept_id

Row 2 onwards — one professor per row.
Department column also accepts dept name or code
(e.g. "Computer Science" or "CS") — the system
will try to match by name or code automatically.`,
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  function show(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }
  return { toast, show };
}

export default function ProfessorsPage() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [editProf, setEditProf] = useState<Professor | null>(null);
  const [deleteProf, setDeleteProf] = useState<Professor | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipTab, setTooltipTab] = useState<'CSV' | 'JSON' | 'Excel'>('CSV');

  const [submitting, setSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', name: '', employee_code: '', dept_id: '' });
  const [editForm, setEditForm] = useState({ email: '', name: '', employee_code: '', dept_id: '' });

  const fileRef = useRef<HTMLInputElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { toast, show: showToast } = useToast();

  useEffect(() => { loadData(); }, []);

  // Close tooltip when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    }
    if (showTooltip) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTooltip]);

  async function loadData() {
    try {
      const [pRes, dRes] = await Promise.all([AdminAPI.listProfessors(), AdminAPI.listDepartments()]);
      setProfessors(pRes.data.data || []);
      setDepartments(dRes.data.data || []);
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await AdminAPI.preRegisterProfessor(addForm);
      setShowAdd(false);
      setAddForm({ email: '', name: '', employee_code: '', dept_id: '' });
      await loadData();
      showToast('Professor added successfully!');
    } catch (err: any) { showToast('Error: ' + (err.response?.data?.error || err.message), 'error'); }
    finally { setSubmitting(false); }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  function openEdit(p: Professor) {
    setEditProf(p);
    setEditForm({
      email: p.pending_email || p.email || '',
      name: p.name,
      employee_code: p.employee_code,
      dept_id: p.dept_id,
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await AdminAPI.updateProfessor(editProf!.professor_id, editForm);
      setEditProf(null);
      await loadData();
      showToast('Professor updated successfully!');
    } catch (err: any) { showToast('Error: ' + (err.response?.data?.error || err.message), 'error'); }
    finally { setSubmitting(false); }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    setSubmitting(true);
    try {
      const res = await AdminAPI.deleteProfessor(deleteProf!.professor_id);
      setDeleteProf(null);
      await loadData();
      const msg = res.data.deactivated
        ? `${deleteProf!.name} has already registered — their account was deactivated.`
        : `${deleteProf!.name} removed successfully.`;
      showToast(msg);
    } catch (err: any) { showToast('Error: ' + (err.response?.data?.error || err.message), 'error'); }
    finally { setSubmitting(false); }
  }

  // ── File Import ──────────────────────────────────────────────────────────
  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      let rows: any[] = [];
      if (ext === 'json') { rows = JSON.parse(await file.text()); }
      else if (ext === 'csv') {
        const text = await file.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
        rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj: any = {}; headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; }); return obj;
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const { read, utils } = await import('xlsx');
        const wb = read(await file.arrayBuffer());
        rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else { showToast('Unsupported file type.', 'error'); return; }

      const deptByName = new Map(departments.map(d => [d.name.toLowerCase(), d.dept_id]));
      const deptByCode = new Map(departments.map(d => [d.code.toLowerCase(), d.dept_id]));
      const normalized: any[] = []; const errors: string[] = [];

      rows.forEach((row, i) => {
        const email = row.email || row.Email || '';
        const name = row.name || row.Name || '';
        const code = row.employee_code || row.code || row['Employee Code'] || row['employee code'] || '';
        const deptRaw = (row.dept || row.department || row.Department || row.dept_name || '').toString().toLowerCase();
        if (!email || !name || !code) { errors.push(`Row ${i + 2}: Missing required field (email, name, or employee_code)`); return; }
        const deptId = deptByName.get(deptRaw) || deptByCode.get(deptRaw) || row.dept_id || '';
        if (!deptId) { errors.push(`Row ${i + 2} (${code}): Unknown dept "${deptRaw}" — use dept name, code, or UUID`); return; }
        normalized.push({ email, name, employee_code: code, dept_id: deptId });
      });

      if (errors.length) { showToast(errors.slice(0, 3).join('\n'), 'error'); return; }
      setSubmitting(true);
      const res = await AdminAPI.bulkImportProfessors(normalized);
      setImportResult(res.data.data);
      await loadData();
    } catch (err: any) { showToast('Import failed: ' + (err.response?.data?.message || err.message), 'error'); }
    finally { setSubmitting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  const filtered = professors.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.employee_code.toLowerCase().includes(search.toLowerCase()) ||
    p.dept_name?.toLowerCase().includes(search.toLowerCase()) ||
    (p.email || p.pending_email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <><style>{css}</style>
      <div className="pp-loading"><div className="spinner" />Loading professors…</div>
    </>
  );

  return (
    <><style>{css}</style>
    <div className="pp-page">
      <div className="pp-blob1" /><div className="pp-blob2" />
      <div className="pp-inner">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="pp-header">
          <div>
            <div className="pp-eyebrow">SmartAttend Admin</div>
            <div>
              <span className="pp-title">Professors</span>
              <span className="pp-chip">{professors.length}</span>
            </div>
            <p className="pp-subtitle">Manage faculty members across all departments</p>
          </div>
          <div className="pp-actions">
            {/* Search */}
            <div className="pp-search-wrap">
              <svg className="pp-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="pp-search" placeholder="Search professors…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Import button + tooltip */}
            <div className="btn-import-wrap" ref={tooltipRef}>
              <label
                className="btn-import"
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

              {/* ── Format Tooltip ─────────────────────────── */}
              {showTooltip && (
                <div className="import-tooltip" onClick={e => e.stopPropagation()}>
                  <div className="tt-header">
                    <p className="tt-title">📋 Import File Format</p>
                    <p className="tt-sub">Supported: CSV, JSON, Excel (.xlsx/.xls) — up to 100 rows</p>
                  </div>

                  {/* Tabs */}
                  <div className="tt-tabs">
                    {(['CSV', 'JSON', 'Excel'] as const).map(t => (
                      <button key={t} className={`tt-tab${tooltipTab === t ? ' active' : ''}`}
                        onClick={() => setTooltipTab(t)}>{t}</button>
                    ))}
                  </div>

                  <div className="tt-body">
                    {/* Required fields */}
                    <div className="tt-fields">
                      <div className="tt-fields-title">Required fields</div>
                      {FORMAT_FIELDS.map(f => (
                        <div key={f.name} className="tt-field-row">
                          <span className="tt-field-name">{f.name}</span>
                          <span className="tt-field-type">{f.type}</span>
                          <span className="tt-field-desc">{f.desc}</span>
                          {f.req && <span className="tt-req">*</span>}
                        </div>
                      ))}
                    </div>

                    {/* Example */}
                    <div className="tt-example-title">Example ({tooltipTab})</div>
                    <pre className="tt-code">{FORMAT_EXAMPLES[tooltipTab]}</pre>

                    {/* Tip */}
                    <div className="tt-tip">
                      <span style={{flexShrink:0}}>💡</span>
                      <span>
                        For Excel/CSV, the <strong>department</strong> column accepts the dept UUID,
                        name, or short code (e.g. <em>"CS"</em> or <em>"Computer Science"</em>).
                        Find UUIDs on the Departments page.
                      </span>
                    </div>

                    {/* Click file input */}
                    <button
                      className="btn-primary"
                      style={{width:'100%', marginTop:12, justifyContent:'center'}}
                      onClick={() => { setShowTooltip(false); fileRef.current?.click(); }}
                    >
                      Choose File to Import
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Add Professor */}
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Professor
            </button>
          </div>
        </div>

        {/* ── Table Card ──────────────────────────────────────────────── */}
        <div className="pp-card">
          <div className="pp-card-header">
            <div>
              <p className="pp-card-title">Faculty Directory</p>
              <p className="pp-card-sub">{filtered.length} of {professors.length} professor{professors.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="pp-empty">
              <div className="pp-empty-icon">👨‍🏫</div>
              <div className="pp-empty-text">{search ? 'No matching professors' : 'No professors yet'}</div>
            </div>
          ) : (
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Professor</th>
                  <th>Employee Code</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => (
                  <tr key={p.professor_id} style={{ animationDelay: `${idx * 25}ms` }}>
                    {/* Name + dept */}
                    <td>
                      <div className="name-cell">
                        <div className="avatar" style={{ background: avatarGradients[idx % avatarGradients.length] }}>
                          {getInitials(p.name)}
                        </div>
                        <div>
                          <span className="prof-name">{p.name}</span>
                          <span className="prof-dept">{p.dept_name}</span>
                        </div>
                      </div>
                    </td>
                    {/* Code */}
                    <td><span className="code-tag">{p.employee_code}</span></td>
                    {/* Email */}
                    <td>
                      {p.email
                        ? <span>{p.email}</span>
                        : <span className="email-pending">⏳ {p.pending_email} (pending)</span>
                      }
                    </td>
                    {/* Status */}
                    <td>
                      {p.awaiting_registration
                        ? <span className="badge-pending"><span className="status-dot dot-amber"/>Not Registered</span>
                        : <span className="badge-active"><span className="status-dot dot-green"/>Active</span>
                      }
                    </td>
                    {/* Actions */}
                    <td>
                      <div className="actions-cell">
                        <button className="btn-action btn-edit" onClick={() => openEdit(p)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          Edit
                        </button>
                        <button className="btn-action btn-delete" onClick={() => setDeleteProf(p)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Add Modal ───────────────────────────────────────────────── */}
        {showAdd && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
            <div className="modal-box">
              <div className="modal-title">Add Professor</div>
              <div className="modal-subtitle">Pre-register a faculty member. They'll set their own password on first login.</div>
              <form onSubmit={handleAdd}>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input required type="email" className="form-input" placeholder="professor@college.edu"
                    value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input required type="text" className="form-input" placeholder="Dr. Jane Smith"
                    value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Employee Code *</label>
                  <input required type="text" className="form-input" placeholder="e.g. EMP-CS-001"
                    value={addForm.employee_code} onChange={e => setAddForm({...addForm, employee_code: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select required className="form-input"
                    value={addForm.dept_id} onChange={e => setAddForm({...addForm, dept_id: e.target.value})}>
                    <option value="">Select department…</option>
                    {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
                <div className="form-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  The professor uses their email + employee code to set their password on first login.
                </div>
                <div className="form-actions">
                  <button type="submit" disabled={submitting} className="btn-submit">
                    {submitting ? 'Adding…' : 'Add Professor'}
                  </button>
                  <button type="button" className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Edit Modal ──────────────────────────────────────────────── */}
        {editProf && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditProf(null)}>
            <div className="modal-box">
              <div className="modal-title">Edit Professor</div>
              <div className="modal-subtitle">Update details for <strong>{editProf.name}</strong></div>
              <form onSubmit={handleEdit}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email" className="form-input"
                    placeholder="professor@college.edu"
                    value={editForm.email}
                    onChange={e => setEditForm({...editForm, email: e.target.value})}
                    disabled={!editProf.awaiting_registration}
                  />
                  {!editProf.awaiting_registration && (
                    <div className="form-warn" style={{marginTop:6}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      Email cannot be changed after the professor has registered. Contact them directly.
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input required type="text" className="form-input" placeholder="Dr. Jane Smith"
                    value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Employee Code *</label>
                  <input required type="text" className="form-input" placeholder="e.g. EMP-CS-001"
                    value={editForm.employee_code} onChange={e => setEditForm({...editForm, employee_code: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select required className="form-input"
                    value={editForm.dept_id} onChange={e => setEditForm({...editForm, dept_id: e.target.value})}>
                    <option value="">Select department…</option>
                    {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
                <div className="form-actions">
                  <button type="submit" disabled={submitting} className="btn-submit">
                    {submitting ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button type="button" className="btn-cancel" onClick={() => setEditProf(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Delete Confirm Modal ─────────────────────────────────────── */}
        {deleteProf && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteProf(null)}>
            <div className="modal-box modal-box-sm" style={{textAlign:'center'}}>
              <div className="delete-icon">🗑️</div>
              <div className="modal-title" style={{textAlign:'center', fontSize:18}}>Remove Professor?</div>
              <p className="delete-msg">
                You're about to remove{' '}
                <span className="delete-name">{deleteProf.name}</span>
                {' '}({deleteProf.employee_code}).
                {deleteProf.awaiting_registration
                  ? ' This professor has not registered yet and will be permanently deleted.'
                  : ' This professor has already registered — their account will be deactivated instead.'
                }
              </p>
              <div className="form-actions">
                <button disabled={submitting} className="btn-submit-red" onClick={handleDelete}>
                  {submitting ? 'Removing…' : deleteProf.awaiting_registration ? 'Delete' : 'Deactivate'}
                </button>
                <button className="btn-cancel" onClick={() => setDeleteProf(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Import Result Modal ─────────────────────────────────────── */}
        {importResult && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setImportResult(null)}>
            <div className="modal-box">
              <div className="modal-title">Import Results</div>
              <div className="result-ok">✅ {importResult.imported} professor(s) imported</div>
              {importResult.skipped?.length > 0 && (
                <>
                  <span className="skip-label">⚠ Skipped ({importResult.skipped.length})</span>
                  <div className="skip-list">
                    {importResult.skipped.map((s: any, i: number) => (
                      <div key={i} className="skip-item">
                        <span className="skip-code">{s.employee_code}</span>: {s.reason}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="form-actions">
                <button className="btn-submit" onClick={() => setImportResult(null)}>Done</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>

    {/* ── Toast ────────────────────────────────────────────────────────── */}
    {toast && (
      <div className={`pp-toast ${toast.type}`}>{toast.msg}</div>
    )}
    </>
  );
}