import { useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '../components/ui';
import { useTasks } from '../hooks/useTasks';
import { formatDuration } from '../lib/utils';
import { requestFocusManualRecord } from '../lib/focusSessionEvents';
import { useFocusSessionStore } from '../stores/useFocusSessionStore';
import { cn } from '../lib/utils';
import { Clock, PictureInPicture2, Zap } from 'lucide-react';

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

  const progressBarStyle = useMemo(
    () => ({
      width: `${Math.max(0, Math.min(100, progressPercent))}%`,
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Focus</h1>
          <p className="text-muted-foreground">Pick a task, run a timer, and automatically log focus time.</p>
        </div>
        <Button variant="outline" onClick={togglePiP}>
          <PictureInPicture2 size={16} />
          {pipOpen ? 'Hide PiP' : 'Show PiP'}
        </Button>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <div className="rounded-xl border border-border bg-secondary/10 p-4 h-full">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{PHASE_LABELS[currentPhase]}</p>
                <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
                  {formatDuration(secondsLeft)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Progress</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{Math.round(progressPercent)}%</p>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden border border-border">
              <div className="h-full bg-primary transition-[width] duration-500" style={progressBarStyle} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/10 p-4 h-full flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Current cycle</p>
                <p className="mt-1 text-lg font-semibold">
                  {((cycleCount % 4) + 1)}/4 focus sessions
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Task</p>
                <p className="mt-1 text-sm font-semibold truncate max-w-[16rem]">
                  {selectedTask?.title ?? 'No task selected'}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {currentPhase === 'focus'
                ? 'Stay focused until the timer ends to auto-log the session.'
                : 'Take a break. Resume when ready to continue your cycle.'}
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              {isRunning ? (
                <Button onClick={pause}>
                  <Clock size={16} />
                  Pause
                </Button>
              ) : (
                <Button onClick={start}>
                  <Zap size={16} />
                  {currentPhase === 'focus' ? 'Start focus' : 'Resume break'}
                </Button>
              )}
              <Button variant="secondary" onClick={requestFocusManualRecord}>
                Record session early
              </Button>
              {currentPhase !== 'focus' && (
                <Button variant="outline" onClick={handleSkipBreak}>
                  Skip break
                </Button>
              )}
            </div>

            {lastRecordedLabel && (
              <p className={cn("text-xs mt-3", lastRecordedLabel.toLowerCase().includes('unable') ? "text-red-400" : "text-muted-foreground")}>
                {lastRecordedLabel}
              </p>
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
