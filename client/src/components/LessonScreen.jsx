import { useState, useEffect, useRef, useCallback } from 'react';
import TopBar from './TopBar';
import TutorTile from './TutorTile';
import ChildTile from './ChildTile';
import QuizContent from './QuizContent';
import SummaryScreen from './SummaryScreen';
import useRealtimeSession from '../hooks/useRealtimeSession';

const CONVERSATION_SECONDS = 5 * 60;

const LUMEE_QUIZ_INSTRUCTIONS = (childName) => `You are Lumee, a warm English tutor for Hebrew-speaking children aged 5-9.

You are now playing a word game with ${childName}. You just finished a fun conversation about their family.

HOW THE GAME WORKS:
- The system will tell you which word to ask about and what the two picture options are.
- Ask the child to click the picture that shows that word. Be playful: "Which picture shows a FATHER? Click on it!" / "?איזו תמונה מראה FATHER? תלחץ עליה"
- Keep it short — one sentence asking the question, then wait.
- After the child clicks, the system will tell you if they were right or wrong.

WHEN THE CHILD IS CORRECT:
- Celebrate enthusiastically! "Yes! Amazing! That's a father! אבא! Great job!"
- Keep it to 1-2 short sentences.

WHEN THE CHILD IS WRONG:
- Stay warm and encouraging. Point out the correct answer.
- Briefly explain: "Actually, this one is the father — אבא. The other one is the mother — אמא. That's okay, you're doing great!"
- Keep it to 2-3 short sentences. Don't dwell on the mistake.

GENERAL:
- Mix English and Hebrew naturally.
- Be encouraging and playful throughout.
- Speak at a pace appropriate for a young child.`;

const PHASES = {
  CONVERSATION: 'conversation',
  TRANSITIONING: 'transitioning',
  QUIZ: 'quiz',
  SUMMARY: 'summary',
};

