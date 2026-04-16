export default function SubtitleBar({ text }) {
  if (!text) return null;

  return (
    <div className="subtitle-bar">
      <p className="subtitle-text">{text}</p>
    </div>
  );
}
