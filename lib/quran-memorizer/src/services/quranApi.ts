import { Ayah } from '../types/quran';

// Cache in-memory for fast switching
const verseCache = new Map<number, Ayah[]>();

export async function fetchSurahVerses(surahNumber: number): Promise<Ayah[]> {
  if (verseCache.has(surahNumber)) {
    return verseCache.get(surahNumber)!;
  }

  try {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,ar.muyassar`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const uthmaniEdition = json.data[0];
    const translationEdition = json.data[1];

    const ayahs: Ayah[] = uthmaniEdition.ayahs.map((a: any, idx: number) => {
      let text = a.text;

      // Strip prefixed Basmalah from Ayah 1 for surahs 2-114 (except surah 9 At-Tawbah)
      if (a.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9) {
        text = text
          .replace(/^بِسْمِ\s+ٱللَّهِ\s+ٱلرَّحْمَٰنِ\s+ٱلرَّحِيمِ\s*/, '')
          .replace(/^بِسْمِ\s+اللَّهِ\s+الرَّحْمَٰنِ\s+الرَّحِيمِ\s*/, '')
          .replace(/^بْسمِ\s+اللَّهِ\s+الرَّحْمٰنِ\s+الرَّحيمِ\s*/, '')
          .trim();
      }

      return {
        number: a.number,
        numberInSurah: a.numberInSurah,
        surahNumber: surahNumber,
        textUthmani: text,
        translation: translationEdition?.ayahs[idx]?.text || '',
        juz: a.juz,
        page: a.page,
        hizbQuarter: a.hizbQuarter,
      };
    });

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
