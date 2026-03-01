import { create } from 'zustand';

export type FocusPhase = 'focus' | 'shortBreak' | 'longBreak';

export interface SelectedTaskInfo {
  id: string;
  title: string;
  focusTimeSeconds: number;
}

interface FocusSessionState {
  currentPhase: FocusPhase;
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  secondsLeft: number;
  cycleCount: number;
  isRunning: boolean;
  selectedTask: SelectedTaskInfo | null;
  pipOpen: boolean;
  lastRecordedLabel: string | null;
  setPhase: (phase: FocusPhase) => void;
  setSecondsLeft: (seconds: number | ((prev: number) => number)) => void;
  setDurations: (params: { focus: number; shortBreak: number; longBreak: number }) => void;
  setSelectedTask: (task: SelectedTaskInfo | null) => void;
  setCycleCount: (count: number) => void;
  setIsRunning: (value: boolean) => void;
  start: () => void;
  pause: () => void;
  togglePiP: () => void;
  setLastRecordedLabel: (label: string | null) => void;
}

const DEFAULT_FOCUS = 25;
const DEFAULT_SHORT_BREAK = 5;
const DEFAULT_LONG_BREAK = 15;

export const useFocusSessionStore = create<FocusSessionState>()((set) => ({
  currentPhase: 'focus',
  focusDuration: DEFAULT_FOCUS,
  shortBreakDuration: DEFAULT_SHORT_BREAK,
  longBreakDuration: DEFAULT_LONG_BREAK,
  secondsLeft: DEFAULT_FOCUS * 60,
  cycleCount: 0,
  isRunning: false,
  selectedTask: null,
  pipOpen: false,
  lastRecordedLabel: null,
  setPhase: (phase) =>
    set((state) => ({
      currentPhase: phase,
      secondsLeft:
        state.isRunning
          ? state.secondsLeft
          : phase === 'focus'
          ? state.focusDuration * 60
          : phase === 'shortBreak'
          ? state.shortBreakDuration * 60
          : state.longBreakDuration * 60,
    })),
  setSecondsLeft: (seconds) =>
    set((state) => {
      const next =
        typeof seconds === 'function' ? seconds(state.secondsLeft) : seconds;
      return { secondsLeft: Math.max(0, next) };
    }),
  setDurations: ({ focus, shortBreak, longBreak }) =>
    set((state) => {
      const targetSeconds =
        state.currentPhase === 'focus'
          ? focus * 60
          : state.currentPhase === 'shortBreak'
          ? shortBreak * 60
          : longBreak * 60;
      return {
        focusDuration: focus,
        shortBreakDuration: shortBreak,
        longBreakDuration: longBreak,
        secondsLeft: state.isRunning ? state.secondsLeft : targetSeconds,
      };
    }),
  setSelectedTask: (task) => set({ selectedTask: task }),
  setCycleCount: (count) => set({ cycleCount: count }),
  setIsRunning: (value) => set({ isRunning: value }),
  start: () => set({ isRunning: true }),
  pause: () => set({ isRunning: false }),
  togglePiP: () => set((state) => ({ pipOpen: !state.pipOpen })),
  setLastRecordedLabel: (label) => set({ lastRecordedLabel: label }),
}));
