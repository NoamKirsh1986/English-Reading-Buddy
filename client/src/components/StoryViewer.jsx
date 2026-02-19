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
  CONVERSATION: 'conversation',
  CONVERSATION_LISTENING: 'conversation_listening',
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
  const [pageImages, setPageImages] = useState(() =>
    story.pages.map((p) => p.imageUrl)
  );
  const [imageLoading, setImageLoading] = useState(false);

  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);
  const conversationHistoryRef = useRef([]);
  const conversationTurnRef = useRef(0);

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

  // Prefetch image for next page when current page loads
  useEffect(() => {
    const loadImage = async (pageIndex) => {
      if (pageIndex >= story.pages.length || pageImages[pageIndex]) return;
      try {
        const res = await fetch('/api/story/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: story.pages[pageIndex].text }),
        });
        const data = await res.json();
        if (data.imageUrl) {
          setPageImages((prev) => {
            const next = [...prev];
            next[pageIndex] = data.imageUrl;
            return next;
          });
        }
      } catch (err) {
        console.error('Image load error:', err);
      }
    };

    // Load current page image if missing
    if (!pageImages[currentPage]) {
      setImageLoading(true);
      loadImage(currentPage).finally(() => setImageLoading(false));
    }

    // Prefetch next page image in background
    const nextPage = currentPage + 1;
    if (nextPage < story.pages.length && !pageImages[nextPage]) {
      loadImage(nextPage);
    }
  }, [currentPage, story.pages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      stopRecording();
    };
  }, []);

  const resetPageState = () => {
    stopAudio();
    stopRecording();
    setFlowState(FLOW_STATES.IDLE);
    setSpokenText('');
    setWordResults(null);
    setTutorMessages([]);
    setPracticePhrase(null);
    setPracticeExplanation(null);
    setIsTutorSpeaking(false);
    conversationHistoryRef.current = [];
    conversationTurnRef.current = 0;
  };

  const addTutorMessage = (text) => {
    setTutorMessages((prev) => [...prev, { type: 'tutor', text }]);
  };

  // ===== Audio playback helpers =====
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

  // ===== Recording helpers (MediaRecorder for audio + Web Speech API for karaoke) =====
  const startRecording = async () => {
    audioChunksRef.current = [];

    // Start MediaRecorder for actual audio capture
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      alert('Please allow microphone access to use the reading feature.');
      return;
    }

    // Start Web Speech API for live karaoke text highlighting
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        let finalTranscript = '';
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
      };

      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          try {
            recognition.start();
          } catch (e) {
            // already stopped
          }
        }
      };

      try {
        recognition.start();
      } catch (e) {
        console.error('Failed to start recognition:', e);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch (e) {
        // already stopped
      }
    }

    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      recorder.stream?.getTracks().forEach((track) => track.stop());
    }
  };

  const getAudioBlob = () => {
    if (audioChunksRef.current.length === 0) return null;
    return new Blob(audioChunksRef.current, { type: 'audio/webm' });
  };

  // ===== Mic button handler =====
  const handleMicPress = async () => {
    if (flowState === FLOW_STATES.IDLE) {
      // Start reading
      setFlowState(FLOW_STATES.READING);
      setSpokenText('');
      setWordResults(null);
      await startRecording();
    } else if (flowState === FLOW_STATES.READING) {
      // Stop reading and analyze
      stopRecording();
      const audioBlob = getAudioBlob();
      setFlowState(FLOW_STATES.ANALYZING);
      await analyzeReading(audioBlob);
    } else if (flowState === FLOW_STATES.CHILD_PRACTICING) {
      // Stop practice recording and evaluate
      stopRecording();
      const audioBlob = getAudioBlob();
      setFlowState(FLOW_STATES.EVALUATING);
      await evaluatePractice(audioBlob);
    } else if (flowState === FLOW_STATES.CONVERSATION_LISTENING) {
      // Stop conversation recording and get tutor reply
      const transcript = spokenText;
      stopRecording();
      setFlowState(FLOW_STATES.CONVERSATION);
      await handleConversationTurn(transcript);
    } else if (flowState === FLOW_STATES.CONVERSATION) {
      // Child wants to speak during conversation - start listening
      stopAudio();
      setFlowState(FLOW_STATES.CONVERSATION_LISTENING);
      setSpokenText('');
      await startRecording();
    } else if (
      flowState === FLOW_STATES.TUTOR_FEEDBACK ||
      flowState === FLOW_STATES.TUTOR_PRACTICE ||
      flowState === FLOW_STATES.COMPLETE
    ) {
      // Child interrupts tutor - stop audio, start recording
      stopAudio();
      setFlowState(FLOW_STATES.CHILD_PRACTICING);
      setSpokenText('');
      await startRecording();
    }
  };

  // ===== Conversation turn handler =====
  const handleConversationTurn = async (childText) => {
    try {
      conversationHistoryRef.current.push({ role: 'child', text: childText });
      conversationTurnRef.current += 1;

      const res = await fetch('/api/voice/tutor-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childText,
          conversationHistory: conversationHistoryRef.current,
          pageText: page.text,
          nativeLanguage: language,
        }),
      });
      const data = await res.json();
      const reply = data.reply || 'Great job! Let\'s move to the next page!';

      conversationHistoryRef.current.push({ role: 'tutor', text: reply });
      addTutorMessage(reply);
      await playTTS(reply);

      // After 2-3 turns, move to practice or complete
      if (conversationTurnRef.current >= 2) {
        if (practicePhrase) {
          setFlowState(FLOW_STATES.TUTOR_PRACTICE);
          const practiceMsg = `Now try saying: "${practicePhrase}" - ${practiceExplanation || ''}`;
          addTutorMessage(practiceMsg);
          await playTTS(practiceMsg);
        } else {
          setFlowState(FLOW_STATES.COMPLETE);
        }
      } else {
        // Still in conversation - wait for child to press mic
        setFlowState(FLOW_STATES.CONVERSATION);
      }
    } catch (err) {
      console.error('Conversation error:', err);
      setFlowState(FLOW_STATES.COMPLETE);
      addTutorMessage('Great talking! Let\'s move to the next page!');
    }
  };

  // ===== Analyze reading =====
  const analyzeReading = async (audioBlob) => {
    try {
      if (!audioBlob) {
        setFlowState(FLOW_STATES.IDLE);
        addTutorMessage('I didn\'t hear anything. Press the mic and try reading again!');
        return;
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('originalText', page.text);
      formData.append('nativeLanguage', language);

      const res = await fetch('/api/voice/analyze-reading', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      setWordResults(data.wordResults || null);

      // Save practice info for later (after conversation)
      if (data.practicePhrase) {
        setPracticePhrase(data.practicePhrase);
        setPracticeExplanation(data.practiceExplanation);
      }

      // Step 1: Tutor reads sentence back and explains in native language
      if (data.feedback) {
        setFlowState(FLOW_STATES.TUTOR_FEEDBACK);
        addTutorMessage(data.feedback);
        await playTTS(data.feedback);
      }

      // Step 2: Ask follow-up question to start conversation
      if (data.followUpQuestion) {
        addTutorMessage(data.followUpQuestion);
        await playTTS(data.followUpQuestion);
        // Initialize conversation history
        conversationHistoryRef.current = [
          { role: 'tutor', text: data.feedback },
          { role: 'tutor', text: data.followUpQuestion },
        ];
        conversationTurnRef.current = 0;
        setFlowState(FLOW_STATES.CONVERSATION);
      } else if (data.practicePhrase) {
        // No follow-up question, go straight to practice
        setFlowState(FLOW_STATES.TUTOR_PRACTICE);
        const practiceMsg = `Now try saying: "${data.practicePhrase}" - ${data.practiceExplanation || ''}`;
        addTutorMessage(practiceMsg);
        await playTTS(practiceMsg);
      } else {
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
  const evaluatePractice = async (audioBlob) => {
    try {
      if (!audioBlob) {
        setFlowState(FLOW_STATES.TUTOR_PRACTICE);
        addTutorMessage('I didn\'t hear anything. Press the mic and try again!');
        return;
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('practicePhrase', practicePhrase);
      formData.append('nativeLanguage', language);

      const res = await fetch('/api/voice/evaluate-practice', {
        method: 'POST',
        body: formData,
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
    flowState === FLOW_STATES.CHILD_PRACTICING ||
    flowState === FLOW_STATES.CONVERSATION_LISTENING;

  const getMicLabel = () => {
    if (isMicActive) return 'Stop';
    if (flowState === FLOW_STATES.IDLE) return 'Read';
    if (flowState === FLOW_STATES.ANALYZING || flowState === FLOW_STATES.EVALUATING) return '...';
    if (flowState === FLOW_STATES.CONVERSATION) return 'Talk';
    if (flowState === FLOW_STATES.TUTOR_PRACTICE) return 'Speak';
    return 'Speak';
  };

  const isMicDisabled =
    flowState === FLOW_STATES.ANALYZING || flowState === FLOW_STATES.EVALUATING;

  // Filter messages to only show tutor messages in transcript
  const visibleMessages = tutorMessages.filter((msg) => msg.type === 'tutor');

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
            {pageImages[currentPage] ? (
              <div className="story-image-container">
                <img
                  src={pageImages[currentPage]}
                  alt="Story illustration"
                  className="story-image"
                />
              </div>
            ) : imageLoading ? (
              <div className="story-image-container">
                <div className="image-placeholder">Drawing picture...</div>
              </div>
            ) : null}

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
            {visibleMessages.length === 0 && (
              <div className="tutor-hint">
                Press the microphone to start reading!
              </div>
            )}
            {visibleMessages.map((msg, i) => (
              <div key={i} className="tutor-message panda-message">
                <span className="message-label">Panda</span>
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
            {flowState === FLOW_STATES.CONVERSATION && !isTutorSpeaking && (
              <div className="conversation-hint">Press mic to answer!</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoryViewer;
