/**
 * LoginPage.tsx — SmartAttend Admin Portal
 *
 * Screens:
 *   'login'  → standard email + password login
 *   'forgot' → POST /api/auth/forgot-password  { identifier: email }
 *   'otp'    → client-side OTP entry (6 boxes) → proceeds to 'reset'
 *   'reset'  → POST /api/auth/reset-password   { identifier, otp, new_password }
 *   'done'   → success, redirect to login
 *
 * Backend contract (from auth.controller.ts):
 *   forgotPassword : { identifier }                        → generic success msg
 *   resetPassword  : { identifier, otp, new_password }    → { success, message }
 *   login          : { email, password }                  → { access_token, user }
 *
 * Add these to your AuthAPI service layer:
 *   AuthAPI.forgotPassword(body)  → axios.post('/auth/forgot-password', body)
 *   AuthAPI.resetPassword(body)   → axios.post('/auth/reset-password',  body)
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthAPI } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { D } from '../components/design-tokens';

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = 'login' | 'forgot' | 'otp' | 'reset' | 'done';

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Page shell ── */
.lp-page {
  min-height: 100vh;
  display: flex;
  background: ${D.bg};
  background-image: radial-gradient(circle, ${D.border} 1px, transparent 1px);
  background-size: 28px 28px;
  font-family: 'DM Sans', sans-serif;
  position: relative;
  overflow: hidden;
}
.lp-blob1 {
  position: fixed; top: -160px; right: -160px;
  width: 560px; height: 560px; border-radius: 50%;
  background: radial-gradient(circle, rgba(124,58,237,.13) 0%, transparent 70%);
  pointer-events: none; z-index: 0;
}
.lp-blob2 {
  position: fixed; bottom: -110px; left: -130px;
  width: 440px; height: 440px; border-radius: 50%;
  background: radial-gradient(circle, rgba(16,185,129,.09) 0%, transparent 70%);
  pointer-events: none; z-index: 0;
}

/* ── Brand panel (left) ── */
.lp-left {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 48px;
  position: relative; z-index: 1;
}
.lp-brand { max-width: 420px; }
.lp-logo {
  width: 64px; height: 64px; border-radius: 18px;
  background: linear-gradient(135deg, ${D.purple}, ${D.purpleMid});
  display: flex; align-items: center; justify-content: center;
  font-size: 30px; margin-bottom: 28px;
  box-shadow: 0 8px 28px rgba(124,58,237,.35);
}
.lp-brand-title {
  font-family: 'Syne', sans-serif;
  font-size: 38px; font-weight: 800;
  color: ${D.textPrimary}; letter-spacing: -1.5px; line-height: 1;
  margin-bottom: 10px;
}
.lp-brand-sub {
  font-size: 15px; color: ${D.textMuted}; line-height: 1.65; max-width: 330px;
}
.lp-features { margin-top: 40px; display: flex; flex-direction: column; gap: 14px; }
.lp-feat {
  display: flex; align-items: center; gap: 12px;
  font-size: 14px; color: ${D.textSecondary};
}
.lp-feat-icon {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}

/* ── Card panel (right) ── */
.lp-right {
  flex: 0 0 500px;
  display: flex; align-items: center; justify-content: center;
  padding: 48px 40px;
  position: relative; z-index: 1;
}
.lp-card {
  background: ${D.surface};
  border: 1px solid ${D.border};
  border-radius: 24px; padding: 40px;
  width: 100%; max-width: 420px;
  box-shadow: 0 4px 6px rgba(0,0,0,.04), 0 20px 60px rgba(0,0,0,.09);
}

/* ── Screen animation ── */
@keyframes screenSlideIn {
  from { opacity: 0; transform: translateX(14px); }
  to   { opacity: 1; transform: translateX(0); }
}
.lp-screen { animation: screenSlideIn .22s ease both; }

