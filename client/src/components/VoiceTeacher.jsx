import { useState, useEffect } from 'react';

function VoiceTeacher({ originalText, spokenText, isReadingComplete, language }) {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (isReadingComplete && spokenText) {
      getFeedback();
    }
  }, [isReadingComplete]);

  useEffect(() => {
    setFeedback(null);
  }, [originalText]);

  const getFeedback = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/voice/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText,
          spokenText,
          nativeLanguage: language,
        }),
      });
      const data = await res.json();
      setFeedback(data.feedback);
      playFeedback(data.feedback);
    } catch (err) {
      setFeedback('Could not get feedback right now.');
    } finally {
      setLoading(false);
    }
  };

  const playFeedback = async (text) => {
    try {
      setIsPlaying(true);
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err) {
      console.error('TTS playback error:', err);
      setIsPlaying(false);
    }
  };

  if (!feedback && !loading) return null;

  return (
    <div className="voice-teacher">
      <div className="teacher-header">
        <span className="teacher-icon">Teacher</span>
        {isPlaying && <span className="speaking-indicator">Speaking...</span>}
      </div>

      {loading ? (
        <p className="teacher-loading">Checking your reading...</p>
      ) : (
        <>
          <p className="teacher-feedback">{feedback}</p>
          <button
            className="replay-btn"
            onClick={() => playFeedback(feedback)}
            disabled={isPlaying}
          >
            {isPlaying ? 'Playing...' : 'Hear Again'}
          </button>
        </>
      )}
    </div>
  );
}

export default VoiceTeacher;
