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
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
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

        // Check if verse repeat is less than requested repeats
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
