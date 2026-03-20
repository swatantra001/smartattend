

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProfAPI } from '../services/api';
import { Button, Badge, Pill, Spinner, EmptyState, StatCard, notify } from '../components/ui';
import type { Course, Assignment, Submission, Cluster } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function isPast(iso: string) { return new Date(iso) < new Date(); }
function pct(n: number) { return ((n || 0) * 100).toFixed(1) + '%'; }

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

/* ── Breadcrumb ── */
.ap-breadcrumb {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: #9ca3af;
  margin-bottom: 20px; flex-wrap: wrap;
}
.ap-breadcrumb-sep { color: rgba(139,92,246,.3); }
.ap-breadcrumb-link {
  color: #8b5cf6; cursor: pointer; transition: opacity .14s;
  background: none; border: none; font-size: 12px; font-weight: 600;
  font-family: 'DM Sans',sans-serif; padding: 0;
}
.ap-breadcrumb-link:hover { opacity: .65; }
.ap-breadcrumb-current { color: #2e1065; }

/* ── Section heading ── */
.ap-section-title {
  font-family: 'Syne',sans-serif; font-size: 20px; font-weight: 800;
  color: #2e1065; letter-spacing: -.3px;
}
.ap-section-sub { font-size: 13px; color: #9ca3af; margin-top: 3px; }

/* ── Course grid ── */
.ap-course-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(272px, 1fr));
  gap: 14px; margin-top: 20px;
}
.ap-course-card {
  background: rgba(255,255,255,.82); backdrop-filter: blur(16px);
  border: 1px solid rgba(139,92,246,.16); border-radius: 18px;
  padding: 20px; cursor: pointer; transition: all .18s;
  box-shadow: 0 2px 12px rgba(139,92,246,.07);
  position: relative; overflow: hidden;
}
.ap-course-card:hover {
  border-color: rgba(139,92,246,.35);
  box-shadow: 0 6px 24px rgba(139,92,246,.14);
  transform: translateY(-2px);
}
.ap-course-card-accent {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 4px; background: linear-gradient(180deg, #8b5cf6, #ec4899);
}
.ap-course-code {
  font-size: 10.5px; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: #8b5cf6; margin-bottom: 7px;
}
.ap-course-name {
  font-family: 'Syne',sans-serif; font-size: 15px; font-weight: 800;
  color: #2e1065; margin-bottom: 4px; letter-spacing: -.2px;
}
.ap-course-dept { font-size: 12px; color: #9ca3af; margin-bottom: 12px; }
.ap-course-arrow {
  font-size: 18px; color: rgba(139,92,246,.35);
  position: absolute; right: 18px; top: 50%; transform: translateY(-50%);
}

/* ── Assignment list ── */
.ap-assign-card {
  background: rgba(255,255,255,.82); backdrop-filter: blur(16px);
  border: 1.5px solid rgba(139,92,246,.14);
  border-left: 4px solid #8b5cf6;
  border-radius: 16px; padding: 18px 20px;
  display: flex; align-items: flex-start; gap: 14px;
  transition: all .18s; margin-bottom: 10px;
  box-shadow: 0 2px 10px rgba(139,92,246,.06);
}
.ap-assign-card:hover {
  box-shadow: 0 6px 20px rgba(139,92,246,.12);
  transform: translateY(-1px);
}
.ap-assign-card.past { border-left-color: #f59e0b; }
.ap-assign-icon {
  width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
  background: rgba(139,92,246,.1); border: 1px solid rgba(139,92,246,.2);
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.ap-assign-title {
  font-family: 'Syne',sans-serif; font-weight: 800; font-size: 14.5px;
  color: #2e1065; margin-bottom: 4px; letter-spacing: -.1px;
}
.ap-assign-desc { font-size: 12px; color: #6b7280; margin-bottom: 6px; }
.ap-assign-deadline { font-size: 12px; font-weight: 600; }
.ap-assign-deadline.past { color: #f59e0b; }
.ap-assign-deadline.live { color: #ef4444; }

/* ── Submission row ── */
.ap-sub-row {
  background: rgba(255,255,255,.7); backdrop-filter: blur(8px);
  border: 1px solid rgba(139,92,246,.12); border-radius: 12px;
  padding: 12px 16px; display: flex; align-items: center; gap: 12px;
  margin-bottom: 8px; transition: all .14s;
}
.ap-sub-row:hover { border-color: rgba(139,92,246,.25); }
.ap-sub-row.flagged { border-color: rgba(239,68,68,.3); background: rgba(254,242,242,.6); }
.ap-sub-avatar {
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Syne',sans-serif; font-size: 15px; font-weight: 800; color: #fff;
}
.ap-file-chip {
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(139,92,246,.08); border: 1px solid rgba(139,92,246,.2);
  border-radius: 8px; padding: 5px 10px; font-size: 11.5px; font-weight: 600;
  color: #6d28d9; cursor: pointer; transition: all .13s; margin: 3px 4px 3px 0;
  text-decoration: none; max-width: 200px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;
}
.ap-file-chip:hover { background: rgba(139,92,246,.15); }

/* ── AI progress ── */
.ap-progress-bar-bg {
  height: 8px; background: rgba(139,92,246,.15);
  border-radius: 99px; overflow: hidden;
}
.ap-progress-bar-fill {
  height: 100%; border-radius: 99px;
  background: linear-gradient(90deg, #8b5cf6, #ec4899);
  transition: width .5s ease;
}

/* ── Cluster card ── */
.ap-cluster-card {
  background: rgba(255,255,255,.82); backdrop-filter: blur(12px);
  border: 1px solid rgba(139,92,246,.18); border-left: 5px solid #8b5cf6;
  border-radius: 16px; padding: 20px; margin-bottom: 14px;
  box-shadow: 0 4px 16px rgba(139,92,246,.08);
}
.ap-cluster-stat {
  border-radius: 10px; padding: 10px 14px; flex: 1;
}

/* ── Clean submission card ── */
.ap-clean-card {
  display: flex; align-items: center; gap: 12px;
  background: rgba(240,253,244,.7); border: 1px solid rgba(34,197,94,.2);
  border-radius: 12px; padding: 12px 16px; margin-bottom: 8px;
}

/* ── Course eval card ── */
.ap-ceval-card {
  background: rgba(255,255,255,.82); backdrop-filter: blur(12px);
  border: 1px solid rgba(139,92,246,.15); border-radius: 16px;
  padding: 18px 20px; margin-bottom: 12px;
  box-shadow: 0 2px 12px rgba(139,92,246,.07);
  cursor: pointer; transition: all .16s;
}
.ap-ceval-card:hover {
  border-color: rgba(139,92,246,.3);
  box-shadow: 0 6px 20px rgba(139,92,246,.12);
  transform: translateY(-1px);
}

/* ── Modal ── */
.ap-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(46,16,101,.55); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px; animation: apFadeIn .15s ease;
}
@keyframes apFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes apSlideUp {
  from { opacity: 0; transform: translateY(14px) scale(.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.ap-modal {
  background: rgba(255,255,255,.96); backdrop-filter: blur(20px);
  border: 1px solid rgba(139,92,246,.18); border-radius: 20px;
  width: 100%; max-height: 90vh; overflow: auto;
  box-shadow: 0 24px 64px rgba(46,16,101,.25);
  animation: apSlideUp .2s ease;
}
.ap-modal-header {
  padding: 18px 22px; border-bottom: 1px solid rgba(139,92,246,.12);
  display: flex; align-items: center;
  background: linear-gradient(135deg, rgba(139,92,246,.06), rgba(236,72,153,.04));
  position: sticky; top: 0; z-index: 1;
  backdrop-filter: blur(16px);
}
.ap-modal-close {
  background: rgba(139,92,246,.08); border: 1px solid rgba(139,92,246,.18);
  color: #8b5cf6; font-size: 14px; padding: 5px 9px;
  cursor: pointer; border-radius: 8px; line-height: 1;
}
.ap-modal-footer {
  padding: 16px 22px; border-top: 1px solid rgba(139,92,246,.10);
  display: flex; justify-content: flex-end; gap: 8px;
  background: rgba(255,255,255,.92);
  position: sticky; bottom: 0; backdrop-filter: blur(16px);
}

/* ── Form inputs inside modal ── */
.ap-input {
  width: 100%; padding: 10px 13px;
  background: rgba(139,92,246,.05); border: 1.5px solid rgba(139,92,246,.18);
  border-radius: 10px; color: #2e1065; font-size: 13.5px;
  transition: all .15s; outline: none; font-family: 'DM Sans',sans-serif;
}
.ap-input:focus {
  border-color: #8b5cf6; background: #fff;
  box-shadow: 0 0 0 3px rgba(139,92,246,.12);
}
.ap-label {
  display: block; font-size: 10.5px; font-weight: 700;
  color: #8b5cf6; letter-spacing: .10em; text-transform: uppercase; margin-bottom: 5px;
}
.ap-form-group { margin-bottom: 15px; }

/* ── File drop zone ── */
.ap-drop-zone {
  border: 1.5px dashed rgba(139,92,246,.35); border-radius: 12px;
  padding: 18px; text-align: center; cursor: pointer;
  background: rgba(139,92,246,.04); transition: all .15s;
  font-size: 13px; color: #8b5cf6; font-weight: 600;
}
.ap-drop-zone:hover { background: rgba(139,92,246,.08); border-color: rgba(139,92,246,.5); }

/* ── Animations ── */
@keyframes apPulse {
  0%,100% { box-shadow: 0 0 0 3px rgba(239,68,68,.2); }
  50%      { box-shadow: 0 0 0 7px rgba(239,68,68,.06); }
}
`;

// ─── types (local extensions) ─────────────────────────────────────────────────
type View = 'courses' | 'assignments' | 'detail' | 'report' | 'courseReport';
interface FileItem { name: string; file?: File; url?: string; isExisting?: boolean; }

// ─── sub-components ───────────────────────────────────────────────────────────

// Breadcrumb
function Breadcrumb({
  steps, onNavigate,
}: { steps: { label: string; view: View | null }[]; onNavigate: (v: View | null) => void }) {
  return (
    <div className="ap-breadcrumb">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="ap-breadcrumb-sep">›</span>}
          {i < steps.length - 1 && s.view ? (
            <button className="ap-breadcrumb-link" onClick={() => onNavigate(s.view)}>
              {s.label}
            </button>
          ) : (
            <span className={i < steps.length - 1 ? '' : 'ap-breadcrumb-current'}>{s.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Create / Edit Assignment Modal ──────────────────────────────────────────
function AssignmentFormModal({
  courseId, existing, onClose, onSaved,
}: {
  courseId: string;
  existing?: Assignment & { professor_files?: string[] };
  onClose: () => void;
  onSaved: (a: Assignment) => void;
}) {
  const isEdit = !!existing;
  const [title, setTitle]       = useState(existing?.title || '');
  const [desc, setDesc]         = useState(existing?.description || '');
  const [deadline, setDeadline] = useState(
    existing?.deadline
      ? new Date(existing.deadline).toISOString().slice(0, 16)
      : ''
  );
  // files management
  const [keepFiles, setKeepFiles] = useState<string[]>(existing?.professor_files || []);
  const [newFiles, setNewFiles]   = useState<File[]>([]);
  const [saving, setSaving]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function getFileName(url: string) {
    try {
      const raw = decodeURIComponent(url).split('/').pop() || url;
      return raw.includes('_') ? raw.split('_').slice(1).join('_') : raw;
    } catch { return url; }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !deadline) { notify('Title and deadline required', 'error'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', desc);
      fd.append('deadline', new Date(deadline).toISOString());
      if (isEdit) fd.append('existing_files', JSON.stringify(keepFiles));
      newFiles.forEach(f => fd.append('files', f));

      const r = isEdit
        ? await ProfAPI.updateAssignment(existing!.id, fd)
        : await ProfAPI.createAssignment(courseId, fd);
      onSaved(r.data.data);
      notify(isEdit ? 'Assignment updated' : 'Assignment created');
      onClose();
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="ap-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ap-modal" style={{ maxWidth: 520 }}>
        <div className="ap-modal-header">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 3 }}>
              {isEdit ? 'Edit Assignment' : 'New Assignment'}
            </div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, color: '#2e1065' }}>
              {isEdit ? 'Update Assignment' : 'Create New Assignment'}
            </div>
          </div>
          <button className="ap-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: 22 }}>
            <div className="ap-form-group">
              <label className="ap-label">Title *</label>
              <input required className="ap-input" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Lab 1: Sorting Algorithms"/>
            </div>
            <div className="ap-form-group">
              <label className="ap-label">Description & Instructions</label>
              <textarea className="ap-input" rows={3} value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Write instructions for students…"
                style={{ resize: 'vertical', minHeight: 80 }}/>
            </div>
            <div className="ap-form-group">
              <label className="ap-label">Deadline *</label>
              <input required type="datetime-local" className="ap-input" value={deadline}
                onChange={e => setDeadline(e.target.value)}/>
            </div>

            {/* Existing files (edit mode) */}
            {isEdit && keepFiles.length > 0 && (
              <div className="ap-form-group">
                <label className="ap-label">Attached Files (keep / remove)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {keepFiles.map((url, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'rgba(139,92,246,.07)', border: '1px solid rgba(139,92,246,.2)',
                      borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#6d28d9',
                    }}>
                      <span>📄 {getFileName(url)}</span>
                      <button type="button" onClick={() => setKeepFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New files */}
            <div className="ap-form-group">
              <label className="ap-label">
                {isEdit ? 'Add More Files' : 'Attach Reference Files (optional)'}
              </label>
              <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files) setNewFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }}/>
              <div className="ap-drop-zone" onClick={() => fileRef.current?.click()}>
                📎 Click to select files (PDF, DOCX, etc.)
              </div>
              {newFiles.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {newFiles.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)',
                      borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#15803d',
                    }}>
                      <span>➕ {f.name}</span>
                      <button type="button" onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ap-modal-footer">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>
              {isEdit ? '💾 Save Changes' : 'Create Assignment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Flag Cluster Modal ───────────────────────────────────────────────────────
function FlagModal({
  clusterId, onClose, onFlagged,
}: { clusterId: string; onClose: () => void; onFlagged: () => void }) {
  const [reason, setReason] = useState('Highly similar submissions detected by AI Clustering.');
  const [flagging, setFlagging] = useState(false);

  async function handleFlag() {
    setFlagging(true);
    try {
      await ProfAPI.flagCluster(clusterId, reason);
      notify('Students flagged and notified');
      onFlagged();
      onClose();
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to flag', 'error');
    } finally { setFlagging(false); }
  }

  return (
    <div className="ap-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ap-modal" style={{ maxWidth: 440 }}>
        <div className="ap-modal-header">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 3 }}>
              Academic Integrity
            </div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, color: '#2e1065' }}>
              Flag Violation
            </div>
          </div>
          <button className="ap-modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{
            background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
            borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#991b1b',
          }}>
            ⚠️ This will send a push notification to all students in this cluster informing them of the flag.
          </div>
          <div className="ap-form-group">
            <label className="ap-label">Flag Reason</label>
            <textarea className="ap-input" rows={3} value={reason} onChange={e => setReason(e.target.value)}
              style={{ resize: 'vertical' }}/>
          </div>
        </div>
        <div className="ap-modal-footer">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={flagging} onClick={handleFlag}>
            ⚠️ Flag Students
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Evaluation Report View ───────────────────────────────────────────────────
function EvalReportView({
  assignment, onBack,
}: { assignment: Assignment; onBack: () => void }) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [flagTarget, setFlagTarget] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ProfAPI.getEvaluationReport(assignment.id)
      .then(r => setData(r.data))
      .catch(() => notify('Failed to load report', 'error'))
      .finally(() => setLoading(false));
  }, [assignment.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32}/></div>;

  const clusters: any[]         = data?.clusters || [];
  const clean: any[]            = data?.clean_submissions || [];
  const stats                   = data?.stats || {};

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
        <StatCard label="Total Evaluated" value={stats.total_submissions ?? '—'}/>
        <StatCard label="Flagged" value={stats.flagged_count ?? 0} color="#ef4444"/>
        <StatCard label="Clean" value={clean.length} color="#10b981"/>
      </div>

      {/* Clusters */}
      <div style={{
        fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16,
        color: '#2e1065', marginBottom: 14,
      }}>
        Detected Clusters ({clusters.length})
      </div>

      {clusters.length === 0 ? (
        <div style={{
          background: 'rgba(240,253,244,.7)', border: '1px solid rgba(34,197,94,.2)',
          borderRadius: 12, padding: '14px 18px', fontSize: 13, color: '#065f46',
          fontWeight: 600, marginBottom: 20,
        }}>
          ✅ No plagiarism detected — all submissions appear independent.
        </div>
      ) : (
        clusters.map((c: any) => (
          <div key={c.cluster_id} className="ap-cluster-card">
            {/* Probability stats */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div className="ap-cluster-stat" style={{ background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.18)' }}>
                <div style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Match Probability</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: '#6d28d9' }}>{pct(c.match_probability)}</div>
              </div>
              <div className="ap-cluster-stat" style={{ background: 'rgba(14,165,233,.07)', border: '1px solid rgba(14,165,233,.18)' }}>
                <div style={{ fontSize: 10, color: '#0ea5e9', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>AI Written</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: '#0284c7' }}>{pct(c.ai_written_probability)}</div>
              </div>
            </div>

            {/* Bar chart visual */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 5 }}>Similarity Intensity</div>
              <div className="ap-progress-bar-bg">
                <div className="ap-progress-bar-fill" style={{ width: `${Math.min((c.match_probability || 0) * 100, 100)}%` }}/>
              </div>
            </div>

            {/* Leader */}
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>
              Primary Source (Leader)
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(139,92,246,.07)', borderRadius: 8,
              padding: '8px 12px', marginBottom: 10,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: "'Syne',sans-serif",
              }}>{c.leader_name?.charAt(0) || '?'}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#2e1065' }}>{c.leader_name}</div>
                <div style={{ fontSize: 11, color: '#8b5cf6' }}>{c.leader_roll}</div>
              </div>
            </div>

            {/* Copiers */}
            {c.copiers?.length > 0 && (
              <>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>
                  Similar Submissions ({c.copiers.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                  {c.copiers.map((cp: any, i: number) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'rgba(239,68,68,.06)', borderRadius: 8, padding: '7px 12px',
                    }}>
                      <span style={{ fontSize: 13 }}>⚠️</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#2e1065' }}>{cp.name}</div>
                        <div style={{ fontSize: 11, color: '#ef4444' }}>{cp.roll_no}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Flag button */}
            <button
              onClick={() => setFlagTarget(c.cluster_id)}
              style={{
                width: '100%', padding: '10px', borderRadius: 10,
                background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.22)',
                color: '#dc2626', fontFamily: "'DM Sans',sans-serif", fontWeight: 700,
                fontSize: 13, cursor: 'pointer', transition: 'all .14s',
              }}>
              ⚠️ Flag This Cluster
            </button>
          </div>
        ))
      )}

      {/* Clean submissions */}
      {clean.length > 0 && (
        <>
          <div style={{ height: 1, background: 'rgba(139,92,246,.12)', margin: '20px 0' }}/>
          <div style={{
            fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16,
            color: '#2e1065', marginBottom: 14,
          }}>
            Independent Submissions ({clean.length})
          </div>
          {clean.map((s: any) => (
            <div key={s.id} className="ap-clean-card">
              <span style={{ fontSize: 22, flexShrink: 0 }}>✅</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#065f46' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#047857' }}>{s.roll_no}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: '#047857', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>AI Written</div>
                <div style={{
                  fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16,
                  color: (s.ai_score || 0) > 0.7 ? '#ef4444' : '#10b981',
                }}>{pct(s.ai_score)}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {flagTarget && (
        <FlagModal clusterId={flagTarget} onClose={() => setFlagTarget(null)} onFlagged={load}/>
      )}
    </div>
  );
}

// ─── Assignment Detail View ───────────────────────────────────────────────────
function AssignmentDetailView({
  assignment: initAssignment, onBack, onViewReport,
}: {
  assignment: Assignment & { professor_files?: string[] };
  onBack: () => void;
  onViewReport: () => void;
}) {
  const [assignment, setAssignment] = useState(initAssignment);
  const [data, setData]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [editModal, setEditModal] = useState(false);
  const progressRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(() => {
    setLoading(true);
    ProfAPI.getAssignmentDetails(assignment.id)
      .then(r => setData(r.data))
      .catch(() => notify('Failed to load', 'error'))
      .finally(() => setLoading(false));
  }, [assignment.id]);

  useEffect(() => { load(); }, [load]);

  // Polling
  useEffect(() => {
    if (!evaluating) return;
    const interval = setInterval(async () => {
      try {
        const r = await ProfAPI.getEvaluationProgress(assignment.id);
        setProgress(r.data.progress || 0);
      } catch { /* silent */ }
    }, 1500);
    return () => clearInterval(interval);
  }, [evaluating, assignment.id]);

  useEffect(() => () => { if (progressRef.current) clearInterval(progressRef.current); }, []);

  async function handleEvaluate() {
    if (!confirm('Run AI clustering for all submissions? This may take several minutes.')) return;
    setEvaluating(true); setProgress(0);
    try {
      await ProfAPI.evaluateAssignment(assignment.id);
      setProgress(100);
      setTimeout(() => { setEvaluating(false); onViewReport(); }, 500);
    } catch (err: any) {
      notify(err.response?.data?.error || 'Evaluation failed', 'error');
      setEvaluating(false);
    }
  }

  function getFileName(url: string) {
    try {
      const raw = decodeURIComponent(url).split('/').pop() || url;
      return raw.includes('_') ? raw.split('_').slice(1).join('_') : raw;
    } catch { return url; }
  }

  const submissions: Submission[] = data?.submissions || [];

  return (
    <div>
      {/* Assignment header card */}
      <div style={{
        background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(139,92,246,.16)', borderRadius: 18,
        padding: 22, marginBottom: 22,
        boxShadow: '0 4px 20px rgba(139,92,246,.09)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            boxShadow: '0 4px 14px rgba(139,92,246,.3)',
          }}>📝</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, color: '#2e1065', marginBottom: 4 }}>
              {assignment.title}
            </div>
            {assignment.description && (
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, lineHeight: 1.5 }}>
                {assignment.description}
              </div>
            )}
            <div style={{ fontSize: 12, fontWeight: 700, color: isPast(assignment.deadline) ? '#f59e0b' : '#ef4444' }}>
              {isPast(assignment.deadline) ? '⏰ Deadline passed: ' : '📅 Due: '}{fmtDate(assignment.deadline)}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setEditModal(true)}>✏️ Edit</Button>
        </div>

        {/* Professor files */}
        {(assignment.professor_files || []).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
              Attached Resources
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(assignment.professor_files || []).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="ap-file-chip">
                  📄 {getFileName(url)}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* AI trigger */}
        <div style={{ marginTop: 18 }}>
          {evaluating ? (
            <div style={{
              background: 'rgba(139,92,246,.07)', border: '1px solid rgba(139,92,246,.2)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: '#6d28d9', fontSize: 14 }}>✨ AI Processing Documents…</span>
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: '#8b5cf6' }}>{progress}%</span>
              </div>
              <div className="ap-progress-bar-bg"><div className="ap-progress-bar-fill" style={{ width: `${progress}%` }}/></div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="primary" onClick={handleEvaluate}
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', boxShadow: '0 4px 14px rgba(139,92,246,.3)' }}>
                ✨ Trigger AI Clustering
              </Button>
              <Button variant="secondary" onClick={onViewReport}>📊 View Report</Button>
            </div>
          )}
        </div>
      </div>

      {/* Submissions */}
      <div style={{
        fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16,
        color: '#2e1065', marginBottom: 14,
      }}>
        Student Submissions ({loading ? '…' : submissions.length})
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28}/></div>
      ) : submissions.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0' }}>No submissions yet.</div>
      ) : (
        <div>
          {submissions.map((s: any) => (
            <div key={s.id} className={`ap-sub-row${s.is_flagged ? ' flagged' : ''}`}>
              <div className="ap-sub-avatar">{s.student_name?.charAt(0)?.toUpperCase() || '?'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#2e1065' }}>
                  {s.student_name}
                  <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>({s.roll_no})</span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
                  Submitted: {fmtDate(s.submitted_at)}
                </div>
                {/* Student files */}
                {(s.student_files || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {(s.student_files || []).map((url: string, i: number) => {
                      const fn = (() => {
                        try { const r = decodeURIComponent(url).split('/').pop() || url; return r.includes('_') ? r.split('_').slice(1).join('_') : r; } catch { return url; }
                      })();
                      return (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="ap-file-chip">
                          📄 {fn}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                {s.is_flagged && <Badge variant="red">⚠️ Flagged</Badge>}
                {s.ai_score != null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>AI Written</div>
                    <div style={{
                      fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14,
                      color: (s.ai_score || 0) > 0.7 ? '#ef4444' : '#10b981',
                    }}>{pct(s.ai_score)}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editModal && (
        <AssignmentFormModal
          courseId=""
          existing={assignment}
          onClose={() => setEditModal(false)}
          onSaved={a => { setAssignment({ ...assignment, ...a }); load(); }}
        />
      )}
    </div>
  );
}

// ─── Course Eval Report View ──────────────────────────────────────────────────
function CourseEvalReportView({
  courseName, results, onViewAssignmentReport,
}: {
  courseName: string;
  results: any[];
  onViewAssignmentReport: (assignmentId: string, title: string) => void;
}) {
  const evaluated = results.filter((r: any) => r.status === 'Evaluated').length;
  const skipped   = results.filter((r: any) => r.status?.includes('Skipped')).length;
  const totalClusters = results.reduce((a: number, r: any) => a + (r.clusters_found || 0), 0);

  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <StatCard label="Evaluated" value={evaluated} color="#8b5cf6"/>
        <StatCard label="Total Clusters" value={totalClusters} color="#ef4444"/>
        <StatCard label="Skipped" value={skipped} color="#9ca3af"/>
      </div>

      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: '#2e1065', marginBottom: 14 }}>
        Detailed Breakdown
      </div>

      {results.map((item: any, i: number) => {
        const isEvaluated = item.status === 'Evaluated';
        const hasClusters = (item.clusters_found || 0) > 0;
        return (
          <div key={i} className="ap-ceval-card"
            onClick={() => isEvaluated && onViewAssignmentReport(item.assignment_id, item.assignment)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: hasClusters ? 12 : 0 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: isEvaluated
                  ? (hasClusters ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.1)')
                  : 'rgba(139,92,246,.08)',
                border: `1px solid ${isEvaluated ? (hasClusters ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)') : 'rgba(139,92,246,.18)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {isEvaluated ? (hasClusters ? '⚠️' : '✅') : '⏸'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: '#2e1065', marginBottom: 4 }}>
                  {item.assignment}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                    background: isEvaluated ? (hasClusters ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.1)') : 'rgba(139,92,246,.1)',
                    color: isEvaluated ? (hasClusters ? '#dc2626' : '#15803d') : '#6d28d9',
                  }}>{item.status}</span>
                  {isEvaluated && (
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: hasClusters ? '#ef4444' : '#10b981',
                    }}>
                      {item.clusters_found} {item.clusters_found === 1 ? 'Cluster' : 'Clusters'}
                    </span>
                  )}
                </div>
              </div>
              {isEvaluated && (
                <span style={{ fontSize: 14, color: 'rgba(139,92,246,.4)' }}>→</span>
              )}
            </div>

            {/* Mini bar */}
            {isEvaluated && hasClusters && (
              <div>
                <div className="ap-progress-bar-bg" style={{ height: 5 }}>
                  <div className="ap-progress-bar-fill"
                    style={{ width: `${Math.min(((item.clusters_found || 0) / 5) * 100, 100)}%`, background: '#ef4444' }}/>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main AssignmentsPage ─────────────────────────────────────────────────────
export default function AssignmentsPage() {
  // Navigation state
  const [view, setView]                 = useState<View>('courses');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<(Assignment & { professor_files?: string[] }) | null>(null);
  const [courseEvalResults, setCourseEvalResults]   = useState<any[]>([]);
  // report-from-course-eval drilldown
  const [reportAssignmentId, setReportAssignmentId] = useState<string | null>(null);
  const [reportAssignmentTitle, setReportAssignmentTitle] = useState('');

  // Data
  const [courses, setCourses]         = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Loading
  const [loadingCourses, setLoadingCourses]         = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Modals
  const [createModal, setCreateModal]   = useState(false);

  // Course-wide AI check
  const [evaluatingAll, setEvaluatingAll] = useState(false);

  // Load courses once
  useEffect(() => {
    ProfAPI.getCourses()
      .then(r => setCourses(r.data.data || []))
      .finally(() => setLoadingCourses(false));
  }, []);

  async function selectCourse(c: Course) {
    setSelectedCourse(c);
    setAssignments([]);
    setView('assignments');
    setLoadingAssignments(true);
    try {
      const r = await ProfAPI.getCourseAssignments(c.course_id);
      setAssignments(r.data.data || []);
    } catch { /* silent */ }
    finally { setLoadingAssignments(false); }
  }

  async function openDetail(a: Assignment) {
    // fetch full assignment details (incl. professor_files) then navigate
    try {
      const r = await ProfAPI.getAssignmentDetails(a.id);
      setSelectedAssignment({ ...a, ...(r.data.assignment || {}) });
    } catch {
      setSelectedAssignment(a);
    }
    setView('detail');
  }

  async function handleEvaluateAll() {
    if (!selectedCourse || !confirm('Run AI integrity check on every assignment in this course? This may take several minutes.')) return;
    setEvaluatingAll(true);
    try {
      const res = await ProfAPI.evaluateEntireCourse(selectedCourse.course_id);
      setCourseEvalResults(res.data.results || []);
      setView('courseReport');
      notify('Course-wide evaluation complete!');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Evaluation failed', 'error');
    } finally { setEvaluatingAll(false); }
  }

  // Breadcrumb steps per view
  function breadcrumbSteps() {
    const base = [{ label: 'Assignments', view: 'courses' as View }];
    if (view === 'courses') return base;
    const withCourse = [...base, { label: selectedCourse?.name || 'Course', view: 'assignments' as View }];
    if (view === 'assignments') return withCourse;
    if (view === 'courseReport') return [...withCourse, { label: 'AI Course Report', view: null }];
    if (view === 'detail') return [...withCourse, { label: selectedAssignment?.title || 'Detail', view: 'detail' as View }];
    if (view === 'report') return [...withCourse, { label: selectedAssignment?.title || 'Detail', view: 'detail' as View }, { label: 'AI Report', view: null }];
    return base;
  }

  function navigate(v: View | null) {
    if (v) setView(v);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>

      {/* Breadcrumb (hide on courses view) */}
      {view !== 'courses' && (
        <Breadcrumb steps={breadcrumbSteps()} onNavigate={navigate}/>
      )}

      {/* ══════════ COURSES ══════════ */}
      {view === 'courses' && (
        <div>
          <div className="ap-section-title">Assignments</div>
          <div className="ap-section-sub">Select a course to manage its assignments</div>

          {loadingCourses ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32}/></div>
          ) : courses.length === 0 ? (
            <EmptyState icon="📚" title="No courses assigned"
              sub="Assign yourself to courses from the Manage Courses page"/>
          ) : (
            <div className="ap-course-grid">
              {courses.map(c => (
                <div key={c.course_id} className="ap-course-card" onClick={() => selectCourse(c)}>
                  <div className="ap-course-card-accent"/>
                  <div className="ap-course-code">{c.code}{c.section ? ` · ${c.section}` : ''} · Sem {c.semester}</div>
                  <div className="ap-course-name">{c.name}</div>
                  <div className="ap-course-dept">{c.dept_name}</div>
                  {(c.student_count ?? 0) > 0 && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11.5, color: '#6d28d9', fontWeight: 600,
                      background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.15)',
                      borderRadius: 7, padding: '3px 9px',
                    }}>👥 {c.student_count} students</div>
                  )}
                  <span className="ap-course-arrow">→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ ASSIGNMENTS LIST ══════════ */}
      {view === 'assignments' && selectedCourse && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 22 }}>
            <div>
              <div className="ap-section-title">{selectedCourse.name}</div>
              <div className="ap-section-sub">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button variant="danger" size="sm" loading={evaluatingAll} onClick={handleEvaluateAll}>
                🔬 Run AI Check on All
              </Button>
              <Button variant="primary" size="sm" onClick={() => setCreateModal(true)}>
                + New Assignment
              </Button>
            </div>
          </div>

          {loadingAssignments ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32}/></div>
          ) : assignments.length === 0 ? (
            <EmptyState icon="📝" title="No assignments yet" sub="Create the first assignment for this course">
              <Button variant="primary" onClick={() => setCreateModal(true)}>+ Create Assignment</Button>
            </EmptyState>
          ) : (
            <div>
              {assignments.map(a => {
                const past = isPast(a.deadline);
                return (
                  <div key={a.id} className={`ap-assign-card${past ? ' past' : ''}`}>
                    <div className="ap-assign-icon">{past ? '⏰' : '📝'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ap-assign-title">{a.title}</div>
                      {a.description && <div className="ap-assign-desc">{a.description}</div>}
                      <div className={`ap-assign-deadline ${past ? 'past' : 'live'}`}>
                        {past ? '⏰ Deadline passed: ' : '📅 Due: '}{fmtDate(a.deadline)}
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => openDetail(a)}>
                      📋 View Submissions
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {createModal && (
            <AssignmentFormModal
              courseId={selectedCourse.course_id}
              onClose={() => setCreateModal(false)}
              onSaved={a => setAssignments(prev => [a, ...prev])}
            />
          )}
        </div>
      )}

      {/* ══════════ ASSIGNMENT DETAIL ══════════ */}
      {view === 'detail' && selectedAssignment && (
        <AssignmentDetailView
          assignment={selectedAssignment}
          onBack={() => setView('assignments')}
          onViewReport={() => setView('report')}
        />
      )}

      {/* ══════════ EVAL REPORT ══════════ */}
      {view === 'report' && selectedAssignment && (
        <EvalReportView
          assignment={selectedAssignment}
          onBack={() => setView('detail')}
        />
      )}

      {/* ══════════ COURSE EVAL REPORT ══════════ */}
      {view === 'courseReport' && selectedCourse && (
        <CourseEvalReportView
          courseName={selectedCourse.name}
          results={courseEvalResults}
          onViewAssignmentReport={(assignmentId, title) => {
            // synthesize a minimal assignment object to reuse EvalReportView
            setSelectedAssignment({ id: assignmentId, title } as any);
            setView('report');
          }}
        />
      )}
    </>
  );
}