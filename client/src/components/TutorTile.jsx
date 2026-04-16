import { useRef, useEffect } from 'react';

const IDLE_VIDEO = 'https://res.cloudinary.com/ds9pmmsrv/video/upload/v1776263023/Lumee_-_listening_gpocde.mp4';
const TALKING_VIDEO = 'https://res.cloudinary.com/ds9pmmsrv/video/upload/v1776263023/Lumee_-_talking_qitrdh.mp4';

export default function TutorTile({ isSpeaking }) {
  const idleRef = useRef(null);
  const talkingRef = useRef(null);

  useEffect(() => {
    [idleRef, talkingRef].forEach((ref) => {
      if (ref.current) {
        ref.current.play().catch(() => {});
      }
    });
  }, []);

  return (
    <div className="tile tutor-tile">
      <span className="tile-label">LUMEE</span>
      <video
        ref={idleRef}
        src={IDLE_VIDEO}
        loop
        muted
        playsInline
        className={`tutor-video ${!isSpeaking ? 'visible' : ''}`}
      />
      <video
        ref={talkingRef}
        src={TALKING_VIDEO}
        loop
        muted
        playsInline
        className={`tutor-video ${isSpeaking ? 'visible' : ''}`}
      />
      <span className={`status-badge ${isSpeaking ? 'speaking' : 'listening'}`}>
        {isSpeaking ? (
          <>
            <span className="badge-dots"><span /><span /><span /></span>
            מדברת
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2" /><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" /></svg>
            מקשיבה
          </>
        )}
      </span>
    </div>
  );
}
