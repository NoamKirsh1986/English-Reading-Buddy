import { useRef, useState, useCallback, useEffect } from 'react';

const LUMEE_INSTRUCTIONS = (childName) => `You are Lumee, a warm, friendly, and patient English tutor for Hebrew-speaking children aged 5-9.

Right now you are teaching a lesson called "Me and My Family" (אני והמשפחה שלי).

The child's name is ${childName}.

Your goal in this conversation phase is to get to know the child and their family, while naturally modeling English family vocabulary (mother, father, sister, brother, grandmother, grandfather, baby, aunt, uncle, daughter, son, big, small, tall, short, happy, sad, etc.).

Guidelines:
- Greet the child warmly by name and ask about their family
- Switch freely between Hebrew and English as needed
- Use the sandwich approach when introducing new vocabulary: say the English word, then a short Hebrew clarification, then use the English word again in context
- Teach through clear modeling and context — do NOT prompt the child to repeat English words or phrases
- Keep your turns short (1-3 sentences) so the child gets to speak
- Be genuinely curious and playful about the child's family
- If the child speaks in Hebrew, respond warmly and model the English equivalent naturally in your reply
- This should feel like a fun chat, not a test or quiz
- Speak at a pace appropriate for a young child`;

export default function useRealtimeSession() {
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const playbackContextRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const currentSourcesRef = useRef([]);
  const transcriptRef = useRef([]);
  const currentTutorTextRef = useRef('');
  const isMutedRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isTutorSpeaking, setIsTutorSpeaking] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [isMuted, setIsMuted] = useState(false);

  const speakingTimeoutRef = useRef(null);

  const playAudioChunk = useCallback((base64Audio) => {
    if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextPlayTimeRef.current = 0;
    }

    const ctx = playbackContextRef.current;
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now + 0.05, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;

    currentSourcesRef.current.push(source);
    source.onended = () => {
      currentSourcesRef.current = currentSourcesRef.current.filter((s) => s !== source);
    };
  }, []);

  const stopPlayback = useCallback(() => {
    currentSourcesRef.current.forEach((s) => {
      try { s.stop(); } catch {}
    });
    currentSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }
  }, []);

  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case 'response.audio.delta':
        setIsTutorSpeaking(true);
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
        playAudioChunk(event.delta);
        break;

      case 'response.audio.done':
        speakingTimeoutRef.current = setTimeout(() => {
          setIsTutorSpeaking(false);
        }, 500);
        break;

      case 'response.audio_transcript.delta':
        currentTutorTextRef.current += event.delta;
        setCurrentSubtitle(currentTutorTextRef.current);
        break;

      case 'response.audio_transcript.done':
        if (currentTutorTextRef.current) {
          const entry = { role: 'tutor', text: currentTutorTextRef.current };
          transcriptRef.current = [...transcriptRef.current, entry];
          setTranscript([...transcriptRef.current]);
        }
        currentTutorTextRef.current = '';
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          const entry = { role: 'child', text: event.transcript };
          transcriptRef.current = [...transcriptRef.current, entry];
          setTranscript([...transcriptRef.current]);
        }
        break;

      case 'response.done':
        break;

      case 'error':
        console.error('[Realtime] Error:', event.error);
        break;

      default:
        break;
    }
  }, [playAudioChunk]);

  const eventHandlerRef = useRef(handleEvent);
  useEffect(() => {
    eventHandlerRef.current = handleEvent;
  }, [handleEvent]);

  const startMicCapture = useCallback((audioStream) => {
    if (audioContextRef.current) return;

    const ctx = new AudioContext({ sampleRate: 24000 });
    audioContextRef.current = ctx;

    const source = ctx.createMediaStreamSource(audioStream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (isMutedRef.current) return;

      const input = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const bytes = new Uint8Array(int16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      wsRef.current.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64,
      }));
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  }, []);

  const connect = useCallback(async (childName, audioStream) => {
    return new Promise((resolve, reject) => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/realtime`);
      wsRef.current = ws;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timed out'));
      }, 15000);

      ws.onopen = () => {
        console.log('[Realtime] WebSocket connected');
      };

      ws.onmessage = (msg) => {
        const event = JSON.parse(msg.data);

        if (event.type === 'session.created') {
          clearTimeout(timeout);

          ws.send(JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: LUMEE_INSTRUCTIONS(childName),
              voice: 'shimmer',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: { model: 'whisper-1' },
              turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 800 },
            },
          }));

          streamRef.current = audioStream;
          startMicCapture(audioStream);
          setIsConnected(true);

          // Trigger Lumee's greeting
          ws.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text', 'audio'],
            },
          }));

          resolve();
        }

        eventHandlerRef.current(event);
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        console.error('[Realtime] WebSocket error:', err);
        reject(new Error('Connection failed'));
      };

      ws.onclose = () => {
        console.log('[Realtime] WebSocket closed');
        setIsConnected(false);
      };
    });
  }, [startMicCapture]);

  const sendWrapUp = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: '[SYSTEM: The conversation time is up. Please wrap up naturally in 1-2 sentences. Tell the child warmly that you had a great chat, and now you are going to play a fun word game together. Say this in a mix of English and Hebrew.]',
        }],
      },
    }));

    wsRef.current.send(JSON.stringify({
      type: 'response.create',
      response: { modalities: ['text', 'audio'] },
    }));
  }, []);

  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current;
    setIsMuted(isMutedRef.current);
  }, []);

  const disconnect = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    stopPlayback();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsTutorSpeaking(false);
    setCurrentSubtitle('');
  }, [stopPlayback]);

  return {
    connect,
    disconnect,
    sendWrapUp,
    toggleMute,
    isConnected,
    isTutorSpeaking,
    isMuted,
    currentSubtitle,
    transcript,
  };
}
