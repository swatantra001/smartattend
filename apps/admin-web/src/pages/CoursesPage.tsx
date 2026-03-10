

import React, { useState, useEffect, useRef } from 'react';
import { AdminAPI } from '../services/api';

/* ─── Interfaces ─────────────────────────────────────────────── */
interface Course {
  course_id: string;
  name: string;
  code: string;
  section: string | null;
  semester: number;
  is_active: boolean;
  dept_name: string;
  dept_id: string;
  student_count: number;
  professor_count: number;
}
interface Department { dept_id: string; name: string; code: string; }
interface CourseDetail {
  students: Array<{
    student_id: string; name: string; roll_number: string;
    semester: number; email: string | null; face_enrolled_at: string | null;
  }>;
  professors: Array<{
    professor_id: string; name: string; employee_code: string; email: string | null;
  }>;
}

/* ─── Design tokens ──────────────────────────────────────────── */
const D = {
  bg: '#F9FAFB', surface: '#FFFFFF',
  border: '#E5E7EB', borderLight: '#F3F4F6',
  purple: '#7C3AED', purpleLight: '#EDE9FE',
  green: '#10B981', greenLight: '#D1FAE5',
  red: '#EF4444', redLight: '#FEE2E2',
  amber: '#F59E0B', amberLight: '#FEF3C7',
  textPrimary: '#111827', textSecondary: '#6B7280', textMuted: '#9CA3AF',
  shadow: '0 1px 3px rgba(0,0,0,.08)',
  shadowLg: '0 12px 32px rgba(0,0,0,.12)',
};

const semColors = [
  { bg:'#EDE9FE', color:'#5B21B6' }, { bg:'#DBEAFE', color:'#1D4ED8' },
  { bg:'#D1FAE5', color:'#065F46' }, { bg:'#FEF3C7', color:'#92400E' },
  { bg:'#FCE7F3', color:'#9D174D' }, { bg:'#FEE2E2', color:'#991B1B' },
  { bg:'#ECFDF5', color:'#065F46' }, { bg:'#F0FDF4', color:'#14532D' },
];
const courseIcons = ['📘','📗','📙','📕','📓','📔','📒','📃'];
const iconBgs = [
  'linear-gradient(135deg,#dbeafe,#ede9fe)', 'linear-gradient(135deg,#d1fae5,#dbeafe)',
  'linear-gradient(135deg,#fef3c7,#fee2e2)', 'linear-gradient(135deg,#fce7f3,#ede9fe)',
  'linear-gradient(135deg,#d1fae5,#fef3c7)', 'linear-gradient(135deg,#dbeafe,#fce7f3)',
];
const avatarGrads = [
  'linear-gradient(135deg,#7C3AED,#A78BFA)', 'linear-gradient(135deg,#3B82F6,#7C3AED)',
  'linear-gradient(135deg,#10B981,#3B82F6)', 'linear-gradient(135deg,#F59E0B,#EF4444)',
  'linear-gradient(135deg,#EC4899,#7C3AED)', 'linear-gradient(135deg,#14B8A6,#A78BFA)',
];

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

/* ─── Import tooltip data ────────────────────────────────────── */
const IMPORT_FIELDS = [
  { name:'name',    type:'string', desc:'Full course title',              req:true  },
  { name:'code',    type:'string', desc:'Course code (e.g. CS301)',       req:true  },
  { name:'dept_id', type:'uuid',   desc:'Dept UUID, name, or short code', req:true  },
  { name:'semester',type:'number', desc:'Semester number (1–10)',          req:true  },
  { name:'section', type:'string', desc:'Section label (e.g. A)',         req:false },
];
const IMPORT_EXAMPLES: Record<string, string> = {
  CSV:
`name,code,dept_id,semester,section
Data Structures,CS301,3fa85f64-...,3,A
Operating Systems,CS401,3fa85f64-...,4,B`,

  JSON:
`[
  {
    "name": "Data Structures",
    "code": "CS301",
    "dept_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "semester": 3,
    "section": "A"
  },
  {
    "name": "Operating Systems",
    "code": "CS401",
    "dept_id": "Computer Science",
    "semester": 4
  }
]`,

  Excel:
`Column headers in Row 1 (case-insensitive):
  name | code | dept_id | semester | section

Row 2 onwards — one course per row.
"dept_id" also accepts dept name or short code
  e.g. "Computer Science" or "CS".
"section" is optional — leave blank to omit.`,
};

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box}

.cp-page{font-family:'DM Sans',sans-serif;min-height:100vh;background:${D.bg};background-image:radial-gradient(circle,${D.border} 1px,transparent 1px);background-size:28px 28px;padding:32px;position:relative;overflow:hidden;}
.cp-blob1{position:fixed;top:-140px;right:-180px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,.10) 0%,transparent 70%);pointer-events:none;z-index:0;}
.cp-blob2{position:fixed;bottom:-80px;left:-100px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(245,158,11,.07) 0%,transparent 70%);pointer-events:none;z-index:0;}
.cp-inner{position:relative;z-index:1;max-width:1140px;}

