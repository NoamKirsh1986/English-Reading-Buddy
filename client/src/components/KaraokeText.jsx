import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

function KaraokeText({ text, isReading, onComplete, onTranscriptUpdate, language, tutorSpeaking, tutorReadingTranscript }) {
  const words = useMemo(() => text.split(/\s+/), [text]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [selectedWord, setSelectedWord] = useState(null);
  const [wordExplanation, setWordExplanation] = useState(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const onCompleteRef = useRef(onComplete);
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);

  // Keep refs in sync with latest props without triggering effect re-runs
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onTranscriptUpdateRef.current = onTranscriptUpdate;
  }, [onTranscriptUpdate]);

  const normalizeWord = (word) => {
    return word.replace(/[^a-zA-Z']/g, '').toLowerCase();
  };

  const findMatchIndex = useCallback(
    (transcript) => {
      const spokenWords = transcript
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 0);

      let matchedIndex = -1;
      let textIdx = 0;

      for (const spoken of spokenWords) {
        if (textIdx >= words.length) break;

        const target = normalizeWord(words[textIdx]);
        const spokenClean = spoken.replace(/[^a-zA-Z']/g, '');

        if (!target) {
          textIdx++;
          continue;
        }

        if (
          spokenClean === target ||
          (target.length > 3 && spokenClean.startsWith(target.slice(0, 3))) ||
          (spokenClean.length > 3 && target.startsWith(spokenClean.slice(0, 3)))
        ) {
          matchedIndex = textIdx;
          textIdx++;
        }
      }

      return matchedIndex;
    },
    [words]
  );

  useEffect(() => {
    if (!isReading) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    transcriptRef.current = '';
    setCurrentWordIndex(-1);

    recognition.onresult = (event) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript + ' ';
      }

      transcriptRef.current = fullTranscript.trim();
      onTranscriptUpdateRef.current?.(transcriptRef.current);

      const matchIdx = findMatchIndex(transcriptRef.current);
      setCurrentWordIndex(matchIdx);

      if (matchIdx >= words.length - 1) {
        onCompleteRef.current?.(transcriptRef.current);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Please allow microphone access to use the reading feature.');
      }
    };

    recognition.onend = () => {
      if (isReading && recognitionRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Already started
        }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }

    return () => {
      try {
        recognition.stop();
      } catch (e) {
        // Already stopped
      }
      recognitionRef.current = null;
    };
  }, [isReading, findMatchIndex, words.length]);

  // Pause/resume recognition when tutor is speaking to avoid echo
  useEffect(() => {
    if (!recognitionRef.current || !isReading) return;

    if (tutorSpeaking) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started
      }
    }
  }, [tutorSpeaking, isReading]);

  // Drive karaoke highlighting from tutor's reading transcript
  useEffect(() => {
    if (tutorReadingTranscript) {
      const matchIdx = findMatchIndex(tutorReadingTranscript);
      setCurrentWordIndex(matchIdx);
    }
  }, [tutorReadingTranscript, findMatchIndex]);

  // Reset when text changes
  useEffect(() => {
    setCurrentWordIndex(-1);
    setSelectedWord(null);
    setWordExplanation(null);
  }, [text]);

  const handleWordClick = async (word, index) => {
    if (selectedWord === index) {
      setSelectedWord(null);
      setWordExplanation(null);
      return;
    }

    setSelectedWord(index);
    setLoadingExplanation(true);
    setWordExplanation(null);

    try {
      const res = await fetch('/api/voice/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: normalizeWord(word),
          sentence: text,
          nativeLanguage: language,
        }),
      });
      const data = await res.json();
      setWordExplanation(data.explanation);
    } catch (err) {
      setWordExplanation('Could not load explanation.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  return (
    <div className="karaoke-container">
      <div className="karaoke-text">
        {words.map((word, index) => (
          <span
            key={index}
            className={`karaoke-word${
              index < currentWordIndex ? ' word-read' : ''
            }${index === currentWordIndex ? ' word-current' : ''}${
              index === selectedWord ? ' word-selected' : ''
            }`}
            onClick={() => handleWordClick(word, index)}
            title="Click for explanation"
          >
            {word}{' '}
          </span>
        ))}
      </div>

      {isReading && currentWordIndex === -1 && (
        <p className="reading-hint">Start reading aloud...</p>
      )}

      {selectedWord !== null && (
        <div className="word-explanation">
          <button
            className="close-explanation"
            onClick={() => {
              setSelectedWord(null);
              setWordExplanation(null);
            }}
          >
            ×
          </button>
          <h4>"{normalizeWord(words[selectedWord])}"</h4>
          {loadingExplanation ? (
            <p className="loading-text">Explaining...</p>
          ) : (
            <p>{wordExplanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default KaraokeText;
