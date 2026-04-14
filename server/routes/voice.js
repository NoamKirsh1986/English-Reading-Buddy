const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openaiOptions = {
  apiKey: process.env.OPENAI_API_KEY,
};
if (global.__proxyFetch) {
  openaiOptions.fetch = global.__proxyFetch;
}
const openai = new OpenAI(openaiOptions);

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

// Tutor conversation turn: respond to child's spoken input during follow-up chat
router.post('/tutor-chat', async (req, res) => {
  try {
    const { childText, conversationHistory, pageText, nativeLanguage } = req.body;

    const messages = [
      {
        role: 'system',
        content: `You are a warm, friendly English tutor for a child who speaks ${nativeLanguage}.
You are having a short conversation with the child about a sentence they just read: "${pageText}"
You may freely mix English and ${nativeLanguage} — match the child's level.
Keep your responses short (1-3 sentences). Be encouraging and playful.
If this is your first turn, you've already explained the sentence — now ask a simple follow-up question related to it (e.g. "What is YOUR favorite food?" if the sentence mentions food).
After 2-3 exchanges, gently tell the child "Great talking! Let's go to the next page!" in a mix of English and ${nativeLanguage}.
Return ONLY your spoken response text, nothing else.`,
      },
    ];

    // Add conversation history
    if (conversationHistory) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === 'tutor' ? 'assistant' : 'user',
          content: msg.text,
        });
      }
    }

    // Add the child's latest message
    messages.push({ role: 'user', content: childText || '(child spoke but was not understood)' });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 200,
      temperature: 0.7,
    });

    const tutorReply = response.choices[0].message.content.trim();
    res.json({ reply: tutorReply });
  } catch (error) {
    console.error('Tutor chat error:', error);
    res.status(500).json({ error: 'Failed to generate tutor response' });
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
