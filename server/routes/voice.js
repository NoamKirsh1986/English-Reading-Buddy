const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openaiOptions = { apiKey: process.env.OPENAI_API_KEY };
if (global.__proxyFetch) {
  openaiOptions.fetch = global.__proxyFetch;
}
const openai = new OpenAI(openaiOptions);

router.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'shimmer',
      input: text,
      speed: 0.9,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

module.exports = router;