/* ── Card header ── */
.lp-eyebrow {
  font-size: 10.5px; font-weight: 600; letter-spacing: .13em;
  text-transform: uppercase; color: ${D.textMuted}; margin-bottom: 6px;
}
.lp-card-title {
  font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800;
  color: ${D.textPrimary}; letter-spacing: -.4px; margin-bottom: 4px;
}
.lp-card-sub { font-size: 13px; color: ${D.textMuted}; line-height: 1.55; margin-bottom: 26px; }

/* ── Step indicator ── */
.lp-steps {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 22px;
}
.lp-step {
  height: 3px; border-radius: 99px; flex: 1;
  background: ${D.borderLight};
  transition: background .3s ease;
}
.lp-step.active  { background: ${D.purple}; }
.lp-step.done    { background: ${D.green}; }

/* ── Back link ── */
.lp-back {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600; color: ${D.purple};
  background: none; border: none; cursor: pointer;
  padding: 0; margin-bottom: 18px;
  transition: opacity .14s;
  letter-spacing: .01em;
}
.lp-back:hover { opacity: .65; }

/* ── Banners ── */
.lp-error {
  display: flex; align-items: flex-start; gap: 8px;
  background: ${D.redLight}; border: 1px solid ${D.red}28;
  border-radius: 10px; padding: 10px 13px;
  font-size: 13px; color: #991b1b; margin-bottom: 16px; line-height: 1.45;
}
.lp-success {
  display: flex; align-items: flex-start; gap: 8px;
  background: ${D.greenLight}; border: 1px solid ${D.green}28;
  border-radius: 10px; padding: 10px 13px;
  font-size: 13px; color: #065f46; margin-bottom: 16px; line-height: 1.45;
}

/* ── Form elements ── */
.lp-group { margin-bottom: 15px; }
.lp-label {
  display: block; font-size: 10.5px; font-weight: 600;
  letter-spacing: .10em; text-transform: uppercase;
  color: ${D.textMuted}; margin-bottom: 5px;
}
.lp-input-wrap { position: relative; }
.lp-input {
  width: 100%; padding: 11px 14px;
  background: ${D.borderLight}; border: 1.5px solid ${D.border};
  border-radius: 10px; font-family: 'DM Sans', sans-serif;
  font-size: 14px; color: ${D.textPrimary};
  outline: none; transition: all .15s ease;
}
.lp-input:focus {
  border-color: ${D.purple}; background: #fff;
  box-shadow: 0 0 0 3px ${D.purpleLight};
}
.lp-input::placeholder { color: ${D.textMuted}; }
.lp-input.has-error { border-color: ${D.red}; }
.lp-input.has-error:focus { box-shadow: 0 0 0 3px ${D.redLight}; border-color: ${D.red}; }
.lp-field-error { font-size: 11px; color: ${D.red}; margin-top: 4px; }

.lp-pw-toggle {
  position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: ${D.textMuted}; font-size: 15px;
  display: flex; align-items: center; padding: 4px;
  transition: color .14s;
}
.lp-pw-toggle:hover { color: ${D.textSecondary}; }

/* ── Password strength ── */
.lp-strength-track {
  height: 3px; background: ${D.borderLight}; border-radius: 99px;
  overflow: hidden; margin-top: 7px;
}
.lp-strength-fill { height: 100%; border-radius: 99px; transition: width .35s ease, background .35s ease; }
.lp-strength-label { font-size: 11px; margin-top: 4px; font-weight: 500; }

/* ── OTP grid ── */
.lp-otp-grid {
  display: flex; gap: 8px; justify-content: center;
  margin-bottom: 6px;
}
.lp-otp-box {
  width: 50px; height: 58px;
  text-align: center; font-family: 'Syne', sans-serif;
  font-size: 22px; font-weight: 800; color: ${D.textPrimary};
  background: ${D.borderLight}; border: 1.5px solid ${D.border};
  border-radius: 11px; outline: none;
  transition: all .15s ease; caret-color: ${D.purple};
}
.lp-otp-box:focus {
  border-color: ${D.purple}; background: #fff;
  box-shadow: 0 0 0 3px ${D.purpleLight};
}
.lp-otp-box.filled {
  border-color: ${D.purple};
  background: ${D.purpleLight};
}
.lp-otp-hint { font-size: 12px; color: ${D.textMuted}; text-align: center; margin-bottom: 22px; }

