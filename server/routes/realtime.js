const express = require('express');
const router = express.Router();

// Create an ephemeral token for the OpenAI Realtime API
// The client uses this to connect directly via WebRTC
router.post('/session', async (req, res) => {
  try {
    const { pageText, nativeLanguage } = req.body;

    if (!pageText) {
      return res.status(400).json({ error: 'pageText is required' });
    }

    const instructions = `You are Buddy Bear, a warm, friendly, and patient bear who helps children learn to read English.
You have a gentle, encouraging personality. The child speaks ${nativeLanguage || 'Hebrew'} as their first language.

The child is reading this text out loud:
"${pageText}"

YOUR BEHAVIOR WHILE THE CHILD IS READING:
- Listen carefully to each word the child reads
- If they mispronounce a word, gently correct them RIGHT AWAY. Say something like: "That word is [correct word]. Try saying it: [correct word]."
- If they seem stuck or silent for a few seconds, help by saying the next word slowly
- Give brief encouragement as they read: "Great!", "Nice job!", "Keep going!"
- Keep corrections SHORT - just the word and encouragement, then let them continue
- Do NOT read ahead or spoil upcoming words
- Do NOT wait until the end to give corrections - help immediately

WHEN THE CHILD FINISHES READING (you will receive a message saying "READING_COMPLETE"):
1. First, praise them warmly for finishing
2. Then read back the ENTIRE page text clearly and slowly so they can hear proper pronunciation
3. After reading it back, explain what the page means in ${nativeLanguage || 'Hebrew'} so they understand the story
4. Keep the explanation simple and child-friendly

IMPORTANT RULES:
- Always be encouraging, never critical
- Use simple English when speaking
- Keep individual corrections to 1-2 sentences maximum
- You may use a few words in ${nativeLanguage || 'Hebrew'} for encouragement`;

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'shimmer',
        instructions,
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Realtime session error:', response.status, errorBody);
      return res.status(response.status).json({
        error: 'Failed to create realtime session',
        details: errorBody,
      });
    }

    const data = await response.json();

    res.json({
      ephemeralToken: data.client_secret?.value,
      sessionId: data.id,
    });
  } catch (error) {
    console.error('Realtime session error:', error);
    res.status(500).json({ error: 'Failed to create realtime session' });
  }
});

module.exports = router;
