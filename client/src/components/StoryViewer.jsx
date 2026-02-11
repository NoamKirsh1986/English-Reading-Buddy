import { useState } from 'react';
import KaraokeText from './KaraokeText';
import VoiceTeacher from './VoiceTeacher';

function StoryViewer({ story, language, onBack }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [readingComplete, setReadingComplete] = useState(false);
  const [spokenText, setSpokenText] = useState('');

  const page = story.pages[currentPage];
  const isLastPage = currentPage === story.pages.length - 1;
  const isFirstPage = currentPage === 0;

  const handleStartReading = () => {
    setIsReading(true);
    setReadingComplete(false);
    setSpokenText('');
  };

  const handleStopReading = () => {
    setIsReading(false);
  };

  const handleReadingComplete = (transcript) => {
    setReadingComplete(true);
    setSpokenText(transcript);
    setIsReading(false);
  };

  const handleNextPage = () => {
    if (!isLastPage) {
      setCurrentPage((prev) => prev + 1);
      setIsReading(false);
      setReadingComplete(false);
      setSpokenText('');
    }
  };

  const handlePrevPage = () => {
    if (!isFirstPage) {
      setCurrentPage((prev) => prev - 1);
      setIsReading(false);
      setReadingComplete(false);
      setSpokenText('');
    }
  };

  return (
    <div className="story-viewer">
      <div className="story-controls-top">
        <button className="back-btn" onClick={onBack}>
          New Story
        </button>
        <span className="page-indicator">
          Page {currentPage + 1} of {story.pages.length}
        </span>
      </div>

      <div className="story-content">
        {page.imageUrl && (
          <div className="story-image-container">
            <img
              src={page.imageUrl}
              alt="Story illustration"
              className="story-image"
            />
          </div>
        )}

        <KaraokeText
          text={page.text}
          isReading={isReading}
          onComplete={handleReadingComplete}
          onTranscriptUpdate={setSpokenText}
          language={language}
        />
      </div>

      <div className="reading-controls">
        {!isReading ? (
          <button className="read-btn" onClick={handleStartReading}>
            {readingComplete ? 'Read Again' : 'Start Reading'}
          </button>
        ) : (
          <button className="stop-btn" onClick={handleStopReading}>
            Stop Reading
          </button>
        )}
      </div>

      <VoiceTeacher
        originalText={page.text}
        spokenText={spokenText}
        isReadingComplete={readingComplete}
        language={language}
      />

      <div className="page-navigation">
        <button
          className="nav-btn prev-btn"
          onClick={handlePrevPage}
          disabled={isFirstPage}
        >
          Previous Page
        </button>
        <button
          className="nav-btn next-btn"
          onClick={handleNextPage}
          disabled={isLastPage}
        >
          {isLastPage ? 'The End!' : 'Next Page'}
        </button>
      </div>
    </div>
  );
}

export default StoryViewer;
