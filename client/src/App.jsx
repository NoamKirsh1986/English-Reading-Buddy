import { useState, useCallback } from 'react';
import OnboardingScreen from './components/OnboardingScreen';
import LessonScreen from './components/LessonScreen';

export default function App() {
  const [inLesson, setInLesson] = useState(false);
  const [childName, setChildName] = useState('');

  const handleStart = useCallback((name) => {
    setChildName(name);
    setInLesson(true);
  }, []);

  const handleExit = useCallback(() => {
    setInLesson(false);
  }, []);

  return (
    <div className="app">
      {!inLesson ? (
        <OnboardingScreen onStart={handleStart} />
      ) : (
        <LessonScreen childName={childName} onExit={handleExit} />
      )}
    </div>
  );
}
