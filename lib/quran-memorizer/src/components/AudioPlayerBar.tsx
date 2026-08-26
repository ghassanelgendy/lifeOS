import React from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Repeat, Clock, Volume2, Sparkles } from 'lucide-react';
import { Reciter, RepeatSettings } from '../types/quran';
import { RECITERS } from '../services/quranData';

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
  return (
    <div className="sticky bottom-0 z-30 w-full border-t border-border/60 bg-background/95 backdrop-blur-md p-3 md:px-6 shadow-2xl">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-foreground font-sans">
        
        {/* Reciter & Current Verse Info */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <Volume2 className="size-4 text-emerald-500 shrink-0" />
            <select
              value={reciter.id}
              onChange={(e) => {
                const found = RECITERS.find((r) => r.id === e.target.value);
                if (found) onSelectReciter(found);
              }}
              className="bg-secondary/60 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {RECITERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/40 px-2.5 py-1 rounded-full border border-border/40">
            <span className="font-semibold text-emerald-500">Ayah {currentAyahIndex}</span>
            {isPlaying && isDelaying && (
              <span className="animate-pulse text-amber-400 font-medium flex items-center gap-1">
                <Clock className="size-3" /> Recite now...
              </span>
            )}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Previous Ayah"
          >
            <SkipBack className="size-4" />
          </button>

          <button
            onClick={onTogglePlayPause}
            className={`p-3 rounded-full font-semibold text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
            title={isPlaying ? 'Pause' : 'Play Tikrār'}
          >
            {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={onStop}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Stop Playback"
          >
            <Square className="size-4" />
          </button>

          <button
            onClick={onNext}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Next Ayah"
          >
            <SkipForward className="size-4" />
          </button>
        </div>

        {/* Tikrār (Looping) Controls & Delay Settings */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end text-xs shrink-0 flex-wrap">
          
          {/* Verse Repeat Counter */}
          <div className="flex items-center gap-1 bg-secondary/50 px-2.5 py-1 rounded-lg border border-border/40">
            <Repeat className="size-3.5 text-emerald-500" />
            <span className="text-[11px] text-muted-foreground">Verse:</span>
            <select
              value={repeatSettings.verseRepeats}
              onChange={(e) =>
                onChangeRepeatSettings({ ...repeatSettings, verseRepeats: Number(e.target.value) })
              }
              className="bg-transparent font-bold text-foreground focus:outline-none"
            >
              {[1, 2, 3, 5, 7, 10, 20].map((num) => (
                <option key={num} value={num}>
                  {num}x
                </option>
              ))}
            </select>
            {isPlaying && (
              <span className="text-[10px] text-emerald-400 font-mono">({currentVerseRepeat}/{repeatSettings.verseRepeats})</span>
            )}
          </div>

          {/* Range Repeat Counter */}
          <div className="flex items-center gap-1 bg-secondary/50 px-2.5 py-1 rounded-lg border border-border/40">
            <Sparkles className="size-3.5 text-indigo-400" />
            <span className="text-[11px] text-muted-foreground">Range:</span>
            <select
              value={repeatSettings.rangeRepeats}
              onChange={(e) =>
                onChangeRepeatSettings({ ...repeatSettings, rangeRepeats: Number(e.target.value) })
              }
              className="bg-transparent font-bold text-foreground focus:outline-none"
            >
              {[1, 2, 3, 5, 10].map((num) => (
                <option key={num} value={num}>
                  {num}x
                </option>
              ))}
            </select>
            {isPlaying && (
              <span className="text-[10px] text-indigo-400 font-mono">({currentRangeLoop}/{repeatSettings.rangeRepeats})</span>
            )}
          </div>

          {/* Recitation Gap Pause Delay */}
          <div className="flex items-center gap-1 bg-secondary/50 px-2.5 py-1 rounded-lg border border-border/40">
            <Clock className="size-3.5 text-amber-400" />
            <span className="text-[11px] text-muted-foreground">Pause:</span>
            <select
              value={repeatSettings.delaySeconds}
              onChange={(e) =>
                onChangeRepeatSettings({ ...repeatSettings, delaySeconds: Number(e.target.value) })
              }
              className="bg-transparent font-bold text-foreground focus:outline-none"
            >
              {[0, 1, 2, 3, 5, 8].map((sec) => (
                <option key={sec} value={sec}>
                  {sec === 0 ? 'None' : `${sec}s`}
                </option>
              ))}
            </select>
          </div>

          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => onChangeSpeed(Number(e.target.value))}
            className="bg-secondary/60 text-[11px] font-bold rounded-lg px-2 py-1 border border-border focus:outline-none"
          >
            {[0.75, 1.0, 1.25, 1.5].map((speed) => (
              <option key={speed} value={speed}>
                {speed}x speed
              </option>
            ))}
          </select>
        </div>

      </div>
    </div>
  );
};
