const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get teacher feedback on reading
router.post('/feedback', async (req, res) => {
  try {
    const { originalText, spokenText, nativeLanguage } = req.body;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a friendly, encouraging English teacher for children who speak ${nativeLanguage}.
You are helping a child practice reading English out loud.
Compare what the child said to the original text and provide gentle, encouraging feedback.
If they made mistakes, help them with the correct pronunciation.
Keep your responses short (2-3 sentences) and encouraging.
Speak to the child directly.
If the reading was good, praise them enthusiastically!
You may use a few words in ${nativeLanguage} to help explain, but keep most of your response in simple English.`,
        },
        {
          role: 'user',
          content: `Original text: "${originalText}"\nWhat the child read: "${spokenText}"\n\nProvide brief, encouraging feedback.`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const feedback = response.choices[0].message.content;
    res.json({ feedback });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to generate feedback' });
  }
});

// Explain a word
router.post('/explain', async (req, res) => {
  try {
    const { word, sentence, nativeLanguage } = req.body;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a friendly English teacher for children who speak ${nativeLanguage}.
Explain English words simply.
Provide the translation in ${nativeLanguage}.
Give one simple example sentence.
Keep explanations very short and child-friendly (3-4 lines max).`,
        },
        {
          role: 'user',
          content: `Explain the word "${word}" (from the sentence: "${sentence}") to a child who speaks ${nativeLanguage}.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.5,
    });

    const explanation = response.choices[0].message.content;
    res.json({ explanation });
  } catch (error) {
    console.error('Explanation error:', error);
    res.status(500).json({ error: 'Failed to explain word' });
  }
});

// Analyze reading accuracy and generate tutor response
router.post('/analyze-reading', async (req, res) => {
  try {
    const { originalText, spokenText, nativeLanguage } = req.body;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a friendly English reading tutor for children who speak ${nativeLanguage}.
Compare the child's spoken text against the original text word by word.
Return a JSON object with:
1. "wordResults": an array with one entry per word in the original text. Each entry has:
   - "word": the original word (keep punctuation)
   - "status": "correct" if the child read it right (allow minor pronunciation differences), or "incorrect" if they missed or mispronounced it
2. "feedback": A short, encouraging message (2-3 sentences) in a mix of simple English and ${nativeLanguage}. Read the sentence for the child and explain what it means in ${nativeLanguage}.
3. "practiceWord": One word the child struggled with most (pick from incorrect words). If all correct, set to null.
4. "practicePhrase": A short, simple phrase (3-6 words) using the practiceWord in a new context. Example: if the word is "night", the phrase could be "I sleep at night". If all words correct, set to null.
5. "practiceExplanation": Brief explanation of the practice phrase in ${nativeLanguage}. If all correct, set to null.

Return ONLY valid JSON, no markdown fences.`,
        },
        {
          role: 'user',
          content: `Original text: "${originalText}"\nChild's reading: "${spokenText}"`,
        },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content.trim();
    // Strip markdown fences if present
    const jsonStr = content.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    const result = JSON.parse(jsonStr);
    res.json(result);
  } catch (error) {
    console.error('Analyze reading error:', error);
    res.status(500).json({ error: 'Failed to analyze reading' });
  }
});

// Evaluate child's practice attempt
router.post('/evaluate-practice', async (req, res) => {
  try {
    const { practicePhrase, spokenText, nativeLanguage } = req.body;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a friendly English tutor for children who speak ${nativeLanguage}.
The child was asked to say a practice phrase. Evaluate how they did.
Return a JSON object with:
1. "success": true if they said it reasonably well, false if they need to try again
2. "message": A short encouraging response (1-2 sentences) in simple English and ${nativeLanguage}. If they did well, praise them and tell them to go to the next page. If not, gently encourage them to try again.

Return ONLY valid JSON, no markdown fences.`,
        },
        {
          role: 'user',
          content: `Practice phrase: "${practicePhrase}"\nChild said: "${spokenText}"`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content.trim();
    const jsonStr = content.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    const result = JSON.parse(jsonStr);
    res.json(result);
  } catch (error) {
    console.error('Evaluate practice error:', error);
    res.status(500).json({ error: 'Failed to evaluate practice' });
  }
});

// Generate TTS audio
router.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
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
