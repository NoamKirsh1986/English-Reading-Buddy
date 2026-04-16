import { useRef, useEffect } from 'react';

const IDLE_VIDEO = 'https://res.cloudinary.com/ds9pmmsrv/video/upload/v1776263023/Lumee_-_listening_gpocde.mp4';
const TALKING_VIDEO = 'https://res.cloudinary.com/ds9pmmsrv/video/upload/v1776263023/Lumee_-_talking_qitrdh.mp4';

export default function TutorTile({ isSpeaking }) {
  const idleRef = useRef(null);
  const talkingRef = useRef(null);

  useEffect(() => {
    // Preload both videos
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
      {isSpeaking && (
        <span className="speaking-indicator">
          <span className="dot" /><span className="dot" /><span className="dot" />
        </span>
      )}
    </div>
  );
}
