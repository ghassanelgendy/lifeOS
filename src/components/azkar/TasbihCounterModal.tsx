import React, { useState, useEffect, useCallback } from 'react';
import { X, RotateCcw, Volume2, VolumeX, Smartphone } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAzkarStore } from '../../stores/useAzkarStore';

const DEFAULT_PRESETS = [
  { text: 'سُبْحَانَ اللَّهِ', count: 33 },
  { text: 'الْحَمْدُ لِلَّهِ', count: 33 },
  { text: 'اللَّهُ أَكْبَرُ', count: 34 },
  { text: 'لَا إِلَهَ إِلَّا اللَّهُ', count: 100 },
  { text: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ', count: 100 },
  { text: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ', count: 100 },
  { text: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', count: 100 },
];

export function TasbihCounterModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    tasbihCount,
    tasbihTarget,
    tasbihZekrText,
    incrementTasbih,
    resetTasbih,
    setTasbihTarget,
    setTasbihZekrText,
    hapticFeedback,
    soundEnabled,
    toggleHaptic,
    toggleSound,
  } = useAzkarStore();

  const [isCompletedAnim, setIsCompletedAnim] = useState(false);

  const triggerHaptic = useCallback(() => {
    if (!hapticFeedback) return;
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(25);
      }
    } catch {}
  }, [hapticFeedback]);

  const handleTap = () => {
    triggerHaptic();
    incrementTasbih();

    if (tasbihTarget > 0 && tasbihCount + 1 >= tasbihTarget) {
      setIsCompletedAnim(true);
      if (soundEnabled && typeof window !== 'undefined' && 'AudioContext' in window) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        } catch {}
      }
      setTimeout(() => setIsCompletedAnim(false), 800);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleTap();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleTap, onClose]);

  if (!isOpen) return null;

  const progressPercent = tasbihTarget > 0 ? Math.min(100, (tasbihCount / tasbihTarget) * 100) : 0;
  const circumference = 2 * Math.PI * 96;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl flex flex-col items-center select-none">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>السبحة الإلكترونية</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Digital Tasbih</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preset Selector */}
        <div className="w-full flex gap-1.5 overflow-x-auto py-3 no-scrollbar">
          {DEFAULT_PRESETS.map((preset) => {
            const isSelected = tasbihZekrText === preset.text;
            return (
              <button
                key={preset.text}
                onClick={() => {
                  setTasbihZekrText(preset.text);
                  setTasbihTarget(preset.count);
                }}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all border shrink-0',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary font-medium shadow-sm'
                    : 'bg-secondary/60 hover:bg-secondary text-muted-foreground border-transparent'
                )}
              >
                {preset.text} ({preset.count})
              </button>
            );
          })}
        </div>

        {/* Selected Zekr Title */}
        <div className="my-4 text-center px-4">
          <p className="text-xl sm:text-2xl font-bold font-arabic-quran text-foreground leading-relaxed">
            {tasbihZekrText}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">الهدف:</span>
            {[33, 100, 0].map((tgt) => (
              <button
                key={tgt}
                onClick={() => setTasbihTarget(tgt)}
                className={cn(
                  'px-2 py-0.5 text-xs rounded-md transition-colors',
                  tasbihTarget === tgt
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tgt === 0 ? 'مفتوح (∞)' : tgt}
              </button>
            ))}
          </div>
        </div>

        {/* Large Circular Tap Area */}
        <div
          onClick={handleTap}
          className={cn(
            'relative cursor-pointer w-56 h-56 rounded-full flex flex-col items-center justify-center transition-all duration-150 active:scale-95 my-2 shadow-inner group',
            isCompletedAnim ? 'ring-4 ring-emerald-500 bg-emerald-500/10' : 'hover:bg-primary/5'
          )}
        >
          {/* Radial progress ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 220 220">
            <circle
              cx="110"
              cy="110"
              r="96"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="6"
              className="text-secondary/50"
            />
            {tasbihTarget > 0 && (
              <circle
                cx="110"
                cy="110"
                r="96"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="text-primary transition-all duration-150"
              />
            )}
          </svg>

          <span className="text-5xl sm:text-6xl font-extrabold tracking-tight font-mono text-foreground select-none">
            {tasbihCount}
          </span>
          {tasbihTarget > 0 && (
            <span className="text-xs font-medium text-muted-foreground mt-1">
              من أصل {tasbihTarget}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground/60 mt-3 group-hover:text-primary transition-colors">
            انقر هنا أو اضغط المسطرة (Space)
          </span>
        </div>

        {/* Control Toolbar */}
        <div className="w-full flex items-center justify-between pt-4 mt-2 border-t border-border text-sm">
          <div className="flex items-center gap-1">
            <button
              onClick={toggleHaptic}
              title="الاهتزاز / Haptic"
              className={cn(
                'p-2 rounded-lg border transition-colors',
                hapticFeedback ? 'border-primary/40 text-primary bg-primary/10' : 'border-border text-muted-foreground'
              )}
            >
              <Smartphone size={16} />
            </button>
            <button
              onClick={toggleSound}
              title="الصوت عند الإتمام"
              className={cn(
                'p-2 rounded-lg border transition-colors',
                soundEnabled ? 'border-primary/40 text-primary bg-primary/10' : 'border-border text-muted-foreground'
              )}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>

          <button
            onClick={resetTasbih}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RotateCcw size={14} />
            <span>إعادة التصفير</span>
          </button>
        </div>
      </div>
    </div>
  );
}
