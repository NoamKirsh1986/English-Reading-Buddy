import { useState } from 'react';

export default function OnboardingScreen({ onStart }) {
  const [name, setName] = useState(() => localStorage.getItem('childName') || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem('childName', trimmed);
    onStart(trimmed);
  };

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-avatar">
          <video
            src="https://res.cloudinary.com/ds9pmmsrv/video/upload/v1776263023/Lumee_-_talking_qitrdh.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
        </div>
        <h1>!Hi, I'm Lumee</h1>
        <p className="onboarding-subtitle">Your English teacher</p>
        <p className="onboarding-subtitle-he" dir="rtl">!היי, אני לומי — המורה שלך לאנגלית</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="child-name">What's your name? / ?מה השם שלך</label>
          <input
            id="child-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your name..."
            autoFocus
            autoComplete="off"
          />
          <button type="submit" disabled={!name.trim()}>
            !Let's start / !יאללה
          </button>
        </form>
      </div>
    </div>
  );
}
