import { useState, useEffect, useRef, useCallback } from 'react';
import KaraokeText from './KaraokeText';
import PandaTutor from './PandaTutor';

const FLOW_STATES = {
  IDLE: 'idle',
  READING: 'reading',
  ANALYZING: 'analyzing',
  TUTOR_FEEDBACK: 'tutor_feedback',
  TUTOR_PRACTICE: 'tutor_practice',
  CHILD_PRACTICING: 'child_practicing',
  EVALUATING: 'evaluating',
  COMPLETE: 'complete',
};

function StoryViewer({ story, language, onBack }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [flowState, setFlowState] = useState(FLOW_STATES.IDLE);
  const [spokenText, setSpokenText] = useState('');
  const [wordResults, setWordResults] = useState(null);
  const [tutorMessages, setTutorMessages] = useState([]);
  const [practicePhrase, setPracticePhrase] = useState(null);
  const [practiceExplanation, setPracticeExplanation] = useState(null);
  const [isTutorSpeaking, setIsTutorSpeaking] = useState(false);

  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  const page = story.pages[currentPage];
  const isLastPage = currentPage === story.pages.length - 1;
  const isFirstPage = currentPage === 0;

  // Auto-scroll tutor messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tutorMessages]);

  // Reset when page changes
  useEffect(() => {
    resetPageState();
  }, [currentPage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      stopRecognition();
    };
  }, []);

  const resetPageState = () => {
    stopAudio();
    stopRecognition();
    setFlowState(FLOW_STATES.IDLE);
    setSpokenText('');
    setWordResults(null);
    setTutorMessages([]);
    setPracticePhrase(null);
    setPracticeExplanation(null);
    setIsTutorSpeaking(false);
  };

  const addTutorMessage = (text) => {
    setTutorMessages((prev) => [...prev, { type: 'tutor', text }]);
  };

  const addChildMessage = (text) => {
    setTutorMessages((prev) => [...prev, { type: 'child', text }]);
  };

  // ===== Audio helpers =====
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsTutorSpeaking(false);
  };

  const playTTS = (text) => {
    return new Promise(async (resolve) => {
      try {
        setIsTutorSpeaking(true);
        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          setIsTutorSpeaking(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve('done');
        };
        audio.onerror = () => {
          setIsTutorSpeaking(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve('error');
        };
        await audio.play();
      } catch (err) {
        console.error('TTS error:', err);
        setIsTutorSpeaking(false);
        resolve('error');
      }
    });
  };

  // ===== Speech Recognition helpers =====
  const startRecognition = () => {
    return new Promise((resolve) => {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        resolve('');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      let finalTranscript = '';

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setSpokenText((finalTranscript + interim).trim());
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Please allow microphone access to use the reading feature.');
        }
      };

      recognition.onend = () => {
        // Auto-restart if still active
        if (recognitionRef.current === recognition) {
          try {
            recognition.start();
          } catch (e) {
            // already stopped
          }
        }
      };

      recognition._resolve = resolve;
      recognition._finalTranscript = () => finalTranscript;

      try {
        recognition.start();
      } catch (e) {
        console.error('Failed to start recognition:', e);
        resolve('');
      }
    });
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch (e) {
        // already stopped
      }
      if (recognition._resolve) {
        recognition._resolve(recognition._finalTranscript?.() || '');
        recognition._resolve = null;
      }
    }
  };

  // ===== Mic button handler =====
  const handleMicPress = async () => {
    if (flowState === FLOW_STATES.IDLE) {
      // Start reading
      setFlowState(FLOW_STATES.READING);
      setSpokenText('');
      setWordResults(null);
      startRecognition();
    } else if (flowState === FLOW_STATES.READING) {
      // Stop reading and analyze
      const transcript = spokenText;
      stopRecognition();
      setFlowState(FLOW_STATES.ANALYZING);
      addChildMessage(transcript || '(no speech detected)');
      await analyzeReading(transcript);
    } else if (flowState === FLOW_STATES.CHILD_PRACTICING) {
      // Stop practice recording and evaluate
      const transcript = spokenText;
      stopRecognition();
      setFlowState(FLOW_STATES.EVALUATING);
      addChildMessage(transcript || '(no speech detected)');
      await evaluatePractice(transcript);
    } else if (
      flowState === FLOW_STATES.TUTOR_FEEDBACK ||
      flowState === FLOW_STATES.TUTOR_PRACTICE ||
      flowState === FLOW_STATES.COMPLETE
    ) {
      // Child interrupts tutor - stop audio, start recording
      stopAudio();
      setFlowState(FLOW_STATES.CHILD_PRACTICING);
      setSpokenText('');
      startRecognition();
    }
  };

  // ===== Analyze reading =====
  const analyzeReading = async (transcript) => {
    try {
      const res = await fetch('/api/voice/analyze-reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: page.text,
          spokenText: transcript,
          nativeLanguage: language,
        }),
      });
      const data = await res.json();

      setWordResults(data.wordResults || null);

      // Step 1: Tutor feedback (reads sentence + explains)
      if (data.feedback) {
        setFlowState(FLOW_STATES.TUTOR_FEEDBACK);
        addTutorMessage(data.feedback);
        await playTTS(data.feedback);
      }

      // Step 2: Practice phrase (if there are incorrect words)
      if (data.practicePhrase) {
        setPracticePhrase(data.practicePhrase);
        setPracticeExplanation(data.practiceExplanation);
        setFlowState(FLOW_STATES.TUTOR_PRACTICE);
        const practiceMsg = `Now try saying: "${data.practicePhrase}" - ${data.practiceExplanation || ''}`;
        addTutorMessage(practiceMsg);
        await playTTS(practiceMsg);
        // Wait for child to press mic
      } else {
        // All correct - tell them to move on
        setFlowState(FLOW_STATES.COMPLETE);
        const doneMsg = isLastPage
          ? 'Amazing! You finished the whole story! Great reading!'
          : 'Great reading! Move to the next page when you are ready!';
        addTutorMessage(doneMsg);
        await playTTS(doneMsg);
      }
    } catch (err) {
      console.error('Analyze error:', err);
      setFlowState(FLOW_STATES.IDLE);
      addTutorMessage('Oops, something went wrong. Try reading again!');
    }
  };

  // ===== Evaluate practice =====
  const evaluatePractice = async (transcript) => {
    try {
      const res = await fetch('/api/voice/evaluate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practicePhrase,
          spokenText: transcript,
          nativeLanguage: language,
        }),
      });
      const data = await res.json();

      setFlowState(FLOW_STATES.COMPLETE);
      const msg = data.message || 'Good job! Move to the next page!';
      addTutorMessage(msg);
      await playTTS(msg);
    } catch (err) {
      console.error('Evaluate error:', err);
      setFlowState(FLOW_STATES.COMPLETE);
      addTutorMessage('Good try! Move to the next page when ready!');
    }
  };

  // ===== Navigation =====
  const handleNextPage = () => {
    if (!isLastPage) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (!isFirstPage) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // ===== Mic button state =====
  const isMicActive =
    flowState === FLOW_STATES.READING ||
    flowState === FLOW_STATES.CHILD_PRACTICING;

  const getMicLabel = () => {
    if (isMicActive) return 'Stop';
    if (flowState === FLOW_STATES.IDLE) return 'Read';
    if (flowState === FLOW_STATES.ANALYZING || flowState === FLOW_STATES.EVALUATING) return '...';
    if (flowState === FLOW_STATES.TUTOR_PRACTICE) return 'Speak';
    return 'Speak';
  };

  const isMicDisabled =
    flowState === FLOW_STATES.ANALYZING || flowState === FLOW_STATES.EVALUATING;

  return (
    <div className="story-viewer">
      <div className="story-controls-top">
        <button className="back-btn" onClick={onBack}>
          New Story
        </button>
        <span className="page-indicator">
          Page {currentPage + 1} of {story.pages.length}
        </span>
      </div>

      <div className="split-layout">
        {/* Left side: Book */}
        <div className="book-panel">
          <div className="story-content">
            {page.imageUrl && (
              <div className="story-image-container">
                <img
                  src={page.imageUrl}
                  alt="Story illustration"
                  className="story-image"
                />
              </div>
            )}

            <KaraokeText
              text={page.text}
              isReading={flowState === FLOW_STATES.READING}
              spokenText={spokenText}
              wordResults={wordResults}
            />
          </div>

          <div className="page-navigation">
            <button
              className="nav-btn prev-btn"
              onClick={handlePrevPage}
              disabled={isFirstPage}
            >
              Previous
            </button>
            <button
              className="nav-btn next-btn"
              onClick={handleNextPage}
              disabled={isLastPage}
            >
              {isLastPage ? 'The End!' : 'Next Page'}
            </button>
          </div>
        </div>

        {/* Right side: Tutor panel */}
        <div className="tutor-panel">
          <PandaTutor
            isTalking={isTutorSpeaking}
            isListening={isMicActive}
          />

          <div className="tutor-messages">
            {tutorMessages.length === 0 && (
              <div className="tutor-hint">
                Press the microphone to start reading!
              </div>
            )}
            {tutorMessages.map((msg, i) => (
              <div
                key={i}
                className={`tutor-message ${msg.type === 'child' ? 'child-message' : 'panda-message'}`}
              >
                <span className="message-label">
                  {msg.type === 'child' ? 'You' : 'Panda'}
                </span>
                <p>{msg.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="mic-area">
            <button
              className={`mic-btn ${isMicActive ? 'mic-active' : ''}`}
              onClick={handleMicPress}
              disabled={isMicDisabled}
            >
              <svg viewBox="0 0 24 24" className="mic-icon" fill="currentColor">
                {isMicActive ? (
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                ) : (
                  <>
                    <path d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z" />
                    <path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V23h2v-3.06A9 9 0 0 0 21 11h-2z" />
                  </>
                )}
              </svg>
              <span className="mic-label">{getMicLabel()}</span>
            </button>
            {isMicActive && (
              <div className="recording-indicator">Listening...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoryViewer;
