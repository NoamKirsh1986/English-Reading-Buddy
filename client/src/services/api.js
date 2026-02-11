const API_BASE = '/api';

export async function generateStory() {
  const response = await fetch(`${API_BASE}/story/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate story');
  }

  return response.json();
}

export async function getTeacherFeedback(originalText, spokenText, nativeLanguage) {
  const response = await fetch(`${API_BASE}/voice/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalText, spokenText, nativeLanguage }),
  });

  if (!response.ok) {
    throw new Error('Failed to get feedback');
  }

  return response.json();
}

export async function explainWord(word, sentence, nativeLanguage) {
  const response = await fetch(`${API_BASE}/voice/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, sentence, nativeLanguage }),
  });

  if (!response.ok) {
    throw new Error('Failed to explain word');
  }

  return response.json();
}
