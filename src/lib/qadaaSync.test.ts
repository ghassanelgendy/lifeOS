import { describe, it, expect } from 'vitest';
import {
  detectQadaaPrayerFromTaskTitle,
  PRAYER_KEY_MAP,
  ARABIC_PRAYER_NAMES,
  QADAA_HABIT_TITLE,
} from './qadaaSync';

describe('qadaaSync - Task Title Detection & Constants', () => {
  it('detects Fajr from various Arabic and English phrases', () => {
    expect(detectQadaaPrayerFromTaskTitle('قضاء الفجر')).toBe('fajr');
    expect(detectQadaaPrayerFromTaskTitle('صلاة قضاء فجر اليوم')).toBe('fajr');
    expect(detectQadaaPrayerFromTaskTitle('Fajr Qadaa')).toBe('fajr');
    expect(detectQadaaPrayerFromTaskTitle('Qadaa Fajr')).toBe('fajr');
    expect(detectQadaaPrayerFromTaskTitle('qadha fajr')).toBe('fajr');
  });

  it('detects Dhuhr, Asr, Maghrib, Isha, and Witr', () => {
    expect(detectQadaaPrayerFromTaskTitle('قضاء الظهر')).toBe('dhuhr');
    expect(detectQadaaPrayerFromTaskTitle('قضاء العصر')).toBe('asr');
    expect(detectQadaaPrayerFromTaskTitle('قضاء المغرب')).toBe('maghrib');
    expect(detectQadaaPrayerFromTaskTitle('قضاء العشاء')).toBe('isha');
    expect(detectQadaaPrayerFromTaskTitle('قضاء الوتر')).toBe('witr');
  });

  it('returns null for non-qadaa tasks or ordinary prayer tasks', () => {
    expect(detectQadaaPrayerFromTaskTitle('صلاة الفجر في المسجد')).toBeNull();
    expect(detectQadaaPrayerFromTaskTitle('قراءة الورد اليومي')).toBeNull();
    expect(detectQadaaPrayerFromTaskTitle('Buying groceries')).toBeNull();
    expect(detectQadaaPrayerFromTaskTitle('')).toBeNull();
  });

  it('provides complete mappings for all 6 prayer keys', () => {
    const keys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'witr'] as const;
    keys.forEach((k) => {
      expect(ARABIC_PRAYER_NAMES[k]).toBeDefined();
    });
    expect(QADAA_HABIT_TITLE).toBe('قضاء الصلوات اليومية');
  });
});
