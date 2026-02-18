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

export async function analyzeReading(audioBlob, originalText, nativeLanguage) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  formData.append('originalText', originalText);
  formData.append('nativeLanguage', nativeLanguage);

  const response = await fetch(`${API_BASE}/voice/analyze-reading`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to analyze reading');
  }

  return response.json();
}

export async function evaluatePractice(audioBlob, practicePhrase, nativeLanguage) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  formData.append('practicePhrase', practicePhrase);
  formData.append('nativeLanguage', nativeLanguage);

  const response = await fetch(`${API_BASE}/voice/evaluate-practice`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to evaluate practice');
  }

  return response.json();
}

export async function textToSpeech(text) {
  const response = await fetch(`${API_BASE}/voice/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate speech');
  }

  return response.blob();
}
