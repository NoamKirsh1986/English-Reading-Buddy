const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateStory() {
  const themes = [
    'a friendly animal adventure',
    'a magical garden',
    'a trip to the beach',
    'making a new friend at school',
    'a fun day at the park',
    'a little bird learning to fly',
    'a rainy day adventure',
    'helping a lost puppy',
    'a visit to the farm',
    'a birthday surprise',
  ];

  const theme = themes[Math.floor(Math.random() * themes.length)];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a children's story writer for kids learning English as a second language.
Write simple, engaging stories using basic vocabulary and short sentences.
Stories must be under 250 words.
Use present tense where possible.
Include some repetition of key words to help learning.
Make the stories fun and imaginative.
Return ONLY the story text — no title, no labels, no extra formatting.`,
      },
      {
        role: 'user',
        content: `Write a short children's story about ${theme}.`,
      },
    ],
    max_tokens: 500,
    temperature: 0.8,
  });

  return response.choices[0].message.content.trim();
}

function splitIntoPages(story) {
  const sentences = story.match(/[^.!?]+[.!?]+/g) || [story];
  return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
}

module.exports = { generateStory, splitIntoPages, openai };
