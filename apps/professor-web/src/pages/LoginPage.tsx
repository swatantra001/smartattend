// import React, { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { AuthAPI } from '../services/api';
// import { useAuthStore } from '../store/auth.store';
// import { connectSocket } from '../services/socket';
// import { D } from '../components/design-tokens';
// import { Spinner } from '../components/ui';
// import type { User } from '../types';

// type Screen = 'login' | 'forgot' | 'otp' | 'reset' | 'done';

// function pwStrength(pw: string) {
//   let s = 0;
//   if (pw.length >= 8) s++;
//   if (pw.length >= 12) s++;
//   if (/[A-Z]/.test(pw)) s++;
//   if (/[0-9]/.test(pw)) s++;
//   if (/[^A-Za-z0-9]/.test(pw)) s++;
//   const map = [
//     { pct: 0,   color: D.border,   label: '' },
//     { pct: 20,  color: D.red,      label: 'Very weak' },
//     { pct: 40,  color: D.amber,    label: 'Weak' },
//     { pct: 60,  color: D.amber,    label: 'Fair' },
//     { pct: 80,  color: D.green,    label: 'Strong' },
//     { pct: 100, color: D.green,    label: 'Very strong' },
//   ];
//   return map[Math.min(s, 5)];
// }

// function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
//   const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
//   function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
//     const ch = e.target.value.replace(/\D/g, '').slice(-1);
//     const arr = (value + '      ').slice(0, 6).split('');
//     arr[i] = ch;
//     onChange(arr.join('').trimEnd());
//     if (ch && i < 5) refs[i + 1].current?.focus();
//   }
//   function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
//     if (e.key === 'Backspace') {
//       const arr = (value + '      ').slice(0, 6).split('');
//       if (arr[i].trim()) { arr[i] = ' '; onChange(arr.join('').trimEnd()); }
//       else if (i > 0) refs[i - 1].current?.focus();
//     }
//   }
//   function handlePaste(e: React.ClipboardEvent) {
//     const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
//     if (p) { onChange(p); refs[Math.min(p.length, 5)].current?.focus(); }
//     e.preventDefault();
//   }
//   return (
//     <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }} onPaste={handlePaste}>
//       {refs.map((ref, i) => (
//         <input key={i} ref={ref} type="text" inputMode="numeric" maxLength={1}
//           value={value[i]?.trim() || ''} autoFocus={i === 0}
//           onChange={(e) => handleChange(i, e)} onKeyDown={(e) => handleKeyDown(i, e)}
//           style={{
//             width: 48, height: 56, textAlign: 'center',
//             background: value[i]?.trim() ? D.accentLight : D.surface2,
//             border: `1.5px solid ${value[i]?.trim() ? D.accent : D.border}`,
//             borderRadius: 10, color: D.textPrimary,
//             fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, outline: 'none',
//             transition: 'all .15s',
//           }}
//         />
//       ))}
//     </div>
//   );
// }

// function Steps({ current }: { current: 1 | 2 | 3 }) {
//   return (
//     <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
//       {[1, 2, 3].map(n => (
//         <div key={n} style={{ height: 3, flex: 1, borderRadius: 99, transition: 'background .3s', background: n < current ? D.green : n === current ? D.accent : D.border }} />
//       ))}
//     </div>
//   );
// }

// const inputStyle: React.CSSProperties = {
//   width: '100%', padding: '11px 14px',
//   background: D.surface2, border: `1.5px solid ${D.border}`,
//   borderRadius: 10, color: D.textPrimary, fontSize: 14, outline: 'none',
//   transition: 'all .15s', fontFamily: 'inherit',
// };

// export default function LoginPage() {
//   const navigate = useNavigate();
//   const { setAuth } = useAuthStore();

//   const [screen, setScreen] = useState<Screen>('login');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [success, setSuccess] = useState('');

//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [showPw, setShowPw] = useState(false);

//   const [identifier, setIdentifier] = useState('');
//   const [otp, setOtp] = useState('');
//   const [newPw, setNewPw] = useState('');
//   const [confirmPw, setConfirmPw] = useState('');
//   const [showNewPw, setShowNewPw] = useState(false);

//   const [countdown, setCountdown] = useState(0);
//   useEffect(() => {
//     if (!countdown) return;
//     const t = setTimeout(() => setCountdown(c => c - 1), 1000);
//     return () => clearTimeout(t);
//   }, [countdown]);

//   function goTo(s: Screen) { setError(''); setSuccess(''); setScreen(s); }

//   async function handleLogin(e: React.FormEvent) {
//     e.preventDefault(); setError(''); setLoading(true);
//     try {
//       const res = await AuthAPI.login(email.trim().toLowerCase(), password);
//       const { access_token, refresh_token, user } = res.data.data as { access_token: string; refresh_token: string; user: User };
//       if (user.role !== 'PROFESSOR') { setError('This portal is for professors only.'); return; }
//       setAuth(user, access_token, refresh_token);
//       connectSocket(access_token);
//       navigate('/', { replace: true });
//     } catch (err: any) {
//       setError(err.response?.data?.error || 'Login failed. Check your credentials.');
//     } finally { setLoading(false); }
//   }

//   async function handleForgot(e: React.FormEvent) {
//     e.preventDefault(); setError(''); setLoading(true);
//     try {
//       await AuthAPI.forgotPassword(identifier.trim());
//       setCountdown(60); setOtp(''); goTo('otp'); setSuccess('OTP sent — check your inbox.');
//     } catch (err: any) {
//       if (err.response?.status === 429) setError('Too many attempts. Wait 15 minutes.');
//       else { setCountdown(60); setOtp(''); goTo('otp'); setSuccess('OTP sent — check your inbox.'); }
//     } finally { setLoading(false); }
//   }