/* ── Buttons ── */
.lp-btn {
  width: 100%; padding: 13px;
  background: ${D.textPrimary}; color: #fff;
  border: none; border-radius: 12px;
  font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: all .18s ease; margin-top: 4px;
  letter-spacing: .02em; box-shadow: 0 4px 14px rgba(17,24,39,.22);
  display: flex; align-items: center; justify-content: center; gap: 7px;
}
.lp-btn:hover:not(:disabled) {
  background: #1f2937; transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(17,24,39,.3);
}
.lp-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
.lp-btn.purple {
  background: ${D.purple};
  box-shadow: 0 4px 14px rgba(124,58,237,.3);
}
.lp-btn.purple:hover:not(:disabled) {
  background: #6D28D9;
  box-shadow: 0 6px 20px rgba(124,58,237,.4);
}

/* ── Spinner ── */
.lp-spin {
  width: 14px; height: 14px; flex-shrink: 0;
  border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
  border-radius: 50%;
  animation: lp-rotate .65s linear infinite;
}
@keyframes lp-rotate { to { transform: rotate(360deg); } }

/* ── Divider ── */
.lp-divider {
  display: flex; align-items: center; gap: 10px;
  margin: 20px 0;
}
.lp-divider::before, .lp-divider::after {
  content: ''; flex: 1; height: 1px; background: ${D.border};
}
.lp-divider span { font-size: 11px; color: ${D.textMuted}; white-space: nowrap; }

/* ── Forgot link ── */
.lp-forgot-link {
  display: block; width: 100%; text-align: center;
  background: none; border: none; cursor: pointer;
  font-size: 13px; font-weight: 600; color: ${D.purple};
  padding: 2px 0; transition: opacity .14s;
}
.lp-forgot-link:hover { opacity: .7; }

/* ── Resend row ── */
.lp-resend {
  font-size: 12px; color: ${D.textMuted}; text-align: center;
  margin-top: 14px;
}
.lp-resend-btn {
  background: none; border: none; cursor: pointer;
  font-size: 12px; font-weight: 600; color: ${D.purple};
  padding: 0; transition: opacity .14s;
}
.lp-resend-btn:hover:not(:disabled) { opacity: .7; }
.lp-resend-btn:disabled { color: ${D.textMuted}; cursor: default; }

/* ── Done screen ── */
.lp-done-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: ${D.greenLight}; border: 2px solid ${D.green}30;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; margin: 0 auto 20px;
}

/* ── Note box ── */
.lp-note {
  margin-top: 16px; padding: 10px 14px;
  background: ${D.purpleLight}; border: 1px solid ${D.purple}20;
  border-radius: 10px; font-size: 12px; color: #5b21b6;
  display: flex; align-items: center; gap: 8px; line-height: 1.4;
}

