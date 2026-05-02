import { useCallback, useEffect, useRef } from 'react';
import { formatDuration } from '../lib/utils';
import { useUpdateTask } from '../hooks/useTasks';
import { onFocusManualRecord } from '../lib/focusSessionEvents';
import { useFocusSessionStore } from '../stores/useFocusSessionStore';
import type { FocusPhase, SelectedTaskInfo } from '../stores/useFocusSessionStore';

export function FocusSessionManager() {
  const {
    currentPhase,
    focusDuration,
    shortBreakDuration,
    longBreakDuration,
    secondsLeft,
    isRunning,
    cycleCount,
    selectedTask,
    setSecondsLeft,
    setPhase,
    setCycleCount,
    setIsRunning,
    setLastRecordedLabel,
    setSelectedTask,
  } = useFocusSessionStore();

  const updateTask = useUpdateTask();
  const timeoutRef = useRef<number | null>(null);

  const recordFocusSeconds = useCallback(
    (seconds: number) => {
      if (!selectedTask) {
        setLastRecordedLabel(`Focus session complete (+${formatDuration(seconds)})`);
        return;
      }
      const payload = {
        id: selectedTask.id,
        data: {
          focus_time_seconds: (selectedTask.focusTimeSeconds ?? 0) + seconds,
        },
      };
      updateTask.mutate(payload, {
        onSuccess: (updated) => {
          const next: SelectedTaskInfo = {
            id: updated.id,
            title: updated.title,
            focusTimeSeconds: updated.focus_time_seconds ?? 0,
          };
          setSelectedTask(next);
          setLastRecordedLabel(`+${formatDuration(seconds)} recorded for ${updated.title}`);
        },
        onError: () => {
          setLastRecordedLabel('Unable to record focus time right now.');
        },
      });
    },
    [selectedTask, setLastRecordedLabel, setSelectedTask, updateTask]
  );

  const handlePhaseComplete = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsRunning(false);
    if (currentPhase === 'focus') {
      const focusSeconds = focusDuration * 60;
      const nextCycle = cycleCount + 1;
      const nextPhase: FocusPhase = nextCycle % 4 === 0 ? 'longBreak' : 'shortBreak';
      const nextSeconds =
        nextPhase === 'longBreak' ? longBreakDuration * 60 : shortBreakDuration * 60;
      setCycleCount(nextCycle);
      setPhase(nextPhase);
      setSecondsLeft(nextSeconds);
      recordFocusSeconds(focusSeconds);
      timeoutRef.current = window.setTimeout(() => {
        setIsRunning(true);
      }, 600);
    } else {
      const nextSeconds = focusDuration * 60;
      setPhase('focus');
      setSecondsLeft(nextSeconds);
      timeoutRef.current = window.setTimeout(() => {
        setIsRunning(true);
      }, 600);
    }
  }, [
    currentPhase,
    focusDuration,
    shortBreakDuration,
    longBreakDuration,
    cycleCount,
    recordFocusSeconds,
    setCycleCount,
    setPhase,
    setSecondsLeft,
    setIsRunning,
  ]);

  useEffect(() => {
    if (!isRunning) return undefined;
    const intervalId = window.setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning, setSecondsLeft]);

  useEffect(() => {
    if (!isRunning) return;
    if (secondsLeft <= 0) {
      handlePhaseComplete();
    }
  }, [secondsLeft, isRunning, handlePhaseComplete]);

  useEffect(() => () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const cleanup = onFocusManualRecord(() => {
      if (currentPhase !== 'focus') return;
      if (!isRunning) return;
      const elapsed = focusDuration * 60 - secondsLeft;
      if (elapsed <= 5) return;
      recordFocusSeconds(elapsed);
      handlePhaseComplete();
    });
    return cleanup;
  }, [currentPhase, focusDuration, secondsLeft, isRunning, recordFocusSeconds, handlePhaseComplete]);

  return null;
}
