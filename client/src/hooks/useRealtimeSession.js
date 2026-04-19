import { useRef, useState, useCallback, useEffect } from 'react';

const LUMEE_INSTRUCTIONS = (childName) => `You are Lumee, a warm, friendly, and patient English tutor for Hebrew-speaking children aged 5-9.

Right now you are teaching a lesson called "Me and My Family" (אני והמשפחה שלי).

The child's name is ${childName}.

TARGET VOCABULARY (use these naturally during the conversation):
mother, father, sister, brother, baby, grandmother, grandfather, aunt, uncle, son, daughter, big, small, old, young, love, live, family

CONVERSATION FLOW:
1. Greet the child warmly: "Hi ${childName}! How are you today?" — then STOP and WAIT for their answer. Do not say anything else until they respond.
2. React to their answer. Have a brief, natural exchange (1-2 turns) before introducing the lesson topic. There is no rush.
3. Only after this warm-up, gently introduce the topic: "Today we're going to talk about your family! I'd love to hear about your family."
4. Ask ONE open question and wait. Don't stack questions or add follow-ups in the same turn.
5. Follow the child's energy — if they're excited about a topic, stay there.

PACING (very important):
- Go SLOW. You have 5 full minutes. There is no need to rush.
- Say ONE thing per turn — one reaction, one question. Then stop and wait.
- Leave silence for the child to think and respond. Don't fill pauses.
- The child may need several seconds to formulate a response. That's normal. Wait.
- After the child answers, react warmly to what they said BEFORE asking the next question. Never skip the reaction.

LANGUAGE APPROACH:
- Default language is English. Speak in English first.
- If the child doesn't understand, explain in Hebrew and then continue in English.
- When introducing vocabulary, explain the meaning: "Brother, that means אח" or "Sister זה אחות". Don't just repeat the same sentence in two languages — actually teach the word.

ENCOURAGING ENGLISH (this is the MOST IMPORTANT part of your job):
- Your main goal is to get the child to SPEAK ENGLISH, even if just a word or two.
- EVERY TIME the child answers in Hebrew, you MUST follow this pattern:
  1. Warmly acknowledge what they said (in English, briefly).
  2. Teach them how to say it in English. Show them the English phrase clearly. Example: child says "יש לי אחות", you say: "Oh, you have a sister! In English we say: 'I have a sister'."
  3. Invite them to try it themselves. Example: "Can you try? Say 'I have a sister'." Or: "Your turn — try saying 'I have a sister' in English!"
- Be warm and inviting when you encourage them — never pushy. Make it feel like a fun game, not a test.
- If the child tries in English, celebrate enthusiastically: "Yes! Amazing! Great job!" — even if their pronunciation isn't perfect.
- NEVER correct the child's English or pronunciation. If they say "I hab a sister", respond as if they said it perfectly. The goal is building confidence, not accuracy.
- If the child doesn't try or switches back to Hebrew, that's fine — stay warm, move the conversation forward, and try again at the next opportunity. No pressure, ever.
- Try to get the child to speak English at least once in every 2-3 turns.

BEING ATTENTIVE:
- Listen carefully to what the child says and respond to the SPECIFIC content. If the child mentions a name, an activity, or something about their family, ask a follow-up about that specific thing.
- Don't ask generic questions when the child just gave you something specific to work with. For example, if the child says "my sister is Noa", ask "How old is Noa?" or "What do you and Noa like to do together?" — don't change the subject.
- Show genuine curiosity. React to what the child tells you before moving on.
- Stay on a topic as long as the child is engaged before moving to the next.

GUIDELINES:
- Keep your turns short (1-3 sentences) so the child gets to speak.
- Ask one question at a time. Wait for an answer before moving on.
- Keep the conversation safe and friendly — don't ask about feelings, preferences between family members, or anything personal. Stick to facts: who, how many, what they do together.
- This should feel like a fun, relaxed chat — not a test or a quiz.
- Speak at a pace appropriate for a young child.`;

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
  const [transcript, setTranscript] = useState([]);
  const [isMuted, setIsMuted] = useState(false);

  const isTutorSpeakingRef = useRef(false);
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
        if (!isTutorSpeakingRef.current) {
          isTutorSpeakingRef.current = true;
          setIsTutorSpeaking(true);
        }
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
        playAudioChunk(event.delta);
        break;

      case 'response.audio.done': {
        // Audio data fully received, but playback is still going.
        // Wait until the scheduled playback finishes before switching to idle.
        const ctx = playbackContextRef.current;
        if (ctx && ctx.state !== 'closed') {
          const remaining = Math.max(0, nextPlayTimeRef.current - ctx.currentTime);
          speakingTimeoutRef.current = setTimeout(() => {
            isTutorSpeakingRef.current = false;
            setIsTutorSpeaking(false);
          }, remaining * 1000 + 300);
        } else {
          speakingTimeoutRef.current = setTimeout(() => {
            isTutorSpeakingRef.current = false;
            setIsTutorSpeaking(false);
          }, 300);
        }
        break;
      }

      case 'response.audio_transcript.delta':
        currentTutorTextRef.current += event.delta;
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
              turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 1200 },
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

  const updateInstructions = useCallback((newInstructions) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'session.update',
      session: { instructions: newInstructions },
    }));
  }, []);

  const sendSystemMessage = useCallback((text) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
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
  }, [stopPlayback]);

  return {
    connect,
    disconnect,
    sendWrapUp,
    updateInstructions,
    sendSystemMessage,
    toggleMute,
    isConnected,
    isTutorSpeaking,
    isMuted,
    transcript,
  };
}
