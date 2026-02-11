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

    console.log(`Generating images for ${pages.length} pages...`);
    const pagesWithImages = await Promise.all(
      pages.map(async (text, index) => {
        console.log(`  Generating image for page ${index + 1}/${pages.length}...`);
        const imageUrl = await generateImage(openai, text);
        return { text, imageUrl };
      })
    );

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

module.exports = router;