//   async function handleResend() {
//     setLoading(true);
//     try { await AuthAPI.forgotPassword(identifier.trim()); setCountdown(60); setSuccess('OTP resent!'); }
//     catch { setSuccess('OTP resent!'); setCountdown(60); }
//     finally { setLoading(false); }
//   }

//   function handleVerifyOtp(e: React.FormEvent) {
//     e.preventDefault(); setError('');
//     if (otp.replace(/\s/g, '').length < 6) { setError('Enter all 6 digits.'); return; }
//     goTo('reset');
//   }

//   async function handleReset(e: React.FormEvent) {
//     e.preventDefault(); setError(''); setLoading(true);
//     if (newPw !== confirmPw) { setError("Passwords don't match."); setLoading(false); return; }
//     if (newPw.length < 8) { setError('Min 8 characters.'); setLoading(false); return; }
//     try {
//       await AuthAPI.resetPassword(identifier.trim(), otp.replace(/\s/g, ''), newPw);
//       goTo('done');
//     } catch (err: any) {
//       setError(err.response?.data?.error || 'Reset failed.');
//     } finally { setLoading(false); }
//   }

//   const strength = pwStrength(newPw);

//   return (
//     <div style={{ minHeight: '100vh', display: 'flex', background: D.bg }}>
//       {/* Left brand panel */}
//       <div style={{
//         flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, position: 'relative',
//         background: `radial-gradient(circle at 20% 30%, rgba(79,127,255,.07) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(168,85,247,.05) 0%, transparent 55%)`,
//       }}>
//         <div style={{ maxWidth: 420 }}>
//           <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, #4f7fff, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 28, boxShadow: '0 12px 32px rgba(79,127,255,.3)' }}>🎓</div>
//           <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 42, fontWeight: 800, letterSpacing: -2, lineHeight: 1, marginBottom: 12 }}>SmartAttend</div>
//           <p style={{ fontSize: 15, color: D.textSecondary, lineHeight: 1.65, maxWidth: 320 }}>AI-powered attendance management for modern educational institutions.</p>
//           <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 16 }}>
//             {[
//               ['🤖', 'rgba(79,127,255,.15)',  'Face recognition with liveness detection'],
//               ['📡', 'rgba(168,85,247,.15)', 'Real-time GPS geofencing & session management'],
//               ['📊', 'rgba(34,197,94,.15)',  'Attendance reports with one-click export'],
//               ['🧠', 'rgba(245,158,11,.15)', 'AI-powered assignment integrity analysis'],
//             ].map(([icon, bg, label]) => (
//               <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: D.textSecondary }}>
//                 <div style={{ width: 36, height: 36, borderRadius: 10, background: bg as string, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icon}</div>
//                 {label}
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>

//       {/* Right card */}
//       <div style={{ flex: '0 0 480px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', background: D.surface, borderLeft: `1px solid ${D.border}` }}>
//         <div style={{ width: '100%', maxWidth: 400 }}>

//           {/* ── LOGIN ── */}
//           {screen === 'login' && (
//             <form onSubmit={handleLogin}>
//               <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.15em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 6 }}>Professor Portal</div>
//               <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: -.5, marginBottom: 4 }}>Welcome back</div>
//               <div style={{ fontSize: 13, color: D.textSecondary, marginBottom: 28 }}>Sign in to manage your attendance sessions</div>
//               {error && <div style={{ padding: '10px 13px', borderRadius: 8, background: D.redLight, border: `1px solid rgba(239,68,68,.2)`, color: '#fca5a5', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>⚠ {error}</div>}
//               <div style={{ marginBottom: 15 }}>
//                 <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 5 }}>Email Address</label>
//                 <input style={inputStyle} type="email" required placeholder="professor@college.edu" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
//               </div>
//               <div style={{ marginBottom: 6 }}>
//                 <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 5 }}>Password</label>
//                 <div style={{ position: 'relative' }}>
//                   <input style={{ ...inputStyle, paddingRight: 44 }} type={showPw ? 'text' : 'password'} required placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} />
//                   <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', color: D.textMuted, fontSize: 15, cursor: 'pointer' }}>{showPw ? '🙈' : '👁'}</button>
//                 </div>
//               </div>
//               <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, borderRadius: 10, background: D.accent, color: '#fff', fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', border: 'none', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(79,127,255,.3)', opacity: loading ? .6 : 1, transition: 'all .18s' }}>
//                 {loading && <Spinner size={14} light />}
//                 {loading ? 'Signing in…' : 'Sign In →'}
//               </button>
//               <button type="button" onClick={() => { setIdentifier(email); goTo('forgot'); }} style={{ display: 'block', width: '100%', textAlign: 'center', background: 'none', border: 'none', color: D.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '10px 0', marginTop: 4 }}>Forgot password?</button>
//             </form>
//           )}

//           {/* ── FORGOT ── */}
//           {screen === 'forgot' && (
//             <form onSubmit={handleForgot}>
//               <button type="button" onClick={() => goTo('login')} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>← Back to login</button>
//               <Steps current={1} />
//               <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.15em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 6 }}>Step 1 of 3</div>
//               <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Forgot password?</div>
//               <div style={{ fontSize: 13, color: D.textSecondary, marginBottom: 24 }}>Enter your email or employee code — we'll send an OTP.</div>
//               {error && <div style={{ padding: '10px 13px', borderRadius: 8, background: D.redLight, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>}
//               <div style={{ marginBottom: 16 }}>
//                 <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 5 }}>Email / Employee Code</label>
//                 <input style={inputStyle} type="text" required placeholder="professor@college.edu" value={identifier} onChange={e => setIdentifier(e.target.value)} autoFocus />
//               </div>
//               <button type="submit" disabled={loading || !identifier.trim()} style={{ width: '100%', padding: 13, borderRadius: 10, background: D.accent, color: '#fff', fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (loading || !identifier.trim()) ? .5 : 1 }}>
//                 {loading && <Spinner size={14} light />} {loading ? 'Sending…' : 'Send OTP →'}
//               </button>
//             </form>
//           )}

