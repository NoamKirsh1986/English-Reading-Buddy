import { useState, useCallback } from 'react';
import OnboardingScreen from './components/OnboardingScreen';
import LessonScreen from './components/LessonScreen';

const PHASES = {
  ONBOARDING: 'onboarding',
  CONVERSATION: 'conversation',
  EXTRACTING: 'extracting',
  QUIZ: 'quiz',
  SUMMARY: 'summary',
};

export default function App() {
  const [phase, setPhase] = useState(PHASES.ONBOARDING);
  const [childName, setChildName] = useState('');
  const [extractedWords, setExtractedWords] = useState(null);

  const handleStart = useCallback((name) => {
    setChildName(name);
    setPhase(PHASES.CONVERSATION);
  }, []);

  const handleConversationEnd = useCallback(async (transcript) => {
    setPhase(PHASES.EXTRACTING);

    try {
      const res = await fetch('/api/lesson/extract-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      setExtractedWords(data.words);
      setPhase(PHASES.QUIZ);
    } catch (err) {
      console.error('Word extraction failed:', err);
      setExtractedWords([
        { word: 'father', contrast: 'mother' },
        { word: 'brother', contrast: 'sister' },
        { word: 'grandmother', contrast: 'grandfather' },
        { word: 'daughter', contrast: 'son' },
        { word: 'aunt', contrast: 'uncle' },
      ]);
      setPhase(PHASES.QUIZ);
    }
  }, []);

  const handleExit = useCallback(() => {
    setPhase(PHASES.ONBOARDING);
    setExtractedWords(null);
  }, []);

  return (
    <div className="app">
      {phase === PHASES.ONBOARDING && (
        <OnboardingScreen onStart={handleStart} />
      )}

      {phase === PHASES.CONVERSATION && (
        <LessonScreen
          childName={childName}
          onConversationEnd={handleConversationEnd}
          onExit={handleExit}
        />
      )}

      {phase === PHASES.EXTRACTING && (
        <div className="transition-screen">
          <div className="spinner" />
          <h2>Getting your word game ready...</h2>
          <p dir="rtl">...מכין את משחק המילים שלך</p>
        </div>
      )}

      {phase === PHASES.QUIZ && (
        <div className="transition-screen">
          <h2>Word Game Coming Soon!</h2>
          <p>Words to practice:</p>
          {extractedWords && (
            <ul className="word-list">
              {extractedWords.map((w, i) => (
                <li key={i}>
                  <strong>{w.word}</strong> vs <strong>{w.contrast}</strong>
                </li>
              ))}
            </ul>
          )}
          <button className="primary-btn" onClick={handleExit}>Back to Start</button>
        </div>
      )}
    </div>
  );
}
