export default function SummaryScreen({ score, totalQuestions, onFinish }) {
  const stars = Array.from({ length: totalQuestions }, (_, i) => i < score);

  return (
    <div className="summary-screen">
      <h1 className="summary-title">Great Job! / !כל הכבוד</h1>

      <div className="summary-stars">
        {stars.map((filled, i) => (
          <span
            key={i}
            className={`summary-star ${filled ? 'filled' : 'empty'}`}
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            {filled ? '\u2B50' : '\u2606'}
          </span>
        ))}
      </div>

      <p className="summary-score">
        {score} / {totalQuestions} correct
      </p>

      <button className="primary-btn" onClick={onFinish}>
        Finish / סיום
      </button>
    </div>
  );
}
