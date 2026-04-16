const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openaiOptions = { apiKey: process.env.OPENAI_API_KEY };
if (global.__proxyFetch) {
  openaiOptions.fetch = global.__proxyFetch;
}
const openai = new OpenAI(openaiOptions);

const FAMILY_FALLBACK_WORDS = [
  { word: 'father', contrast: 'mother' },
  { word: 'brother', contrast: 'sister' },
  { word: 'grandmother', contrast: 'grandfather' },
  { word: 'daughter', contrast: 'son' },
  { word: 'aunt', contrast: 'uncle' },
];

router.post('/extract-words', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript || transcript.length === 0) {
      return res.json({ words: FAMILY_FALLBACK_WORDS });
    }

    const formatted = transcript
      .map((t) => `${t.role === 'tutor' ? 'Lumee' : 'Child'}: ${t.text}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are analyzing a conversation between an English tutor (Lumee) and a Hebrew-speaking child learning English. The lesson topic is "Me and My Family".

Your task: identify exactly 5 English vocabulary words related to family that the child did NOT know or use in English during the conversation. Signs the child doesn't know a word:
- The child used the Hebrew equivalent instead of the English word
- The child didn't understand when the tutor used the word
- The child hesitated or couldn't respond when the topic came up

For each word, also provide a "contrast" word — a related but different word that can be used in a picture-matching quiz. The contrast should be from the same category (e.g., mother/father, sister/brother, tall/short, happy/sad).

Return ONLY a JSON array of exactly 5 objects with "word" and "contrast" fields. Example:
[{"word": "father", "contrast": "mother"}, {"word": "sister", "contrast": "brother"}]

If you cannot find 5 words the child didn't know, fill the remaining slots with common family vocabulary the child didn't get a chance to demonstrate.

Return ONLY valid JSON, no markdown fences.`,
        },
        {
          role: 'user',
          content: formatted,
        },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content.trim();
    const jsonStr = content.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    const words = JSON.parse(jsonStr);

    if (!Array.isArray(words) || words.length < 5) {
      return res.json({ words: FAMILY_FALLBACK_WORDS });
    }

    res.json({ words: words.slice(0, 5) });
  } catch (error) {
    console.error('Word extraction error:', error);
    res.json({ words: FAMILY_FALLBACK_WORDS });
  }
});

router.post('/generate-image', async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) {
      return res.status(400).json({ error: 'No word provided' });
    }

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `A simple, clear 3D rendered illustration of "${word}" for a children's vocabulary card. The image should clearly depict the concept of "${word}" in a family context. Style: 3D cartoon render (like Pixar/Disney), colorful, friendly, on a clean simple background. No text or words in the image.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    res.json({ imageUrl: response.data[0].url });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

module.exports = router;
