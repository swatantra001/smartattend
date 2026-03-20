import React, { useState, useEffect, useRef } from 'react';
import { StudentAPI, AssignmentAPI } from '../services/api';
import { D } from '../components/design-tokens';
import { Button, Badge, Tabs, Spinner, EmptyState, notify } from '../components/ui';
import type { Course, Assignment, Submission } from '../types';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function isPast(dl: string) { return new Date(dl) < new Date(); }
function fileIcon(url: string) {
  if (url.includes('.pdf')) return '📄';
  if (url.match(/\.(doc|docx)/)) return '📝';
  if (url.match(/\.(jpg|jpeg|png|gif|webp)/)) return '🖼️';
  if (url.match(/\.(zip|rar|tar)/)) return '📦';
  return '📎';
}

// ── Assignment Detail panel ────────────────────────────────────────────────────
function AssignmentDetail({ assignment, onBack }: { assignment: Assignment; onBack: () => void }) {
  const [data, setData]             = useState<{ assignment: Assignment; submission: Submission | null } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    AssignmentAPI.getAssignmentDetails(assignment.id)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, [assignment.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      await AssignmentAPI.submitAssignment(assignment.id, files);
      notify(`✅ ${files.length} file(s) submitted`);
      load();
    } catch (err: any) {
      notify(err.response?.data?.error || 'Upload failed', 'error');
    } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function handleDeleteSubmission() {
    if (!confirm('Revoke your entire submission? All your files will be deleted.')) return;
    setDeleting(true);
    try {
      await AssignmentAPI.deleteSubmission(assignment.id);
      notify('Submission revoked');
      load();
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed', 'error');
    } finally { setDeleting(false); }
  }

  async function handleDeleteFile(url: string) {
    if (!confirm('Remove this file?')) return;
    setDeletingFile(url);
    try {
      await AssignmentAPI.deleteFile(assignment.id, url);
      notify('File removed');
      load();
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed', 'error');
    } finally { setDeletingFile(null); }
  }

  const past = isPast(assignment.deadline);
  const sub  = data?.submission;
  const profFiles: string[] = data?.assignment?.professor_files || [];

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, fontFamily: 'inherit' }}>← Back to Assignments</button>

      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: 22, borderBottom: `1px solid ${D.border}`, borderLeft: `4px solid ${past ? D.amber : D.accent}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17 }}>{assignment.title}</div>
              {assignment.description && <div style={{ fontSize: 13, color: D.textSecondary, marginTop: 6, lineHeight: 1.6 }}>{assignment.description}</div>}
            </div>
            {sub && <Badge variant="green">✓ Submitted</Badge>}
          </div>
          <div style={{ fontSize: 12, color: past ? D.amber : D.textMuted, fontWeight: 600, marginTop: 10 }}>
            {past ? '⏰ Deadline passed: ' : '📅 Due: '}{fmtDate(assignment.deadline)}
          </div>
        </div>

        {/* Professor's files */}
        {profFiles.length > 0 && (
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${D.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: D.textMuted, marginBottom: 10 }}>Assignment Files</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {profFiles.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: D.surface2, borderRadius: 9, border: `1px solid ${D.border}`, color: D.textPrimary, textDecoration: 'none', fontSize: 13 }}>
                  <span style={{ fontSize: 18 }}>{fileIcon(url)}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{decodeURIComponent(url.split('/').pop() || 'File ' + (i + 1))}</span>
                  <span style={{ fontSize: 11, color: D.accent }}>↓ Download</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28} /></div>
      ) : (
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>Your Submission</div>
            {sub && (
              <div style={{ fontSize: 12, color: D.textMuted }}>Submitted: {fmtDate(sub.submitted_at)}</div>
            )}
          </div>
          <div style={{ padding: 22 }}>
            {sub?.is_flagged && (
              <div style={{ background: D.redLight, border: `1px solid rgba(239,68,68,.2)`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: D.red, fontWeight: 600, marginBottom: 14 }}>
                ⚠️ Flagged for Academic Integrity Review: {sub.flag_reason}
              </div>
            )}

            {/* Submitted files */}
            {sub && (sub.student_files || []).length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: D.textMuted, marginBottom: 8 }}>Submitted Files</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(sub.student_files || []).map((url, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: D.surface2, borderRadius: 9, border: `1px solid ${D.border}` }}>
                      <span style={{ fontSize: 18 }}>{fileIcon(url)}</span>
                      <a href={url} target="_blank" rel="noreferrer" style={{ flex: 1, color: D.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {decodeURIComponent(url.split('/').pop() || 'File ' + (i + 1))}
                      </a>
                      {!past && (
                        <button onClick={() => handleDeleteFile(url)} disabled={deletingFile === url} style={{ background: 'none', border: 'none', color: D.red, cursor: 'pointer', fontSize: 16, padding: 4 }}>
                          {deletingFile === url ? '…' : '✕'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {past ? (
              !sub ? (
                <div style={{ textAlign: 'center', padding: '20px', color: D.textMuted, fontSize: 13 }}>
                  ⏰ Deadline has passed. Submission closed.
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px', color: D.green, fontSize: 13, fontWeight: 600 }}>
                  ✅ Submitted before deadline
                </div>
              )
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input ref={fileInputRef} type="file" multiple onChange={handleUpload} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.txt,.zip,.jpg,.jpeg,.png" />
                <Button variant="primary" loading={uploading} onClick={() => fileInputRef.current?.click()}>
                  📎 {sub ? 'Add More Files' : 'Upload Files'}
                </Button>
                {sub && (
                  <Button variant="danger" size="sm" loading={deleting} onClick={handleDeleteSubmission}>Revoke Submission</Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Assignment list for a course ───────────────────────────────────────────────
function AssignmentList({ course, onSelect, onBack }: { course: Course; onSelect: (a: Assignment) => void; onBack: () => void }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    AssignmentAPI.getCourseAssignments(course.course_id)
      .then(r => setAssignments(r.data.data || []))
      .finally(() => setLoading(false));
  }, [course.course_id]);

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, fontFamily: 'inherit' }}>← My Courses</button>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{course.name}</div>
      <div style={{ fontSize: 12, color: D.textMuted, marginBottom: 20 }}>{course.code}</div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={28} /></div>
      ) : assignments.length === 0 ? (
        <EmptyState icon="📝" title="No assignments yet" sub="Check back later" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {assignments.map(a => {
            const past = isPast(a.deadline);
            return (
              <div key={a.id} onClick={() => onSelect(a)} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: '16px 18px', cursor: 'pointer', borderLeft: `4px solid ${a.has_submitted ? D.green : past ? D.amber : D.accent}`, transition: 'border-color .15s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>{a.title}</div>
                    {a.description && <div style={{ fontSize: 12, color: D.textSecondary, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</div>}
                    <div style={{ fontSize: 12, marginTop: 6, color: past ? D.amber : D.textMuted, fontWeight: past ? 600 : 400 }}>
                      {past ? '⏰ Closed: ' : '📅 Due: '}{fmtDate(a.deadline)}
                    </div>
                  </div>
                  {a.has_submitted
                    ? <Badge variant="green">✓ Submitted</Badge>
                    : past
                      ? <Badge variant="amber">Closed</Badge>
                      : <Badge variant="red">Pending</Badge>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AssignmentsPage() {
  const [courses, setCourses]               = useState<Course[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    StudentAPI.getMyCourses()
      .then(r => setCourses(r.data.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (selectedAssignment) return <AssignmentDetail assignment={selectedAssignment} onBack={() => setSelectedAssignment(null)} />;
  if (selectedCourse) return <AssignmentList course={selectedCourse} onSelect={setSelectedAssignment} onBack={() => setSelectedCourse(null)} />;

  return (
    <div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 20 }}>My Courses</div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32} /></div>
      ) : courses.length === 0 ? (
        <EmptyState icon="📚" title="Not enrolled in any courses" sub="Your professor will enroll you in courses" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {courses.map(c => (
            <div key={c.course_id} onClick={() => setSelectedCourse(c)} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'border-color .15s' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 6 }}>
                {c.code}{c.section ? ` · ${c.section}` : ''}{c.semester ? ` · Sem ${c.semester}` : ''}
              </div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15 }}>{c.name}</div>
              {c.dept_name && <div style={{ fontSize: 12, color: D.textMuted, marginTop: 4 }}>{c.dept_name}</div>}
              <div style={{ marginTop: 12, color: D.accent, fontSize: 12, fontWeight: 600 }}>View Assignments →</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}