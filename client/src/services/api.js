const API_BASE = '/api';

export async function extractWords(transcript) {
  const response = await fetch(`${API_BASE}/lesson/extract-words`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    throw new Error('Failed to extract words');
  }

  return response.json();
}

export async function generateImage(word) {
  const response = await fetch(`${API_BASE}/lesson/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate image');
  }

  return response.json();
}