export default function LessonScreen({ childName, onExit }) {
  const {
    connect,
    disconnect,
    sendWrapUp,
    updateInstructions,
    sendSystemMessage,
    toggleMute,
    isConnected,
    isTutorSpeaking,
    isMuted,
    transcript,
  } = useRealtimeSession();

  const [phase, setPhase] = useState(PHASES.CONVERSATION);
  const [timeLeft, setTimeLeft] = useState(CONVERSATION_SECONDS);
  const [videoStream, setVideoStream] = useState(null);
  const [error, setError] = useState(null);
  const [isWrappingUp, setIsWrappingUp] = useState(false);

  // Quiz state
  const [words, setWords] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [questionImages, setQuestionImages] = useState({});
  const [quizReady, setQuizReady] = useState(false);
  const [waitingForLumee, setWaitingForLumee] = useState(false);

  const timerRef = useRef(null);
  const hasWrappedUpRef = useRef(false);
  const wrapUpDoneTimerRef = useRef(null);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Generate images for a question index
  const generateQuestionImages = useCallback(async (questionWords, index) => {
    if (index >= questionWords.length) return;
    const q = questionWords[index];
    try {
      const [wordRes, contrastRes] = await Promise.all([
        fetch('/api/lesson/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: q.word }),
        }).then((r) => r.json()),
        fetch('/api/lesson/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: q.contrast }),
        }).then((r) => r.json()),
      ]);
      setQuestionImages((prev) => ({
        ...prev,
        [index]: {
          wordImageUrl: wordRes.imageUrl,
          contrastImageUrl: contrastRes.imageUrl,
        },
      }));
    } catch (err) {
      console.error(`Failed to generate images for Q${index + 1}:`, err);
      setQuestionImages((prev) => ({
        ...prev,
        [index]: { wordImageUrl: null, contrastImageUrl: null },
      }));
    }
  }, []);

  // Transition from conversation to quiz
  const startQuizTransition = useCallback(async (conversationTranscript) => {
    setPhase(PHASES.TRANSITIONING);

    // Extract words
    let extractedWords;
    try {
      const res = await fetch('/api/lesson/extract-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: conversationTranscript }),
      });
      const data = await res.json();
      extractedWords = data.words;
    } catch {
      extractedWords = [
        { word: 'father', contrast: 'mother' },
        { word: 'brother', contrast: 'sister' },
        { word: 'grandmother', contrast: 'grandfather' },
        { word: 'daughter', contrast: 'son' },
        { word: 'aunt', contrast: 'uncle' },
      ];
    }
    setWords(extractedWords);

    // Generate images for Q1, start Q2 in background
    await generateQuestionImages(extractedWords, 0);
    generateQuestionImages(extractedWords, 1);

    // Update Lumee's instructions to quiz mode
    updateInstructions(LUMEE_QUIZ_INSTRUCTIONS(childName));

    setPhase(PHASES.QUIZ);
    setQuizReady(true);
  }, [generateQuestionImages, updateInstructions, childName]);

  // When quiz is ready and we have images for current question, ask Lumee
  useEffect(() => {
    if (phase !== PHASES.QUIZ || !quizReady || !words) return;
    if (!questionImages[currentQ]) return;
    if (waitingForLumee) return;

    const q = words[currentQ];
    sendSystemMessage(
      `[SYSTEM: Ask the child to click the picture that shows "${q.word}". The two pictures show "${q.word}" and "${q.contrast}". This is question ${currentQ + 1} of ${words.length}. Ask in a fun, playful way.]`
    );
    setWaitingForLumee(true);
  }, [phase, quizReady, words, currentQ, questionImages, waitingForLumee, sendSystemMessage]);

  const handleQuizAnswer = useCallback((isCorrect, correctSide) => {
    if (!words) return;
    const q = words[currentQ];

    if (isCorrect) {
      setScore((s) => s + 1);
      sendSystemMessage(
        `[SYSTEM: The child clicked the CORRECT picture! It was "${q.word}". Celebrate enthusiastically!]`
      );
    } else {
      sendSystemMessage(
        `[SYSTEM: The child clicked the WRONG picture. They clicked "${q.contrast}" instead of "${q.word}". The correct picture was on the ${correctSide} side. Gently explain which one was correct and encourage them.]`
      );
    }

    // Pre-generate images for Q+2 (Q+1 already started)
    if (currentQ + 2 < words.length) {
      generateQuestionImages(words, currentQ + 2);
    }

    // Move to next question after a delay for Lumee to react
    setTimeout(() => {
      const nextQ = currentQ + 1;
      if (nextQ >= words.length) {
        sendSystemMessage(
          `[SYSTEM: The word game is over! The child got ${score + (isCorrect ? 1 : 0)} out of ${words.length} correct. Give them a warm, encouraging summary. Say goodbye and tell them you're proud of them. Mix English and Hebrew.]`
        );
        setTimeout(() => {
          setPhase(PHASES.SUMMARY);
        }, 8000);
      } else {
        setCurrentQ(nextQ);
        setWaitingForLumee(false);
      }
    }, 5000);
  }, [words, currentQ, score, sendSystemMessage, generateQuestionImages]);

  // Timer → wrap-up → quiz transition
  useEffect(() => {
    if (timeLeft === 0 && !hasWrappedUpRef.current) {
      hasWrappedUpRef.current = true;
      setIsWrappingUp(true);
      sendWrapUp();

      wrapUpDoneTimerRef.current = setTimeout(() => {
        setIsWrappingUp(false);
        startQuizTransition(transcript);
      }, 12000);
    }
  }, [timeLeft, sendWrapUp, startQuizTransition, transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wrapUpDoneTimerRef.current) clearTimeout(wrapUpDoneTimerRef.current);
      disconnect();
      if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: { sampleRate: 24000, channelCount: 1 },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const videoOnlyStream = new MediaStream(stream.getVideoTracks());
        setVideoStream(videoOnlyStream);

        const audioStream = new MediaStream(stream.getAudioTracks());
        await connect(childName, audioStream);
        startTimer();
      } catch (err) {
        console.error('Init error:', err);

        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: { sampleRate: 24000, channelCount: 1 },
          });
          if (cancelled) {
            audioStream.getTracks().forEach((t) => t.stop());
            return;
          }
          await connect(childName, audioStream);
          startTimer();
        } catch (audioErr) {
          if (!cancelled) {
            setError('Could not access microphone. Please allow mic access and try again.');
          }
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkip = useCallback(() => {
    if (hasWrappedUpRef.current) return;
    hasWrappedUpRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsWrappingUp(true);

    sendWrapUp();
    wrapUpDoneTimerRef.current = setTimeout(() => {
      setIsWrappingUp(false);
      startQuizTransition(transcript);
    }, 8000);
  }, [sendWrapUp, startQuizTransition, transcript]);

  const handlePause = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (wrapUpDoneTimerRef.current) clearTimeout(wrapUpDoneTimerRef.current);
    disconnect();
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop());
    }
    onExit();
  }, [disconnect, videoStream, onExit]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleFinish = useCallback(() => {
    disconnect();
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop());
    }
    onExit();
  }, [disconnect, videoStream, onExit]);

  if (error) {
    return (
      <div className="lesson-screen">
        <div className="lesson-error">
          <p>{error}</p>
          <button onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }

  if (phase === PHASES.SUMMARY) {
    return (
      <SummaryScreen
        score={score}
        totalQuestions={words ? words.length : 5}
        onFinish={handleFinish}
      />
    );
  }

  const isQuiz = phase === PHASES.QUIZ;
  const currentImages = isQuiz && words ? questionImages[currentQ] : null;

  return (
    <div className="lesson-screen">
      <TopBar
        title={isQuiz ? 'Word Game \u00B7 \u05DE\u05E9\u05D7\u05E7 \u05DE\u05D9\u05DC\u05D9\u05DD' : 'Me and My Family \u00B7 \u05D0\u05E0\u05D9 \u05D5\u05D4\u05DE\u05E9\u05E4\u05D7\u05D4 \u05E9\u05DC\u05D9'}
        timeLeft={isQuiz ? null : timeLeft}
        onSkip={isQuiz ? null : handleSkip}
        onPause={handlePause}
        onFullscreen={handleFullscreen}
      />

      {!isConnected && !error && (
        <div className="connecting-overlay">
          <div className="spinner" />
          <p>Connecting to Lumee...</p>
        </div>
      )}

      {phase === PHASES.TRANSITIONING && (
        <div className="connecting-overlay">
          <div className="spinner" />
          <p>Getting your word game ready...</p>
          <p dir="rtl" style={{ color: '#999', fontSize: '0.95rem' }}>...מכין את משחק המילים שלך</p>
        </div>
      )}

      <div className={`lesson-body ${isQuiz ? 'quiz-layout' : 'conversation-layout'}`}>
        {isQuiz && (
          <div className="quiz-area">
            {currentImages ? (
              <QuizContent
                key={currentQ}
                word={words[currentQ].word}
                contrastWord={words[currentQ].contrast}
                wordImageUrl={currentImages.wordImageUrl}
                contrastImageUrl={currentImages.contrastImageUrl}
                questionNumber={currentQ + 1}
                totalQuestions={words.length}
                onAnswer={handleQuizAnswer}
                disabled={false}
              />
            ) : (
              <div className="quiz-loading">
                <div className="spinner" />
                <p>Creating pictures...</p>
              </div>
            )}
          </div>
        )}

        <div className={`tiles-container ${isQuiz ? 'tiles-sidebar' : 'tiles-center'}`}>
          <TutorTile isSpeaking={isTutorSpeaking} />
          <ChildTile
            childName={childName}
            videoStream={videoStream}
            isMuted={isMuted}
            onToggleMute={toggleMute}
          />
        </div>
      </div>

      {isWrappingUp && phase === PHASES.CONVERSATION && (
        <div className="wrapping-banner">Finishing up...</div>
      )}
    </div>
  );
}
