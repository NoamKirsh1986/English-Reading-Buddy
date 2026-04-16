import { useRef, useEffect } from 'react';

export default function ChildTile({ childName, videoStream, isMuted, onToggleMute }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  return (
    <div className="tile child-tile">
      <span className="tile-label">{childName.toUpperCase()}</span>
      {videoStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="child-video"
        />
      ) : (
        <div className="child-placeholder">
          <span className="placeholder-icon">&#128103;</span>
        </div>
      )}
      <button
        className={`mic-button ${isMuted ? 'muted' : ''}`}
        onClick={onToggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.36 2.18" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
    </div>
  );
}
