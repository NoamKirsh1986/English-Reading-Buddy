function PandaTutor({ isTalking, isListening }) {
  return (
    <div className="panda-character-container">
      <div className={`panda-character ${isTalking ? 'panda-talking' : ''} ${isListening ? 'panda-listening' : ''}`}>
        <img
          src="/panda-tutor.svg"
          alt="Panda Buddy"
          className="panda-avatar-img"
        />
      </div>
      <span className="panda-name-label">Panda Buddy</span>
    </div>
  );
}

export default PandaTutor;
