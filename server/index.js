require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const storyRoutes = require('./routes/story');
const voiceRoutes = require('./routes/voice');
const realtimeRoutes = require('./routes/realtime');
const tutorRoutes = require('./routes/tutor');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/story', storyRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/tutor', tutorRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
