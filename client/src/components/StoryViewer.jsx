import { useState, useEffect, useRef } from 'react';
import PandaTutor from './PandaTutor';

const FLOW_STATES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  READING: 'reading',
  PROCESSING: 'processing',
  FEEDBACK: 'feedback',
};

function StoryViewer({ story, language, onBack }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [flowState, setFlowState] = useState(FLOW_STATES.IDLE);
  const [incorrectWords, setIncorrectWords] = useState([]);
  const [shouldRetry, setShouldRetry] = useState(false);
  const [tutorMessages, setTutorMessages] = useState([]);
  const [isTutorSpeaking, setIsTutorSpeaking] = useState(false);
  const [pageImages, setPageImages] = useState(() =>
    story.pages.map((p) => p.imageUrl)
  );
  const [imageLoading, setImageLoading] = useState(false);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const playbackContextRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const currentSourcesRef = useRef([]);
  const messagesEndRef = useRef(null);
  const functionCallArgsRef = useRef('');
  const eventHandlerRef = useRef(null);

  const page = story.pages[currentPage];
  const isLastPage = currentPage === story.pages.length - 1;
  const isFirstPage = currentPage === 0;

  // Keep the event handler ref up to date so WebSocket always calls the latest version
  eventHandlerRef.current = (event) => {
    handleRealtimeEvent(event);
  };

  // Auto-scroll tutor messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tutorMessages]);

  // Reset when page changes
  useEffect(() => {
    resetPageState();
  }, [currentPage]);

  // Prefetch images
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

    if (!pageImages[currentPage]) {
      setImageLoading(true);
      loadImage(currentPage).finally(() => setImageLoading(false));
    }

    const nextPage = currentPage + 1;
    if (nextPage < story.pages.length && !pageImages[nextPage]) {
      loadImage(nextPage);
    }
  }, [currentPage, story.pages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectRealtime();
      stopMicCapture();
    };
  }, []);

  const resetPageState = () => {
    stopMicCapture();
    stopPlayback();
    setFlowState(FLOW_STATES.IDLE);
    setIncorrectWords([]);
    setShouldRetry(false);
    setTutorMessages([]);
    setIsTutorSpeaking(false);
    functionCallArgsRef.current = '';
  };

  const addTutorMessage = (text) => {
    setTutorMessages((prev) => [...prev, { type: 'tutor', text }]);
  };

  // ===== WebSocket connection to Realtime API (via server proxy) =====
  const connectRealtime = () => {
    return new Promise((resolve, reject) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // Close stale connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/realtime`;
      console.log('Connecting to Realtime API via', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      let resolved = false;

      // Timeout if session.created never arrives
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error('Realtime API connection timed out');
          ws.close();
          wsRef.current = null;
          reject(new Error('Connection timed out'));
        }
      }, 15000);

      ws.onopen = () => {
        console.log('WebSocket connected to server proxy');
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          console.error('Failed to parse WS message:', event.data);
          return;
        }

        console.log('Realtime event:', data.type);

        // Resolve the promise when session is created
        if (data.type === 'session.created' && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }

        // Delegate to the latest handler via ref
        eventHandlerRef.current?.(data);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          wsRef.current = null;
          reject(new Error('WebSocket connection failed'));
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected, code:', event.code, 'reason:', event.reason);
        wsRef.current = null;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error('WebSocket closed before session created'));
        }
      };
    });
  };

  const disconnectRealtime = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendEvent = (event) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  };

  // Configure session for current page
  const configureSession = (pageText) => {
    sendEvent({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: `You are "Panda Buddy", a warm, friendly, and encouraging English reading tutor for children who speak ${language}.

The child is going to read this sentence aloud: "${pageText}"

YOUR TASK:
1. Listen to the child read the sentence without interrupting.
2. When the child finishes, FIRST call the provide_reading_feedback function to report which specific words were mispronounced, skipped, or read incorrectly. Compare what you heard to the expected sentence carefully.
3. THEN speak your feedback:
   a. Read the full sentence slowly and clearly in English so the child hears correct pronunciation.
   b. Explain in ${language} what the sentence means.
   c. If words were incorrect, mention them gently in ${language} and encourage the child to try reading again.
   d. If the reading was perfect, praise the child enthusiastically and tell them to move to the next page.

Keep your spoken response concise and warm (3-5 sentences). Mix English and ${language}.`,
        tools: [
          {
            type: 'function',
            name: 'provide_reading_feedback',
            description:
              'Report which words from the sentence the child read incorrectly, mispronounced, or skipped',
            parameters: {
              type: 'object',
              properties: {
                incorrect_words: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'The specific words from the original sentence that were mispronounced or skipped. Use the exact words as they appear in the sentence.',
                },
                should_retry: {
                  type: 'boolean',
                  description:
                    'true if the child should try reading the sentence again, false if reading was good enough',
                },
              },
              required: ['incorrect_words', 'should_retry'],
            },
          },
        ],
        tool_choice: 'auto',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: null,
      },
    });
  };

  // ===== Handle events from Realtime API =====
  const handleRealtimeEvent = (event) => {
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        break;

      case 'response.audio.delta':
        if (event.delta) {
          setIsTutorSpeaking(true);
          playAudioChunk(event.delta);
        }
        break;

      case 'response.audio_transcript.done':
        if (event.transcript) {
          addTutorMessage(event.transcript);
        }
        break;

      case 'response.function_call_arguments.delta':
        functionCallArgsRef.current += event.delta || '';
        break;

      case 'response.function_call_arguments.done': {
        try {
          const args = JSON.parse(
            event.arguments || functionCallArgsRef.current
          );
          console.log('Reading feedback:', args);

          if (args.incorrect_words && args.incorrect_words.length > 0) {
            setIncorrectWords(
              args.incorrect_words.map((w) => w.toLowerCase())
            );
            setShouldRetry(args.should_retry ?? true);
          } else {
            setIncorrectWords([]);
            setShouldRetry(false);
          }
        } catch (err) {
          console.error('Failed to parse function call args:', err);
        }
        break;
      }

      case 'response.output_item.done':
        // When the function call item is done, send the result and trigger audio response
        if (event.item?.type === 'function_call') {
          sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: event.item.call_id,
              output: JSON.stringify({ status: 'ok' }),
            },
          });
          // Reset args for next function call
          functionCallArgsRef.current = '';
          // Trigger the audio feedback response
          sendEvent({ type: 'response.create' });
        }
        break;

      case 'response.done': {
        const outputs = event.response?.output || [];
        const hasAudio = outputs.some((item) => item.type === 'message');
        const hasFunctionCall = outputs.some((item) => item.type === 'function_call');

        // If it has audio (with or without function call), transition to FEEDBACK
        if (hasAudio) {
          setFlowState(FLOW_STATES.FEEDBACK);
          setTimeout(() => {
            setIsTutorSpeaking(false);
          }, 1500);
        }
        // If it ONLY has a function call (no audio yet), the output_item.done handler
        // already triggered the next response — just wait for audio
        if (!hasAudio && !hasFunctionCall && event.response?.status === 'completed') {
          // Empty response — transition to feedback anyway
          setFlowState(FLOW_STATES.FEEDBACK);
          setIsTutorSpeaking(false);
        }
        break;
      }

      case 'error':
        console.error('Realtime API error:', JSON.stringify(event.error, null, 2));
        // Only reset to IDLE for fatal errors, not transient ones
        if (event.error?.code === 'session_expired' || event.error?.code === 'invalid_api_key') {
          setFlowState(FLOW_STATES.IDLE);
          addTutorMessage('Connection lost. Please try again!');
          stopMicCapture();
        }
        break;

      default:
        break;
    }
  };

  // ===== Audio capture: stream PCM 16-bit 24kHz mono to Realtime API =====
  const startMicCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 24000 },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        // Base64 encode
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        sendEvent({
          type: 'input_audio_buffer.append',
          audio: base64,
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.error('Failed to start mic:', err);
      alert('Please allow microphone access to use the reading feature.');
      throw err;
    }
  };

  const stopMicCapture = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // ===== Audio playback: stream PCM 16-bit 24kHz from Realtime API =====
  const getPlaybackContext = () => {
    if (
      !playbackContextRef.current ||
      playbackContextRef.current.state === 'closed'
    ) {
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextPlayTimeRef.current = 0;
    }
    return playbackContextRef.current;
  };

  const playAudioChunk = (base64Audio) => {
    const ctx = getPlaybackContext();

    // Decode base64 to Int16
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);

    // Convert Int16 to Float32
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    // Create AudioBuffer and schedule playback
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (nextPlayTimeRef.current < now) {
      nextPlayTimeRef.current = now + 0.05;
    }
    source.start(nextPlayTimeRef.current);
    currentSourcesRef.current.push(source);
    nextPlayTimeRef.current += buffer.duration;

    source.onended = () => {
      currentSourcesRef.current = currentSourcesRef.current.filter(
        (s) => s !== source
      );
    };
  };

  const stopPlayback = () => {
    currentSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {
        /* already stopped */
      }
    });
    currentSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    if (
      playbackContextRef.current &&
      playbackContextRef.current.state !== 'closed'
    ) {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }
    setIsTutorSpeaking(false);
  };

  // ===== Main mic button handler =====
  const handleMicPress = async () => {
    if (
      flowState === FLOW_STATES.IDLE ||
      flowState === FLOW_STATES.FEEDBACK
    ) {
      // Start reading (or retry)
      try {
        setFlowState(FLOW_STATES.CONNECTING);
        stopPlayback();
        setTutorMessages([]);
        setIncorrectWords([]);
        setShouldRetry(false);
        functionCallArgsRef.current = '';

        // Connect (or reuse connection) to Realtime API
        await connectRealtime();

        // Configure session with current page text
        configureSession(page.text);

        // Brief delay to ensure session update is processed
        await new Promise((r) => setTimeout(r, 300));

        // Start capturing mic audio
        await startMicCapture();
        setFlowState(FLOW_STATES.READING);
      } catch (err) {
        console.error('Failed to start reading:', err);
        setFlowState(FLOW_STATES.IDLE);
        addTutorMessage(`Could not connect to the tutor: ${err.message}. Please restart the server and try again.`);
      }
    } else if (flowState === FLOW_STATES.READING) {
      // Child is done reading — stop mic, commit audio, request response
      stopMicCapture();
      setFlowState(FLOW_STATES.PROCESSING);

      sendEvent({ type: 'input_audio_buffer.commit' });
      sendEvent({ type: 'response.create' });
    }
  };

  // ===== Navigation =====
  const handleNextPage = () => {
    if (!isLastPage) {
      disconnectRealtime();
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (!isFirstPage) {
      disconnectRealtime();
      setCurrentPage((prev) => prev - 1);
    }
  };

  // ===== Mic button state =====
  const isMicActive = flowState === FLOW_STATES.READING;

  const getMicLabel = () => {
    if (flowState === FLOW_STATES.READING) return 'Done';
    if (
      flowState === FLOW_STATES.CONNECTING ||
      flowState === FLOW_STATES.PROCESSING
    )
      return '...';
    if (flowState === FLOW_STATES.FEEDBACK && shouldRetry) return 'Try Again';
    return 'Read';
  };

  const isMicDisabled =
    flowState === FLOW_STATES.CONNECTING ||
    flowState === FLOW_STATES.PROCESSING;

  // ===== Render sentence with incorrect word highlighting =====
  const renderSentence = () => {
    const words = page.text.split(/\s+/);
    return (
      <div className="sentence-container">
        <div className="sentence-text">
          {words.map((word, index) => {
            const cleanWord = word.replace(/[^a-zA-Z']/g, '').toLowerCase();
            const isIncorrect = incorrectWords.includes(cleanWord);
            return (
              <span
                key={index}
                className={`sentence-word ${isIncorrect ? 'word-highlight' : ''}`}
              >
                {word}{' '}
              </span>
            );
          })}
        </div>
        {flowState === FLOW_STATES.READING && (
          <p className="reading-hint">Reading... press Done when finished</p>
        )}
      </div>
    );
  };

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

            {renderSentence()}
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
              <svg
                viewBox="0 0 24 24"
                className="mic-icon"
                fill="currentColor"
              >
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
            {flowState === FLOW_STATES.PROCESSING && (
              <div className="processing-indicator">Thinking...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoryViewer;
