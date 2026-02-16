import { useState, useCallback } from 'react';
import KaraokeText from './KaraokeText';
import BearTutor from './BearTutor';

function StoryViewer({ story, language, onBack }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [readingComplete, setReadingComplete] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [tutorTranscript, setTutorTranscript] = useState(null);

  const page = story.pages[currentPage];
  const isLastPage = currentPage === story.pages.length - 1;
  const isFirstPage = currentPage === 0;

  const handleStartReading = () => {
    setIsReading(true);
    setReadingComplete(false);
    setSpokenText('');
    setTutorTranscript(null);
  };

  const handleStopReading = () => {
    setIsReading(false);
  };

  const handleReadingComplete = (transcript) => {
    setReadingComplete(true);
    setSpokenText(transcript);
    setIsReading(false);
  };

  const handleTutorSpeaking = useCallback((speaking) => {
    setTutorSpeaking(speaking);
  }, []);

  const handleTutorTranscript = useCallback((transcript) => {
    setTutorTranscript(transcript);
  }, []);

  const handleNextPage = () => {
    if (!isLastPage) {
      setCurrentPage((prev) => prev + 1);
      setIsReading(false);
      setReadingComplete(false);
      setSpokenText('');
      setTutorSpeaking(false);
      setTutorTranscript(null);
    }
  };

  const handlePrevPage = () => {
    if (!isFirstPage) {
      setCurrentPage((prev) => prev - 1);
      setIsReading(false);
      setReadingComplete(false);
      setSpokenText('');
      setTutorSpeaking(false);
      setTutorTranscript(null);
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
          tutorSpeaking={tutorSpeaking}
          tutorReadingTranscript={tutorTranscript}
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

      <BearTutor
        pageText={page.text}
        language={language}
        isReading={isReading}
        isReadingComplete={readingComplete}
        onTutorSpeaking={handleTutorSpeaking}
        onTutorTranscript={handleTutorTranscript}
      />
    </div>
  );
}

export default StoryViewer;
