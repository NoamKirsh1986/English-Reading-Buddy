const express = require('express');
const router = express.Router();
const { generateStory, splitIntoPages, openai } = require('../services/storyGenerator');
const { generateImage } = require('../services/imageGenerator');

router.post('/generate', async (req, res) => {
  try {
    console.log('Generating story...');
    const story = await generateStory();

    console.log('Splitting story into pages...');
    const pages = splitIntoPages(story);

    // Generate images for the first 2 pages in parallel
    const pagesToPrefetch = Math.min(2, pages.length);
    console.log(`Generating images for first ${pagesToPrefetch} pages...`);
    const imagePromises = pages.slice(0, pagesToPrefetch).map((text) =>
      generateImage(openai, text)
    );
    const images = await Promise.all(imagePromises);

    const pagesWithImages = pages.map((text, index) => ({
      text,
      imageUrl: index < pagesToPrefetch ? images[index] : null,
    }));

    console.log('Story generation complete!');
    res.json({
      story,
      pages: pagesWithImages,
      totalPages: pagesWithImages.length,
    });
  } catch (error) {
    console.error('Story generation error:', error);
    res.status(500).json({ error: 'Failed to generate story. ' + error.message });
  }
});

// Generate a single page image on demand
router.post('/generate-image', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    console.log('Generating on-demand image...');
    const imageUrl = await generateImage(openai, text);
    res.json({ imageUrl });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

module.exports = router;
