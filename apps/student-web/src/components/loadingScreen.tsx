import React from 'react';

const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');

@keyframes pulse-ring {
  0%   { transform: translate(-50%,-50%) scale(.85); opacity:.6; }
  50%  { transform: translate(-50%,-50%) scale(1.05); opacity:.15; }
  100% { transform: translate(-50%,-50%) scale(.85); opacity:.6; }
}
@keyframes spin {
  to { transform: translate(-50%,-50%) rotate(360deg); }
}
@keyframes float {
  0%,100% { transform: translateY(0);   }
  50%      { transform: translateY(-8px); }
}
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(250%);  }
}
@keyframes fadeUp {
  from { opacity:0; transform:translateY(16px); }
  to   { opacity:1; transform:translateY(0);    }
}
@keyframes dot-bounce {
  0%,80%,100% { transform:translateY(0);    opacity:.3; }
  40%          { transform:translateY(-6px); opacity:1;  }
}
@keyframes grid-pan {
  from { background-position: 0 0; }
  to   { background-position: 28px 28px; }
}

.ls-page {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  background: #F9FAFB;
  background-image: radial-gradient(circle, #E5E7EB 1px, transparent 1px);
  background-size: 28px 28px;
  animation: grid-pan 2s linear infinite;
  font-family: 'DM Sans', sans-serif;
  overflow: hidden;
}

/* ambient blobs */
.ls-blob1 {
  position: absolute; top: -180px; right: -180px;
  width: 560px; height: 560px; border-radius: 50%;
  background: radial-gradient(circle, rgba(124,58,237,.14) 0%, transparent 68%);
  pointer-events: none;
}
.ls-blob2 {
  position: absolute; bottom: -120px; left: -140px;
  width: 440px; height: 440px; border-radius: 50%;
  background: radial-gradient(circle, rgba(16,185,129,.09) 0%, transparent 68%);
  pointer-events: none;
}
.ls-blob3 {
  position: absolute; top: 40%; left: 50%;
  transform: translate(-50%,-50%);
  width: 320px; height: 320px; border-radius: 50%;
  background: radial-gradient(circle, rgba(124,58,237,.06) 0%, transparent 70%);
  pointer-events: none;
}

/* card */
.ls-card {
  position: relative; z-index: 1;
  background: #fff;
  border: 1px solid #E5E7EB;
  border-radius: 28px;
  padding: 48px 52px 40px;
  display: flex; flex-direction: column; align-items: center;
  box-shadow:
    0 1px 3px rgba(0,0,0,.06),
    0 20px 60px rgba(124,58,237,.08),
    0 0 0 1px rgba(124,58,237,.06);
  animation: fadeUp .5s ease both;
  min-width: 320px;
}

/* icon stack */
.ls-icon-wrap {
  position: relative;
  width: 96px; height: 96px;
  margin-bottom: 32px;
}

/* outer pulse ring */
.ls-ring-pulse {
  position: absolute; top: 50%; left: 50%;
  width: 110px; height: 110px; border-radius: 50%;
  background: rgba(124,58,237,.10);
  animation: pulse-ring 2.4s ease-in-out infinite;
}

/* spinner arc */
.ls-ring-spin {
  position: absolute; top: 50%; left: 50%;
  width: 96px; height: 96px; border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: #7C3AED;
  border-right-color: #A78BFA;
  transform: translate(-50%,-50%);
  animation: spin .9s linear infinite;
}

/* icon background */
.ls-icon-bg {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  width: 72px; height: 72px; border-radius: 20px;
  background: linear-gradient(135deg, #EDE9FE, #DBEAFE);
  border: 1px solid rgba(124,58,237,.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 32px;
  animation: float 3s ease-in-out infinite;
  box-shadow: 0 4px 20px rgba(124,58,237,.15);
}

/* text */
.ls-title {
  font-family: 'Syne', sans-serif;
  font-size: 22px; font-weight: 800;
  color: #111827; letter-spacing: -.5px;
  margin: 0 0 4px; line-height: 1;
}
.ls-sub {
  font-size: 13px; font-weight: 500;
  color: #9CA3AF; margin: 0 0 28px;
  letter-spacing: .02em;
}

/* progress */
.ls-track {
  width: 160px; height: 4px;
  background: #F3F4F6; border-radius: 99px;
  overflow: hidden; position: relative;
  margin-bottom: 20px;
}
.ls-fill {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, #7C3AED, #A78BFA, #7C3AED);
  background-size: 200% 100%;
  border-radius: 99px;
  animation: shimmer 1.8s linear infinite;
}

/* dots */
.ls-dots {
  display: flex; gap: 6px; align-items: center;
}
.ls-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #7C3AED;
  animation: dot-bounce 1.2s ease-in-out infinite;
}
.ls-dot:nth-child(2) { animation-delay:.15s; }
.ls-dot:nth-child(3) { animation-delay:.30s; }

/* version badge */
.ls-badge {
  position: absolute; bottom: -44px;
  display: flex; align-items: center; gap: 6px;
  font-family: 'DM Sans', sans-serif;
  font-size: 11px; font-weight: 500;
  color: #9CA3AF; letter-spacing: .04em;
  white-space: nowrap;
}
.ls-badge-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 0 2px rgba(16,185,129,.25);
}
`;

export function LoadingScreen() {
  return (
    <>
      <style>{css}</style>
      <div className="ls-page">
        <div className="ls-blob1" />
        <div className="ls-blob2" />
        <div className="ls-blob3" />

        <div className="ls-card">
          {/* Animated icon */}
          <div className="ls-icon-wrap">
            <div className="ls-ring-pulse" />
            <div className="ls-ring-spin"  />
            <div className="ls-icon-bg">🎓</div>
          </div>

          {/* Text */}
          <h2 className="ls-title">SmartAttend</h2>
          <p className="ls-sub">Verifying session…</p>

          {/* Progress bar */}
          <div className="ls-track">
            <div className="ls-fill" />
          </div>

          {/* Bouncing dots */}
          <div className="ls-dots">
            <div className="ls-dot" />
            <div className="ls-dot" />
            <div className="ls-dot" />
          </div>

          {/* Version / status badge */}
          <div className="ls-badge">
            <div className="ls-badge-dot" />
            Secure · Admin Portal
          </div>
        </div>
      </div>
    </>
  );
}