//           {/* ── OTP ── */}
//           {screen === 'otp' && (
//             <form onSubmit={handleVerifyOtp}>
//               <button type="button" onClick={() => goTo('forgot')} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>← Back</button>
//               <Steps current={2} />
//               <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.15em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 6 }}>Step 2 of 3</div>
//               <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Enter OTP</div>
//               <div style={{ fontSize: 13, color: D.textSecondary, marginBottom: 24 }}>Sent to <strong>{identifier}</strong>. Valid 10 min.</div>
//               {error && <div style={{ padding: '10px 13px', borderRadius: 8, background: D.redLight, color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}
//               {success && <div style={{ color: D.green, fontSize: 13, marginBottom: 12 }}>✓ {success}</div>}
//               <OtpInput value={otp} onChange={setOtp} />
//               <div style={{ fontSize: 12, color: D.textMuted, textAlign: 'center', marginBottom: 20 }}>Tip: paste the code directly</div>
//               <button type="submit" disabled={otp.replace(/\s/g, '').length < 6} style={{ width: '100%', padding: 13, borderRadius: 10, background: D.accent, color: '#fff', fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', opacity: otp.replace(/\s/g, '').length < 6 ? .5 : 1 }}>Verify & Continue →</button>
//               <div style={{ fontSize: 12, color: D.textMuted, textAlign: 'center', marginTop: 14 }}>
//                 Didn't get it?{' '}
//                 <button type="button" disabled={countdown > 0 || loading} onClick={handleResend} style={{ background: 'none', border: 'none', color: countdown > 0 ? D.textMuted : D.accent, fontWeight: 600, cursor: countdown > 0 ? 'default' : 'pointer', fontSize: 12 }}>
//                   {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
//                 </button>
//               </div>
//             </form>
//           )}

//           {/* ── RESET ── */}
//           {screen === 'reset' && (
//             <form onSubmit={handleReset}>
//               <button type="button" onClick={() => goTo('otp')} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>← Back</button>
//               <Steps current={3} />
//               <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.15em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 6 }}>Step 3 of 3</div>
//               <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>New password</div>
//               <div style={{ fontSize: 13, color: D.textSecondary, marginBottom: 24 }}>Choose a strong password for your account.</div>
//               {error && <div style={{ padding: '10px 13px', borderRadius: 8, background: D.redLight, color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}
//               <div style={{ marginBottom: 15 }}>
//                 <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 5 }}>New Password</label>
//                 <div style={{ position: 'relative' }}>
//                   <input style={{ ...inputStyle, paddingRight: 44 }} type={showNewPw ? 'text' : 'password'} required placeholder="Min 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)} autoFocus />
//                   <button type="button" onClick={() => setShowNewPw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', color: D.textMuted, fontSize: 15, cursor: 'pointer' }}>{showNewPw ? '🙈' : '👁'}</button>
//                 </div>
//                 {newPw && (<>
//                   <div style={{ height: 3, background: D.border, borderRadius: 99, overflow: 'hidden', marginTop: 7 }}><div style={{ height: '100%', borderRadius: 99, width: strength.pct + '%', background: strength.color, transition: 'all .35s' }} /></div>
//                   <div style={{ fontSize: 11, marginTop: 4, color: strength.pct > 0 ? strength.color : D.textMuted }}>{strength.label}</div>
//                 </>)}
//               </div>
//               <div style={{ marginBottom: 16 }}>
//                 <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 5 }}>Confirm Password</label>
//                 <input style={{ ...inputStyle, borderColor: confirmPw && confirmPw !== newPw ? D.red : D.border }} type={showNewPw ? 'text' : 'password'} required placeholder="Repeat" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
//                 {confirmPw && confirmPw !== newPw && <div style={{ fontSize: 11, color: D.red, marginTop: 4 }}>Passwords don't match</div>}
//               </div>
//               <button type="submit" disabled={loading || newPw.length < 8 || newPw !== confirmPw} style={{ width: '100%', padding: 13, borderRadius: 10, background: D.accent, color: '#fff', fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (loading || newPw.length < 8 || newPw !== confirmPw) ? .5 : 1 }}>
//                 {loading && <Spinner size={14} light />} {loading ? 'Updating…' : 'Update Password'}
//               </button>
//             </form>
//           )}

//           {/* ── DONE ── */}
//           {screen === 'done' && (
//             <div style={{ textAlign: 'center' }}>
//               <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
//               <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Password updated!</div>
//               <div style={{ fontSize: 13, color: D.textSecondary, marginBottom: 28 }}>Sign in with your new password.</div>
//               <button onClick={() => { goTo('login'); setEmail(identifier); setPassword(''); }} style={{ width: '100%', padding: 13, borderRadius: 10, background: D.accent, color: '#fff', fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none' }}>Back to Sign In</button>
//             </div>
//           )}

//         </div>
//       </div>
//     </div>
//   );
// }













