export default function TopBar({ title, timeLeft, onSkip, onPause, onFullscreen }) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="top-bar">
      <h2 className="top-bar-title">{title}</h2>
      <div className="top-bar-controls">
        <span className="timer">{timeStr}</span>
        <button className="top-btn" onClick={onSkip} title="Skip to quiz">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
          </svg>
        </button>
        <button className="top-btn" onClick={onPause} title="End lesson">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h12v12H6z" />
          </svg>
        </button>
        <button className="top-btn" onClick={onFullscreen} title="Fullscreen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
