import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Repeat,
  Clock,
  Volume2,
  Sparkles,
  SlidersHorizontal,
  X,
  Gauge,
} from 'lucide-react';
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

function getSheikhLastName(reciter: Reciter): string {
  const map: Record<string, string> = {
    husary: 'الحصري',
    alafasy: 'العفاسي',
    minshawi: 'المنشاوي',
    minshawi_mujawwad: 'المنشاوي',
    abdulbasit: 'عبد الباسط',
    shatri: 'الشاطري',
    ghamadi: 'الغامدي',
  };
  if (map[reciter.id]) return map[reciter.id];
  const words = reciter.name.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  return words[words.length - 1] || reciter.name;
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
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  let isSidebarCollapsed = false;
  try {
    isSidebarCollapsed = useUIStore((state) => state?.isSidebarCollapsed ?? false);
  } catch {
    isSidebarCollapsed = false;
  }

  const content = (
    <>
      <div
        dir="rtl"
        className={`fixed bottom-0 left-0 right-0 z-[90] border-t border-border/50 bg-card/85 backdrop-blur-2xl px-3 py-2 md:py-3 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.3)] font-arabic-title text-right transition-all ${
          isSidebarCollapsed ? 'md:left-16' : 'md:left-64'
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 md:gap-4 text-foreground">
          
          {/* Reciter & Current Ayah Badge */}
          <div className="flex items-center gap-2 min-w-0 shrink">
            {/* Desktop Sheikh Dropdown */}
            <div className="hidden md:flex items-center gap-2">
              <Volume2 className="size-4 text-emerald-400 shrink-0" />
              <select
                value={reciter.id}
                onChange={(e) => {
                  const found = RECITERS.find((r) => r.id === e.target.value);
                  if (found) onSelectReciter(found);
                }}
                className="bg-secondary/80 text-xs font-bold rounded-xl px-2.5 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {RECITERS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Compact Mobile Sheikh & Ayah Pill */}
            <div
              onClick={() => setShowSettingsDrawer(true)}
              className="flex items-center gap-1.5 text-[11px] bg-secondary/80 hover:bg-secondary border border-border/60 px-2.5 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-all truncate"
            >
              <span className="md:hidden text-emerald-400 font-bold truncate max-w-[90px]">
                {getSheikhLastName(reciter)}
              </span>
              <span className="text-foreground font-bold shrink-0">آية {currentAyahIndex}</span>
              {repeatSettings.verseRepeats > 1 && (
                <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/15 px-1.5 py-0.2 rounded-md shrink-0">
                  {currentVerseRepeat}/{repeatSettings.verseRepeats}
                </span>
              )}
              {isPlaying && isDelaying && (
                <span className="animate-pulse text-amber-400 text-[10px] font-bold shrink-0">
                  سكوت...
                </span>
              )}
            </div>
          </div>

          {/* Center Playback Controls (Ultra-Compact on Mobile) */}
          <div dir="rtl" className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <button
              onClick={onPrev}
              className="p-1.5 md:p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground active:scale-90 transition-all cursor-pointer"
              title="الآية السابقة"
            >
              <SkipForward className="size-4 shrink-0" />
            </button>

            <button
              onClick={onTogglePlayPause}
              className={`p-2.5 md:p-3 rounded-full font-bold text-white shadow-md active:scale-90 transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
              title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التكرار'}
            >
              {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={onNext}
              className="p-1.5 md:p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground active:scale-90 transition-all cursor-pointer"
              title="الآية التالية"
            >
              <SkipBack className="size-4 shrink-0" />
            </button>

            <button
              onClick={onStop}
              className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground active:scale-90 transition-all cursor-pointer"
              title="إيقاف"
            >
              <Square className="size-3.5" />
            </button>
          </div>

          {/* Desktop Controls (Inline on MD+) */}
          <div className="hidden md:flex items-center gap-2 text-xs shrink-0">
            {/* Verse Repeats */}
            <div className="flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-xl border border-border/40">
              <Repeat className="size-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold text-muted-foreground">تكرار:</span>
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
            </div>

            {/* Range Repeats */}
            <div className="flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-xl border border-border/40">
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
            </div>

            {/* Pause Delay */}
            <div className="flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded-xl border border-border/40">
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
              className="bg-secondary/80 text-[11px] font-bold rounded-xl px-2 py-1 border border-border focus:outline-none"
            >
              {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                <option key={speed} value={speed}>
                  {speed}x
                </option>
              ))}
            </select>
          </div>

          {/* Mobile Repeat & Audio Settings Drawer Trigger Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setShowSettingsDrawer(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-secondary/90 hover:bg-secondary text-foreground text-xs font-bold border border-border/60 active:scale-95 transition-all cursor-pointer"
              title="إعدادات الصوت والتكرار"
            >
              <SlidersHorizontal className="size-3.5 text-emerald-400" />
              <span className="text-[10px]">خيارات</span>
            </button>
          </div>

        </div>
      </div>

      {/* iOS Native Bottom Sheet Drawer for Audio & Repeat Settings */}
      {showSettingsDrawer && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowSettingsDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
            className="w-full max-w-md rounded-t-[2.5rem] border-t border-border/60 bg-card/95 backdrop-blur-2xl p-6 space-y-4 shadow-2xl text-right pb-safe animate-in slide-in-from-bottom-5 duration-200"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 font-arabic-title">
                <SlidersHorizontal className="size-4 text-emerald-400" />
                <span>خيارات الصوت والتكرار</span>
              </h3>
              <button
                onClick={() => setShowSettingsDrawer(false)}
                className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 1. Reciter Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Volume2 className="size-3.5 text-emerald-400" />
                <span>القارئ الصوتي:</span>
              </label>
              <select
                value={reciter.id}
                onChange={(e) => {
                  const found = RECITERS.find((r) => r.id === e.target.value);
                  if (found) onSelectReciter(found);
                }}
                className="w-full bg-secondary/80 text-xs font-bold rounded-xl px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {RECITERS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Repeats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Repeat className="size-3.5 text-emerald-400" />
                  <span>تكرار كل آية:</span>
                </label>
                <select
                  value={repeatSettings.verseRepeats}
                  onChange={(e) =>
                    onChangeRepeatSettings({ ...repeatSettings, verseRepeats: Number(e.target.value) })
                  }
                  className="w-full bg-secondary/80 text-xs font-bold rounded-xl px-3 py-2 border border-border focus:outline-none"
                >
                  {[1, 2, 3, 5, 7, 10, 20].map((num) => (
                    <option key={num} value={num}>
                      {num} مرات
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-indigo-400" />
                  <span>تكرار المقطع كلياً:</span>
                </label>
                <select
                  value={repeatSettings.rangeRepeats}
                  onChange={(e) =>
                    onChangeRepeatSettings({ ...repeatSettings, rangeRepeats: Number(e.target.value) })
                  }
                  className="w-full bg-secondary/80 text-xs font-bold rounded-xl px-3 py-2 border border-border focus:outline-none"
                >
                  {[1, 2, 3, 5, 10].map((num) => (
                    <option key={num} value={num}>
                      {num} مرات
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Pause Delay & Speed */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-amber-400" />
                  <span>السكوت للتسميع:</span>
                </label>
                <select
                  value={repeatSettings.delaySeconds}
                  onChange={(e) =>
                    onChangeRepeatSettings({ ...repeatSettings, delaySeconds: Number(e.target.value) })
                  }
                  className="w-full bg-secondary/80 text-xs font-bold rounded-xl px-3 py-2 border border-border focus:outline-none"
                >
                  {[0, 1, 2, 3, 5, 8].map((sec) => (
                    <option key={sec} value={sec}>
                      {sec === 0 ? 'بدون سكوت' : `${sec} ثواني`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Gauge className="size-3.5 text-blue-400" />
                  <span>سرعة التلاوة:</span>
                </label>
                <select
                  value={playbackRate}
                  onChange={(e) => onChangeSpeed(Number(e.target.value))}
                  className="w-full bg-secondary/80 text-xs font-bold rounded-xl px-3 py-2 border border-border focus:outline-none"
                >
                  {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}x
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer mt-2"
            >
              تم
            </button>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(content, document.body);
};
