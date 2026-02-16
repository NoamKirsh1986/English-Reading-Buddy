import { useState, useEffect, useRef, useCallback } from 'react';

const TUTOR_STATES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  LISTENING: 'listening',
  SPEAKING: 'speaking',
  CELEBRATING: 'celebrating',
  ERROR: 'error',
};

function BearTutor({ pageText, language, isReading, isReadingComplete, onTutorSpeaking, onTutorTranscript }) {
  const [tutorState, setTutorState] = useState(TUTOR_STATES.IDLE);
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const readingCompleteHandled = useRef(false);
  const pageTextRef = useRef(pageText);
  const streamingTranscriptRef = useRef('');
  const onTutorTranscriptRef = useRef(onTutorTranscript);

  // Keep refs current
  useEffect(() => {
    pageTextRef.current = pageText;
  }, [pageText]);

  useEffect(() => {
    onTutorTranscriptRef.current = onTutorTranscript;
  }, [onTutorTranscript]);

  // Connect to Realtime API when reading starts
  useEffect(() => {
    if (isReading && !connected) {
      connectRealtime();
    }
    if (!isReading && !isReadingComplete) {
      // Reading was stopped (not completed) — disconnect
      disconnectRealtime();
    }
  }, [isReading]);

  // Handle reading complete — tell the bear to do the readback
  useEffect(() => {
    if (isReadingComplete && !readingCompleteHandled.current && dcRef.current?.readyState === 'open') {
      readingCompleteHandled.current = true;
      sendReadingComplete();
    }
  }, [isReadingComplete]);

  // Reset when page text changes
  useEffect(() => {
    readingCompleteHandled.current = false;
    setMessages([]);
    disconnectRealtime();
    setTutorState(TUTOR_STATES.IDLE);
  }, [pageText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectRealtime();
    };
  }, []);

  const connectRealtime = async () => {
    setTutorState(TUTOR_STATES.CONNECTING);
    setMessages([]);

    try {
      // 1. Get ephemeral token from our server
      const tokenRes = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageText: pageTextRef.current,
          nativeLanguage: language,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || 'Failed to create session');
      }

      const { ephemeralToken } = await tokenRes.json();

      if (!ephemeralToken) {
        throw new Error('No ephemeral token received');
      }

      // 2. Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 3. Set up audio output (bear's voice)
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioRef.current = audioEl;

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
      };

      // 4. Get microphone and add audio track
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 5. Create data channel for events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setConnected(true);
        setTutorState(TUTOR_STATES.LISTENING);
        addMessage("Hi there! I'm Buddy Bear. Start reading and I'll help you!", 'tutor');
      };

      dc.onmessage = (event) => {
        handleRealtimeEvent(JSON.parse(event.data));
      };

      dc.onclose = () => {
        setConnected(false);
      };

      // 6. Create SDP offer and connect to OpenAI
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ephemeralToken}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpResponse.ok) {
        throw new Error(`WebRTC handshake failed: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch (error) {
      console.error('Realtime connection error:', error);
      setTutorState(TUTOR_STATES.ERROR);
      addMessage('Having trouble connecting. The bear tutor needs microphone access!', 'error');
    }
  };

  const disconnectRealtime = () => {
    if (dcRef.current) {
      try { dcRef.current.close(); } catch (e) { /* ignore */ }
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) { /* ignore */ }
      pcRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    setConnected(false);
  };

  const handleRealtimeEvent = useCallback((event) => {
    switch (event.type) {
      case 'response.audio_transcript.delta':
        // Bear is speaking — accumulate transcript
        streamingTranscriptRef.current += (event.delta || '');
        // Send transcript to parent for karaoke highlighting during readback
        if (readingCompleteHandled.current) {
          onTutorTranscriptRef.current?.(streamingTranscriptRef.current);
        }
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'tutor-streaming') {
            return [
              ...prev.slice(0, -1),
              { ...last, text: last.text + (event.delta || '') },
            ];
          }
          return [...prev, { type: 'tutor-streaming', text: event.delta || '' }];
        });
        break;

      case 'response.audio.delta':
        // Bear audio is playing
        if (tutorState !== TUTOR_STATES.SPEAKING) {
          setTutorState(TUTOR_STATES.SPEAKING);
          onTutorSpeaking?.(true);
        }
        break;

      case 'response.audio_transcript.done':
        // Finalize the streaming message
        streamingTranscriptRef.current = '';
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'tutor-streaming') {
            return [
              ...prev.slice(0, -1),
              { type: 'tutor', text: event.transcript || last.text },
            ];
          }
          return prev;
        });
        break;

      case 'response.done':
        // Bear finished responding
        setTutorState(
          readingCompleteHandled.current
            ? TUTOR_STATES.CELEBRATING
            : TUTOR_STATES.LISTENING
        );
        onTutorSpeaking?.(false);
        // Clear karaoke highlighting when tutor stops
        onTutorTranscriptRef.current?.(null);
        break;

      case 'input_audio_buffer.speech_started':
        // User started speaking again
        if (tutorState === TUTOR_STATES.SPEAKING) {
          // User interrupted the bear
          setTutorState(TUTOR_STATES.LISTENING);
          onTutorSpeaking?.(false);
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User speech transcript (no longer displayed)
        break;

      case 'error':
        console.error('Realtime API error:', event.error);
        break;
    }
  }, [tutorState, onTutorSpeaking]);

  const sendReadingComplete = () => {
    if (dcRef.current?.readyState === 'open') {
      // Send a user message through the data channel
      dcRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: 'READING_COMPLETE - The child has finished reading the page. Now do STEP 1: Praise them briefly, then read back the ENTIRE page text clearly and slowly. After reading it, do STEP 2: Ask the child what they understood and WAIT for their response.',
          }],
        },
      }));
      // Trigger a response
      dcRef.current.send(JSON.stringify({
        type: 'response.create',
      }));
    }
  };

  const addMessage = (text, type) => {
    setMessages((prev) => [...prev, { type, text }]);
  };

  const getStatusText = () => {
    switch (tutorState) {
      case TUTOR_STATES.CONNECTING:
        return 'Waking up...';
      case TUTOR_STATES.LISTENING:
        return 'Listening...';
      case TUTOR_STATES.SPEAKING:
        return 'Speaking...';
      case TUTOR_STATES.CELEBRATING:
        return 'Great job!';
      case TUTOR_STATES.ERROR:
        return 'Connection issue';
      default:
        return 'Ready to help!';
    }
  };

  const getStatusClass = () => {
    switch (tutorState) {
      case TUTOR_STATES.LISTENING:
        return 'status-listening';
      case TUTOR_STATES.SPEAKING:
        return 'status-speaking';
      case TUTOR_STATES.CELEBRATING:
        return 'status-celebrating';
      case TUTOR_STATES.ERROR:
        return 'status-error';
      default:
        return '';
    }
  };

  const isTalking = tutorState === TUTOR_STATES.SPEAKING;

  return (
    <div className={`bear-tutor ${tutorState}`}>
      <div className="bear-character-container">
        <div className={`bear-character ${isTalking ? 'bear-talking' : ''}`}>
          {/* Bear body */}
          <div className="bear-body">
            {/* Ears */}
            <div className="bear-ear bear-ear-left"></div>
            <div className="bear-ear bear-ear-right"></div>
            {/* Head */}
            <div className="bear-head">
              {/* Eyes */}
              <div className="bear-eye bear-eye-left">
                <div className="bear-pupil"></div>
              </div>
              <div className="bear-eye bear-eye-right">
                <div className="bear-pupil"></div>
              </div>
              {/* Nose */}
              <div className="bear-nose"></div>
              {/* Mouth */}
              <div className={`bear-mouth ${isTalking ? 'bear-mouth-talking' : ''}`}></div>
            </div>
            {/* Teacher hat */}
            <div className="bear-hat"></div>
          </div>
        </div>
        <div className={`bear-status-badge ${getStatusClass()}`}>
          {getStatusText()}
        </div>
        <span className="bear-name-label">Buddy Bear</span>
      </div>
    </div>
  );
}

export default BearTutor;
