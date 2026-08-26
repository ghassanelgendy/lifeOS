import React from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Square, SkipBack, SkipForward, Repeat, Clock, Volume2, Sparkles } from 'lucide-react';
import { Reciter, RepeatSettings } from '../types/quran';
import { RECITERS } from '../services/quranData';
import { useUIStore } from '../../../../src/stores/useUIStore';

interface AudioPlayerBarProps {
  reciter: Reciter;
  onSelectReciter: (reciter: Reciter) => void;
  isPlaying: boolean;
  isDelaying: boolean;
  currentAyahIndex: number;
  currentVerseRepeat: number;
  currentRangeLoop: number;
  playbackRate: number;
  repeatSettings: RepeatSettings;
  onChangeRepeatSettings: (settings: RepeatSettings) => void;
  onTogglePlayPause: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrev: () => void;
  onChangeSpeed: (speed: number) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  reciter,
  onSelectReciter,
  isPlaying,
  isDelaying,
  currentAyahIndex,
  currentVerseRepeat,
  currentRangeLoop,
  playbackRate,
  repeatSettings,
  onChangeRepeatSettings,
  onTogglePlayPause,
  onStop,
  onNext,
  onPrev,
  onChangeSpeed,
}) => {
  let isSidebarCollapsed = false;
  try {
    isSidebarCollapsed = useUIStore((state) => state?.isSidebarCollapsed ?? false);
  } catch {
    isSidebarCollapsed = false;
  }

  const content = (
    <div
      dir="rtl"
      className={`fixed bottom-0 left-0 right-0 z-[90] border-t border-emerald-500/30 bg-card/90 backdrop-blur-2xl p-2.5 md:p-3.5 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.5)] font-arabic-title text-right transition-all ${
        isSidebarCollapsed ? 'md:left-16' : 'md:left-64'
      }`}
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-foreground px-4 md:px-6">
        
        {/* Reciter & Current Verse Info */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <Volume2 className="size-4 text-emerald-400 shrink-0" />
            <select
              value={reciter.id}
              onChange={(e) => {
                const found = RECITERS.find((r) => r.id === e.target.value);
                if (found) onSelectReciter(found);
              }}
              className="bg-secondary/80 text-xs font-bold rounded-xl px-3 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {RECITERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-bold">
            <span className="text-emerald-400">الآية {currentAyahIndex}</span>
            {isPlaying && isDelaying && (
              <span className="animate-pulse text-amber-400 font-bold flex items-center gap-1">
                <Clock className="size-3" /> وقت التكرار...
              </span>
            )}
          </div>
        </div>

        {/* Playback Buttons */}
        <div dir="rtl" className="flex items-center gap-2 shrink-0">
          <button
            onClick={onPrev}
            className="p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground transition-colors cursor-pointer"
            title="الآية السابقة"
          >
            <SkipForward className="size-4 shrink-0" />
          </button>

          <button
            onClick={onTogglePlayPause}
            className={`p-3 rounded-full font-bold text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
            title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التكرار'}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={onStop}
            className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="إيقاف الكلية"
          >
            <Square className="size-4" />
          </button>

          <button
            onClick={onNext}
            className="p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground transition-colors cursor-pointer"
            title="الآية التالية"
          >
            <SkipBack className="size-4 shrink-0" />
          </button>
        </div>

        {/* Tikrār (Looping) Controls & Speed */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end text-xs shrink-0 flex-wrap">
          
          {/* Verse Repeats */}
          <div className="flex items-center gap-1.5 bg-secondary/80 px-3 py-1 rounded-xl border border-border/40">
            <Repeat className="size-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-bold text-muted-foreground">تكرار الآية:</span>
            <select
              value={repeatSettings.verseRepeats}
              onChange={(e) =>
                onChangeRepeatSettings({ ...repeatSettings, verseRepeats: Number(e.target.value) })
              }
              className="bg-transparent font-bold text-foreground focus:outline-none text-xs"
            >
              {[1, 2, 3, 5, 7, 10, 20].map((num) => (
                <option key={num} value={num}>
                  {num}×
                </option>
              ))}
            </select>
            {isPlaying && (
              <span className="text-[10px] text-emerald-400 font-mono font-bold">({currentVerseRepeat}/{repeatSettings.verseRepeats})</span>
            )}
          </div>

          {/* Range Repeats */}
          <div className="flex items-center gap-1.5 bg-secondary/80 px-3 py-1 rounded-xl border border-border/40">
            <Sparkles className="size-3.5 text-indigo-400 shrink-0" />
            <span className="text-[11px] font-bold text-muted-foreground">المقطع:</span>
            <select
              value={repeatSettings.rangeRepeats}
              onChange={(e) =>
                onChangeRepeatSettings({ ...repeatSettings, rangeRepeats: Number(e.target.value) })
              }
              className="bg-transparent font-bold text-foreground focus:outline-none text-xs"
            >
              {[1, 2, 3, 5, 10].map((num) => (
                <option key={num} value={num}>
                  {num}×
                </option>
              ))}
            </select>
            {isPlaying && (
              <span className="text-[10px] text-indigo-400 font-mono font-bold">({currentRangeLoop}/{repeatSettings.rangeRepeats})</span>
            )}
          </div>

          {/* Pause Delay */}
          <div className="flex items-center gap-1.5 bg-secondary/80 px-3 py-1 rounded-xl border border-border/40">
            <Clock className="size-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] font-bold text-muted-foreground">السكوت:</span>
            <select
              value={repeatSettings.delaySeconds}
              onChange={(e) =>
                onChangeRepeatSettings({ ...repeatSettings, delaySeconds: Number(e.target.value) })
              }
              className="bg-transparent font-bold text-foreground focus:outline-none text-xs"
            >
              {[0, 1, 2, 3, 5, 8].map((sec) => (
                <option key={sec} value={sec}>
                  {sec === 0 ? 'بدون' : `${sec}ث`}
                </option>
              ))}
            </select>
          </div>

          {/* Speed */}
          <select
            value={playbackRate}
            onChange={(e) => onChangeSpeed(Number(e.target.value))}
            className="bg-secondary/80 text-[11px] font-bold rounded-xl px-2.5 py-1 border border-border focus:outline-none"
          >
            {[0.75, 1.0, 1.25, 1.5].map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </div>

      </div>
    </div>
  );

  return createPortal(content, document.body);
};
