import { useMemo, useEffect, useState, useCallback } from 'react';

function KaraokeText({ text, isReading, spokenText, wordResults }) {
  const words = useMemo(() => text.split(/\s+/), [text]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);

  const normalizeWord = (word) => {
    return word.replace(/[^a-zA-Z']/g, '').toLowerCase();
  };

  // Drive karaoke highlighting during live reading
  const findMatchIndex = useCallback(
    (transcript) => {
      if (!transcript) return -1;
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
    if (isReading && spokenText) {
      const idx = findMatchIndex(spokenText);
      setCurrentWordIndex(idx);
    }
  }, [isReading, spokenText, findMatchIndex]);

  // Reset highlight when text changes or reading starts fresh
  useEffect(() => {
    setCurrentWordIndex(-1);
  }, [text]);

  const getWordClass = (index) => {
    // If we have word results (post-analysis), show green/orange
    if (wordResults && wordResults[index]) {
      const status = wordResults[index].status;
      if (status === 'correct') return 'word-correct';
      if (status === 'incorrect') return 'word-incorrect';
    }

    // During live reading, show karaoke highlighting
    if (isReading) {
      if (index < currentWordIndex) return 'word-read';
      if (index === currentWordIndex) return 'word-current';
    }

    return '';
  };

  return (
    <div className="karaoke-container">
      <div className="karaoke-text">
        {words.map((word, index) => (
          <span
            key={index}
            className={`karaoke-word ${getWordClass(index)}`}
          >
            {word}{' '}
          </span>
        ))}
      </div>
      {isReading && currentWordIndex === -1 && (
        <p className="reading-hint">Start reading aloud...</p>
      )}
    </div>
  );
}

export default KaraokeText;
