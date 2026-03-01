import { useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '../components/ui';
import { useTasks } from '../hooks/useTasks';
import { formatDuration } from '../lib/utils';
import { requestFocusManualRecord } from '../lib/focusSessionEvents';
import { useFocusSessionStore } from '../stores/useFocusSessionStore';

const PHASE_LABELS = {
  focus: 'Focus session',
  shortBreak: 'Short break',
  longBreak: 'Long break',
} as const;

export default function Focus() {
  const { data: tasks = [] } = useTasks();
  const {
    currentPhase,
    secondsLeft,
    focusDuration,
    shortBreakDuration,
    longBreakDuration,
    isRunning,
    cycleCount,
    selectedTask,
    lastRecordedLabel,
    setDurations,
    start,
    pause,
    togglePiP,
    pipOpen,
    setSelectedTask,
    setSecondsLeft,
    setPhase,
    setIsRunning,
  } = useFocusSessionStore();

  const totalPhaseSeconds = useMemo(() => {
    if (currentPhase === 'focus') return focusDuration * 60;
    if (currentPhase === 'shortBreak') return shortBreakDuration * 60;
    return longBreakDuration * 60;
  }, [currentPhase, focusDuration, shortBreakDuration, longBreakDuration]);

  const progressPercent = useMemo(() => {
    if (!totalPhaseSeconds) return 0;
    return Math.min(100, ((totalPhaseSeconds - secondsLeft) / totalPhaseSeconds) * 100);
  }, [secondsLeft, totalPhaseSeconds]);

  const accentRingStyle = useMemo(
    () => ({
      background: `conic-gradient(var(--color-ring) ${progressPercent}%, rgba(255,255,255,0.1) ${progressPercent}% 100%)`,
    }),
    [progressPercent]
  );

  useEffect(() => {
    if (!tasks.length) {
      if (selectedTask !== null) {
        setSelectedTask(null);
      }
      return;
    }
    if (!selectedTask) {
      const first = tasks[0];
      setSelectedTask({
        id: first.id,
        title: first.title,
        focusTimeSeconds: first.focus_time_seconds ?? 0,
      });
      return;
    }
    const updated = tasks.find((task) => task.id === selectedTask.id);
    if (!updated) {
      setSelectedTask(null);
      return;
    }
    if (
      updated.title !== selectedTask.title ||
      (updated.focus_time_seconds ?? 0) !== selectedTask.focusTimeSeconds
    ) {
      setSelectedTask({
        id: updated.id,
        title: updated.title,
        focusTimeSeconds: updated.focus_time_seconds ?? 0,
      });
    }
  }, [tasks, selectedTask, setSelectedTask]);

  const handleTaskChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = tasks.find((task) => task.id === event.target.value);
    if (next) {
      setSelectedTask({
        id: next.id,
        title: next.title,
        focusTimeSeconds: next.focus_time_seconds ?? 0,
      });
    } else {
      setSelectedTask(null);
    }
  };

  const handleDurationChange = (field: 'focus' | 'shortBreak' | 'longBreak', value: number) => {
    if (Number.isNaN(value) || value <= 0) return;
    setDurations({
      focus: field === 'focus' ? value : focusDuration,
      shortBreak: field === 'shortBreak' ? value : shortBreakDuration,
      longBreak: field === 'longBreak' ? value : longBreakDuration,
    });
  };

  const handleSkipBreak = () => {
    setPhase('focus');
    setSecondsLeft(focusDuration * 60);
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">Focus mode</p>
            <h1 className="text-3xl font-semibold">Get into the zone</h1>
            <p className="text-sm text-white/70">
              Choose a task below, set your focus/break rhythm, then let the timer guide you.
            </p>
          </div>
          <button
            type="button"
            onClick={togglePiP}
            className="rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em]"
          >
            {pipOpen ? 'Hide PiP' : 'Show PiP'}
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-6 md:flex-row">
          <div className="relative flex flex-1 items-center justify-center">
            <div
              className="rounded-full border border-border bg-background/70"
              style={{
                width: '190px',
                height: '190px',
                ...accentRingStyle,
                boxShadow: '0 0 30px rgba(15,23,42,0.7)',
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p
                className="font-semibold text-white/90"
                style={{
                  fontSize: '30px',
                  fontFamily: "'Orbitron', 'Space Mono', monospace",
                  letterSpacing: '0.05em',
                }}
              >
                {formatDuration(secondsLeft)}
              </p>
              <span className="text-xs uppercase tracking-[0.3em] text-white/60">
                {PHASE_LABELS[currentPhase]}
              </span>
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Current cycle</p>
              <p className="text-lg font-semibold">
                {((cycleCount % 4) + 1)}/4 focus sessions
              </p>
              <p className="text-sm text-white/70">
                {currentPhase === 'focus'
                  ? 'Stay focused until this timer reaches zero to log the session automatically.'
                  : 'Take a break, then the next focus period starts when you resume.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isRunning ? (
                <Button size="sm" variant="secondary" onClick={pause}>
                  Pause
                </Button>
              ) : (
                <Button size="sm" onClick={start}>
                  {currentPhase === 'focus' ? 'Start focus' : 'Resume break'}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={requestFocusManualRecord}>
                Record session early
              </Button>
              {currentPhase !== 'focus' && (
                <Button size="sm" variant="outline" onClick={handleSkipBreak}>
                  Skip break
                </Button>
              )}
            </div>
            {lastRecordedLabel && (
              <p className="text-xs text-white/70">{lastRecordedLabel}</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Pick a task</p>
              <p className="text-xs text-muted-foreground">The minutes you log attach to this task</p>
            </div>
            <span className="text-xs text-muted-foreground">
              Total tracked: {formatDuration(selectedTask?.focusTimeSeconds ?? 0)}
            </span>
          </div>
          <select
            value={selectedTask?.id ?? ''}
            onChange={handleTaskChange}
            className="w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              {tasks.length ? 'Select a task...' : 'Create a task first'}
            </option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </section>
        <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Session rhythm</p>
              <p className="text-xs text-muted-foreground">
                Adjust how long each focus block and break should feel.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Focus', name: 'focus', value: focusDuration, placeholder: 25 },
              { label: 'Short break', name: 'shortBreak', value: shortBreakDuration, placeholder: 5 },
              { label: 'Long break', name: 'longBreak', value: longBreakDuration, placeholder: 15 },
            ].map((field) => (
              <label
                key={field.name}
                className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.3em] text-muted-foreground"
              >
                {field.label} (min)
                <input
                  type="number"
                  min={1}
                  value={field.value}
                  placeholder={String(field.placeholder)}
                  onChange={(event) =>
                    handleDurationChange(field.name as 'focus' | 'shortBreak' | 'longBreak', Number(event.target.value))
                  }
                  className="w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Long breaks trigger automatically every four focus sessions. You can pause or skip them at any time.
          </p>
        </section>
      </div>
    </div>
  );
}
