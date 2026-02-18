const FormData = require('form-data');

const SPEECHACE_API_URL = 'https://api.speechace.co/api/scoring/text/v9/json';

/**
 * Send audio to SpeechAce for pronunciation scoring.
 * Returns the raw SpeechAce response.
 */
async function scorePronunciation(audioBuffer, referenceText) {
  const apiKey = process.env.SPEECHACE_API_KEY;
  if (!apiKey) {
    throw new Error('SPEECHACE_API_KEY is not configured');
  }

  const form = new FormData();
  form.append('text', referenceText);
  form.append('user_audio_file', audioBuffer, {
    filename: 'audio.wav',
    contentType: 'audio/wav',
  });
  form.append('question_info', '"read_aloud"');

  const url = `${SPEECHACE_API_URL}?key=${encodeURIComponent(apiKey)}&dialect=en-us&user_id=student`;

  const fetchOptions = {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  };

  // Use proxy agent if available (set in index.js for containerized environments)
  if (global.__proxyAgent) {
    const nodeFetch = require('node-fetch');
    var fetchFn = nodeFetch;
    fetchOptions.agent = global.__proxyAgent;
  } else {
    var fetchFn = fetch;
  }

  const response = await fetchFn(url, fetchOptions);

  const data = await response.json();

  if (data.status !== 'success') {
    throw new Error(`SpeechAce error: ${data.detail_message || JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Parse SpeechAce response into word-level results for the frontend.
 * Each word gets a status (correct/incorrect) and a numeric score (0-100).
 */
function parseWordResults(speechAceData, originalText) {
  const words = originalText.split(/\s+/);
  const scoreList = speechAceData.text_score?.word_score_list || [];

  const wordResults = words.map((word, index) => {
    const scoreEntry = scoreList[index];
    if (!scoreEntry) {
      return { word, status: 'correct', score: 100 };
    }

    const score = scoreEntry.quality_score ?? 0;
    return {
      word,
      status: score >= 60 ? 'correct' : 'incorrect',
      score,
    };
  });

  return wordResults;
}

/**
 * Build a summary of pronunciation results for GPT-4o to use when generating feedback.
 */
function buildScoreSummary(wordResults, speechAceData) {
  const totalScore = speechAceData.text_score?.quality_score ?? null;
  const incorrectWords = wordResults.filter((w) => w.status === 'incorrect');
  const correctWords = wordResults.filter((w) => w.status === 'correct');

  return {
    overallScore: totalScore,
    totalWords: wordResults.length,
    correctCount: correctWords.length,
    incorrectCount: incorrectWords.length,
    incorrectWords: incorrectWords.map((w) => ({
      word: w.word,
      score: w.score,
    })),
    wordDetails: wordResults.map((w) => `${w.word} (${w.score}/100)`).join(', '),
  };
}

module.exports = { scorePronunciation, parseWordResults, buildScoreSummary };