/* ── Responsive ── */
@media (max-width: 800px) {
  .lp-left { display: none; }
  .lp-right { flex: 1; padding: 32px 20px; }
}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pwStrength(pw: string) {
  let s = 0;
  if (pw.length >= 8)        s++;
  if (pw.length >= 12)       s++;
  if (/[A-Z]/.test(pw))     s++;
  if (/[0-9]/.test(pw))     s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { pct: 0,   color: D.border,  label: '' },
    { pct: 20,  color: D.red,     label: 'Very weak' },
    { pct: 40,  color: D.amber,   label: 'Weak' },
    { pct: 60,  color: D.amber,   label: 'Fair' },
    { pct: 80,  color: D.green,   label: 'Strong' },
    { pct: 100, color: D.green,   label: 'Very strong' },
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
const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
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
    <div className="lp-otp-grid" onPaste={handlePaste}>
      {refs.map((ref, i) => (
        <input
          key={i} ref={ref}
          className={`lp-otp-box${value[i] && value[i].trim() ? ' filled' : ''}`}
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
    <div className="lp-steps">
      {[1, 2, 3].map(n => (
        <div key={n}
          className={`lp-step ${n < current ? 'done' : n === current ? 'active' : ''}`}
        />
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { setAuth, isAuthenticated } = useAuthStore();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated]);

  const [screen, setScreen]   = useState<Screen>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // login fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);

  // forgot / otp / reset shared state
  const [identifier, setIdentifier] = useState(''); // email used in forgot
  const [otp, setOtp]               = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showNewPw, setShowNewPw]   = useState(false);

  // resend countdown
  const [countdown, setCountdown] = useState(0);
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
      const res = await AuthAPI.login(email.toLowerCase().trim(), password);
      const { access_token, user } = res.data.data;
      if (user.role !== 'ADMIN') {
        setError('This portal is for administrators only.');
        return;
      }
      setAuth(user, access_token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  // ── FORGOT PASSWORD → POST /api/auth/forgot-password ──────────────────────
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      // Backend accepts { identifier: email }
      // It responds with a generic success msg to prevent enumeration
      await AuthAPI.forgotPassword({ identifier: identifier.trim() });
      setCountdown(60);
      setOtp('');
      goTo('otp');
      setSuccess('OTP sent — check your inbox.');
    } catch (err: any) {
      const msg = err.response?.data?.error || '';
      if (err.response?.status === 429) {
        setError('Too many attempts. Please wait 15 minutes before requesting another OTP.');
      } else if (err.response?.status === 403) {
        setError(msg || 'Account is deactivated. Contact your system administrator.');
      } else {
        // Still show success-like UI to prevent enumeration (mirror backend behaviour)
        setCountdown(60);
        setOtp('');
        goTo('otp');
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
      setCountdown(60);
      setSuccess('OTP resent!');
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Too many attempts. Please wait 15 minutes.');
      } else {
        setSuccess('OTP resent!'); // generic to avoid enumeration
        setCountdown(60);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── OTP verify (client-side gate before reset screen) ─────────────────────
  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const digits = otp.replace(/\s/g, '');
    if (digits.length < 6) {
      setError('Please enter all 6 digits of your OTP.');
      return;
    }
    goTo('reset');
  }

  // ── RESET PASSWORD → POST /api/auth/reset-password ────────────────────────
  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    if (newPw !== confirmPw) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }
    if (newPw.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }
    try {
      // Matches backend: { identifier, otp, new_password }
      await AuthAPI.resetPassword({
        identifier: identifier.trim(),
        otp: otp.replace(/\s/g, ''),
        new_password: newPw,
      });
      goTo('done');
    } catch (err: any) {
      const msg: string = err.response?.data?.error || 'Reset failed.';
      const code: string = err.response?.data?.code  || '';
      if (code === 'INVALID_OTP') {
        setError('Incorrect OTP. Please double-check and try again.');
      } else if (code === 'OTP_EXPIRED') {
        setError('This OTP has expired. Go back and request a new one.');
      } else if (code === 'WEAK_PASSWORD') {
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const strength = passwordStrength(newPw);
  const otpDigits = otp.replace(/\s/g, '');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="lp-page">
        <div className="lp-blob1"/>
        <div className="lp-blob2"/>

        {/* ── Brand panel ── */}
        <div className="lp-left">
          <div className="lp-brand">
            <div className="lp-logo">🎓</div>
            <div className="lp-brand-title">SmartAttend</div>
            <p className="lp-brand-sub">AI-powered attendance management for modern educational institutions.</p>
            <div className="lp-features">
              {[
                { icon:'🤖', bg:'#EDE9FE', label:'Face recognition with liveness detection' },
                { icon:'📱', bg:'#D1FAE5', label:'Secure device binding per student' },
                { icon:'📊', bg:'#DBEAFE', label:'Real-time reports and audit trails' },
                { icon:'🔐', bg:'#FEF3C7', label:'Role-based access for admin & faculty' },
              ].map(f => (
                <div key={f.label} className="lp-feat">
                  <div className="lp-feat-icon" style={{background: f.bg}}>{f.icon}</div>
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Card panel ── */}
        <div className="lp-right">
          <div className="lp-card">

            {/* ════════ LOGIN ════════ */}
            {screen === 'login' && (
              <div className="lp-screen">
                <div className="lp-eyebrow">Administrator Portal</div>
                <div className="lp-card-title">Welcome back</div>
                <div className="lp-card-sub">Sign in to manage SmartAttend</div>

                <form onSubmit={handleLogin}>
                  {error && (
                    <div className="lp-error">
                      <AlertIcon/>
                      {error}
                    </div>
                  )}
                  <div className="lp-group">
                    <label className="lp-label">Email Address</label>
                    <input
                      className="lp-input" type="email" required
                      placeholder="admin@college.edu"
                      value={email} onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <div className="lp-group">
                    <label className="lp-label">Password</label>
                    <div className="lp-input-wrap">
                      <input
                        className="lp-input" type={showPw ? 'text' : 'password'}
                        required placeholder="Your password"
                        value={password} onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                        style={{paddingRight: 42}}
                      />
                      <button
                        type="button" className="lp-pw-toggle"
                        onClick={() => setShowPw(p => !p)} tabIndex={-1}
                      >
                        {showPw ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="lp-btn">
                    {loading && <span className="lp-spin"/>}
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>

                <div className="lp-divider"><span>account recovery</span></div>
                <button className="lp-forgot-link" onClick={() => { setIdentifier(email); goTo('forgot'); }}>
                  Forgot your password?
                </button>

                <div className="lp-note">
                  <LockIcon/>
                  Administrator access only. Faculty log in via the professor app.
                </div>
              </div>
            )}

            {/* ════════ FORGOT PASSWORD ════════ */}
            {screen === 'forgot' && (
              <div className="lp-screen">
                <button className="lp-back" onClick={() => goTo('login')}>
                  <BackIcon/> Back to login
                </button>
                <Steps current={1}/>
                <div className="lp-eyebrow">Account Recovery · Step 1 of 3</div>
                <div className="lp-card-title">Forgot password?</div>
                <div className="lp-card-sub">
                  Enter your admin email address. We'll send a 6-digit OTP to reset your password.
                </div>

                <form onSubmit={handleForgot}>
                  {error && <div className="lp-error"><AlertIcon/>{error}</div>}
                  <div className="lp-group">
                    <label className="lp-label">Email Address</label>
                    <input
                      className="lp-input" type="email" required
                      placeholder="admin@college.edu"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !identifier.trim()}
                    className="lp-btn purple"
                  >
                    {loading && <span className="lp-spin"/>}
                    {loading ? 'Sending OTP…' : 'Send OTP →'}
                  </button>
                </form>
              </div>
            )}

            {/* ════════ OTP ENTRY ════════ */}
            {screen === 'otp' && (
              <div className="lp-screen">
                <button className="lp-back" onClick={() => goTo('forgot')}>
                  <BackIcon/> Back
                </button>
                <Steps current={2}/>
                <div className="lp-eyebrow">Account Recovery · Step 2 of 3</div>
                <div className="lp-card-title">Enter OTP</div>
                <div className="lp-card-sub">
                  We sent a 6-digit code to{' '}
                  <strong style={{color: D.textPrimary}}>{identifier}</strong>
                  . Valid for 10 minutes.
                </div>

                <form onSubmit={handleVerifyOtp}>
                  {error   && <div className="lp-error"><AlertIcon/>{error}</div>}
                  {success && <div className="lp-success"><CheckIcon/>{success}</div>}

                  <OtpInput value={otp} onChange={setOtp}/>
                  <div className="lp-otp-hint">
                    Tip: you can paste the code directly
                  </div>

                  <button
                    type="submit"
                    disabled={otpDigits.length < 6}
                    className="lp-btn purple"
                  >
                    Verify & Continue →
                  </button>
                </form>

                <div className="lp-resend">
                  Didn't receive it?{' '}
                  <button
                    className="lp-resend-btn"
                    disabled={countdown > 0 || loading}
                    onClick={handleResend}
                  >
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            )}

            {/* ════════ SET NEW PASSWORD ════════ */}
            {screen === 'reset' && (
              <div className="lp-screen">
                <button className="lp-back" onClick={() => goTo('otp')}>
                  <BackIcon/> Back
                </button>
                <Steps current={3}/>
                <div className="lp-eyebrow">Account Recovery · Step 3 of 3</div>
                <div className="lp-card-title">Set new password</div>
                <div className="lp-card-sub">
                  Choose a strong password for your administrator account.
                </div>

                <form onSubmit={handleReset}>
                  {error && <div className="lp-error"><AlertIcon/>{error}</div>}

                  <div className="lp-group">
                    <label className="lp-label">New Password</label>
                    <div className="lp-input-wrap">
                      <input
                        className="lp-input"
                        type={showNewPw ? 'text' : 'password'}
                        required placeholder="Min. 8 characters"
                        value={newPw} onChange={e => setNewPw(e.target.value)}
                        style={{paddingRight: 42}}
                        autoFocus
                      />
                      <button
                        type="button" className="lp-pw-toggle"
                        onClick={() => setShowNewPw(p => !p)} tabIndex={-1}
                      >
                        {showNewPw ? '🙈' : '👁'}
                      </button>
                    </div>
                    {newPw && (
                      <>
                        <div className="lp-strength-track">
                          <div
                            className="lp-strength-fill"
                            style={{width: `${strength.pct}%`, background: strength.color}}
                          />
                        </div>
                        <div
                          className="lp-strength-label"
                          style={{color: strength.pct > 0 ? strength.color : D.textMuted}}
                        >
                          {strength.label}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="lp-group">
                    <label className="lp-label">Confirm Password</label>
                    <input
                      className={`lp-input${confirmPw && confirmPw !== newPw ? ' has-error' : ''}`}
                      type={showNewPw ? 'text' : 'password'}
                      required placeholder="Repeat your password"
                      value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                    />
                    {confirmPw && confirmPw !== newPw && (
                      <div className="lp-field-error">Passwords don't match</div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="lp-btn purple"
                    disabled={loading || newPw.length < 8 || newPw !== confirmPw}
                  >
                    {loading && <span className="lp-spin"/>}
                    {loading ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              </div>
            )}

            {/* ════════ SUCCESS ════════ */}
            {screen === 'done' && (
              <div className="lp-screen" style={{textAlign: 'center'}}>
                <div className="lp-done-icon">✓</div>
                <div className="lp-card-title" style={{textAlign:'center',marginBottom:6}}>
                  Password updated!
                </div>
                <div className="lp-card-sub" style={{textAlign:'center',marginBottom:28}}>
                  Your administrator password has been reset successfully. Sign in with your new password.
                </div>
                <button
                  className="lp-btn"
                  onClick={() => { goTo('login'); setEmail(identifier); setPassword(''); setNewPw(''); setConfirmPw(''); setOtp(''); }}
                >
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

// ─── Re-export helper used inline above ───────────────────────────────────────
function passwordStrength(pw: string) {
  let s = 0;
  if (pw.length >= 8)            s++;
  if (pw.length >= 12)           s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { pct:  0, color: D.border,  label: '' },
    { pct: 20, color: D.red,     label: 'Very weak' },
    { pct: 40, color: D.amber,   label: 'Weak' },
    { pct: 60, color: D.amber,   label: 'Fair' },
    { pct: 80, color: D.green,   label: 'Strong' },
    { pct:100, color: D.green,   label: 'Very strong' },
  ];
  return map[Math.min(s, 5)];
}