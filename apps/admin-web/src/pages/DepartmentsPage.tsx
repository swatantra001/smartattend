// D:\smartattend\apps\admin-web\src\pages\DepartmentsPage.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AdminAPI } from '../services/api';

/* ─── Interfaces ──────────────────────────────────────────────── */
interface Department {
  dept_id: string;
  name: string;
  code: string;
  student_count: number;
  professor_count: number;
  course_count: number;
  created_at?: string;
}

interface DeptDetail {
  courses: Array<{
    course_id: string; name: string; code: string;
    section: string | null; semester: number;
    is_active: boolean; student_count: number;
  }>;
  professors: Array<{
    professor_id: string; name: string;
    employee_code: string; email: string | null;
    awaiting_registration: boolean;
  }>;
  students_sample: Array<{
    student_id: string; name: string;
    roll_number: string; semester: number;
  }>;
  total_students: number;
}

/* ─── Design tokens ───────────────────────────────────────────── */
const D = {
  bg: '#F9FAFB', surface: '#FFFFFF',
  border: '#E5E7EB', borderLight: '#F3F4F6',
  purple: '#7C3AED', purpleLight: '#EDE9FE',
  green: '#10B981', greenLight: '#D1FAE5',
  red: '#EF4444', redLight: '#FEE2E2',
  amber: '#F59E0B', amberLight: '#FEF3C7',
  blue: '#3B82F6', blueLight: '#DBEAFE',
  teal: '#14B8A6',
  textPrimary: '#111827', textSecondary: '#6B7280', textMuted: '#9CA3AF',
  shadow: '0 1px 3px rgba(0,0,0,.08)',
  shadowLg: '0 12px 32px rgba(0,0,0,.12)',
};

/* Gradient palette for dept avatar chips */
const DEPT_GRADIENTS = [
  'linear-gradient(135deg,#7C3AED,#A78BFA)',
  'linear-gradient(135deg,#3B82F6,#60A5FA)',
  'linear-gradient(135deg,#10B981,#34D399)',
  'linear-gradient(135deg,#F59E0B,#FCD34D)',
  'linear-gradient(135deg,#EF4444,#F87171)',
  'linear-gradient(135deg,#14B8A6,#2DD4BF)',
  'linear-gradient(135deg,#EC4899,#F472B6)',
  'linear-gradient(135deg,#8B5CF6,#10B981)',
];

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

/* ─── Import format data ─────────────────────────────────────── */
const IMPORT_FIELDS = [
  { name: 'name', type: 'string', desc: 'Full department name',     req: true  },
  { name: 'code', type: 'string', desc: 'Short code (e.g. CS, ME)', req: true  },
];
const IMPORT_EXAMPLES: Record<string, string> = {
  CSV:
`name,code
Computer Science,CS
Mechanical Engineering,ME
Electronics & Comm.,EC`,

  JSON:
`[
  { "name": "Computer Science",        "code": "CS" },
  { "name": "Mechanical Engineering",  "code": "ME" },
  { "name": "Electronics & Comm.",     "code": "EC" }
]`,

  Excel:
`Column headers in Row 1:
  name | code

Row 2 onwards — one department per row.
Duplicate codes are skipped automatically.`,
};

/* ─── Semeter pill colours ────────────────────────────────────── */
const SEM_COLORS = [
  { bg:'#EDE9FE', color:'#5B21B6' }, { bg:'#DBEAFE', color:'#1D4ED8' },
  { bg:'#D1FAE5', color:'#065F46' }, { bg:'#FEF3C7', color:'#92400E' },
  { bg:'#FCE7F3', color:'#9D174D' }, { bg:'#FEE2E2', color:'#991B1B' },
  { bg:'#ECFDF5', color:'#065F46' }, { bg:'#F0FDF4', color:'#14532D' },
];

/* ─── CSS ─────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box}

.dp-page{font-family:'DM Sans',sans-serif;min-height:100vh;background:${D.bg};background-image:radial-gradient(circle,${D.border} 1px,transparent 1px);background-size:28px 28px;padding:32px;position:relative;overflow:hidden;}
.dp-blob1{position:fixed;top:-120px;right:-160px;width:480px;height:480px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,.09) 0%,transparent 70%);pointer-events:none;z-index:0;}
.dp-blob2{position:fixed;bottom:-100px;left:-80px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(20,184,166,.07) 0%,transparent 70%);pointer-events:none;z-index:0;}
.dp-inner{position:relative;z-index:1;max-width:1200px;}

/* ── Header ─────────────────────────────────────────────────── */
.dp-hdr{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:20px;}
.dp-eyebrow{font-size:11px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:${D.textMuted};margin-bottom:5px;}
.dp-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;color:${D.textPrimary};letter-spacing:-.5px;margin:0;line-height:1;}
.dp-chip{display:inline-flex;align-items:center;background:${D.textPrimary};color:#f9fafb;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-left:10px;vertical-align:middle;position:relative;top:-3px;}
.dp-sub{margin:4px 0 0;font-size:13px;color:${D.textMuted};}
.dp-hdr-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}

