export const D = {
  bg: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  purpleMid: '#A78BFA',
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

export const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

.sa-page {
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
.sa-blob1 {
  position: fixed; top: -140px; right: -180px;
  width: 500px; height: 500px; border-radius: 50%;
  background: radial-gradient(circle, rgba(124,58,237,.10) 0%, transparent 70%);
  pointer-events: none; z-index: 0;
}
.sa-blob2 {
  position: fixed; bottom: -80px; left: -100px;
  width: 380px; height: 380px; border-radius: 50%;
  background: radial-gradient(circle, rgba(16,185,129,.07) 0%, transparent 70%);
  pointer-events: none; z-index: 0;
}
.sa-inner { position: relative; z-index: 1; max-width: 1200px; }

.sa-eyebrow { font-size:11px; font-weight:500; letter-spacing:.18em; text-transform:uppercase; color:${D.textMuted}; margin-bottom:5px; }
.sa-title { font-family:'Syne',sans-serif; font-size:24px; font-weight:700; color:${D.textPrimary}; letter-spacing:-.5px; margin:0; }
.sa-chip { display:inline-flex; align-items:center; background:${D.textPrimary}; color:#f9fafb; font-family:'Syne',sans-serif; font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; margin-left:10px; vertical-align:middle; position:relative; top:-3px; }
.sa-subtitle { margin:4px 0 0; font-size:13px; color:${D.textMuted}; }

.sa-header { display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:28px; }
.sa-actions { display:flex; gap:8px; align-items:center; }

.sa-card { background:${D.surface}; border:1px solid ${D.border}; border-radius:${D.radius}px; box-shadow:${D.shadow}; overflow:hidden; }
.sa-card-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px 16px; border-bottom:1px solid ${D.borderLight}; }
.sa-card-title { font-family:'Syne',sans-serif; font-size:15px; font-weight:600; color:${D.textPrimary}; margin:0; }
.sa-card-sub { font-size:12px; color:${D.textMuted}; margin:3px 0 0; }

.sa-table { width:100%; border-collapse:collapse; }
.sa-table thead tr { background:${D.borderLight}; border-bottom:1px solid ${D.border}; }
.sa-table th { padding:10px 16px; font-size:11px; font-weight:600; letter-spacing:.10em; text-transform:uppercase; color:${D.textMuted}; text-align:left; font-family:'DM Sans',sans-serif; white-space:nowrap; }
.sa-table th:first-child { padding-left:24px; }
.sa-table th:last-child { padding-right:24px; }
.sa-table tbody tr { border-bottom:1px solid ${D.borderLight}; transition:background .12s ease; animation:rowIn .3s ease both; }
.sa-table tbody tr:last-child { border-bottom:none; }
.sa-table tbody tr:hover { background:#FAFAFA; }
@keyframes rowIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
.sa-table td { padding:12px 16px; vertical-align:middle; font-size:13px; color:${D.textSecondary}; }
.sa-table td:first-child { padding-left:24px; }
.sa-table td:last-child { padding-right:24px; }

.sa-name-cell { display:flex; align-items:center; gap:10px; }
.sa-avatar { width:36px; height:36px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:'Syne',sans-serif; font-weight:800; font-size:12px; color:#fff; box-shadow:0 2px 8px rgba(0,0,0,.15); }
.sa-name { font-family:'Syne',sans-serif; font-size:14px; font-weight:700; color:${D.textPrimary}; display:block; }
.sa-name-sub { font-size:11px; color:${D.textMuted}; display:block; margin-top:1px; }

.code-tag { background:${D.borderLight}; color:${D.textSecondary}; font-family:'Courier New',monospace; font-size:11px; font-weight:600; padding:3px 8px; border-radius:5px; letter-spacing:.04em; border:1px solid ${D.border}; }

.badge-green { display:inline-flex; align-items:center; gap:5px; background:${D.greenLight}; color:#065f46; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; }
.badge-amber { display:inline-flex; align-items:center; gap:5px; background:${D.amberLight}; color:#92400e; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; }
.badge-red   { display:inline-flex; align-items:center; gap:5px; background:${D.redLight}; color:#991b1b; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; }
.badge-purple{ display:inline-flex; align-items:center; gap:5px; background:${D.purpleLight}; color:#5b21b6; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; }
.badge-blue  { display:inline-flex; align-items:center; gap:5px; background:${D.blueLight}; color:#1e40af; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; }
.badge-muted { display:inline-flex; align-items:center; gap:5px; background:${D.borderLight}; color:${D.textSecondary}; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; }
.status-dot  { width:6px; height:6px; border-radius:50%; display:inline-block; }
.dot-green { background:${D.green}; box-shadow:0 0 0 2px ${D.green}30; }
.dot-amber { background:${D.amber}; }
.dot-red   { background:${D.red}; }
.dot-muted { background:${D.textMuted}; }

.btn-primary { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; background:${D.textPrimary}; color:#fff; border:none; border-radius:${D.radiusSm}px; font-family:'Syne',sans-serif; font-size:13px; font-weight:700; cursor:pointer; transition:all .18s ease; letter-spacing:.02em; box-shadow:0 4px 14px rgba(17,24,39,.2); }
.btn-primary:hover { background:#1f2937; transform:translateY(-1px); box-shadow:0 6px 20px rgba(17,24,39,.28); }
.btn-primary:disabled { opacity:.55; cursor:not-allowed; transform:none; }
.btn-ghost { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; background:${D.surface}; color:${D.textSecondary}; border:1.5px solid ${D.border}; border-radius:${D.radiusSm}px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:all .15s ease; }
.btn-ghost:hover { border-color:${D.textPrimary}; color:${D.textPrimary}; }
.btn-ghost:disabled { opacity:.55; cursor:not-allowed; }
.btn-success { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; background:${D.greenLight}; color:#065f46; border:1px solid ${D.green}30; border-radius:${D.radiusSm}px; font-family:'Syne',sans-serif; font-size:12px; font-weight:700; cursor:pointer; transition:all .14s ease; }
.btn-success:hover { background:${D.green}; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px ${D.green}40; }
.btn-success:disabled { opacity:.55; cursor:not-allowed; transform:none; }
.btn-danger { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; background:${D.redLight}; color:#991b1b; border:1px solid ${D.red}30; border-radius:${D.radiusSm}px; font-family:'Syne',sans-serif; font-size:12px; font-weight:700; cursor:pointer; transition:all .14s ease; }
.btn-danger:hover { background:${D.red}; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px ${D.red}40; }
.btn-danger:disabled { opacity:.55; cursor:not-allowed; transform:none; }

.sa-search-wrap { position:relative; }
.sa-search { padding:9px 12px 9px 36px; background:${D.surface}; border:1.5px solid ${D.border}; border-radius:${D.radiusSm}px; font-family:'DM Sans',sans-serif; font-size:13px; color:${D.textPrimary}; outline:none; transition:all .15s ease; width:220px; box-sizing:border-box; }
.sa-search:focus { border-color:${D.purple}; box-shadow:0 0 0 3px ${D.purpleLight}; width:260px; }
.sa-search::placeholder { color:${D.textMuted}; }
.sa-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:${D.textMuted}; pointer-events:none; }

.sa-modal-overlay { position:fixed; inset:0; background:rgba(17,24,39,.45); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:50; animation:fadeIn .15s ease; }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes slideUp { from{opacity:0;transform:translateY(20px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
.sa-modal-box { background:${D.surface}; border-radius:20px; padding:28px; width:100%; max-width:460px; box-shadow:${D.shadowLg}; animation:slideUp .2s ease; max-height:90vh; overflow-y:auto; border:1px solid ${D.border}; }
.sa-modal-box-lg { max-width:520px; }
.sa-modal-title { font-family:'Syne',sans-serif; font-size:20px; font-weight:800; color:${D.textPrimary}; margin:0 0 4px; letter-spacing:-.02em; }
.sa-modal-sub { font-size:13px; color:${D.textMuted}; margin:0 0 20px; line-height:1.5; }

.sa-form-group { margin-bottom:14px; }
.sa-form-label { display:block; font-size:11px; font-weight:500; letter-spacing:.10em; text-transform:uppercase; color:${D.textMuted}; margin-bottom:5px; }
.sa-form-input { width:100%; padding:10px 12px; background:${D.borderLight}; border:1.5px solid ${D.border}; border-radius:10px; font-family:'DM Sans',sans-serif; font-size:14px; color:${D.textPrimary}; transition:all .15s ease; box-sizing:border-box; outline:none; }
.sa-form-input:focus { border-color:${D.purple}; background:#fff; box-shadow:0 0 0 3px ${D.purpleLight}; }
.sa-form-input::placeholder { color:${D.textMuted}; }
.sa-form-textarea { width:100%; padding:10px 12px; min-height:110px; background:${D.borderLight}; border:1.5px solid ${D.border}; border-radius:10px; font-family:'DM Sans',sans-serif; font-size:14px; color:${D.textPrimary}; resize:vertical; transition:all .15s ease; box-sizing:border-box; outline:none; line-height:1.6; }
.sa-form-textarea:focus { border-color:${D.purple}; background:#fff; box-shadow:0 0 0 3px ${D.purpleLight}; }
.sa-form-hint { display:flex; align-items:flex-start; gap:8px; background:${D.blueLight}; border:1px solid ${D.blue}30; border-radius:10px; padding:10px 14px; font-size:12px; color:#1D4ED8; line-height:1.5; margin:10px 0; }
.sa-form-actions { display:flex; gap:10px; margin-top:18px; }
.sa-btn-submit { flex:1; padding:11px; background:${D.textPrimary}; color:#fff; border:none; border-radius:10px; font-family:'Syne',sans-serif; font-size:13px; font-weight:700; cursor:pointer; transition:all .15s ease; letter-spacing:.02em; }
.sa-btn-submit:hover:not(:disabled) { background:#1f2937; box-shadow:0 4px 14px rgba(0,0,0,.2); }
.sa-btn-submit:disabled { opacity:.55; cursor:not-allowed; }
.sa-btn-cancel { flex:1; padding:11px; background:${D.borderLight}; color:${D.textSecondary}; border:none; border-radius:10px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:all .15s ease; }
.sa-btn-cancel:hover { background:${D.border}; }

.sem-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-top:6px; }
.sem-btn { padding:7px 4px; border:1.5px solid ${D.border}; border-radius:8px; background:${D.borderLight}; font-family:'Syne',sans-serif; font-size:11px; font-weight:700; color:${D.textMuted}; cursor:pointer; transition:all .12s ease; text-align:center; }
.sem-btn:hover { border-color:${D.purple}; color:${D.purple}; }
.sem-btn.active { border-color:${D.purple}; background:${D.purpleLight}; color:${D.purple}; box-shadow:0 0 0 2px ${D.purple}20; }

.result-ok { background:${D.greenLight}; border:1px solid #a7f3d0; border-radius:10px; padding:12px 16px; font-family:'Syne',sans-serif; font-weight:700; font-size:15px; color:#065f46; margin-bottom:14px; }
.skip-label { font-size:11px; font-weight:700; color:${D.red}; margin-bottom:6px; display:block; letter-spacing:.06em; text-transform:uppercase; }
.skip-list { max-height:180px; overflow-y:auto; border:1px solid ${D.redLight}; border-radius:10px; background:#fff; margin-bottom:10px; }
.skip-item { padding:8px 12px; border-bottom:1px solid ${D.redLight}; font-size:12px; color:${D.textSecondary}; }
.skip-item:last-child { border-bottom:none; }
.skip-code { font-family:monospace; font-weight:700; color:${D.red}; }

.sa-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:64px 24px; color:${D.textMuted}; }
.sa-empty-icon { font-size:40px; margin-bottom:12px; opacity:.4; }
.sa-empty-text { font-family:'Syne',sans-serif; font-size:15px; font-weight:600; color:${D.border}; }

.sa-loading { display:flex; align-items:center; justify-content:center; min-height:60vh; gap:10px; color:${D.textMuted}; font-family:'Syne',sans-serif; font-weight:600; font-size:14px; }
.spinner { width:20px; height:20px; border:2.5px solid ${D.border}; border-top-color:${D.purple}; border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin { to{transform:rotate(360deg)} }

.sa-pg { display:flex; align-items:center; justify-content:space-between; padding:14px 24px; border-top:1px solid ${D.borderLight}; }
.sa-pg-info { font-size:12px; color:${D.textMuted}; font-variant-numeric:tabular-nums; }
.sa-pg-btns { display:flex; gap:4px; }
.sa-pg-btn { display:inline-flex; align-items:center; gap:4px; padding:6px 12px; background:${D.surface}; border:1.5px solid ${D.border}; border-radius:8px; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:600; color:${D.textSecondary}; cursor:pointer; transition:all .14s ease; }
.sa-pg-btn:hover:not(:disabled) { border-color:${D.purple}; color:${D.purple}; }
.sa-pg-btn:disabled { opacity:.4; cursor:not-allowed; }

.filter-tabs { display:flex; gap:6px; margin-bottom:20px; }
.filter-tab { padding:7px 18px; border-radius:${D.radiusSm}px; border:1.5px solid ${D.border}; font-family:'Syne',sans-serif; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s ease; background:${D.surface}; color:${D.textSecondary}; }
.filter-tab:hover { border-color:${D.purple}; color:${D.purple}; }
.filter-tab.active { background:${D.textPrimary}; color:#fff; border-color:${D.textPrimary}; }
`;