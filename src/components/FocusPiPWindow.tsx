import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDuration } from '../lib/utils';
import { useFocusSessionStore } from '../stores/useFocusSessionStore';

const WINDOW_OPTIONS_FULL = 'width=336,height=414,toolbar=0,location=0,status=0,menubar=0,resizable=0';
const WINDOW_OPTIONS_MINI = 'width=160,height=56,toolbar=0,location=0,status=0,menubar=0,resizable=0,scrollbars=0';

const MINI_STYLES = `
  @keyframes pip-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.92; }
  }
  @keyframes pip-cat-bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
  @keyframes pip-glow {
    0%, 100% { box-shadow: 0 0 12px rgba(255,255,255,0.08); }
    50% { box-shadow: 0 0 20px rgba(255,255,255,0.15); }
  }
  @keyframes pip-eye-blink {
    0%, 45%, 55%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(0.08); }
  }
  @keyframes pip-mouth-smile {
    0%, 25% { opacity: 0; }
    40%, 60% { opacity: 1; }
    75%, 100% { opacity: 0; }
  }
  @keyframes pip-mouth-line {
    0%, 25% { opacity: 1; }
    40%, 60% { opacity: 0; }
    75%, 100% { opacity: 1; }
  }
`;

export function FocusPiPWindow() {
  const {
    pipOpen,
    pipMiniMode,
    togglePiP,
    setPipMiniMode,
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

    const options = pipMiniMode ? WINDOW_OPTIONS_MINI : WINDOW_OPTIONS_FULL;
    // Empty URL + location=0 keeps chrome minimal; URL bar is browser-controlled and can't be fully hidden in web.
    // In Tauri/Electron the app window has no URL bar.
    const popup = window.open('about:blank', 'lifeos-focus-pip', options);
    if (!popup) return;
    popup.document.title = 'LifeOS Focus';
    const { body, documentElement } = popup.document;
    body.style.margin = '0';
    body.style.overflow = 'hidden';
    body.style.backgroundColor = '#05060c';
    body.style.color = '#ffffff';
    body.style.fontFamily = 'Inter, system-ui, sans-serif';
    body.style.display = 'flex';
    body.style.alignItems = 'center';
    body.style.justifyContent = 'center';
    body.style.cursor = pipMiniMode ? 'pointer' : 'default';
    documentElement.style.overflow = 'hidden';
    if (pipMiniMode) {
      const style = popup.document.createElement('style');
      style.textContent = MINI_STYLES;
      popup.document.head.appendChild(style);
    }
    const wrapper = popup.document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.minWidth = '0';
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
  }, [pipOpen, pipMiniMode, togglePiP]);

  const getAccentValue = (prop: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(prop)?.trim() || fallback;
  };
  const accentRingColor = getAccentValue('--color-ring', '#0ea5e9');
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

  // Mini mode: small window, time + smiling cat, no scroll, animations. Click to expand.
  if (pipMiniMode) {
    return createPortal(
      <div
        role="button"
        tabIndex={0}
        onClick={() => setPipMiniMode(false)}
        onKeyDown={(e) => e.key === 'Enter' && setPipMiniMode(false)}
        title="Click to expand"
        style={{
          width: '100%',
          height: '100%',
          minWidth: '120px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: accentCardColor,
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '10px',
          cursor: 'pointer',
          animation: 'pip-pulse 2.5s ease-in-out infinite, pip-glow 2.5s ease-in-out infinite',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            animation: 'pip-cat-bounce 1.5s ease-in-out infinite',
            lineHeight: 0,
          }}
          aria-hidden
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Face */}
            <circle cx="32" cy="32" r="28" fill="rgba(255,255,255,0.95)" />
            {/* Ears */}
            <path d="M18 22 L8 4 L22 20 Z" fill="rgba(255,255,255,0.95)" />
            <path d="M46 22 L56 4 L42 20 Z" fill="rgba(255,255,255,0.95)" />
            {/* Eyes (blinking) */}
            <ellipse
              cx="24"
              cy="28"
              rx="5"
              ry="6"
              fill="#1a1a1a"
              style={{
                transformOrigin: '24px 28px',
                animation: 'pip-eye-blink 3s ease-in-out infinite',
              }}
            />
            <ellipse
              cx="40"
              cy="28"
              rx="5"
              ry="6"
              fill="#1a1a1a"
              style={{
                transformOrigin: '40px 28px',
                animation: 'pip-eye-blink 3s ease-in-out infinite 0.1s',
              }}
            />
            {/* Mouth: neutral line (shows when "closing") */}
            <line
              x1="22"
              y1="42"
              x2="42"
              y2="42"
              stroke="#1a1a1a"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                animation: 'pip-mouth-line 2.5s ease-in-out infinite',
              }}
            />
            {/* Mouth: smile curve (opening/smiling) */}
            <path
              d="M 22 42 Q 32 52 42 42"
              stroke="#1a1a1a"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              style={{
                animation: 'pip-mouth-smile 2.5s ease-in-out infinite',
              }}
            />
          </svg>
        </span>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.95)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
          }}
        >
          {formatDuration(secondsLeft)}
        </span>
      </div>,
      containerEl
    );
  }

  // Full PiP
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
        <button
          type="button"
          onClick={() => setPipMiniMode(true)}
          title="Minimize to small indicator"
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px',
            background: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
          }}
        >
          −
        </button>
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
