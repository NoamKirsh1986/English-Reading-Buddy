import { useState } from 'react';

export default function QuizContent({
  word,
  contrastWord,
  wordImageUrl,
  contrastImageUrl,
  questionNumber,
  totalQuestions,
  onAnswer,
  disabled,
}) {
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);

  // Randomize order: sometimes word is left, sometimes right
  const [flipped] = useState(() => Math.random() > 0.5);
  const leftWord = flipped ? contrastWord : word;
  const rightWord = flipped ? word : contrastWord;
  const leftImage = flipped ? contrastImageUrl : wordImageUrl;
  const rightImage = flipped ? wordImageUrl : contrastImageUrl;

  const handleClick = (side) => {
    if (disabled || showResult) return;
    const pickedWord = side === 'left' ? leftWord : rightWord;
    const isCorrect = pickedWord === word;
    setSelected(side);
    setShowResult(true);

    const correctSide = leftWord === word ? 'left' : 'right';
    onAnswer(isCorrect, correctSide);
  };

  const correctSide = leftWord === word ? 'left' : 'right';

  return (
    <div className="quiz-content">
      <div className="quiz-header">
        <span className="quiz-progress">{questionNumber} / {totalQuestions}</span>
      </div>

      <div className="quiz-images">
        <button
          className={`quiz-image-btn ${
            showResult
              ? selected === 'left' && correctSide === 'left'
                ? 'correct'
                : selected === 'left' && correctSide !== 'left'
                ? 'wrong'
                : correctSide === 'left'
                ? 'reveal-correct'
                : ''
              : ''
          }`}
          onClick={() => handleClick('left')}
          disabled={disabled || showResult}
        >
          {leftImage ? (
            <img src={leftImage} alt="" className="quiz-image" />
          ) : (
            <div className="quiz-image-loading"><div className="spinner" /></div>
          )}
          {showResult && correctSide === 'left' && selected === 'left' && (
            <span className="star-badge">&#11088;</span>
          )}
        </button>

        <button
          className={`quiz-image-btn ${
            showResult
              ? selected === 'right' && correctSide === 'right'
                ? 'correct'
                : selected === 'right' && correctSide !== 'right'
                ? 'wrong'
                : correctSide === 'right'
                ? 'reveal-correct'
                : ''
              : ''
          }`}
          onClick={() => handleClick('right')}
          disabled={disabled || showResult}
        >
          {rightImage ? (
            <img src={rightImage} alt="" className="quiz-image" />
          ) : (
            <div className="quiz-image-loading"><div className="spinner" /></div>
          )}
          {showResult && correctSide === 'right' && selected === 'right' && (
            <span className="star-badge">&#11088;</span>
          )}
        </button>
      </div>
    </div>
  );
}
