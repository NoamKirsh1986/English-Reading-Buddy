const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate bear tutor video via Sora 2, with DALL-E 3 image fallback
router.post('/generate-video', async (req, res) => {
  try {
    // Try Sora 2 video generation first
    const videoResult = await generateBearVideo();
    if (videoResult) {
      return res.json(videoResult);
    }

    // Fallback to DALL-E 3 static image
    const imageResult = await generateBearImage();
    return res.json(imageResult);
  } catch (error) {
    console.error('Tutor video generation error:', error);
    // Return a placeholder so the app still works
    res.json({
      type: 'placeholder',
      url: null,
      description: 'Buddy Bear tutor (video generation unavailable)',
    });
  }
});

async function generateBearVideo() {
  try {
    const response = await fetch('https://api.openai.com/v1/videos/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sora',
        prompt: `A friendly cartoon brown bear wearing a small red teacher's cap, sitting at a colorful children's desk. The bear has big warm eyes and a gentle smile. The bear occasionally nods, tilts its head as if listening, and gives a thumbs up. Soft, warm lighting with a pastel classroom background. The style is like a children's animated show - round, soft shapes, vibrant but gentle colors. The bear looks directly at the camera as if talking to a child. Looping animation.`,
        size: '480x480',
        duration: 5,
        n: 1,
      }),
    });

    if (!response.ok) {
      console.log('Sora API not available, falling back to DALL-E:', response.status);
      return null;
    }

    const data = await response.json();
    const videoUrl = data.data?.[0]?.url;

    if (videoUrl) {
      return {
        type: 'video',
        url: videoUrl,
        description: 'Buddy Bear tutor video',
      };
    }

    return null;
  } catch (error) {
    console.log('Sora video generation failed, using fallback:', error.message);
    return null;
  }
}

async function generateBearImage() {
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `A friendly, adorable cartoon brown bear character wearing a small red teacher's cap, sitting and looking directly at the viewer with big warm eyes and a gentle encouraging smile. The bear has round soft features like a children's book character. Soft pastel classroom background with a bookshelf. Warm lighting. The style is cute, friendly, and perfect for a children's educational app. The bear should look like a warm, approachable tutor.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    return {
      type: 'image',
      url: response.data[0].url,
      description: 'Buddy Bear tutor image',
    };
  } catch (error) {
    console.error('DALL-E image generation failed:', error.message);
    return null;
  }
}

module.exports = router;