/**
 * LoginPage.tsx — SmartAttend Professor Portal
 *
 * Screens:
 *   'login'  → standard email + password login
 *   'forgot' → POST /api/auth/forgot-password  { identifier }
 *   'otp'    → client-side OTP entry (6 boxes) → proceeds to 'reset'
 *   'reset'  → POST /api/auth/reset-password   { identifier, otp, new_password }
 *   'done'   → success, redirect to login
 *
 * Backend contract:
 *   forgotPassword : { identifier }                        → generic success msg
 *   resetPassword  : { identifier, otp, new_password }    → { success, message }
 *   login          : { email, password }                  → { access_token, refresh_token, user }
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthAPI } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { connectSocket } from '../services/socket';
import { D } from '../components/design-tokens';
import { Spinner } from '../components/ui';
import type { User } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = 'login' | 'forgot' | 'otp' | 'reset' | 'done';

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Page shell ── */
.plp-page {
  min-height: 100vh;
  display: flex;
  font-family: 'DM Sans', sans-serif;
  position: relative;
  overflow: hidden;
  background: #faf5ff;
}

/* ── Orbit-style animated background — purple/violet theme ── */
.plp-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse 80% 60% at 65% 0%, rgba(139,92,246,.15) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 5% 85%, rgba(245,158,11,.08) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at 85% 75%, rgba(236,72,153,.07) 0%, transparent 50%),
    #f5f0ff;
}

/* ── Floating orbs ── */
.plp-orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
.plp-orb1 {
  width: 560px; height: 560px;
  top: -200px; right: -120px;
  background: radial-gradient(circle, rgba(139,92,246,.20) 0%, rgba(139,92,246,.04) 50%, transparent 70%);
  animation: plp-float1 16s ease-in-out infinite;
}
.plp-orb2 {
  width: 400px; height: 400px;
  bottom: -140px; left: -90px;
  background: radial-gradient(circle, rgba(245,158,11,.12) 0%, rgba(245,158,11,.02) 50%, transparent 70%);
  animation: plp-float2 20s ease-in-out infinite;
}
.plp-orb3 {
  width: 280px; height: 280px;
  top: 45%; left: 36%;
  background: radial-gradient(circle, rgba(236,72,153,.08) 0%, transparent 65%);
  animation: plp-float3 24s ease-in-out infinite;
}
@keyframes plp-float1 {
  0%,100% { transform: translate(0,0) scale(1); }
  33%      { transform: translate(-25px, 45px) scale(1.04); }
  66%      { transform: translate(18px, -22px) scale(.98); }
}
@keyframes plp-float2 {
  0%,100% { transform: translate(0,0) scale(1); }
  50%      { transform: translate(35px, -28px) scale(1.07); }
}
@keyframes plp-float3 {
  0%,100% { transform: translate(0,0) scale(1); }
  40%      { transform: translate(-18px, 25px) scale(1.09); }
  70%      { transform: translate(12px, -12px) scale(.96); }
}

/* ── Grid dots ── */
.plp-grid {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(circle, rgba(139,92,246,.20) 1px, transparent 1px);
  background-size: 30px 30px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
}

/* ── Brand panel (left) ── */
.plp-left {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 48px;
  position: relative; z-index: 1;
}
.plp-brand { max-width: 420px; }

