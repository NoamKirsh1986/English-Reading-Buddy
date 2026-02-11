import { useState } from 'react';
import LanguageSelector from './components/LanguageSelector';
import StoryViewer from './components/StoryViewer';
import { generateStory } from './services/api';

function App() {
  const [language, setLanguage] = useState('Hebrew');
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateStory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateStory();
      setStory(data);
    } catch (err) {
      setError(err.message || 'Failed to generate story');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    setStory(null);
    setError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>English Reading Buddy</h1>
        <p className="subtitle">Practice reading English with fun stories!</p>
      </header>

      {!story ? (
        <main className="home-screen">
          <div className="setup-card">
            <LanguageSelector value={language} onChange={setLanguage} />

            <button
              className="generate-btn"
              onClick={handleGenerateStory}
              disabled={loading}
            >
              {loading ? (
                <span className="loading-content">
                  <span className="spinner"></span>
                  Creating your story...
                </span>
              ) : (
                'Generate Story'
              )}
            </button>

            {error && <p className="error-message">{error}</p>}
          </div>

          {loading && (
            <div className="loading-info">
              <p>Writing a story and drawing pictures just for you...</p>
              <p className="loading-sub">This may take a moment</p>
            </div>
          )}
        </main>
      ) : (
        <main className="reading-screen">
          <StoryViewer
            story={story}
            language={language}
            onBack={handleBackToHome}
          />
        </main>
      )}
    </div>
  );
}

export default App;
