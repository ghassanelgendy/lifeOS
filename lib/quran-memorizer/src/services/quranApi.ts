import { Ayah } from '../types/quran';

// Cache in-memory for fast switching
const verseCache = new Map<number, Ayah[]>();

export async function fetchSurahVerses(surahNumber: number): Promise<Ayah[]> {
  if (verseCache.has(surahNumber)) {
    return verseCache.get(surahNumber)!;
  }

  try {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,en.sahih`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const uthmaniEdition = json.data[0];
    const translationEdition = json.data[1];

    const ayahs: Ayah[] = uthmaniEdition.ayahs.map((a: any, idx: number) => ({
      number: a.number,
      numberInSurah: a.numberInSurah,
      surahNumber: surahNumber,
      textUthmani: a.text,
      translation: translationEdition?.ayahs[idx]?.text || '',
      juz: a.juz,
      page: a.page,
      hizbQuarter: a.hizbQuarter,
    }));

    verseCache.set(surahNumber, ayahs);
    return ayahs;
  } catch (err) {
    console.error('Failed to fetch surah verses:', err);
    throw err;
  }
}

/**
 * Returns audio URL for a given surah and ayah number.
 * Standard format: 3-digit surah number + 3-digit ayah number (e.g., 001001.mp3)
 */
export function getAyahAudioUrl(reciterSubfolder: string, surahNumber: number, ayahInSurah: number): string {
  const surahStr = String(surahNumber).padStart(3, '0');
  const ayahStr = String(ayahInSurah).padStart(3, '0');
  return `https://everyayah.com/data/${reciterSubfolder}/${surahStr}${ayahStr}.mp3`;
}
