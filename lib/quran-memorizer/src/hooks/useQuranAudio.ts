import { useState, useEffect, useRef, useCallback } from 'react';
import { Reciter, RepeatSettings } from '../types/quran';
import { getAyahAudioUrl } from '../services/quranApi';

interface UseQuranAudioProps {
  reciter: Reciter;
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  repeatSettings: RepeatSettings;
  onAyahChange?: (ayahNumber: number) => void;
}

export function useQuranAudio({
  reciter,
  surahNumber,
  startAyah,
  endAyah,
  repeatSettings,
  onAyahChange,
}: UseQuranAudioProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(startAyah);
  const [currentVerseRepeat, setCurrentVerseRepeat] = useState(1);
  const [currentRangeLoop, setCurrentRangeLoop] = useState(1);
  const [isDelaying, setIsDelaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync index if selection changes
  useEffect(() => {
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
        // Check verse repeat
        if (currentVerseRepeat < repeatSettings.verseRepeats) {
          if (repeatSettings.delaySeconds > 0) {
            setIsDelaying(true);
            delayTimerRef.current = setTimeout(() => {
              setIsDelaying(false);
              setCurrentVerseRepeat((prev) => prev + 1);
              playAyahTrack(ayahNum);
            }, repeatSettings.delaySeconds * 1000);
          } else {
            setCurrentVerseRepeat((prev) => prev + 1);
            playAyahTrack(ayahNum);
          }
        } else {
          // Reset verse repeat counter for next verse
          setCurrentVerseRepeat(1);

          // Advance to next verse in range
          if (ayahNum < endAyah) {
            const nextAyah = ayahNum + 1;
            setCurrentAyahIndex(nextAyah);
            if (repeatSettings.delaySeconds > 0) {
              setIsDelaying(true);
              delayTimerRef.current = setTimeout(() => {
                setIsDelaying(false);
                playAyahTrack(nextAyah);
              }, repeatSettings.delaySeconds * 1000);
            } else {
              playAyahTrack(nextAyah);
            }
          } else {
            // Reached end of range! Check range repeats
            if (currentRangeLoop < repeatSettings.rangeRepeats) {
              setCurrentRangeLoop((prev) => prev + 1);
              setCurrentAyahIndex(startAyah);
              if (repeatSettings.delaySeconds > 0) {
                setIsDelaying(true);
                delayTimerRef.current = setTimeout(() => {
                  setIsDelaying(false);
                  playAyahTrack(startAyah);
                }, repeatSettings.delaySeconds * 1000);
              } else {
                playAyahTrack(startAyah);
              }
            } else {
              // Complete!
              setIsPlaying(false);
              setCurrentRangeLoop(1);
              setCurrentVerseRepeat(1);
            }
          }
        }
      };
    },
    [reciter, surahNumber, startAyah, endAyah, repeatSettings, currentVerseRepeat, currentRangeLoop, playbackRate, onAyahChange]
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
    setCurrentAyahIndex(startAyah);
    setCurrentVerseRepeat(1);
    setCurrentRangeLoop(1);
  };

  const nextAyah = () => {
    if (currentAyahIndex < endAyah) {
      const nextIndex = currentAyahIndex + 1;
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
    togglePlayPause,
    stop,
    nextAyah,
    prevAyah,
    changePlaybackRate,
    setCurrentAyahIndex,
  };
}