/* ── LLM copy banner ─────────────────────────────────────────── */
.dp-llm-bar{
  display:flex;align-items:center;gap:12px;
  background:linear-gradient(135deg,${D.purpleLight},${D.blueLight});
  border:1.5px solid ${D.purple}30;
  border-radius:12px;padding:14px 20px;margin-bottom:22px;
  box-shadow:0 2px 8px ${D.purple}15;
}
.dp-llm-icon{font-size:22px;flex-shrink:0;}
.dp-llm-text{flex:1;}
.dp-llm-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:${D.purple};margin:0 0 2px;}
.dp-llm-desc{font-size:12px;color:${D.textSecondary};margin:0;line-height:1.4;}
.dp-llm-btn{
  display:inline-flex;align-items:center;gap:6px;
  padding:9px 16px;background:${D.purple};color:#fff;
  border:none;border-radius:8px;font-family:'Syne',sans-serif;
  font-size:12px;font-weight:700;cursor:pointer;
  transition:all .18s ease;white-space:nowrap;
  box-shadow:0 4px 12px ${D.purple}40;letter-spacing:.02em;
}
.dp-llm-btn:hover{background:#6D28D9;transform:translateY(-1px);box-shadow:0 6px 18px ${D.purple}50;}
.dp-llm-btn.copied{background:${D.green};box-shadow:0 4px 12px ${D.green}40;}

/* ── Buttons ─────────────────────────────────────────────────── */
.btn-primary{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:${D.textPrimary};color:#fff;border:none;border-radius:8px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s ease;letter-spacing:.02em;box-shadow:0 4px 14px rgba(17,24,39,.2);}
.btn-primary:hover{background:#1f2937;transform:translateY(-1px);box-shadow:0 6px 20px rgba(17,24,39,.28);}
.btn-ghost{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;background:${D.surface};color:${D.textSecondary};border:1.5px solid ${D.border};border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s ease;}
.btn-ghost:hover{border-color:${D.textPrimary};color:${D.textPrimary};}

/* ── Search ─────────────────────────────────────────────────── */
.dp-sw{position:relative;}
.dp-si{padding:9px 12px 9px 36px;background:${D.surface};border:1.5px solid ${D.border};border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;color:${D.textPrimary};outline:none;transition:all .15s ease;width:200px;}
.dp-si:focus{border-color:${D.purple};box-shadow:0 0 0 3px ${D.purpleLight};width:210px;}
.dp-si::placeholder{color:${D.textMuted};}
.dp-si-ico{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:${D.textMuted};pointer-events:none;}

/* ── Import tooltip ─────────────────────────────────────────── */
.dp-tt-wrap{position:relative;}
.dp-tt{position:absolute;top:calc(100% + 10px);right:0;width:400px;background:#fff;border:1.5px solid ${D.border};border-radius:14px;box-shadow:${D.shadowLg};z-index:400;overflow:hidden;animation:dpTTIn .18s ease;}
@keyframes dpTTIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.dp-tt::before{content:'';position:absolute;top:-7px;right:20px;width:12px;height:12px;background:#fff;border-left:1.5px solid ${D.border};border-top:1.5px solid ${D.border};transform:rotate(45deg);}
.dp-tt-head{padding:13px 17px 10px;border-bottom:1px solid ${D.borderLight};}
.dp-tt-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:${D.textPrimary};margin:0 0 2px;}
.dp-tt-sub{font-size:11px;color:${D.textMuted};margin:0;}
.dp-tt-tabs{display:flex;border-bottom:1px solid ${D.borderLight};}
.dp-tt-tab{flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:600;cursor:pointer;color:${D.textMuted};transition:all .15s;border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif;letter-spacing:.04em;text-transform:uppercase;}
.dp-tt-tab:hover{color:${D.purple};}
.dp-tt-tab.active{color:${D.purple};border-bottom-color:${D.purple};background:rgba(124,58,237,.04);}
.dp-tt-body{padding:13px 17px 15px;}
.dp-tt-ft{font-size:10px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:${D.textMuted};margin-bottom:6px;}
.dp-tt-fr{display:flex;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px solid ${D.borderLight};font-size:12px;}
.dp-tt-fr:last-of-type{border-bottom:none;}
.dp-tt-fn{font-family:'Courier New',monospace;font-weight:700;color:${D.purple};min-width:52px;}
.dp-tt-ftp{font-size:10px;background:${D.borderLight};color:${D.textMuted};border-radius:4px;padding:1px 5px;font-family:monospace;}
.dp-tt-fd{color:${D.textSecondary};flex:1;}
.dp-tt-freq{color:${D.red};font-size:10px;font-weight:700;}
.dp-tt-ext{font-size:10px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:${D.textMuted};margin:11px 0 6px;}
.dp-tt-code{background:#1e1e2e;border-radius:8px;padding:10px 12px;font-family:'Courier New',monospace;font-size:11px;color:#cdd6f4;line-height:1.7;overflow-x:auto;white-space:pre;max-height:130px;overflow-y:auto;}
.dp-tt-tip{display:flex;align-items:flex-start;gap:7px;background:${D.amberLight};border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:8px 12px;font-size:11px;color:#92400e;margin-top:10px;line-height:1.5;}
.dp-tt-cta{width:100%;margin-top:11px;justify-content:center;display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:${D.textPrimary};color:#fff;border:none;border-radius:8px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s ease;letter-spacing:.02em;box-shadow:0 4px 14px rgba(17,24,39,.2);}
.dp-tt-cta:hover{background:#1f2937;transform:translateY(-1px);}

/* ── Table card ─────────────────────────────────────────────── */
.dp-card{background:${D.surface};border:1px solid ${D.border};border-radius:12px;box-shadow:${D.shadow};overflow:hidden;}
.dp-card-head{display:flex;align-items:center;justify-content:space-between;padding:18px 24px 16px;border-bottom:1px solid ${D.borderLight};}
.dp-card-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:600;color:${D.textPrimary};margin:0;}
.dp-card-sub{font-size:12px;color:${D.textMuted};margin:3px 0 0;}

.dp-tbl{width:100%;border-collapse:collapse;}
.dp-tbl thead tr{background:${D.borderLight};border-bottom:1px solid ${D.border};}
.dp-tbl th{padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:${D.textMuted};text-align:left;font-family:'DM Sans',sans-serif;white-space:nowrap;}
.dp-tbl th:first-child{padding-left:24px;}
.dp-tbl th:last-child{padding-right:24px;text-align:right;}
.dp-tbl tbody tr{border-bottom:1px solid ${D.borderLight};transition:background .12s;animation:dpRow .3s ease both;cursor:pointer;}
.dp-tbl tbody tr:last-child{border-bottom:none;}
.dp-tbl tbody tr:hover{background:#FAFAFA;}
@keyframes dpRow{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.dp-tbl td{padding:13px 16px;vertical-align:middle;font-size:13px;color:${D.textSecondary};}
.dp-tbl td:first-child{padding-left:24px;}
.dp-tbl td:last-child{padding-right:24px;text-align:right;}

/* dept name cell */
.dp-name-cell{display:flex;align-items:center;gap:12px;}
.dp-avatar{width:38px;height:38px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:12px;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);}
.dp-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:${D.textPrimary};display:block;}
.dp-name-sub{font-size:11px;color:${D.textMuted};display:block;margin-top:2px;}

/* code pill */
.code-tag{background:${D.borderLight};color:${D.textSecondary};font-family:'Courier New',monospace;font-size:11px;font-weight:600;padding:3px 8px;border-radius:5px;letter-spacing:.04em;border:1px solid ${D.border};}

/* stat cells */
.sv{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:${D.textPrimary};display:block;line-height:1;}
.sl{font-size:10px;color:${D.textMuted};display:block;margin-top:2px;letter-spacing:.06em;text-transform:uppercase;}

/* dept_id cell */
.dp-id-cell{display:flex;align-items:center;gap:6px;}
.dp-id-text{font-family:'Courier New',monospace;font-size:10.5px;color:${D.textMuted};max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.02em;}
.dp-copy-btn{
  flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;
  width:26px;height:26px;border-radius:6px;border:1px solid ${D.border};
  background:${D.borderLight};color:${D.textMuted};cursor:pointer;
  transition:all .14s ease;
}
.dp-copy-btn:hover{background:${D.purpleLight};border-color:${D.purple};color:${D.purple};}
.dp-copy-btn.done{background:${D.greenLight};border-color:${D.green};color:${D.green};}

/* action buttons */
.act-cell{display:flex;align-items:center;gap:5px;justify-content:flex-end;}
.btn-ra{display:inline-flex;align-items:center;gap:4px;padding:5px 11px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;transition:all .14s ease;border:1.5px solid transparent;font-family:'DM Sans',sans-serif;white-space:nowrap;}
.btn-ra-edit{background:${D.purpleLight};color:${D.purple};border-color:${D.purple}20;}
.btn-ra-edit:hover{background:${D.purple};color:#fff;box-shadow:0 2px 8px ${D.purple}40;transform:translateY(-1px);}
.btn-ra-del{background:${D.redLight};color:${D.red};border-color:${D.red}20;}
.btn-ra-del:hover{background:${D.red};color:#fff;box-shadow:0 2px 8px ${D.red}40;transform:translateY(-1px);}
.btn-ra:disabled{opacity:.5;cursor:not-allowed;transform:none!important;box-shadow:none!important;}

/* row hint */
.dp-hint{display:flex;align-items:center;gap:6px;font-size:11px;color:${D.textMuted};padding:10px 24px;border-top:1px solid ${D.borderLight};background:${D.borderLight};}

/* empty */
.dp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 24px;color:${D.textMuted};}
.dp-empty-icon{font-size:40px;margin-bottom:12px;opacity:.5;}
.dp-empty-text{font-family:'Syne',sans-serif;font-size:15px;font-weight:600;color:${D.border};}

/* ── Modals ──────────────────────────────────────────────────── */
.dp-ov{position:fixed;inset:0;background:rgba(17,24,39,.48);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:500;animation:dpFI .15s ease;}
@keyframes dpFI{from{opacity:0}to{opacity:1}}
@keyframes dpSU{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}

.dp-modal{background:${D.surface};border-radius:20px;padding:28px;width:100%;max-width:460px;box-shadow:${D.shadowLg};animation:dpSU .2s ease;max-height:90vh;overflow-y:auto;border:1px solid ${D.border};}
.dp-modal-xl{max-width:680px;}

.dp-mt{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:${D.textPrimary};margin:0 0 4px;letter-spacing:-.02em;}
.dp-ms{font-size:13px;color:${D.textMuted};margin:0 0 20px;line-height:1.5;}
.dp-ms strong{color:${D.textSecondary};font-weight:600;}

.fg{margin-bottom:14px;}
.fl{display:block;font-size:11px;font-weight:500;letter-spacing:.10em;text-transform:uppercase;color:${D.textMuted};margin-bottom:5px;}
.fi{width:100%;padding:10px 12px;background:${D.borderLight};border:1.5px solid ${D.border};border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;color:${D.textPrimary};transition:all .15s ease;outline:none;}
.fi:focus{border-color:${D.purple};background:#fff;box-shadow:0 0 0 3px ${D.purpleLight};}
.fi::placeholder{color:${D.textMuted};}
.f2c{display:grid;grid-template-columns:1fr 1fr;gap:12px;}

.fa{display:flex;gap:10px;margin-top:18px;}
.fa-ok{flex:1;padding:11px;background:${D.textPrimary};color:#fff;border:none;border-radius:10px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;}
.fa-ok:hover:not(:disabled){background:#1f2937;box-shadow:0 4px 14px rgba(0,0,0,.2);}
.fa-ok:disabled{opacity:.55;cursor:not-allowed;}
.fa-red{flex:1;padding:11px;background:${D.red};color:#fff;border:none;border-radius:10px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;}
.fa-red:hover:not(:disabled){background:#dc2626;box-shadow:0 4px 14px ${D.red}40;}
.fa-red:disabled{opacity:.55;cursor:not-allowed;}
.fa-cancel{flex:1;padding:11px;background:${D.borderLight};color:${D.textSecondary};border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;}
.fa-cancel:hover{background:${D.border};}

/* ── Detail modal ────────────────────────────────────────────── */
.det-hero{display:flex;align-items:center;gap:14px;padding-bottom:18px;border-bottom:1px solid ${D.borderLight};margin-bottom:16px;}
.det-av{width:50px;height:50px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:#fff;}
.det-name{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:${D.textPrimary};margin:0 0 6px;}
.det-tags{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.det-close{margin-left:auto;background:none;border:none;cursor:pointer;color:${D.textMuted};font-size:20px;line-height:1;padding:4px;border-radius:6px;transition:all .12s;}
.det-close:hover{background:${D.borderLight};color:${D.textPrimary};}

/* det id row */
.det-id-row{display:flex;align-items:center;gap:8px;background:${D.borderLight};border:1px solid ${D.border};border-radius:8px;padding:8px 12px;margin-bottom:16px;}
.det-id-label{font-size:11px;font-weight:600;color:${D.textMuted};text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;}
.det-id-val{font-family:'Courier New',monospace;font-size:12px;color:${D.purple};font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.det-id-copy{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;background:${D.purpleLight};color:${D.purple};border:1px solid ${D.purple}20;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;transition:all .14s;white-space:nowrap;font-family:'DM Sans',sans-serif;}
.det-id-copy:hover{background:${D.purple};color:#fff;}
.det-id-copy.done{background:${D.greenLight};color:${D.green};border-color:${D.green}20;}

.det-stats{display:flex;gap:10px;margin-bottom:16px;}
.det-sbox{flex:1;background:${D.borderLight};border:1px solid ${D.border};border-radius:10px;padding:12px 14px;}
.det-snum{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:${D.textPrimary};display:block;line-height:1;}
.det-slbl{font-size:10px;color:${D.textMuted};display:block;margin-top:3px;letter-spacing:.06em;text-transform:uppercase;}

.det-tabs{display:flex;border-bottom:1px solid ${D.borderLight};margin-bottom:14px;}
.det-tab{flex:1;padding:9px;text-align:center;font-size:12px;font-weight:600;cursor:pointer;color:${D.textMuted};transition:all .15s;border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif;letter-spacing:.04em;text-transform:uppercase;}
.det-tab:hover{color:${D.purple};}
.det-tab.active{color:${D.purple};border-bottom-color:${D.purple};background:rgba(124,58,237,.04);}

.det-list{display:flex;flex-direction:column;gap:7px;max-height:310px;overflow-y:auto;padding-right:2px;}
.det-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:${D.borderLight};border-radius:10px;border:1px solid ${D.border};transition:background .12s;}
.det-item:hover{background:rgba(124,58,237,.05);}
.det-iav{width:30px;height:30px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:10px;color:#fff;}
.det-iname{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:${D.textPrimary};display:block;}
.det-isub{font-size:11px;color:${D.textMuted};display:block;margin-top:1px;}
.det-ibadge{margin-left:auto;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;}
.det-ibadge-g{background:${D.greenLight};color:#065f46;}
.det-ibadge-grey{background:${D.borderLight};color:${D.textMuted};border:1px solid ${D.border};}
.det-ibadge-p{background:${D.purpleLight};color:${D.purple};}
.det-ibadge-b{background:${D.blueLight};color:${D.blue};}
.sem-pill{display:inline-flex;align-items:center;font-family:'Syne',sans-serif;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;letter-spacing:.04em;}

.det-empty{text-align:center;padding:32px;color:${D.textMuted};font-size:13px;}
.det-empty-icon{font-size:26px;display:block;margin-bottom:8px;opacity:.4;}
.det-loading{display:flex;align-items:center;justify-content:center;padding:36px;gap:10px;color:${D.textMuted};font-family:'Syne',sans-serif;font-size:13px;}

/* students sample footer */
.det-sample-footer{margin-top:10px;padding:10px 12px;background:${D.amberLight};border:1px solid rgba(245,158,11,.3);border-radius:8px;font-size:11px;color:#92400e;line-height:1.5;}

/* delete confirm */
.del-icon{font-size:36px;text-align:center;margin-bottom:12px;}
.del-msg{font-size:14px;color:${D.textSecondary};text-align:center;line-height:1.6;margin:0 0 20px;}
.del-name{font-family:'Syne',sans-serif;font-weight:700;color:${D.textPrimary};}

/* import result */
.res-ok{background:${D.greenLight};border:1px solid #a7f3d0;border-radius:10px;padding:12px 16px;font-family:'Syne',sans-serif;font-weight:700;font-size:15px;color:#065f46;margin-bottom:14px;}
.skip-label{font-size:11px;font-weight:700;color:${D.red};margin-bottom:6px;display:block;letter-spacing:.06em;text-transform:uppercase;}
.skip-list{max-height:150px;overflow-y:auto;border:1px solid ${D.redLight};border-radius:10px;background:#fff;margin-bottom:10px;}
.skip-item{padding:7px 12px;border-bottom:1px solid ${D.redLight};font-size:12px;color:${D.textSecondary};}
.skip-item:last-child{border-bottom:none;}
.skip-code{font-family:monospace;font-weight:700;color:${D.red};}

/* load */
.dp-load{display:flex;align-items:center;justify-content:center;min-height:60vh;gap:10px;color:${D.textMuted};font-family:'Syne',sans-serif;font-weight:600;font-size:14px;}
.spinner{width:20px;height:20px;border:2.5px solid ${D.border};border-top-color:${D.purple};border-radius:50%;animation:dpSpin .7s linear infinite;}
@keyframes dpSpin{to{transform:rotate(360deg)}}

/* toast */
.dp-toast{position:fixed;bottom:28px;right:28px;color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;padding:12px 20px;border-radius:10px;box-shadow:${D.shadowLg};z-index:9999;animation:dpFI .25s ease;max-width:340px;line-height:1.4;}
.dp-toast.ok{background:#065f46;}
.dp-toast.err{background:#991b1b;}
`;

/* ─── Toast hook ──────────────────────────────────────────────── */
function useToast() {
  const [t, setT] = useState<{msg:string;type:'ok'|'err'}|null>(null);
  function show(msg:string, type:'ok'|'err'='ok') {
    setT({msg,type}); setTimeout(()=>setT(null), 3200);
  }
  return {t, show};
}

/* ─── Copy button with tick feedback ─────────────────────────── */
function CopyBtn({ text, className = '', children }: { text:string; className?:string; children?:React.ReactNode }) {
  const [done, setDone] = useState(false);
  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(()=>{
      setDone(true); setTimeout(()=>setDone(false), 1800);
    });
  }
  return (
    <button className={`${className}${done?' done':''}`} onClick={copy} title="Copy">
      {done
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
      {children}
    </button>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */
export default function DepartmentsPage() {
  const [depts, setDepts]         = useState<Department[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [sub, setSub]             = useState(false);
  const [llmCopied, setLlmCopied] = useState(false);

  // tooltip
  const [showTT, setShowTT]   = useState(false);
  const [ttTab, setTtTab]     = useState<'CSV'|'JSON'|'Excel'>('CSV');
  const ttRef                 = useRef<HTMLDivElement>(null);
  const fileRef               = useRef<HTMLInputElement>(null);

  // modals
  const [showAdd, setShowAdd]           = useState(false);
  const [editDept, setEditDept]         = useState<Department|null>(null);
  const [delDept, setDelDept]           = useState<Department|null>(null);
  const [detailDept, setDetailDept]     = useState<Department|null>(null);
  const [detailData, setDetailData]     = useState<DeptDetail|null>(null);
  const [detailLoad, setDetailLoad]     = useState(false);
  const [detailTab, setDetailTab]       = useState<'courses'|'professors'|'students'>('courses');
  const [importResult, setImportResult] = useState<any>(null);

  const [addF, setAddF] = useState({ name:'', code:'' });
  const [editF, setEditF] = useState({ name:'', code:'' });

  const {t:toast, show:showToast} = useToast();

  /* tooltip outside click */
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ttRef.current && !ttRef.current.contains(e.target as Node)) setShowTT(false);
    }
    if (showTT) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showTT]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const res = await AdminAPI.listDepartments();
      setDepts(res.data.data || []);
    } catch { showToast('Failed to load departments', 'err'); }
    finally { setLoading(false); }
  }

  /* ── LLM copy ─────────────────────────────────────────────── */
  function copyLLMMapping() {
    const obj: Record<string, string> = {};
    depts.forEach(d => { obj[d.name] = d.dept_id; });
    const text =
      `Department Name → ID mapping for SmartAttend import:\n\n` +
      `${JSON.stringify(obj, null, 2)}\n\n` +
      `Usage: When you prepare CSV/JSON import files for students, professors, or courses,\n` +
      `use these UUIDs as the "dept_id" field value.\n` +
      `You can also use the dept short code instead: ${depts.map(d=>`"${d.code}" → "${d.name}"`).join(', ')}`;
    navigator.clipboard.writeText(text).then(() => {
      setLlmCopied(true); setTimeout(() => setLlmCopied(false), 2500);
    });
  }

  /* ── Add ──────────────────────────────────────────────────── */
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSub(true);
    try {
      await AdminAPI.createDepartment(addF);
      setShowAdd(false); setAddF({name:'',code:''});
      await loadData(); showToast('Department created!');
    } catch (err:any) { showToast('Error: '+(err.response?.data?.error||err.message),'err'); }
    finally { setSub(false); }
  }

  /* ── Edit ─────────────────────────────────────────────────── */
  function openEdit(d: Department) {
    setEditDept(d); setEditF({name:d.name, code:d.code});
  }
  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); setSub(true);
    try {
      await AdminAPI.updateDepartment(editDept!.dept_id, editF);
      setEditDept(null); await loadData(); showToast('Department updated!');
    } catch (err:any) { showToast('Error: '+(err.response?.data?.error||err.message),'err'); }
    finally { setSub(false); }
  }

  /* ── Delete ───────────────────────────────────────────────── */
  async function handleDelete() {
    setSub(true);
    try {
      await AdminAPI.deleteDepartment(delDept!.dept_id);
      const n = delDept!.name; setDelDept(null);
      await loadData(); showToast(`"${n}" deleted.`);
    } catch (err:any) { showToast('Error: '+(err.response?.data?.error||err.message),'err'); }
    finally { setSub(false); }
  }

  /* ── Row detail ───────────────────────────────────────────── */
  async function openDetail(d: Department, e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.btn-ra') ||
        (e.target as HTMLElement).closest('.dp-copy-btn') ||
        (e.target as HTMLElement).closest('.det-id-copy')) return;
    setDetailDept(d); setDetailTab('courses'); setDetailData(null); setDetailLoad(true);
    try {
      const res = await AdminAPI.getDepartmentDetail(d.dept_id);
      setDetailData(res.data.data);
    } catch { showToast('Failed to load details','err'); setDetailDept(null); }
    finally { setDetailLoad(false); }
  }

  /* ── Bulk import ─────────────────────────────────────────── */
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
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
          const o:any={}; headers.forEach((h,i) => {o[h]=vals[i]??'';}); return o;
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const {read,utils} = await import('xlsx');
        const wb = read(await file.arrayBuffer());
        rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else { showToast('Use CSV, JSON, or Excel','err'); return; }

      const norm: any[] = []; const errs: string[] = [];
      rows.forEach((r, i) => {
        const name = (r.name||r.Name||'').toString().trim();
        const code = (r.code||r.Code||'').toString().trim();
        if (!name||!code) { errs.push(`Row ${i+2}: Missing name or code`); return; }
        norm.push({name, code});
      });
      if (errs.length) { showToast(errs.slice(0,3).join('\n'),'err'); return; }
      setSub(true);
      const res = await AdminAPI.bulkImportDepartments(norm);
      setImportResult(res.data.data);
      await loadData();
    } catch (err:any) { showToast('Import failed: '+(err.response?.data?.message||err.message),'err'); }
    finally { setSub(false); if (fileRef.current) fileRef.current.value=''; }
  }

  const filtered = depts.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.code.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <><style>{CSS}</style>
      <div className="dp-load"><div className="spinner"/>Loading departments…</div>
    </>
  );

  return (
    <><style>{CSS}</style>
    <div className="dp-page">
      <div className="dp-blob1"/><div className="dp-blob2"/>
      <div className="dp-inner">

        {/* ── Header ──────────────────────────────────── */}
        <div className="dp-hdr">
          <div>
            <div className="dp-eyebrow">SmartAttend Admin</div>
            <div><span className="dp-title">Departments</span><span className="dp-chip">{depts.length}</span></div>
            <p className="dp-sub">Manage departments · click a row to see courses, professors &amp; students</p>
          </div>
          <div className="dp-hdr-right">
            {/* Search */}
            <div className="dp-sw">
              <svg className="dp-si-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="dp-si" placeholder="Search departments…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>

            {/* Import + tooltip */}
            <div className="dp-tt-wrap" ref={ttRef}>
              <label className="btn-ghost" style={{cursor:'pointer'}}
                onMouseEnter={()=>setShowTT(true)}
                onClick={()=>setShowTT(v=>!v)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Import
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.json" style={{display:'none'}}
                  onChange={e=>{setShowTT(false);handleImport(e);}}/>
              </label>

              {showTT && (
                <div className="dp-tt" onClick={e=>e.stopPropagation()}>
                  <div className="dp-tt-head">
                    <p className="dp-tt-title">📋 Bulk Import Format</p>
                    <p className="dp-tt-sub">CSV, JSON, or Excel (.xlsx) — departments only need 2 fields</p>
                  </div>
                  <div className="dp-tt-tabs">
                    {(['CSV','JSON','Excel'] as const).map(tab=>(
                      <button key={tab} className={`dp-tt-tab${ttTab===tab?' active':''}`}
                        onClick={()=>setTtTab(tab)}>{tab}</button>
                    ))}
                  </div>
                  <div className="dp-tt-body">
                    <div className="dp-tt-ft">Fields</div>
                    {IMPORT_FIELDS.map(f=>(
                      <div key={f.name} className="dp-tt-fr">
                        <span className="dp-tt-fn">{f.name}</span>
                        <span className="dp-tt-ftp">{f.type}</span>
                        <span className="dp-tt-fd">{f.desc}</span>
                        {f.req&&<span className="dp-tt-freq">*</span>}
                      </div>
                    ))}
                    <div className="dp-tt-ext">Example ({ttTab})</div>
                    <pre className="dp-tt-code">{IMPORT_EXAMPLES[ttTab]}</pre>
                    <div className="dp-tt-tip">
                      <span style={{flexShrink:0}}>💡</span>
                      <span>Duplicate codes are automatically skipped. After import, use the <strong>Copy for AI</strong> button to get UUIDs.</span>
                    </div>
                    <button className="dp-tt-cta" onClick={()=>{setShowTT(false);fileRef.current?.click();}}>
                      Choose File to Import
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Add dept */}
            <button className="btn-primary" onClick={()=>setShowAdd(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Department
            </button>
          </div>
        </div>

        {/* ── LLM Mapping Banner ──────────────────────── */}
        {depts.length > 0 && (
          <div className="dp-llm-bar">
            <div className="dp-llm-icon">🤖</div>
            <div className="dp-llm-text">
              <p className="dp-llm-title">Copy mapping for AI / LLM import assistance</p>
              <p className="dp-llm-desc">
                Copies all department names → UUIDs as a JSON block. Paste it into ChatGPT, Claude, or any LLM
                so it can auto-fill <code>dept_id</code> values when preparing your student / course import files.
              </p>
            </div>
            <button className={`dp-llm-btn${llmCopied?' copied':''}`} onClick={copyLLMMapping}>
              {llmCopied
                ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
                : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy for AI</>
              }
            </button>
          </div>
        )}

        {/* ── Table Card ──────────────────────────────── */}
        <div className="dp-card">
          <div className="dp-card-head">
            <div>
              <p className="dp-card-title">All Departments</p>
              <p className="dp-card-sub">{filtered.length} of {depts.length} department{depts.length!==1?'s':''}</p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="dp-empty">
              <div className="dp-empty-icon">🏛️</div>
              <div className="dp-empty-text">{search?'No matching departments':'No departments yet'}</div>
            </div>
          ) : (
            <>
              <table className="dp-tbl">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Code</th>
                    <th>Department ID</th>
                    <th>Courses</th>
                    <th>Professors</th>
                    <th>Students</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, idx) => (
                    <tr key={d.dept_id} style={{animationDelay:`${idx*25}ms`}}
                      onClick={e=>openDetail(d,e)}>

                      {/* Name */}
                      <td>
                        <div className="dp-name-cell">
                          <div className="dp-avatar" style={{background:DEPT_GRADIENTS[idx%DEPT_GRADIENTS.length]}}>
                            {initials(d.name)}
                          </div>
                          <div>
                            <span className="dp-name">{d.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td><span className="code-tag">{d.code}</span></td>

                      {/* dept_id + copy */}
                      <td onClick={e=>e.stopPropagation()}>
                        <div className="dp-id-cell">
                          <span className="dp-id-text" title={d.dept_id}>{d.dept_id}</span>
                          <CopyBtn text={d.dept_id} className="dp-copy-btn"/>
                        </div>
                      </td>

                      {/* Stats */}
                      <td><span className="sv">{d.course_count}</span><span className="sl">courses</span></td>
                      <td><span className="sv">{d.professor_count}</span><span className="sl">professors</span></td>
                      <td><span className="sv">{d.student_count}</span><span className="sl">students</span></td>

                      {/* Actions */}
                      <td>
                        <div className="act-cell">
                          <button className="btn-ra btn-ra-edit"
                            onClick={e=>{e.stopPropagation();openEdit(d);}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit
                          </button>
                          <button className="btn-ra btn-ra-del"
                            onClick={e=>{e.stopPropagation();setDelDept(d);}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
              <div className="dp-hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Click any row to see courses, professors and students in that department
              </div>
            </>
          )}
        </div>

        {/* ── Add Modal ────────────────────────────────── */}
        {showAdd && (
          <div className="dp-ov" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
            <div className="dp-modal">
              <div className="dp-mt">Add Department</div>
              <div className="dp-ms">Create a new department. The UUID will be auto-generated.</div>
              <form onSubmit={handleAdd}>
                <div className="fg"><label className="fl">Department Name *</label>
                  <input required className="fi" placeholder="e.g. Computer Science"
                    value={addF.name} onChange={e=>setAddF({...addF,name:e.target.value})}/>
                </div>
                <div className="fg"><label className="fl">Short Code *</label>
                  <input required className="fi" placeholder="e.g. CS" style={{textTransform:'uppercase'}}
                    value={addF.code} onChange={e=>setAddF({...addF,code:e.target.value.toUpperCase()})}/>
                </div>
                <div style={{background:D.purpleLight,border:`1px solid ${D.purple}20`,borderRadius:10,padding:'10px 14px',fontSize:12,color:D.purple,marginBottom:4,lineHeight:1.5}}>
                  <strong>💡</strong> After adding, use the <strong>Copy for AI</strong> button on the main page to get the UUID for import files.
                </div>
                <div className="fa">
                  <button type="submit" disabled={sub} className="fa-ok">{sub?'Creating…':'Create Department'}</button>
                  <button type="button" className="fa-cancel" onClick={()=>setShowAdd(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Edit Modal ───────────────────────────────── */}
        {editDept && (
          <div className="dp-ov" onClick={e=>e.target===e.currentTarget&&setEditDept(null)}>
            <div className="dp-modal">
              <div className="dp-mt">Edit Department</div>
              <div className="dp-ms">Update <strong>{editDept.name}</strong></div>
              <form onSubmit={handleEdit}>
                <div className="fg"><label className="fl">Department Name *</label>
                  <input required className="fi" placeholder="Department name"
                    value={editF.name} onChange={e=>setEditF({...editF,name:e.target.value})}/>
                </div>
                <div className="fg"><label className="fl">Short Code *</label>
                  <input required className="fi" placeholder="e.g. CS"
                    value={editF.code} onChange={e=>setEditF({...editF,code:e.target.value.toUpperCase()})}/>
                </div>
                <div className="fa">
                  <button type="submit" disabled={sub} className="fa-ok">{sub?'Saving…':'Save Changes'}</button>
                  <button type="button" className="fa-cancel" onClick={()=>setEditDept(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Delete Confirm ───────────────────────────── */}
        {delDept && (
          <div className="dp-ov" onClick={e=>e.target===e.currentTarget&&setDelDept(null)}>
            <div className="dp-modal" style={{maxWidth:420,textAlign:'center'}}>
              <div className="del-icon">⚠️</div>
              <div className="dp-mt" style={{textAlign:'center',fontSize:18}}>Delete Department?</div>
              <p className="del-msg">
                <span className="del-name">{delDept.name}</span> will be permanently deleted.
                This will also remove all associated courses, enrollments, and attendance records.
                This action <strong>cannot be undone</strong>.
              </p>
              {(delDept.student_count > 0 || delDept.course_count > 0) && (
                <div style={{background:D.redLight,border:`1px solid ${D.red}20`,borderRadius:8,padding:'10px 14px',fontSize:12,color:D.red,marginBottom:16,textAlign:'left'}}>
                  ⚠️ This department has <strong>{delDept.student_count} student{delDept.student_count!==1?'s':''}</strong> and <strong>{delDept.course_count} course{delDept.course_count!==1?'s':''}</strong>. Deleting it will cascade to all related data.
                </div>
              )}
              <div className="fa">
                <button disabled={sub} className="fa-red" onClick={handleDelete}>
                  {sub?'Deleting…':'Delete Permanently'}
                </button>
                <button className="fa-cancel" onClick={()=>setDelDept(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Import Result ────────────────────────────── */}
        {importResult && (
          <div className="dp-ov" onClick={e=>e.target===e.currentTarget&&setImportResult(null)}>
            <div className="dp-modal">
              <div className="dp-mt">Import Results</div>
              <div className="res-ok">✅ {importResult.imported} department{importResult.imported!==1?'s':''} imported</div>
              {importResult.skipped?.length>0&&(
                <><span className="skip-label">⚠ Skipped ({importResult.skipped.length})</span>
                <div className="skip-list">
                  {importResult.skipped.map((s:any,i:number)=>(
                    <div key={i} className="skip-item">
                      <span className="skip-code">{s.code}</span>: {s.reason}
                    </div>
                  ))}
                </div></>
              )}
              <div style={{background:D.purpleLight,border:`1px solid ${D.purple}20`,borderRadius:8,padding:'10px 14px',fontSize:12,color:D.purple,marginBottom:4}}>
                💡 Use the <strong>Copy for AI</strong> button on the page to get UUIDs for your import files.
              </div>
              <div className="fa">
                <button className="fa-ok" onClick={()=>setImportResult(null)}>Done</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Department Detail Modal ──────────────────── */}
        {detailDept && (
          <div className="dp-ov" onClick={e=>e.target===e.currentTarget&&setDetailDept(null)}>
            <div className="dp-modal dp-modal-xl">

              {/* Hero */}
              <div className="det-hero">
                <div className="det-av"
                  style={{background:DEPT_GRADIENTS[filtered.findIndex(d=>d.dept_id===detailDept.dept_id)%DEPT_GRADIENTS.length]}}>
                  {initials(detailDept.name)}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="det-name">{detailDept.name}</div>
                  <div className="det-tags">
                    <span className="code-tag">{detailDept.code}</span>
                    <span style={{fontSize:12,color:D.textMuted}}>
                      {detailDept.course_count} course{detailDept.course_count!==1?'s':''}
                      {' · '}{detailDept.student_count} student{detailDept.student_count!==1?'s':''}
                      {' · '}{detailDept.professor_count} professor{detailDept.professor_count!==1?'s':''}
                    </span>
                  </div>
                </div>
                <button className="det-close" onClick={()=>setDetailDept(null)}>✕</button>
              </div>

              {/* dept_id copy row */}
              <div className="det-id-row">
                <span className="det-id-label">Dept ID</span>
                <span className="det-id-val">{detailDept.dept_id}</span>
                <CopyBtn text={detailDept.dept_id} className="det-id-copy">
                  <span>Copy UUID</span>
                </CopyBtn>
              </div>

              {/* Stats */}
              {detailData && (
                <div className="det-stats">
                  <div className="det-sbox">
                    <span className="det-snum">{detailData.courses.length}</span>
                    <span className="det-slbl">Courses</span>
                  </div>
                  <div className="det-sbox">
                    <span className="det-snum">{detailData.professors.length}</span>
                    <span className="det-slbl">Professors</span>
                  </div>
                  <div className="det-sbox">
                    <span className="det-snum">{detailData.total_students}</span>
                    <span className="det-slbl">Students</span>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="det-tabs">
                <button className={`det-tab${detailTab==='courses'?' active':''}`}
                  onClick={()=>setDetailTab('courses')}>
                  📚 Courses {detailData?`(${detailData.courses.length})`:''}
                </button>
                <button className={`det-tab${detailTab==='professors'?' active':''}`}
                  onClick={()=>setDetailTab('professors')}>
                  👨‍🏫 Professors {detailData?`(${detailData.professors.length})`:''}
                </button>
                <button className={`det-tab${detailTab==='students'?' active':''}`}
                  onClick={()=>setDetailTab('students')}>
                  👨‍🎓 Students {detailData?`(${detailData.total_students})`:''}
                </button>
              </div>

              {/* Body */}
              {detailLoad ? (
                <div className="det-loading"><div className="spinner"/>Loading details…</div>
              ) : !detailData ? null
              : detailTab === 'courses' ? (
                detailData.courses.length === 0 ? (
                  <div className="det-empty"><span className="det-empty-icon">📚</span>No courses yet.</div>
                ) : (
                  <div className="det-list">
                    {detailData.courses.map((c) => {
                      const sem = SEM_COLORS[(c.semester-1)%SEM_COLORS.length];
                      return (
                        <div key={c.course_id} className="det-item">
                          <div className="det-iav" style={{background:'linear-gradient(135deg,#7C3AED,#A78BFA)',fontSize:14}}>📘</div>
                          <div style={{flex:1,minWidth:0}}>
                            <span className="det-iname">{c.name}</span>
                            <span className="det-isub">
                              <span className="code-tag" style={{fontSize:10,padding:'2px 6px'}}>{c.code}</span>
                              {c.section&&<span style={{marginLeft:4,fontSize:10,color:D.amber}}>§{c.section}</span>}
                              {' · '}{c.student_count} students
                            </span>
                          </div>
                          <span className="sem-pill" style={{background:sem.bg,color:sem.color}}>Sem {c.semester}</span>
                          <span style={{marginLeft:6}} className={`det-ibadge ${c.is_active?'det-ibadge-g':'det-ibadge-grey'}`}>
                            {c.is_active?'Active':'Inactive'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : detailTab === 'professors' ? (
                detailData.professors.length === 0 ? (
                  <div className="det-empty"><span className="det-empty-icon">👨‍🏫</span>No professors registered yet.</div>
                ) : (
                  <div className="det-list">
                    {detailData.professors.map((p,i) => (
                      <div key={p.professor_id} className="det-item">
                        <div className="det-iav" style={{background:DEPT_GRADIENTS[i%DEPT_GRADIENTS.length]}}>
                          {initials(p.name)}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <span className="det-iname">{p.name}</span>
                          <span className="det-isub">
                            <span className="code-tag" style={{fontSize:10,padding:'2px 6px'}}>{p.employee_code}</span>
                            {p.email&&<>{' · '}<span style={{color:D.textMuted}}>{p.email}</span></>}
                          </span>
                        </div>
                        <span className={`det-ibadge ${p.awaiting_registration?'det-ibadge-grey':'det-ibadge-p'}`}>
                          {p.awaiting_registration?'Pending':'Active'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Students tab */
                detailData.total_students === 0 ? (
                  <div className="det-empty"><span className="det-empty-icon">🎓</span>No students enrolled yet.</div>
                ) : (
                  <>
                    <div className="det-list">
                      {detailData.students_sample.map((s,i) => (
                        <div key={s.student_id} className="det-item">
                          <div className="det-iav" style={{background:DEPT_GRADIENTS[i%DEPT_GRADIENTS.length]}}>
                            {initials(s.name)}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <span className="det-iname">{s.name}</span>
                            <span className="det-isub">
                              <span className="code-tag" style={{fontSize:10,padding:'2px 6px'}}>{s.roll_number}</span>
                              {' · Sem '}{s.semester}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {detailData.total_students > detailData.students_sample.length && (
                      <div className="det-sample-footer">
                        Showing {detailData.students_sample.length} of {detailData.total_students} students.
                        Go to the <strong>Students</strong> page and filter by department to see all.
                      </div>
                    )}
                  </>
                )
              )}

              <div style={{marginTop:18,textAlign:'right'}}>
                <button className="fa-cancel" style={{maxWidth:120,display:'inline-block'}}
                  onClick={()=>setDetailDept(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>

    {toast && <div className={`dp-toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}