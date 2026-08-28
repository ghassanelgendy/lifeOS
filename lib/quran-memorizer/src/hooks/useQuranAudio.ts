import { useState, useEffect, useRef, useCallback } from 'react';
import { Reciter, RepeatSettings } from '../types/quran';
import { getAyahAudioUrl } from '../services/quranApi';

interface UseQuranAudioProps {
  reciter: Reciter;
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  initialAyahIndex?: number;
  repeatSettings: RepeatSettings;
  onAyahChange?: (ayahNumber: number) => void;
}

export function useQuranAudio({
  reciter,
  surahNumber,
  startAyah,
  endAyah,
  initialAyahIndex,
  repeatSettings,
  onAyahChange,
}: UseQuranAudioProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(initialAyahIndex ?? startAyah);
  const [currentVerseRepeat, setCurrentVerseRepeat] = useState(1);
  const [currentRangeLoop, setCurrentRangeLoop] = useState(1);
  const [isDelaying, setIsDelaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const verseRepeatRef = useRef(1);
  const rangeLoopRef = useRef(1);
  const currentAyahRef = useRef(initialAyahIndex ?? startAyah);
  const repeatSettingsRef = useRef(repeatSettings);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMountRef = useRef(true);

  // Sync refs when settings or selections change
  useEffect(() => {
    repeatSettingsRef.current = repeatSettings;
  }, [repeatSettings]);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    currentAyahRef.current = startAyah;
    verseRepeatRef.current = 1;
    rangeLoopRef.current = 1;
    setCurrentAyahIndex(startAyah);
    setCurrentVerseRepeat(1);
    setCurrentRangeLoop(1);
  }, [surahNumber, startAyah]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
    };
  }, []);

  const cumulativePhaseRef = useRef<'verse_repeat' | 'recite_pause' | 'review_chain'>('verse_repeat');
  const targetChainVerseRef = useRef<number>(initialAyahIndex ?? startAyah);

  const playAyahTrack = useCallback(
    (ayahNum: number) => {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const url = getAyahAudioUrl(reciter.subfolder, surahNumber, ayahNum);
      const audio = new Audio(url);
      audio.playbackRate = playbackRate;
      audioRef.current = audio;

      if (onAyahChange) {
        onAyahChange(ayahNum);
      }

      audio.play().catch((err) => {
        console.warn('Playback error or interrupted:', err);
        setIsPlaying(false);
      });

      audio.onended = () => {
        const settings = repeatSettingsRef.current;

        // --- CUMULATIVE MEMORIZATION METHOD ---
        // (Method: 3x verse -> recitation pause -> chain review from startAyah to current verse -> next verse)
        if (settings.cumulativeMemorizationMode) {
          if (cumulativePhaseRef.current === 'verse_repeat') {
            const targetRepeats = settings.verseRepeats > 1 ? settings.verseRepeats : 3;
            if (verseRepeatRef.current < targetRepeats) {
              verseRepeatRef.current += 1;
              setCurrentVerseRepeat(verseRepeatRef.current);
              playAyahTrack(ayahNum);
              return;
            } else {
              // Finished 3x repeats for this new verse!
              verseRepeatRef.current = 1;
              setCurrentVerseRepeat(1);
              cumulativePhaseRef.current = 'recite_pause';

              // Pause for user to recite with closed eyes (e.g. 4 seconds)
              setIsDelaying(true);
              const pauseSec = Math.max(3, settings.delaySeconds || 4);
              delayTimerRef.current = setTimeout(() => {
                setIsDelaying(false);
                if (ayahNum > startAyah) {
                  // Chain review from startAyah up to this ayah
                  cumulativePhaseRef.current = 'review_chain';
                  targetChainVerseRef.current = ayahNum;
                  currentAyahRef.current = startAyah;
                  setCurrentAyahIndex(startAyah);
                  playAyahTrack(startAyah);
                } else {
                  // If on first ayah, advance immediately to next verse
                  cumulativePhaseRef.current = 'verse_repeat';
                  if (ayahNum < endAyah) {
                    const next = ayahNum + 1;
                    currentAyahRef.current = next;
                    setCurrentAyahIndex(next);
                    playAyahTrack(next);
                  } else {
                    setIsPlaying(false);
                  }
                }
              }, pauseSec * 1000);
              return;
            }
          } else if (cumulativePhaseRef.current === 'review_chain') {
            // Playing consecutive chain from startAyah to targetChainVerse
            if (ayahNum < targetChainVerseRef.current) {
              const nextInChain = ayahNum + 1;
              currentAyahRef.current = nextInChain;
              setCurrentAyahIndex(nextInChain);
              playAyahTrack(nextInChain);
              return;
            } else {
              // Finished chain review! Advance to the next fresh ayah
              const target = targetChainVerseRef.current;
              cumulativePhaseRef.current = 'verse_repeat';
              if (target < endAyah) {
                const nextFreshAyah = target + 1;
                targetChainVerseRef.current = nextFreshAyah;
                currentAyahRef.current = nextFreshAyah;
                setCurrentAyahIndex(nextFreshAyah);
                playAyahTrack(nextFreshAyah);
                return;
              } else {
                setIsPlaying(false);
                return;
              }
            }
          }
        }

        // --- STANDARD REPEAT MODE ---
        if (verseRepeatRef.current < settings.verseRepeats) {
          verseRepeatRef.current += 1;
          setCurrentVerseRepeat(verseRepeatRef.current);

          if (settings.delaySeconds > 0) {
            setIsDelaying(true);
            delayTimerRef.current = setTimeout(() => {
              setIsDelaying(false);
              playAyahTrack(ayahNum);
            }, settings.delaySeconds * 1000);
          } else {
            playAyahTrack(ayahNum);
          }
        } else {
          // Reached repeat target for this verse! Reset verse repeat ref to 1
          verseRepeatRef.current = 1;
          setCurrentVerseRepeat(1);

          // Advance to next verse in range
          if (ayahNum < endAyah) {
            const nextAyah = ayahNum + 1;
            currentAyahRef.current = nextAyah;
            setCurrentAyahIndex(nextAyah);

            if (settings.delaySeconds > 0) {
              setIsDelaying(true);
              delayTimerRef.current = setTimeout(() => {
                setIsDelaying(false);
                playAyahTrack(nextAyah);
              }, settings.delaySeconds * 1000);
            } else {
              playAyahTrack(nextAyah);
            }
          } else {
            // Reached end of range! Check range repeats
            if (rangeLoopRef.current < settings.rangeRepeats) {
              rangeLoopRef.current += 1;
              setCurrentRangeLoop(rangeLoopRef.current);

              const firstAyah = startAyah;
              currentAyahRef.current = firstAyah;
              setCurrentAyahIndex(firstAyah);

              if (settings.delaySeconds > 0) {
                setIsDelaying(true);
                delayTimerRef.current = setTimeout(() => {
                  setIsDelaying(false);
                  playAyahTrack(firstAyah);
                }, settings.delaySeconds * 1000);
              } else {
                playAyahTrack(firstAyah);
              }
            } else {
              // Complete! Reset all refs & state
              setIsPlaying(false);
              verseRepeatRef.current = 1;
              rangeLoopRef.current = 1;
              setCurrentVerseRepeat(1);
              setCurrentRangeLoop(1);
            }
          }
        }
      };
    },
    [reciter, surahNumber, startAyah, endAyah, playbackRate, onAyahChange]
  );

  const togglePlayPause = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
      setIsPlaying(false);
      setIsDelaying(false);
    } else {
      setIsPlaying(true);
      playAyahTrack(currentAyahIndex);
    }
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
    }
    setIsPlaying(false);
    setIsDelaying(false);
    verseRepeatRef.current = 1;
    rangeLoopRef.current = 1;
    setCurrentAyahIndex(startAyah);
    setCurrentVerseRepeat(1);
    setCurrentRangeLoop(1);
  };

  const nextAyah = () => {
    if (currentAyahIndex < endAyah) {
      const nextIndex = currentAyahIndex + 1;
      verseRepeatRef.current = 1;
      currentAyahRef.current = nextIndex;
      setCurrentAyahIndex(nextIndex);
      setCurrentVerseRepeat(1);
      if (isPlaying) {
        playAyahTrack(nextIndex);
      }
    }
  };

  const prevAyah = () => {
    if (currentAyahIndex > startAyah) {
      const prevIndex = currentAyahIndex - 1;
      verseRepeatRef.current = 1;
      currentAyahRef.current = prevIndex;
      setCurrentAyahIndex(prevIndex);
      setCurrentVerseRepeat(1);
      if (isPlaying) {
        playAyahTrack(prevIndex);
      }
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  return {
    isPlaying,
    isDelaying,
    currentAyahIndex,
    currentVerseRepeat,
    currentRangeLoop,
    playbackRate,
    setCurrentAyahIndex,
    togglePlayPause,
    stop,
    nextAyah,
    prevAyah,
    changePlaybackRate,
  };
}
