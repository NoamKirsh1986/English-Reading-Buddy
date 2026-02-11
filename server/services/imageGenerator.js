async function generateImage(openai, pageText) {
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Children's book illustration for: "${pageText}". Style: colorful, warm, friendly, cartoon-like, suitable for a children's picture book. No text or words in the image.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    return response.data[0].url;
  } catch (error) {
    console.error('Image generation error:', error.message);
    return null;
  }
}

module.exports = { generateImage };
