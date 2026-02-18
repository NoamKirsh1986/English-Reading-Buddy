const express = require('express');
const router = express.Router();
const multer = require('multer');
const OpenAI = require('openai');
const { scorePronunciation, parseWordResults, buildScoreSummary } = require('../services/speechace');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Multer stores uploaded audio in memory as a Buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
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

// Analyze reading accuracy using SpeechAce (audio) + GPT-4o (feedback)
router.post('/analyze-reading', upload.single('audio'), async (req, res) => {
  try {
    const { originalText, nativeLanguage } = req.body;
    const audioBuffer = req.file?.buffer;

    if (!audioBuffer) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Step 1: Score pronunciation with SpeechAce
    const speechAceData = await scorePronunciation(audioBuffer, originalText);
    const wordResults = parseWordResults(speechAceData, originalText);
    const scoreSummary = buildScoreSummary(wordResults, speechAceData);

    // Step 2: Generate child-friendly feedback with GPT-4o using the scores
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a friendly English reading tutor for children who speak ${nativeLanguage}.
You have pronunciation assessment scores for each word the child read.
Use these scores to provide helpful, encouraging feedback.

Return a JSON object with:
1. "feedback": A short, encouraging message (2-3 sentences) in a mix of simple English and ${nativeLanguage}. Read the sentence for the child and explain what it means in ${nativeLanguage}. If they struggled with specific words, mention those gently.
2. "practiceWord": The word with the lowest pronunciation score (pick from words scoring below 60). If all words scored 60+, set to null.
3. "practicePhrase": A short, simple phrase (3-6 words) using the practiceWord in a new context. Example: if the word is "night", the phrase could be "I sleep at night". If no practice needed, set to null.
4. "practiceExplanation": Brief explanation of the practice phrase in ${nativeLanguage}. If no practice needed, set to null.

Return ONLY valid JSON, no markdown fences.`,
        },
        {
          role: 'user',
          content: `Original text: "${originalText}"
Pronunciation scores per word: ${scoreSummary.wordDetails}
Overall score: ${scoreSummary.overallScore}/100
Words needing practice (scored below 60): ${scoreSummary.incorrectWords.map((w) => `"${w.word}" (${w.score})`).join(', ') || 'none'}`,
        },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content.trim();
    const jsonStr = content.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    const gptResult = JSON.parse(jsonStr);

    res.json({
      wordResults,
      feedback: gptResult.feedback,
      practiceWord: gptResult.practiceWord,
      practicePhrase: gptResult.practicePhrase,
      practiceExplanation: gptResult.practiceExplanation,
    });
  } catch (error) {
    console.error('Analyze reading error:', error);
    res.status(500).json({ error: 'Failed to analyze reading' });
  }
});

// Evaluate child's practice attempt using SpeechAce (audio) + GPT-4o (feedback)
router.post('/evaluate-practice', upload.single('audio'), async (req, res) => {
  try {
    const { practicePhrase, nativeLanguage } = req.body;
    const audioBuffer = req.file?.buffer;

    if (!audioBuffer) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Step 1: Score pronunciation with SpeechAce
    const speechAceData = await scorePronunciation(audioBuffer, practicePhrase);
    const overallScore = speechAceData.text_score?.quality_score ?? 0;

    // Step 2: Generate feedback with GPT-4o
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a friendly English tutor for children who speak ${nativeLanguage}.
The child was asked to say a practice phrase. You have their pronunciation score.
Return a JSON object with:
1. "success": true if the overall score is 50 or above, false otherwise
2. "message": A short encouraging response (1-2 sentences) in simple English and ${nativeLanguage}. If they did well, praise them and tell them to go to the next page. If not, gently encourage them to try again.

Return ONLY valid JSON, no markdown fences.`,
        },
        {
          role: 'user',
          content: `Practice phrase: "${practicePhrase}"\nPronunciation score: ${overallScore}/100`,
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