/* Session live card — Orbit-style */
.plp-preview-card {
  margin-top: 44px;
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(139,92,246,.18);
  border-radius: 18px;
  padding: 20px 22px;
  box-shadow: 0 8px 32px rgba(139,92,246,.10), 0 2px 8px rgba(0,0,0,.06);
  max-width: 360px;
  animation: plp-card-float 7s ease-in-out infinite;
}
@keyframes plp-card-float {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
}
.plp-preview-title {
  font-size: 11px; font-weight: 700; letter-spacing: .10em;
  text-transform: uppercase; color: rgba(139,92,246,.85); margin-bottom: 14px;
}
.plp-preview-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; border-radius: 10px;
  background: rgba(139,92,246,.06); margin-bottom: 8px;
}
.plp-preview-row:last-child { margin-bottom: 0; }
.plp-preview-row-label { font-size: 13px; color: #2e1065; font-weight: 500; }
.plp-preview-row-sub   { font-size: 11px; color: #9ca3af; margin-top: 2px; }
.plp-preview-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.plp-preview-dot.live   { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.25); animation: plp-pulse 1.5s ease-in-out infinite; }
.plp-preview-dot.idle   { background: #f59e0b; }
.plp-preview-dot.done   { background: #8b5cf6; }
@keyframes plp-pulse {
  0%,100% { box-shadow: 0 0 0 3px rgba(34,197,94,.25); }
  50%      { box-shadow: 0 0 0 6px rgba(34,197,94,.12); }
}

.plp-logo {
  width: 62px; height: 62px; border-radius: 18px;
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; margin-bottom: 26px;
  box-shadow: 0 8px 28px rgba(139,92,246,.35);
}
.plp-brand-title {
  font-family: 'Syne', sans-serif;
  font-size: 40px; font-weight: 800;
  color: #2e1065; letter-spacing: -2px; line-height: 1;
  margin-bottom: 10px;
}
.plp-brand-sub {
  font-size: 15px; color: #6b7280; line-height: 1.65; max-width: 330px;
}
.plp-features { margin-top: 36px; display: flex; flex-direction: column; gap: 13px; }
.plp-feat {
  display: flex; align-items: center; gap: 12px;
  font-size: 14px; color: #4b5563;
}
.plp-feat-icon {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}

/* ── Card panel (right) ── */
.plp-right {
  flex: 0 0 500px;
  display: flex; align-items: center; justify-content: center;
  padding: 48px 40px;
  position: relative; z-index: 1;
}
.plp-card {
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(139,92,246,.15);
  border-radius: 24px; padding: 40px;
  width: 100%; max-width: 420px;
  box-shadow: 0 4px 6px rgba(0,0,0,.03), 0 20px 60px rgba(139,92,246,.12);
}

/* ── Screen animation ── */
@keyframes plp-slideIn {
  from { opacity: 0; transform: translateX(14px); }
  to   { opacity: 1; transform: translateX(0); }
}
.plp-screen { animation: plp-slideIn .22s ease both; }

/* ── Card header ── */
.plp-eyebrow {
  font-size: 10.5px; font-weight: 600; letter-spacing: .13em;
  text-transform: uppercase; color: #8b5cf6; margin-bottom: 6px;
}
.plp-card-title {
  font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800;
  color: #2e1065; letter-spacing: -.4px; margin-bottom: 4px;
}
.plp-card-sub { font-size: 13px; color: #6b7280; line-height: 1.55; margin-bottom: 26px; }

/* ── Step indicator ── */
.plp-steps { display: flex; align-items: center; gap: 6px; margin-bottom: 22px; }
.plp-step {
  height: 3px; border-radius: 99px; flex: 1;
  background: #e5e7eb; transition: background .3s ease;
}
.plp-step.active { background: #8b5cf6; }
.plp-step.done   { background: #22c55e; }

/* ── Back link ── */
.plp-back {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600; color: #8b5cf6;
  background: none; border: none; cursor: pointer;
  padding: 0; margin-bottom: 18px;
  transition: opacity .14s; letter-spacing: .01em;
}
.plp-back:hover { opacity: .65; }

/* ── Banners ── */
.plp-error {
  display: flex; align-items: flex-start; gap: 8px;
  background: #fef2f2; border: 1px solid rgba(239,68,68,.2);
  border-radius: 10px; padding: 10px 13px;
  font-size: 13px; color: #991b1b; margin-bottom: 16px; line-height: 1.45;
}
.plp-success {
  display: flex; align-items: flex-start; gap: 8px;
  background: #f0fdf4; border: 1px solid rgba(34,197,94,.2);
  border-radius: 10px; padding: 10px 13px;
  font-size: 13px; color: #065f46; margin-bottom: 16px; line-height: 1.45;
}

/* ── Form elements ── */
.plp-group { margin-bottom: 15px; }
.plp-label {
  display: block; font-size: 10.5px; font-weight: 600;
  letter-spacing: .10em; text-transform: uppercase;
  color: #9ca3af; margin-bottom: 5px;
}
.plp-input-wrap { position: relative; }
.plp-input {
  width: 100%; padding: 11px 14px;
  background: #faf5ff; border: 1.5px solid #e5e7eb;
  border-radius: 10px; font-family: 'DM Sans', sans-serif;
  font-size: 14px; color: #2e1065;
  outline: none; transition: all .15s ease;
}
.plp-input:focus {
  border-color: #8b5cf6; background: #fff;
  box-shadow: 0 0 0 3px rgba(139,92,246,.12);
}
.plp-input::placeholder { color: #9ca3af; }
.plp-input.has-error { border-color: #ef4444; }
.plp-input.has-error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,.12); }
.plp-field-error { font-size: 11px; color: #ef4444; margin-top: 4px; }

.plp-pw-toggle {
  position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: #9ca3af; font-size: 15px;
  display: flex; align-items: center; padding: 4px;
  transition: color .14s;
}
.plp-pw-toggle:hover { color: #6b7280; }

/* ── Password strength ── */
.plp-strength-track {
  height: 3px; background: #e5e7eb; border-radius: 99px;
  overflow: hidden; margin-top: 7px;
}
.plp-strength-fill { height: 100%; border-radius: 99px; transition: width .35s ease, background .35s ease; }
.plp-strength-label { font-size: 11px; margin-top: 4px; font-weight: 500; }

/* ── OTP grid ── */
.plp-otp-grid {
  display: flex; gap: 8px; justify-content: center;
  margin-bottom: 6px;
}
.plp-otp-box {
  width: 50px; height: 58px;
  text-align: center; font-family: 'Syne', sans-serif;
  font-size: 22px; font-weight: 800; color: #2e1065;
  background: #faf5ff; border: 1.5px solid #e5e7eb;
  border-radius: 11px; outline: none;
  transition: all .15s ease; caret-color: #8b5cf6;
}
.plp-otp-box:focus {
  border-color: #8b5cf6; background: #fff;
  box-shadow: 0 0 0 3px rgba(139,92,246,.12);
}
.plp-otp-box.filled {
  border-color: #8b5cf6;
  background: rgba(139,92,246,.08);
}
.plp-otp-hint { font-size: 12px; color: #9ca3af; text-align: center; margin-bottom: 22px; }

/* ── Buttons ── */
.plp-btn {
  width: 100%; padding: 13px;
  background: #2e1065; color: #fff;
  border: none; border-radius: 12px;
  font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: all .18s ease; margin-top: 4px;
  letter-spacing: .02em; box-shadow: 0 4px 14px rgba(46,16,101,.22);
  display: flex; align-items: center; justify-content: center; gap: 7px;
}
.plp-btn:hover:not(:disabled) {
  background: #4c1d95; transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(46,16,101,.3);
}
.plp-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
.plp-btn.violet {
  background: #8b5cf6;
  box-shadow: 0 4px 14px rgba(139,92,246,.35);
}
.plp-btn.violet:hover:not(:disabled) {
  background: #7c3aed;
  box-shadow: 0 6px 20px rgba(139,92,246,.45);
}

/* ── Spinner ── */
.plp-spin {
  width: 14px; height: 14px; flex-shrink: 0;
  border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
  border-radius: 50%;
  animation: plp-rotate .65s linear infinite;
}
@keyframes plp-rotate { to { transform: rotate(360deg); } }

/* ── Divider ── */
.plp-divider {
  display: flex; align-items: center; gap: 10px;
  margin: 20px 0;
}
.plp-divider::before, .plp-divider::after {
  content: ''; flex: 1; height: 1px; background: #e5e7eb;
}
.plp-divider span { font-size: 11px; color: #9ca3af; white-space: nowrap; }

/* ── Forgot link ── */
.plp-forgot-link {
  display: block; width: 100%; text-align: center;
  background: none; border: none; cursor: pointer;
  font-size: 13px; font-weight: 600; color: #8b5cf6;
  padding: 2px 0; transition: opacity .14s;
}
.plp-forgot-link:hover { opacity: .7; }

/* ── Resend row ── */
.plp-resend {
  font-size: 12px; color: #9ca3af; text-align: center;
  margin-top: 14px;
}
.plp-resend-btn {
  background: none; border: none; cursor: pointer;
  font-size: 12px; font-weight: 600; color: #8b5cf6;
  padding: 0; transition: opacity .14s;
}
.plp-resend-btn:hover:not(:disabled) { opacity: .7; }
.plp-resend-btn:disabled { color: #9ca3af; cursor: default; }

/* ── Done screen ── */
.plp-done-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: #f0fdf4; border: 2px solid rgba(34,197,94,.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; margin: 0 auto 20px;
}

/* ── Note box ── */
.plp-note {
  margin-top: 16px; padding: 10px 14px;
  background: rgba(139,92,246,.07); border: 1px solid rgba(139,92,246,.15);
  border-radius: 10px; font-size: 12px; color: #6d28d9;
  display: flex; align-items: center; gap: 8px; line-height: 1.4;
}

/* ── Portal switcher ── */
.plp-portal-switch {
  margin-top: 14px; padding: 12px 14px;
  background: rgba(99,102,241,.06); border: 1px solid rgba(99,102,241,.18);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
}
.plp-portal-switch-label {
  font-size: 12px; color: #6b7280; line-height: 1.4;
}
.plp-portal-switch-label strong { color: #2e1065; display: block; font-size: 12.5px; }
.plp-portal-switch-btn {
  background: rgba(99,102,241,.10); border: 1px solid rgba(99,102,241,.28);
  border-radius: 8px; padding: 7px 13px;
  font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700;
  color: #4338ca; cursor: pointer; white-space: nowrap;
  transition: all .15s; flex-shrink: 0; text-decoration: none;
  display: inline-flex; align-items: center; gap: 5px;
}
.plp-portal-switch-btn:hover { background: rgba(99,102,241,.18); transform: translateY(-1px); }

/* ── Responsive ── */
@media (max-width: 860px) {
  .plp-left { display: none; }
  .plp-right { flex: 1; padding: 32px 20px; }
}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pwStrength(pw: string) {
  let s = 0;
  if (pw.length >= 8)            s++;
  if (pw.length >= 12)           s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { pct:  0, color: '#e5e7eb', label: '' },
    { pct: 20, color: '#ef4444', label: 'Very weak' },
    { pct: 40, color: '#f59e0b', label: 'Weak' },
    { pct: 60, color: '#f59e0b', label: 'Fair' },
    { pct: 80, color: '#22c55e', label: 'Strong' },
    { pct:100, color: '#22c55e', label: 'Very strong' },
  ];
  return map[Math.min(s, 5)];
}

// ─── SVGs ─────────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const BookIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const ExternalIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

// ─── OTP Input ────────────────────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const ch = e.target.value.replace(/\D/g, '').slice(-1);
    const arr = value.padEnd(6, ' ').split('');
    arr[i] = ch;
    onChange(arr.join('').replace(/\s+$/, ''));
    if (ch && i < 5) refs[i + 1].current?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      const arr = value.padEnd(6, ' ').split('');
      if (arr[i].trim()) {
        arr[i] = ' ';
        onChange(arr.join('').replace(/\s+$/, ''));
      } else if (i > 0) {
        refs[i - 1].current?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs[i - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs[i + 1].current?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      refs[Math.min(pasted.length, 5)].current?.focus();
    }
    e.preventDefault();
  }

  return (
    <div className="plp-otp-grid" onPaste={handlePaste}>
      {refs.map((ref, i) => (
        <input
          key={i} ref={ref}
          className={`plp-otp-box${value[i] && value[i].trim() ? ' filled' : ''}`}
          type="text" inputMode="numeric" maxLength={1}
          value={value[i]?.trim() || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}

// ─── Step dots ────────────────────────────────────────────────────────────────
function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="plp-steps">
      {[1, 2, 3].map(n => (
        <div key={n}
          className={`plp-step ${n < current ? 'done' : n === current ? 'active' : ''}`}
        />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [screen, setScreen]         = useState<Screen>('login');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp]               = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showNewPw, setShowNewPw]   = useState(false);

  const [countdown, setCountdown]   = useState(0);
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function goTo(s: Screen) { setError(''); setSuccess(''); setScreen(s); }

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await AuthAPI.login(email.trim().toLowerCase(), password);
      const { access_token, refresh_token, user } = res.data.data as {
        access_token: string; refresh_token: string; user: User;
      };
      if (user.role !== 'PROFESSOR') {
        setError('This portal is for professors only.');
        return;
      }
      setAuth(user, access_token, refresh_token);
      connectSocket(access_token);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  // ── FORGOT ────────────────────────────────────────────────────────────────
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await AuthAPI.forgotPassword({ identifier: identifier.trim() });
      setCountdown(60); setOtp(''); goTo('otp');
      setSuccess('OTP sent — check your inbox.');
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Too many attempts. Please wait 15 minutes before requesting another OTP.');
      } else {
        setCountdown(60); setOtp(''); goTo('otp');
        setSuccess('OTP sent — check your inbox.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(''); setLoading(true);
    try {
      await AuthAPI.forgotPassword({ identifier: identifier.trim() });
      setCountdown(60); setSuccess('OTP resent!');
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Too many attempts. Please wait 15 minutes.');
      } else {
        setSuccess('OTP resent!'); setCountdown(60);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── OTP ───────────────────────────────────────────────────────────────────
  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (otp.replace(/\s/g, '').length < 6) {
      setError('Please enter all 6 digits of your OTP.');
      return;
    }
    goTo('reset');
  }

  // ── RESET ─────────────────────────────────────────────────────────────────
  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    if (newPw !== confirmPw) { setError('Passwords do not match.'); setLoading(false); return; }
    if (newPw.length < 8)   { setError('Password must be at least 8 characters.'); setLoading(false); return; }
    try {
      await AuthAPI.resetPassword({
        identifier: identifier.trim(),
        otp: otp.replace(/\s/g, ''),
        new_password: newPw,
      });
      goTo('done');
    } catch (err: any) {
      const msg: string  = err.response?.data?.error || 'Reset failed.';
      const code: string = err.response?.data?.code  || '';
      if (code === 'INVALID_OTP')      setError('Incorrect OTP. Please double-check and try again.');
      else if (code === 'OTP_EXPIRED') setError('This OTP has expired. Go back and request a new one.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const strength  = pwStrength(newPw);
  const otpDigits = otp.replace(/\s/g, '');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="plp-page">
        <div className="plp-bg"/>
        <div className="plp-grid"/>
        <div className="plp-orb plp-orb1"/>
        <div className="plp-orb plp-orb2"/>
        <div className="plp-orb plp-orb3"/>

        {/* ── Brand panel ── */}
        <div className="plp-left">
          <div className="plp-brand">
            <div className="plp-logo">🎓</div>
            <div className="plp-brand-title">SmartAttend</div>
            <p className="plp-brand-sub">
              AI-powered attendance management for modern educational institutions.
            </p>
            <div className="plp-features">
              {[
                { icon:'🤖', bg:'rgba(139,92,246,.12)',  label:'Face recognition with liveness detection' },
                { icon:'📡', bg:'rgba(99,102,241,.12)',  label:'Real-time GPS geofencing & session management' },
                { icon:'📊', bg:'rgba(34,197,94,.12)',   label:'Attendance reports with one-click export' },
                { icon:'🧠', bg:'rgba(245,158,11,.12)',  label:'AI-powered assignment integrity analysis' },
              ].map(f => (
                <div key={f.label} className="plp-feat">
                  <div className="plp-feat-icon" style={{background: f.bg}}>{f.icon}</div>
                  {f.label}
                </div>
              ))}
            </div>

            {/* Live session status card — Orbit-inspired */}
            <div className="plp-preview-card">
              <div className="plp-preview-title">Active sessions today</div>
              {[
                { label: 'CS401 — Computer Networks', sub: 'Hall B, Rm 204', dot: 'live',  count: '38 / 42' },
                { label: 'CS302 — Data Structures',   sub: 'Lab 1',          dot: 'idle',  count: 'Starts 2:00 PM' },
                { label: 'CS501 — Machine Learning',  sub: 'Seminar Hall',   dot: 'done',  count: 'Completed' },
              ].map(s => (
                <div key={s.label} className="plp-preview-row">
                  <div>
                    <div className="plp-preview-row-label">{s.label}</div>
                    <div className="plp-preview-row-sub">{s.sub}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                    <span style={{fontSize:12,color:'#6b7280',fontWeight:500}}>{s.count}</span>
                    <div className={`plp-preview-dot ${s.dot}`}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Card panel ── */}
        <div className="plp-right">
          <div className="plp-card">

            {/* ════════ LOGIN ════════ */}
            {screen === 'login' && (
              <div className="plp-screen">
                <div className="plp-eyebrow">Professor Portal</div>
                <div className="plp-card-title">Welcome back</div>
                <div className="plp-card-sub">Sign in to manage your attendance sessions</div>

                <form onSubmit={handleLogin}>
                  {error && (
                    <div className="plp-error">
                      <AlertIcon/>{error}
                    </div>
                  )}
                  <div className="plp-group">
                    <label className="plp-label">Email Address</label>
                    <input
                      className="plp-input" type="email" required
                      placeholder="professor@college.edu"
                      value={email} onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <div className="plp-group">
                    <label className="plp-label">Password</label>
                    <div className="plp-input-wrap">
                      <input
                        className="plp-input" type={showPw ? 'text' : 'password'}
                        required placeholder="Your password"
                        value={password} onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                        style={{paddingRight: 42}}
                      />
                      <button type="button" className="plp-pw-toggle"
                        onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                        {showPw ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="plp-btn violet">
                    {loading && <span className="plp-spin"/>}
                    {loading ? 'Signing in…' : 'Sign In →'}
                  </button>
                </form>

                <div className="plp-divider"><span>account recovery</span></div>
                <button className="plp-forgot-link"
                  onClick={() => { setIdentifier(email); goTo('forgot'); }}>
                  Forgot your password?
                </button>

                <div className="plp-note">
                  <BookIcon/>
                  Professor access only. Students log in via the student portal.
                </div>

                {/* Portal switcher */}
                <div className="plp-portal-switch">
                  <div className="plp-portal-switch-label">
                    <strong>Are you a Student?</strong>
                    Access the student portal instead
                  </div>
                  <a href="http://localhost:3002" className="plp-portal-switch-btn">
                    Student <ExternalIcon/>
                  </a>
                </div>
              </div>
            )}

            {/* ════════ FORGOT PASSWORD ════════ */}
            {screen === 'forgot' && (
              <div className="plp-screen">
                <button className="plp-back" onClick={() => goTo('login')}>
                  <BackIcon/> Back to login
                </button>
                <Steps current={1}/>
                <div className="plp-eyebrow">Account Recovery · Step 1 of 3</div>
                <div className="plp-card-title">Forgot password?</div>
                <div className="plp-card-sub">
                  Enter your email or employee code. We'll send a 6-digit OTP to reset your password.
                </div>
                <form onSubmit={handleForgot}>
                  {error && <div className="plp-error"><AlertIcon/>{error}</div>}
                  <div className="plp-group">
                    <label className="plp-label">Email / Employee Code</label>
                    <input
                      className="plp-input" type="text" required
                      placeholder="professor@college.edu or EMP001"
                      value={identifier} onChange={e => setIdentifier(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <button type="submit"
                    disabled={loading || !identifier.trim()}
                    className="plp-btn violet">
                    {loading && <span className="plp-spin"/>}
                    {loading ? 'Sending OTP…' : 'Send OTP →'}
                  </button>
                </form>
              </div>
            )}

            {/* ════════ OTP ENTRY ════════ */}
            {screen === 'otp' && (
              <div className="plp-screen">
                <button className="plp-back" onClick={() => goTo('forgot')}>
                  <BackIcon/> Back
                </button>
                <Steps current={2}/>
                <div className="plp-eyebrow">Account Recovery · Step 2 of 3</div>
                <div className="plp-card-title">Enter OTP</div>
                <div className="plp-card-sub">
                  We sent a 6-digit code to{' '}
                  <strong style={{color:'#2e1065'}}>{identifier}</strong>. Valid for 10 minutes.
                </div>
                <form onSubmit={handleVerifyOtp}>
                  {error   && <div className="plp-error"><AlertIcon/>{error}</div>}
                  {success && <div className="plp-success"><CheckIcon/>{success}</div>}
                  <OtpInput value={otp} onChange={setOtp}/>
                  <div className="plp-otp-hint">Tip: you can paste the code directly</div>
                  <button type="submit" disabled={otpDigits.length < 6} className="plp-btn violet">
                    Verify & Continue →
                  </button>
                </form>
                <div className="plp-resend">
                  Didn't receive it?{' '}
                  <button className="plp-resend-btn"
                    disabled={countdown > 0 || loading}
                    onClick={handleResend}>
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            )}

            {/* ════════ SET NEW PASSWORD ════════ */}
            {screen === 'reset' && (
              <div className="plp-screen">
                <button className="plp-back" onClick={() => goTo('otp')}>
                  <BackIcon/> Back
                </button>
                <Steps current={3}/>
                <div className="plp-eyebrow">Account Recovery · Step 3 of 3</div>
                <div className="plp-card-title">Set new password</div>
                <div className="plp-card-sub">Choose a strong password for your professor account.</div>
                <form onSubmit={handleReset}>
                  {error && <div className="plp-error"><AlertIcon/>{error}</div>}
                  <div className="plp-group">
                    <label className="plp-label">New Password</label>
                    <div className="plp-input-wrap">
                      <input
                        className="plp-input"
                        type={showNewPw ? 'text' : 'password'}
                        required placeholder="Min. 8 characters"
                        value={newPw} onChange={e => setNewPw(e.target.value)}
                        style={{paddingRight: 42}}
                        autoFocus
                      />
                      <button type="button" className="plp-pw-toggle"
                        onClick={() => setShowNewPw(p => !p)} tabIndex={-1}>
                        {showNewPw ? '🙈' : '👁'}
                      </button>
                    </div>
                    {newPw && (
                      <>
                        <div className="plp-strength-track">
                          <div className="plp-strength-fill"
                            style={{width:`${strength.pct}%`, background:strength.color}}/>
                        </div>
                        <div className="plp-strength-label"
                          style={{color: strength.pct > 0 ? strength.color : '#9ca3af'}}>
                          {strength.label}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="plp-group">
                    <label className="plp-label">Confirm Password</label>
                    <input
                      className={`plp-input${confirmPw && confirmPw !== newPw ? ' has-error' : ''}`}
                      type={showNewPw ? 'text' : 'password'}
                      required placeholder="Repeat your password"
                      value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                    />
                    {confirmPw && confirmPw !== newPw && (
                      <div className="plp-field-error">Passwords don't match</div>
                    )}
                  </div>
                  <button type="submit" className="plp-btn violet"
                    disabled={loading || newPw.length < 8 || newPw !== confirmPw}>
                    {loading && <span className="plp-spin"/>}
                    {loading ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              </div>
            )}

            {/* ════════ SUCCESS ════════ */}
            {screen === 'done' && (
              <div className="plp-screen" style={{textAlign:'center'}}>
                <div className="plp-done-icon">✓</div>
                <div className="plp-card-title" style={{textAlign:'center',marginBottom:6}}>
                  Password updated!
                </div>
                <div className="plp-card-sub" style={{textAlign:'center',marginBottom:28}}>
                  Your professor password has been reset successfully. Sign in with your new password.
                </div>
                <button className="plp-btn"
                  onClick={() => {
                    goTo('login');
                    setEmail(identifier);
                    setPassword(''); setNewPw(''); setConfirmPw(''); setOtp('');
                  }}>
                  Back to Sign In
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}