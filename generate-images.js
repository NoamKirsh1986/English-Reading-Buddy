require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OUTPUT_DIR = path.join(__dirname, 'client', 'public', 'lessons', 'family');

const BASE_STYLE = 'Simple watercolor illustration for a children\'s vocabulary card. Soft pastel colors, clean white background, friendly and warm. No text, no words, no letters, no symbols. Secular — no religious clothing, head coverings, or religious symbols of any kind. Modern casual clothing.';

const WORDS = [
  { id: 'mother',        prompt: `A warm, smiling woman (mid 30s) in modern casual clothes (jeans and a top), standing. ${BASE_STYLE}` },
  { id: 'father',        prompt: `A warm, smiling man (mid 30s) in modern casual clothes (jeans and a t-shirt), standing. ${BASE_STYLE}` },
  { id: 'sister',        prompt: `A young girl (about 7 years old) in casual clothes (dress or shorts and t-shirt), smiling. ${BASE_STYLE}` },
  { id: 'brother',       prompt: `A young boy (about 7 years old) in casual clothes (shorts and t-shirt), smiling. ${BASE_STYLE}` },
  { id: 'baby',          prompt: `A cute baby (about 1 year old) sitting on the floor, wearing a simple onesie, smiling. ${BASE_STYLE}` },
  { id: 'child',         prompt: `A child (about 5 years old, gender neutral) standing, wearing casual clothes, smiling and waving. ${BASE_STYLE}` },
  { id: 'grandmother',   prompt: `An elderly woman (about 70) with gray hair, wearing modern casual clothes, smiling warmly. ${BASE_STYLE}` },
  { id: 'grandfather',   prompt: `An elderly man (about 70) with gray hair, wearing modern casual clothes (sweater and pants), smiling warmly. ${BASE_STYLE}` },
  { id: 'aunt',          prompt: `A woman (about 40) in smart casual modern clothes, smiling, looking friendly. Different from the "mother" image — slightly different hair and outfit. ${BASE_STYLE}` },
  { id: 'uncle',         prompt: `A man (about 40) in smart casual modern clothes, smiling, looking friendly. Different from the "father" image — slightly different hair and outfit. ${BASE_STYLE}` },
  { id: 'dog',           prompt: `A friendly golden retriever dog, sitting, looking happy with tongue out. ${BASE_STYLE}` },
  { id: 'cat',           prompt: `A cute orange tabby cat, sitting calmly, looking at the viewer. ${BASE_STYLE}` },
  { id: 'family',        prompt: `A family of four (mother, father, and two children) standing together, hugging, smiling. Modern casual clothes. ${BASE_STYLE}` },
  { id: 'friends',       prompt: `Three children (different appearances) standing together, arms around each other's shoulders, smiling as friends. Modern casual clothes. ${BASE_STYLE}` },
  { id: 'big',           prompt: `A big elephant standing, taking up most of the frame. Clear sense of large size. ${BASE_STYLE}` },
  { id: 'small',         prompt: `A tiny mouse sitting, very small in the frame with space around it. Clear sense of small size. ${BASE_STYLE}` },
  { id: 'old',           prompt: `An old, gnarled tree with thick trunk and many branches. Looks ancient and wise. ${BASE_STYLE}` },
  { id: 'young',         prompt: `A small, fresh green seedling/sapling just sprouting from the ground. Looks new and young. ${BASE_STYLE}` },
];

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (res2) => {
          const stream = fs.createWriteStream(filepath);
          res2.pipe(stream);
          stream.on('finish', () => { stream.close(); resolve(); });
        }).on('error', reject);
        return;
      }
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(); });
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Generating ${WORDS.length} images into ${OUTPUT_DIR}\n`);

  for (const word of WORDS) {
    const filepath = path.join(OUTPUT_DIR, `${word.id}.png`);

    if (fs.existsSync(filepath)) {
      console.log(`[SKIP] ${word.id}.png already exists`);
      continue;
    }

    console.log(`[GENERATING] ${word.id}...`);
    try {
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: word.prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      });

      const url = response.data[0].url;
      await downloadImage(url, filepath);
      console.log(`[OK] ${word.id}.png saved`);
    } catch (err) {
      console.error(`[FAIL] ${word.id}: ${err.message}`);
    }
  }

  console.log('\nDone! Review the images in:');
  console.log(OUTPUT_DIR);
}

main();
