import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDuration } from '../lib/utils';
import { useFocusSessionStore } from '../stores/useFocusSessionStore';

const WINDOW_OPTIONS = 'width=336,height=414,toolbar=0,location=0,status=0,menubar=0,resizable=0';

export function FocusPiPWindow() {
  const {
    pipOpen,
    togglePiP,
    currentPhase,
    secondsLeft,
    isRunning,
    selectedTask,
    start,
    pause,
    focusDuration,
    shortBreakDuration,
    longBreakDuration,
  } = useFocusSessionStore();

  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);
  const windowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!pipOpen) {
      windowRef.current?.close();
      windowRef.current = null;
      setContainerEl(null);
      return;
    }
    if (typeof window === 'undefined') return;

    const popup = window.open('', 'lifeos-focus-pip', WINDOW_OPTIONS);
    if (!popup) return;
    popup.document.title = 'LifeOS Focus';
    popup.document.body.style.margin = '0';
    popup.document.body.style.backgroundColor = '#05060c';
    popup.document.body.style.color = '#ffffff';
    popup.document.body.style.fontFamily = 'Inter, system-ui, sans-serif';
    popup.document.body.style.display = 'flex';
    popup.document.body.style.alignItems = 'center';
    popup.document.body.style.justifyContent = 'center';
    const wrapper = popup.document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    popup.document.body.appendChild(wrapper);
    const icon = popup.document.createElement('link');
    icon.rel = 'icon';
    icon.href = '/favicon.ico';
    popup.document.head.appendChild(icon);
    windowRef.current = popup;
    setContainerEl(wrapper);

    const handleClose = () => {
      if (pipOpen) togglePiP();
    };
    popup.addEventListener('beforeunload', handleClose);

    return () => {
      popup.removeEventListener('beforeunload', handleClose);
      popup.close();
      windowRef.current = null;
      setContainerEl(null);
    };
  }, [pipOpen, togglePiP]);

  const getAccentValue = (prop: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(prop)?.trim() || fallback;
  };
  const accentRingColor = getAccentValue('--color-ring', '#0ea5e9');
  const accentForegroundColor = getAccentValue('--color-accent-foreground', '#ffffff');
  const accentCardColor = getAccentValue('--color-card', '#05060c');

  const phaseLabel = useMemo(() => {
    if (currentPhase === 'focus') return 'Focus';
    if (currentPhase === 'shortBreak') return 'Short break';
    return 'Long break';
  }, [currentPhase]);

  const totalPhaseSeconds = useMemo(() => {
    if (currentPhase === 'focus') return focusDuration * 60;
    if (currentPhase === 'shortBreak') return shortBreakDuration * 60;
    return longBreakDuration * 60;
  }, [currentPhase, focusDuration, shortBreakDuration, longBreakDuration]);
  const progressAngle = totalPhaseSeconds > 0 ? ((totalPhaseSeconds - secondsLeft) / totalPhaseSeconds) * 360 : 0;
  const accentRingStyle = useMemo(
    () => ({
      background: `conic-gradient(${accentRingColor} ${progressAngle}deg, rgba(255,255,255,0.08) 0deg)`,
    }),
    [accentRingColor, progressAngle]
  );

  if (!containerEl) return null;

  return createPortal(
    <div
      style={{
        width: '336px',
        padding: '20px',
        borderRadius: '0px',
        background: accentCardColor,
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 30px 70px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {phaseLabel}
          </p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{selectedTask?.title ?? 'No task selected'}</p>
        </div>

      </div>
      <div
        style={{
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          border: '8px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
          position: 'relative',
          boxShadow: 'inset 0 0 40px rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            width: 'calc(100% - 16px)',
            height: 'calc(100% - 16px)',
            borderRadius: '50%',
            position: 'absolute',
            top: '8px',
            left: '8px',
            boxSizing: 'border-box',
            ...accentRingStyle,
          }}
        />
        <span
          style={{
            position: 'relative',
            fontSize: '48px',
            fontWeight: 600,
            color: 'var(--color-accent-foreground)',
          }}
        >
          {formatDuration(secondsLeft)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          onClick={() => (isRunning ? pause() : start())}
          style={{
            flex: 1,
            borderRadius: '10px',
            border: 'none',
            padding: '10px 10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            background: `white`,
            color: 'black',
            cursor: 'pointer',
          }}
        >
          {isRunning ? 'Pause focus' : 'Start focus'}
        </button>

      </div>
    </div>,
    containerEl
  );
}
