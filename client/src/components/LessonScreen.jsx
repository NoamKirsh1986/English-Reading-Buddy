import { useState, useEffect, useRef, useCallback } from 'react';
import TopBar from './TopBar';
import TutorTile from './TutorTile';
import ChildTile from './ChildTile';
import SubtitleBar from './SubtitleBar';
import useRealtimeSession from '../hooks/useRealtimeSession';

const CONVERSATION_SECONDS = 5 * 60;

export default function LessonScreen({ childName, onConversationEnd, onExit }) {
  const {
    connect,
    disconnect,
    sendWrapUp,
    toggleMute,
    isConnected,
    isTutorSpeaking,
    isMuted,
    currentSubtitle,
    transcript,
  } = useRealtimeSession();

  const [timeLeft, setTimeLeft] = useState(CONVERSATION_SECONDS);
  const [videoStream, setVideoStream] = useState(null);
  const [error, setError] = useState(null);
  const [isWrappingUp, setIsWrappingUp] = useState(false);
  const timerRef = useRef(null);
  const hasWrappedUpRef = useRef(false);
  const wrapUpDoneTimerRef = useRef(null);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // When timer hits 0, trigger wrap-up
  useEffect(() => {
    if (timeLeft === 0 && !hasWrappedUpRef.current) {
      hasWrappedUpRef.current = true;
      setIsWrappingUp(true);
      sendWrapUp();

      // Give Lumee 15s to finish her wrap-up, then auto-transition
      wrapUpDoneTimerRef.current = setTimeout(() => {
        disconnect();
        onConversationEnd(transcript);
      }, 15000);
    }
  }, [timeLeft, sendWrapUp, disconnect, onConversationEnd, transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wrapUpDoneTimerRef.current) clearTimeout(wrapUpDoneTimerRef.current);
      disconnect();
      if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: { sampleRate: 24000, channelCount: 1 },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Split: video track for display, audio-only stream for Realtime API
        const videoOnlyStream = new MediaStream(stream.getVideoTracks());
        setVideoStream(videoOnlyStream);

        const audioStream = new MediaStream(stream.getAudioTracks());
        await connect(childName, audioStream);
        startTimer();
      } catch (err) {
        console.error('Init error:', err);

        // Try audio-only if video fails
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: { sampleRate: 24000, channelCount: 1 },
          });
          if (cancelled) {
            audioStream.getTracks().forEach((t) => t.stop());
            return;
          }
          await connect(childName, audioStream);
          startTimer();
        } catch (audioErr) {
          if (!cancelled) {
            setError('Could not access microphone. Please allow mic access and try again.');
          }
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkip = useCallback(() => {
    if (hasWrappedUpRef.current) return;
    hasWrappedUpRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsWrappingUp(true);

    sendWrapUp();
    // Give Lumee 8s to say goodbye, then transition
    wrapUpDoneTimerRef.current = setTimeout(() => {
      disconnect();
      onConversationEnd(transcript);
    }, 8000);
  }, [sendWrapUp, disconnect, onConversationEnd, transcript]);

  const handlePause = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (wrapUpDoneTimerRef.current) clearTimeout(wrapUpDoneTimerRef.current);
    disconnect();
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop());
    }
    onExit();
  }, [disconnect, videoStream, onExit]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  if (error) {
    return (
      <div className="lesson-screen">
        <div className="lesson-error">
          <p>{error}</p>
          <button onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-screen">
      <TopBar
        title="Me and My Family \u00B7 \u05D0\u05E0\u05D9 \u05D5\u05D4\u05DE\u05E9\u05E4\u05D7\u05D4 \u05E9\u05DC\u05D9"
        timeLeft={timeLeft}
        onSkip={handleSkip}
        onPause={handlePause}
        onFullscreen={handleFullscreen}
      />

      {!isConnected && !error && (
        <div className="connecting-overlay">
          <div className="spinner" />
          <p>Connecting to Lumee...</p>
        </div>
      )}

      <div className="video-call-layout">
        <TutorTile isSpeaking={isTutorSpeaking} />
        <ChildTile
          childName={childName}
          videoStream={videoStream}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />
      </div>

      <SubtitleBar text={currentSubtitle} />

      {isWrappingUp && (
        <div className="wrapping-banner">Finishing up...</div>
      )}
    </div>
  );
}