/* header */
.cp-hdr{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:28px;}
.cp-eyebrow{font-size:11px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:${D.textMuted};margin-bottom:5px;}
.cp-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;color:${D.textPrimary};letter-spacing:-.5px;margin:0;line-height:1;}
.cp-chip{display:inline-flex;align-items:center;background:${D.textPrimary};color:#f9fafb;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-left:10px;vertical-align:middle;position:relative;top:-3px;}
.cp-sub{margin:4px 0 0;font-size:13px;color:${D.textMuted};}
.cp-hdr-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}

/* search */
.cp-sw{position:relative;}
.cp-si{padding:9px 12px 9px 36px;background:${D.surface};border:1.5px solid ${D.border};border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;color:${D.textPrimary};outline:none;transition:all .15s ease;width:210px;}
.cp-si:focus{border-color:${D.purple};box-shadow:0 0 0 3px ${D.purpleLight};width:250px;}
.cp-si::placeholder{color:${D.textMuted};}
.cp-si-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:${D.textMuted};pointer-events:none;}

/* buttons */
.btn-primary{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:${D.textPrimary};color:#fff;border:none;border-radius:8px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s ease;letter-spacing:.02em;box-shadow:0 4px 14px rgba(17,24,39,.2);}
.btn-primary:hover{background:#1f2937;transform:translateY(-1px);box-shadow:0 6px 20px rgba(17,24,39,.28);}
.btn-ghost{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;background:${D.surface};color:${D.textSecondary};border:1.5px solid ${D.border};border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s ease;}
.btn-ghost:hover{border-color:${D.textPrimary};color:${D.textPrimary};}

/* import tooltip */
.cp-tt-wrap{position:relative;}
.cp-tt{position:absolute;top:calc(100% + 10px);right:0;width:430px;background:#fff;border:1.5px solid ${D.border};border-radius:14px;box-shadow:${D.shadowLg};z-index:400;overflow:hidden;animation:cpTTIn .18s ease;}
@keyframes cpTTIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.cp-tt::before{content:'';position:absolute;top:-7px;right:20px;width:12px;height:12px;background:#fff;border-left:1.5px solid ${D.border};border-top:1.5px solid ${D.border};transform:rotate(45deg);}
.cp-tt-head{padding:14px 18px 10px;border-bottom:1px solid ${D.borderLight};}
.cp-tt-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:${D.textPrimary};margin:0 0 2px;}
.cp-tt-sub{font-size:11px;color:${D.textMuted};margin:0;}
.cp-tt-tabs{display:flex;border-bottom:1px solid ${D.borderLight};}
.cp-tt-tab{flex:1;padding:8px 0;text-align:center;font-size:11px;font-weight:600;cursor:pointer;color:${D.textMuted};transition:all .15s ease;border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif;letter-spacing:.04em;text-transform:uppercase;}
.cp-tt-tab:hover{color:${D.purple};}
.cp-tt-tab.active{color:${D.purple};border-bottom-color:${D.purple};background:rgba(124,58,237,.04);}
.cp-tt-body{padding:14px 18px 16px;}
.cp-tt-ft{font-size:10px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:${D.textMuted};margin-bottom:7px;}
.cp-tt-fr{display:flex;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px solid ${D.borderLight};font-size:12px;}
.cp-tt-fr:last-of-type{border-bottom:none;}
.cp-tt-fn{font-family:'Courier New',monospace;font-weight:700;color:${D.purple};min-width:82px;}
.cp-tt-ftp{font-size:10px;background:${D.borderLight};color:${D.textMuted};border-radius:4px;padding:1px 5px;font-family:monospace;}
.cp-tt-fd{color:${D.textSecondary};flex:1;line-height:1.4;}
.cp-tt-freq{color:${D.red};font-size:10px;font-weight:700;}
.cp-tt-ext{font-size:10px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:${D.textMuted};margin:12px 0 6px;}
.cp-tt-code{background:#1e1e2e;border-radius:8px;padding:10px 12px;font-family:'Courier New',monospace;font-size:11px;color:#cdd6f4;line-height:1.7;overflow-x:auto;white-space:pre;max-height:145px;overflow-y:auto;}
.cp-tt-tip{display:flex;align-items:flex-start;gap:7px;background:${D.amberLight};border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:8px 12px;font-size:11px;color:#92400e;margin-top:10px;line-height:1.5;}
.cp-tt-cta{width:100%;margin-top:12px;justify-content:center;display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:${D.textPrimary};color:#fff;border:none;border-radius:8px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s ease;letter-spacing:.02em;box-shadow:0 4px 14px rgba(17,24,39,.2);}
.cp-tt-cta:hover{background:#1f2937;transform:translateY(-1px);}

/* table card */
.cp-card{background:${D.surface};border:1px solid ${D.border};border-radius:12px;box-shadow:${D.shadow};overflow:hidden;}
.cp-card-head{display:flex;align-items:center;justify-content:space-between;padding:18px 24px 16px;border-bottom:1px solid ${D.borderLight};}
.cp-card-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:600;color:${D.textPrimary};margin:0;}
.cp-card-sub{font-size:12px;color:${D.textMuted};margin:3px 0 0;}

.cp-tbl{width:100%;border-collapse:collapse;}
.cp-tbl thead tr{background:${D.borderLight};border-bottom:1px solid ${D.border};}
.cp-tbl th{padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:${D.textMuted};text-align:left;font-family:'DM Sans',sans-serif;white-space:nowrap;}
.cp-tbl th:first-child{padding-left:24px;width:44px;}
.cp-tbl th:last-child{padding-right:24px;text-align:right;}
.cp-tbl tbody tr{border-bottom:1px solid ${D.borderLight};transition:background .12s ease;animation:cpRow .3s ease both;cursor:pointer;}
.cp-tbl tbody tr:last-child{border-bottom:none;}
.cp-tbl tbody tr:hover{background:#FAFAFA;}
@keyframes cpRow{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.cp-tbl td{padding:13px 16px;vertical-align:middle;font-size:13px;color:${D.textSecondary};}
.cp-tbl td:first-child{padding-left:24px;}
.cp-tbl td:last-child{padding-right:24px;text-align:right;}

.rank-n{font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:${D.border};width:28px;display:inline-block;text-align:center;}
.rank-n.top{color:${D.amber};}

.cw{display:flex;align-items:center;gap:12px;}
.ci{width:36px;height:36px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px;}
.cn{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:${D.textPrimary};display:block;line-height:1.3;}
.cd{font-size:11px;color:${D.textMuted};display:block;margin-top:2px;}

.code-tag{background:${D.borderLight};color:${D.textSecondary};font-family:'Courier New',monospace;font-size:11px;font-weight:600;padding:3px 8px;border-radius:5px;letter-spacing:.04em;border:1px solid ${D.border};}
.sec-tag{background:${D.amberLight};color:#92400e;font-size:11px;font-weight:600;padding:3px 8px;border-radius:5px;margin-left:4px;font-family:'DM Sans',sans-serif;}
.sem-pill{display:inline-flex;align-items:center;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:.04em;}

.sv{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:${D.textPrimary};display:block;line-height:1;}
.sl{font-size:10px;color:${D.textMuted};display:block;margin-top:2px;letter-spacing:.06em;text-transform:uppercase;}

.sdot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px;}
.sdot-on{background:${D.green};box-shadow:0 0 0 2px ${D.green}30;}
.sdot-off{background:${D.textMuted};}
.st-on{color:${D.green};font-weight:600;font-size:12px;}
.st-off{color:${D.textMuted};font-weight:600;font-size:12px;}

/* row action buttons */
.act-cell{display:flex;align-items:center;gap:5px;justify-content:flex-end;}
.btn-ra{display:inline-flex;align-items:center;gap:4px;padding:5px 11px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;transition:all .14s ease;border:1.5px solid transparent;font-family:'DM Sans',sans-serif;white-space:nowrap;}
.btn-ra-edit{background:${D.purpleLight};color:${D.purple};border-color:${D.purple}20;}
.btn-ra-edit:hover{background:${D.purple};color:#fff;box-shadow:0 2px 8px ${D.purple}40;transform:translateY(-1px);}
.btn-ra-del{background:${D.redLight};color:${D.red};border-color:${D.red}20;}
.btn-ra-del:hover{background:${D.red};color:#fff;box-shadow:0 2px 8px ${D.red}40;transform:translateY(-1px);}
.btn-ra:disabled{opacity:.5;cursor:not-allowed;transform:none!important;box-shadow:none!important;}

/* row hint bar */
.cp-hint{display:flex;align-items:center;gap:6px;font-size:11px;color:${D.textMuted};padding:10px 24px;border-top:1px solid ${D.borderLight};background:${D.borderLight};}

/* empty */
.cp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 24px;color:${D.textMuted};}
.cp-empty-icon{font-size:40px;margin-bottom:12px;opacity:.5;}
.cp-empty-text{font-family:'Syne',sans-serif;font-size:15px;font-weight:600;color:${D.border};}

/* modals */
.cp-ov{position:fixed;inset:0;background:rgba(17,24,39,.48);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:500;animation:cpFI .15s ease;}
@keyframes cpFI{from{opacity:0}to{opacity:1}}
@keyframes cpSU{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}

.cp-modal{background:${D.surface};border-radius:20px;padding:28px;width:100%;max-width:480px;box-shadow:${D.shadowLg};animation:cpSU .2s ease;max-height:90vh;overflow-y:auto;border:1px solid ${D.border};}
.cp-modal-xl{max-width:660px;}

.cp-mt{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:${D.textPrimary};margin:0 0 4px;letter-spacing:-.02em;}
.cp-ms{font-size:13px;color:${D.textMuted};margin:0 0 20px;line-height:1.5;}
.cp-ms strong{color:${D.textSecondary};font-weight:600;}

.fg{margin-bottom:14px;}
.fl{display:block;font-size:11px;font-weight:500;letter-spacing:.10em;text-transform:uppercase;color:${D.textMuted};margin-bottom:5px;}
.fi{width:100%;padding:10px 12px;background:${D.borderLight};border:1.5px solid ${D.border};border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;color:${D.textPrimary};transition:all .15s ease;outline:none;}
.fi:focus{border-color:${D.purple};background:#fff;box-shadow:0 0 0 3px ${D.purpleLight};}
.fi::placeholder{color:${D.textMuted};}
.f2c{display:grid;grid-template-columns:1fr 1fr;gap:12px;}

.sem-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px;}
.sem-btn{padding:7px 4px;border:1.5px solid ${D.border};border-radius:8px;background:${D.borderLight};font-family:'Syne',sans-serif;font-size:11px;font-weight:700;color:${D.textMuted};cursor:pointer;transition:all .12s ease;text-align:center;}
.sem-btn:hover{border-color:${D.purple};color:${D.purple};}
.sem-btn.active{border-color:${D.purple};background:${D.purpleLight};color:${D.purple};box-shadow:0 0 0 2px ${D.purple}20;}

.fa{display:flex;gap:10px;margin-top:18px;}
.fa-ok{flex:1;padding:11px;background:${D.textPrimary};color:#fff;border:none;border-radius:10px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s ease;}
.fa-ok:hover:not(:disabled){background:#1f2937;box-shadow:0 4px 14px rgba(0,0,0,.2);}
.fa-ok:disabled{opacity:.55;cursor:not-allowed;}
.fa-red{flex:1;padding:11px;background:${D.red};color:#fff;border:none;border-radius:10px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s ease;}
.fa-red:hover:not(:disabled){background:#dc2626;box-shadow:0 4px 14px ${D.red}40;}
.fa-red:disabled{opacity:.55;cursor:not-allowed;}
.fa-cancel{flex:1;padding:11px;background:${D.borderLight};color:${D.textSecondary};border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s ease;}
.fa-cancel:hover{background:${D.border};}

/* detail modal */
.det-hero{display:flex;align-items:center;gap:14px;padding-bottom:18px;border-bottom:1px solid ${D.borderLight};margin-bottom:18px;}
.det-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
.det-name{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:${D.textPrimary};margin:0 0 5px;}
.det-tags{display:flex;gap:5px;flex-wrap:wrap;align-items:center;}
.det-close{margin-left:auto;background:none;border:none;cursor:pointer;color:${D.textMuted};font-size:20px;line-height:1;padding:4px;border-radius:6px;transition:all .12s;}
.det-close:hover{background:${D.borderLight};color:${D.textPrimary};}

.det-stats{display:flex;gap:12px;margin-bottom:16px;}
.det-sbox{flex:1;background:${D.borderLight};border:1px solid ${D.border};border-radius:10px;padding:12px 14px;}
.det-snum{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:${D.textPrimary};display:block;line-height:1;}
.det-slbl{font-size:10px;color:${D.textMuted};display:block;margin-top:3px;letter-spacing:.06em;text-transform:uppercase;}

.det-tabs{display:flex;border-bottom:1px solid ${D.borderLight};margin-bottom:16px;}
.det-tab{flex:1;padding:9px;text-align:center;font-size:12px;font-weight:600;cursor:pointer;color:${D.textMuted};transition:all .15s ease;border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif;letter-spacing:.04em;text-transform:uppercase;}
.det-tab:hover{color:${D.purple};}
.det-tab.active{color:${D.purple};border-bottom-color:${D.purple};background:rgba(124,58,237,.04);}

.det-list{display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto;padding-right:2px;}
.det-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:${D.borderLight};border-radius:10px;border:1px solid ${D.border};transition:background .12s;}
.det-item:hover{background:rgba(124,58,237,.05);}
.det-av{width:32px;height:32px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:11px;color:#fff;}
.det-iname{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:${D.textPrimary};display:block;}
.det-isub{font-size:11px;color:${D.textMuted};display:block;margin-top:2px;}
.det-badge{margin-left:auto;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;}
.det-badge-g{background:${D.greenLight};color:#065f46;}
.det-badge-grey{background:${D.borderLight};color:${D.textMuted};border:1px solid ${D.border};}
.det-badge-p{background:${D.purpleLight};color:${D.purple};}
.det-empty{text-align:center;padding:36px;color:${D.textMuted};font-size:13px;}
.det-empty-icon{font-size:28px;display:block;margin-bottom:8px;opacity:.4;}
.det-loading{display:flex;align-items:center;justify-content:center;padding:40px;gap:10px;color:${D.textMuted};font-family:'Syne',sans-serif;font-size:13px;}

/* delete confirm */
.del-icon{font-size:36px;text-align:center;margin-bottom:12px;}
.del-msg{font-size:14px;color:${D.textSecondary};text-align:center;line-height:1.6;margin:0 0 20px;}
.del-name{font-family:'Syne',sans-serif;font-weight:700;color:${D.textPrimary};}

/* loading */
.cp-load{display:flex;align-items:center;justify-content:center;min-height:60vh;gap:10px;color:${D.textMuted};font-family:'Syne',sans-serif;font-weight:600;font-size:14px;}
.spinner{width:20px;height:20px;border:2.5px solid ${D.border};border-top-color:${D.purple};border-radius:50%;animation:cpSpin .7s linear infinite;}
@keyframes cpSpin{to{transform:rotate(360deg)}}

/* toast */
.cp-toast{position:fixed;bottom:28px;right:28px;color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;padding:12px 20px;border-radius:10px;box-shadow:${D.shadowLg};z-index:9999;animation:cpFI .25s ease;max-width:340px;line-height:1.4;}
.cp-toast.ok{background:#065f46;}
.cp-toast.err{background:#991b1b;}
`;

/* ─── Toast hook ─────────────────────────────────────────────── */
function useToast() {
  const [t, setT] = useState<{msg:string;type:'ok'|'err'}|null>(null);
  function show(msg:string, type:'ok'|'err'='ok') {
    setT({msg,type}); setTimeout(()=>setT(null),3500);
  }
  return {t, show};
}

/* ─── Component ──────────────────────────────────────────────── */
export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [depts, setDepts]     = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [sub, setSub]         = useState(false);

  // tooltip
  const [showTT, setShowTT]   = useState(false);
  const [ttTab, setTtTab]     = useState<'CSV'|'JSON'|'Excel'>('CSV');
  const ttRef                 = useRef<HTMLDivElement>(null);
  const fileRef               = useRef<HTMLInputElement>(null);

  // modals
  const [showCreate, setShowCreate]       = useState(false);
  const [editCourse, setEditCourse]       = useState<Course|null>(null);
  const [delCourse, setDelCourse]         = useState<Course|null>(null);
  const [detailCourse, setDetailCourse]   = useState<Course|null>(null);
  const [detailData, setDetailData]       = useState<CourseDetail|null>(null);
  const [detailLoad, setDetailLoad]       = useState(false);
  const [detailTab, setDetailTab]         = useState<'students'|'professors'>('students');

  const [cF, setCF] = useState({ name:'', code:'', section:'', dept_id:'', semester:1 });
  const [eF, setEF] = useState({ name:'', code:'', section:'', dept_id:'', semester:1 });

  const {t:toast, show:showToast} = useToast();

  /* tooltip outside-click close */
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
      const [cR, dR] = await Promise.all([AdminAPI.listCourses(), AdminAPI.listDepartments()]);
      setCourses(cR.data.data || []);
      setDepts(dR.data.data || []);
    } catch { showToast('Failed to load data','err'); }
    finally { setLoading(false); }
  }

  /* ── Bulk import ──────────────────────────────────────────── */
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      let rows: any[] = [];
      if (ext==='json') { rows = JSON.parse(await file.text()); }
      else if (ext==='csv') {
        const lines = (await file.text()).trim().split('\n');
        const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'));
        rows = lines.slice(1).map(line=>{
          const vals = line.split(',').map(v=>v.trim().replace(/^"|"$/g,''));
          const o:any={}; headers.forEach((h,i)=>{o[h]=vals[i]??'';}); return o;
        });
      } else if (ext==='xlsx'||ext==='xls') {
        const {read,utils} = await import('xlsx');
        const wb = read(await file.arrayBuffer());
        rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else { showToast('Use CSV, JSON, or Excel','err'); return; }

      const dByName = new Map(depts.map(d=>[d.name.toLowerCase(),d.dept_id]));
      const dByCode = new Map(depts.map(d=>[d.code.toLowerCase(),d.dept_id]));
      const norm:any[] = []; const errs:string[] = [];

      rows.forEach((r,i)=>{
        const name=(r.name||r.Name||'').toString();
        const code=(r.code||r.Code||'').toString();
        const dRaw=(r.dept_id||r.dept||r.department||'').toString().toLowerCase();
        const sem=parseInt(r.semester||r.Semester||'1');
        const sec=(r.section||r.Section||undefined);
        if(!name||!code){errs.push(`Row ${i+2}: Missing name or code`);return;}
        const deptId=dByName.get(dRaw)||dByCode.get(dRaw)||r.dept_id||'';
        if(!deptId){errs.push(`Row ${i+2} (${code}): Unknown dept "${dRaw}"`);return;}
        norm.push({name,code,dept_id:deptId,semester:isNaN(sem)?1:sem,section:sec||undefined});
      });

      if(errs.length){showToast(errs.slice(0,3).join('\n'),'err');return;}
      setSub(true);
      await AdminAPI.bulkImportCourses(norm);
      await loadData();
      showToast(`${norm.length} course(s) imported!`);
    } catch(err:any){showToast('Import failed: '+(err.response?.data?.message||err.message),'err');}
    finally{setSub(false);if(fileRef.current)fileRef.current.value='';}
  }

  /* ── Create ───────────────────────────────────────────────── */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSub(true);
    try {
      await AdminAPI.createCourse({...cF,section:cF.section||undefined,semester:Number(cF.semester)});
      setShowCreate(false); setCF({name:'',code:'',section:'',dept_id:'',semester:1});
      await loadData(); showToast('Course created!');
    } catch(err:any){showToast('Error: '+(err.response?.data?.error||err.message),'err');}
    finally{setSub(false);}
  }

  /* ── Edit ─────────────────────────────────────────────────── */
  function openEdit(c: Course) {
    setEditCourse(c);
    setEF({name:c.name,code:c.code,section:c.section||'',dept_id:c.dept_id,semester:c.semester});
  }
  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); setSub(true);
    try {
      await AdminAPI.updateCourse(editCourse!.course_id,{...eF,section:eF.section||undefined,semester:Number(eF.semester)});
      setEditCourse(null); await loadData(); showToast('Course updated!');
    } catch(err:any){showToast('Error: '+(err.response?.data?.error||err.message),'err');}
    finally{setSub(false);}
  }

  /* ── Delete ───────────────────────────────────────────────── */
  async function handleDelete() {
    setSub(true);
    try {
      await AdminAPI.deleteCourse(delCourse!.course_id);
      const n=delCourse!.name; setDelCourse(null);
      await loadData(); showToast(`"${n}" deactivated.`);
    } catch(err:any){showToast('Error: '+(err.response?.data?.error||err.message),'err');}
    finally{setSub(false);}
  }

  /* ── Row click → detail ───────────────────────────────────── */
  async function openDetail(c: Course, e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.btn-ra')) return;
    setDetailCourse(c); setDetailTab('students'); setDetailData(null); setDetailLoad(true);
    try {
      const res = await AdminAPI.getCourseDetail(c.course_id);
      setDetailData(res.data.data);
    } catch { showToast('Failed to load course details','err'); setDetailCourse(null); }
    finally { setDetailLoad(false); }
  }

  const filtered = courses.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.dept_name?.toLowerCase().includes(search.toLowerCase())
  );

  function ii(courseId: string) { // icon index in filtered
    const i = filtered.findIndex(c=>c.course_id===courseId);
    return i < 0 ? 0 : i;
  }

  if (loading) return (
    <><style>{CSS}</style>
      <div className="cp-load"><div className="spinner"/>Loading courses…</div>
    </>
  );

  return (
    <><style>{CSS}</style>
    <div className="cp-page">
      <div className="cp-blob1"/><div className="cp-blob2"/>
      <div className="cp-inner">

        {/* ── Header ────────────────────────────────────── */}
        <div className="cp-hdr">
          <div>
            <div className="cp-eyebrow">SmartAttend Admin</div>
            <div><span className="cp-title">Courses</span><span className="cp-chip">{courses.length}</span></div>
            <p className="cp-sub">Manage all courses · click any row to view enrolled students &amp; professors</p>
          </div>

          <div className="cp-hdr-right">
            {/* Search */}
            <div className="cp-sw">
              <svg className="cp-si-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="cp-si" placeholder="Search courses…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>

            {/* Import + tooltip */}
            <div className="cp-tt-wrap" ref={ttRef}>
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
                <div className="cp-tt" onClick={e=>e.stopPropagation()}>
                  <div className="cp-tt-head">
                    <p className="cp-tt-title">📋 Bulk Import Format</p>
                    <p className="cp-tt-sub">CSV, JSON, or Excel (.xlsx) — up to 200 rows</p>
                  </div>

                  <div className="cp-tt-tabs">
                    {(['CSV','JSON','Excel'] as const).map(tab=>(
                      <button key={tab} className={`cp-tt-tab${ttTab===tab?' active':''}`}
                        onClick={()=>setTtTab(tab)}>{tab}</button>
                    ))}
                  </div>

                  <div className="cp-tt-body">
                    <div className="cp-tt-ft">Fields</div>
                    {IMPORT_FIELDS.map(f=>(
                      <div key={f.name} className="cp-tt-fr">
                        <span className="cp-tt-fn">{f.name}</span>
                        <span className="cp-tt-ftp">{f.type}</span>
                        <span className="cp-tt-fd">{f.desc}</span>
                        {f.req && <span className="cp-tt-freq">*</span>}
                      </div>
                    ))}

                    <div className="cp-tt-ext">Example ({ttTab})</div>
                    <pre className="cp-tt-code">{IMPORT_EXAMPLES[ttTab]}</pre>

                    <div className="cp-tt-tip">
                      <span style={{flexShrink:0}}>💡</span>
                      <span><strong>dept_id</strong> accepts the dept name, short code, or UUID — the system matches automatically.</span>
                    </div>

                    <button className="cp-tt-cta" onClick={()=>{setShowTT(false);fileRef.current?.click();}}>
                      Choose File to Import
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* New Course */}
            <button className="btn-primary" onClick={()=>setShowCreate(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Course
            </button>
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────── */}
        <div className="cp-card">
          <div className="cp-card-head">
            <div>
              <p className="cp-card-title">All Courses</p>
              <p className="cp-card-sub">{filtered.length} of {courses.length} course{courses.length!==1?'s':''}</p>
            </div>
          </div>

          {filtered.length===0 ? (
            <div className="cp-empty">
              <div className="cp-empty-icon">📚</div>
              <div className="cp-empty-text">{search?'No matching courses':'No courses yet'}</div>
            </div>
          ) : (
            <>
              <table className="cp-tbl">
                <thead>
                  <tr>
                    <th>#</th><th>Course</th><th>Code</th><th>Semester</th>
                    <th>Students</th><th>Professors</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => {
                    const sem = semColors[(c.semester-1)%semColors.length];
                    return (
                      <tr key={c.course_id} style={{animationDelay:`${idx*25}ms`}}
                        onClick={e=>openDetail(c,e)}>

                        <td><span className={`rank-n${idx<3?' top':''}`}>{idx+1}</span></td>

                        <td>
                          <div className="cw">
                            <div className="ci" style={{background:iconBgs[idx%iconBgs.length]}}>
                              {courseIcons[idx%courseIcons.length]}
                            </div>
                            <div>
                              <span className="cn">{c.name}</span>
                              <span className="cd">{c.dept_name}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="code-tag">{c.code}</span>
                          {c.section&&<span className="sec-tag">{c.section}</span>}
                        </td>

                        <td>
                          <span className="sem-pill" style={{background:sem.bg,color:sem.color}}>
                            Sem {c.semester}
                          </span>
                        </td>

                        <td><span className="sv">{c.student_count}</span><span className="sl">enrolled</span></td>
                        <td><span className="sv">{c.professor_count}</span><span className="sl">assigned</span></td>

                        <td>
                          {c.is_active
                            ? <span className="st-on"><span className="sdot sdot-on"/>Active</span>
                            : <span className="st-off"><span className="sdot sdot-off"/>Inactive</span>
                          }
                        </td>

                        <td>
                          <div className="act-cell">
                            <button className="btn-ra btn-ra-edit"
                              onClick={e=>{e.stopPropagation();openEdit(c);}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Edit
                            </button>
                            {c.is_active && (
                              <button className="btn-ra btn-ra-del"
                                onClick={e=>{e.stopPropagation();setDelCourse(c);}}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6"/><path d="M14 11v6"/>
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="cp-hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Click any row to view enrolled students and assigned professors
              </div>
            </>
          )}
        </div>

        {/* ── Create Modal ──────────────────────────────── */}
        {showCreate && (
          <div className="cp-ov" onClick={e=>e.target===e.currentTarget&&setShowCreate(false)}>
            <div className="cp-modal">
              <div className="cp-mt">Create Course</div>
              <div className="cp-ms">Add a new course to the SmartAttend system.</div>
              <form onSubmit={handleCreate}>
                <div className="fg"><label className="fl">Course Name *</label>
                  <input required className="fi" placeholder="e.g. Data Structures & Algorithms"
                    value={cF.name} onChange={e=>setCF({...cF,name:e.target.value})}/>
                </div>
                <div className="f2c">
                  <div className="fg"><label className="fl">Course Code *</label>
                    <input required className="fi" placeholder="e.g. CS301"
                      value={cF.code} onChange={e=>setCF({...cF,code:e.target.value})}/>
                  </div>
                  <div className="fg"><label className="fl">Section</label>
                    <input className="fi" placeholder="e.g. A"
                      value={cF.section} onChange={e=>setCF({...cF,section:e.target.value})}/>
                  </div>
                </div>
                <div className="fg"><label className="fl">Department *</label>
                  <select required className="fi" value={cF.dept_id} onChange={e=>setCF({...cF,dept_id:e.target.value})}>
                    <option value="">Select department…</option>
                    {depts.map(d=><option key={d.dept_id} value={d.dept_id}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Semester *</label>
                  <div className="sem-grid">
                    {[1,2,3,4,5,6,7,8].map(s=>(
                      <button key={s} type="button" className={`sem-btn${cF.semester===s?' active':''}`}
                        onClick={()=>setCF({...cF,semester:s})}>Sem {s}</button>
                    ))}
                  </div>
                </div>
                <div className="fa">
                  <button type="submit" disabled={sub} className="fa-ok">{sub?'Creating…':'Create Course'}</button>
                  <button type="button" className="fa-cancel" onClick={()=>setShowCreate(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Edit Modal ────────────────────────────────── */}
        {editCourse && (
          <div className="cp-ov" onClick={e=>e.target===e.currentTarget&&setEditCourse(null)}>
            <div className="cp-modal">
              <div className="cp-mt">Edit Course</div>
              <div className="cp-ms">Updating <strong>{editCourse.name}</strong></div>
              <form onSubmit={handleEdit}>
                <div className="fg"><label className="fl">Course Name *</label>
                  <input required className="fi" placeholder="Course name"
                    value={eF.name} onChange={e=>setEF({...eF,name:e.target.value})}/>
                </div>
                <div className="f2c">
                  <div className="fg"><label className="fl">Course Code *</label>
                    <input required className="fi" placeholder="e.g. CS301"
                      value={eF.code} onChange={e=>setEF({...eF,code:e.target.value})}/>
                  </div>
                  <div className="fg"><label className="fl">Section</label>
                    <input className="fi" placeholder="e.g. A"
                      value={eF.section} onChange={e=>setEF({...eF,section:e.target.value})}/>
                  </div>
                </div>
                <div className="fg"><label className="fl">Department *</label>
                  <select required className="fi" value={eF.dept_id} onChange={e=>setEF({...eF,dept_id:e.target.value})}>
                    <option value="">Select department…</option>
                    {depts.map(d=><option key={d.dept_id} value={d.dept_id}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Semester *</label>
                  <div className="sem-grid">
                    {[1,2,3,4,5,6,7,8].map(s=>(
                      <button key={s} type="button" className={`sem-btn${eF.semester===s?' active':''}`}
                        onClick={()=>setEF({...eF,semester:s})}>Sem {s}</button>
                    ))}
                  </div>
                </div>
                <div className="fa">
                  <button type="submit" disabled={sub} className="fa-ok">{sub?'Saving…':'Save Changes'}</button>
                  <button type="button" className="fa-cancel" onClick={()=>setEditCourse(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Delete Confirm ─────────────────────────────── */}
        {delCourse && (
          <div className="cp-ov" onClick={e=>e.target===e.currentTarget&&setDelCourse(null)}>
            <div className="cp-modal" style={{maxWidth:400,textAlign:'center'}}>
              <div className="del-icon">🗑️</div>
              <div className="cp-mt" style={{textAlign:'center',fontSize:18}}>Deactivate Course?</div>
              <p className="del-msg">
                <span className="del-name">{delCourse.name}</span> ({delCourse.code}) will be marked inactive.
                Attendance records are preserved. Professors can no longer start sessions for it.
              </p>
              <div className="fa">
                <button disabled={sub} className="fa-red" onClick={handleDelete}>
                  {sub?'Deactivating…':'Deactivate'}
                </button>
                <button className="fa-cancel" onClick={()=>setDelCourse(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Detail Modal ───────────────────────────────── */}
        {detailCourse && (
          <div className="cp-ov" onClick={e=>e.target===e.currentTarget&&setDetailCourse(null)}>
            <div className="cp-modal cp-modal-xl">

              {/* Hero */}
              <div className="det-hero">
                <div className="det-icon" style={{background:iconBgs[ii(detailCourse.course_id)%iconBgs.length]}}>
                  {courseIcons[ii(detailCourse.course_id)%courseIcons.length]}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="det-name">{detailCourse.name}</div>
                  <div className="det-tags">
                    <span className="code-tag">{detailCourse.code}</span>
                    {detailCourse.section&&<span className="sec-tag">{detailCourse.section}</span>}
                    <span className="sem-pill" style={{
                      background:semColors[(detailCourse.semester-1)%semColors.length].bg,
                      color:semColors[(detailCourse.semester-1)%semColors.length].color}}>
                      Sem {detailCourse.semester}
                    </span>
                    <span style={{fontSize:11,color:D.textMuted}}>· {detailCourse.dept_name}</span>
                  </div>
                </div>
                <button className="det-close" onClick={()=>setDetailCourse(null)}>✕</button>
              </div>

              {/* Stats (only once loaded) */}
              {detailData && (
                <div className="det-stats">
                  <div className="det-sbox">
                    <span className="det-snum">{detailData.students.length}</span>
                    <span className="det-slbl">Students Enrolled</span>
                  </div>
                  <div className="det-sbox">
                    <span className="det-snum">{detailData.professors.length}</span>
                    <span className="det-slbl">Professors Assigned</span>
                  </div>
                  <div className="det-sbox">
                    <span className="det-snum">{detailData.students.filter(s=>s.face_enrolled_at).length}</span>
                    <span className="det-slbl">Face Enrolled</span>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="det-tabs">
                <button className={`det-tab${detailTab==='students'?' active':''}`}
                  onClick={()=>setDetailTab('students')}>
                  👨‍🎓 Students {detailData?`(${detailData.students.length})`:''}
                </button>
                <button className={`det-tab${detailTab==='professors'?' active':''}`}
                  onClick={()=>setDetailTab('professors')}>
                  👨‍🏫 Professors {detailData?`(${detailData.professors.length})`:''}
                </button>
              </div>

              {/* Body */}
              {detailLoad ? (
                <div className="det-loading"><div className="spinner"/>Loading details…</div>
              ) : !detailData ? null
              : detailTab==='students' ? (
                detailData.students.length===0 ? (
                  <div className="det-empty">
                    <span className="det-empty-icon">🎓</span>
                    No students enrolled yet. Professors add students via the professor app.
                  </div>
                ) : (
                  <div className="det-list">
                    {detailData.students.map((s,i)=>(
                      <div key={s.student_id} className="det-item">
                        <div className="det-av" style={{background:avatarGrads[i%avatarGrads.length]}}>
                          {initials(s.name)}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <span className="det-iname">{s.name}</span>
                          <span className="det-isub">
                            <span className="code-tag" style={{fontSize:10,padding:'2px 6px'}}>{s.roll_number}</span>
                            {' · Sem '}{s.semester}
                            {s.email&&<>{' · '}<span style={{color:D.textMuted}}>{s.email}</span></>}
                          </span>
                        </div>
                        <span className={`det-badge ${s.face_enrolled_at?'det-badge-g':'det-badge-grey'}`}>
                          {s.face_enrolled_at?'✓ Face':'No Face'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                detailData.professors.length===0 ? (
                  <div className="det-empty">
                    <span className="det-empty-icon">👨‍🏫</span>
                    No professors assigned to this course yet.
                  </div>
                ) : (
                  <div className="det-list">
                    {detailData.professors.map((p,i)=>(
                      <div key={p.professor_id} className="det-item">
                        <div className="det-av" style={{background:'linear-gradient(135deg,#7C3AED,#A78BFA)'}}>
                          {initials(p.name)}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <span className="det-iname">{p.name}</span>
                          <span className="det-isub">
                            <span className="code-tag" style={{fontSize:10,padding:'2px 6px'}}>{p.employee_code}</span>
                            {p.email&&<>{' · '}<span style={{color:D.textMuted}}>{p.email}</span></>}
                          </span>
                        </div>
                        <span className="det-badge det-badge-p">Professor</span>
                      </div>
                    ))}
                  </div>
                )
              )}

              <div style={{marginTop:20,textAlign:'right'}}>
                <button className="fa-cancel" style={{maxWidth:120,display:'inline-block'}}
                  onClick={()=>setDetailCourse(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>

    {toast && <div className={`cp-toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}