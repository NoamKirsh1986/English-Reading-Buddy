function PandaTutor({ isTalking, isListening }) {
  return (
    <div className="panda-character-container">
      <div className={`panda-character ${isTalking ? 'panda-talking' : ''} ${isListening ? 'panda-listening' : ''}`}>
        <div className="panda-body">
          {/* Ears */}
          <div className="panda-ear panda-ear-left"></div>
          <div className="panda-ear panda-ear-right"></div>
          {/* Head */}
          <div className="panda-head">
            {/* Eye patches */}
            <div className="panda-eye-patch panda-eye-patch-left">
              <div className="panda-eye panda-eye-left">
                <div className="panda-pupil"></div>
              </div>
            </div>
            <div className="panda-eye-patch panda-eye-patch-right">
              <div className="panda-eye panda-eye-right">
                <div className="panda-pupil"></div>
              </div>
            </div>
            {/* Nose */}
            <div className="panda-nose"></div>
            {/* Mouth */}
            <div className={`panda-mouth ${isTalking ? 'panda-mouth-talking' : ''}`}></div>
            {/* Sunglasses on forehead for "cool" look */}
            <div className="panda-sunglasses">
              <div className="panda-lens panda-lens-left"></div>
              <div className="panda-lens panda-lens-right"></div>
              <div className="panda-bridge"></div>
            </div>
          </div>
        </div>
      </div>
      <span className="panda-name-label">Panda Buddy</span>
    </div>
  );
}

export default PandaTutor;
