import { Ayah } from '../types/quran';

// Cache in-memory for fast switching
const verseCache = new Map<number, Ayah[]>();
const pageCache = new Map<number, Ayah[]>();

async function getPageFromIdb(p: number): Promise<Ayah[] | null> {
  try {
    if (typeof indexedDB === 'undefined') return null;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('lifeos-indexeddb', 6);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject();
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('quran_pages')) {
          req.result.createObjectStore('quran_pages', { keyPath: 'page' });
        }
      };
    });
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('quran_pages', 'readonly');
        const req = tx.objectStore('quran_pages').get(p);
        req.onsuccess = () => resolve(req.result?.ayahs ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

async function setPageToIdb(p: number, ayahs: Ayah[]): Promise<void> {
  try {
    if (typeof indexedDB === 'undefined') return;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('lifeos-indexeddb', 6);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject();
    });
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction('quran_pages', 'readwrite');
        tx.objectStore('quran_pages').put({ page: p, ayahs, cachedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // best-effort
  }
}

export async function fetchSurahVerses(surahNumber: number): Promise<Ayah[]> {
  if (verseCache.has(surahNumber)) {
    return verseCache.get(surahNumber)!;
  }

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('quran_offline');
    }
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

export async function fetchPageVerses(pageNumber: number): Promise<Ayah[]> {
  const p = Math.max(1, Math.min(604, pageNumber));

  // 1. In-memory cache
  if (pageCache.has(p)) {
    return pageCache.get(p)!;
  }

  // 2. IDB persistent cache
  const idbData = await getPageFromIdb(p);
  if (idbData && idbData.length > 0) {
    pageCache.set(p, idbData);
    return idbData;
  }

  // 3. Network fetch (online only)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('quran_offline');
  }

  try {
    const [uthmaniRes, tafsirRes] = await Promise.all([
      fetch(`https://api.alquran.cloud/v1/page/${p}/quran-uthmani`),
      fetch(`https://api.alquran.cloud/v1/page/${p}/ar.muyassar`)
    ]);

    if (!uthmaniRes.ok) throw new Error(`HTTP ${uthmaniRes.status}`);
    const uthmaniJson = await uthmaniRes.json();
    const tafsirJson = tafsirRes.ok ? await tafsirRes.json() : { data: { ayahs: [] } };

    const uthmaniAyahs = uthmaniJson.data?.ayahs || [];
    const tafsirAyahs = tafsirJson.data?.ayahs || [];

    const ayahs: Ayah[] = uthmaniAyahs.map((a: any, idx: number) => {
      let text = a.text;
      const sNumber = a.surah?.number || 1;

      // Strip prefixed Basmalah from Ayah 1 for surahs 2-114 (except surah 9 At-Tawbah)
      if (a.numberInSurah === 1 && sNumber !== 1 && sNumber !== 9) {
        text = text
          .replace(/^بِسْمِ\s+ٱللَّهِ\s+ٱلرَّحْمَٰنِ\s+ٱلرَّحِيمِ\s*/, '')
          .replace(/^بِسْمِ\s+اللَّهِ\s+الرَّحْمَٰنِ\s+الرَّحِيمِ\s*/, '')
          .replace(/^بْسمِ\s+اللَّهِ\s+الرَّحْمٰنِ\s+الرَّحيمِ\s*/, '')
          .trim();
      }

      return {
        number: a.number,
        numberInSurah: a.numberInSurah,
        surahNumber: sNumber,
        textUthmani: text,
        translation: tafsirAyahs[idx]?.text || '',
        juz: a.juz,
        page: a.page || p,
        hizbQuarter: a.hizbQuarter,
      };
    });

    pageCache.set(p, ayahs);
    void setPageToIdb(p, ayahs);
    return ayahs;
  } catch (err) {
    console.error(`Failed to fetch page ${p} verses:`, err);
    throw err;
  }
}

async function setMultiplePagesToIdb(pages: { page: number; ayahs: Ayah[] }[]): Promise<void> {
  try {
    if (typeof indexedDB === 'undefined') return;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('lifeos-indexeddb', 6);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject();
    });
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction('quran_pages', 'readwrite');
        const store = tx.objectStore('quran_pages');
        const now = Date.now();
        for (const item of pages) {
          store.put({ page: item.page, ayahs: item.ayahs, cachedAt: now });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // best-effort
  }
}

/**
 * Downloads and caches the entire 604 pages of the Medina Mushaf along with Tafsir Al-Muyassar
 * in 2 fast bulk network requests, populating in-memory and IndexedDB storage.
 */
export async function downloadAndCacheFullQuran(
  onProgress?: (step: 'fetching' | 'processing' | 'saving' | 'done', progressPercent: number, statusText: string) => void
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('لا يوجد اتصال بالإنترنت لبدء التنزيل');
  }

  onProgress?.('fetching', 20, 'جاري تنزيل نصوص القرآن الكريم والتفسير الميسر...');

  const [uthmaniRes, tafsirRes] = await Promise.all([
    fetch('https://api.alquran.cloud/v1/quran/quran-uthmani'),
    fetch('https://api.alquran.cloud/v1/quran/ar.muyassar')
  ]);

  if (!uthmaniRes.ok) {
    throw new Error(`تعذر تحميل المصحف من الخادم (HTTP ${uthmaniRes.status})`);
  }

  onProgress?.('processing', 55, 'جاري معالجة وترتيب 604 صفحة مع التفسير...');

  const uthmaniJson = await uthmaniRes.json();
  const tafsirJson = tafsirRes.ok ? await tafsirRes.json() : { data: { surahs: [] } };

  const uthmaniSurahs = uthmaniJson.data?.surahs || [];
  const tafsirSurahs = tafsirJson.data?.surahs || [];

  const pageMap = new Map<number, Ayah[]>();
  for (let p = 1; p <= 604; p++) {
    pageMap.set(p, []);
  }

  for (let sIdx = 0; sIdx < uthmaniSurahs.length; sIdx++) {
    const uSurah = uthmaniSurahs[sIdx];
    const tSurah = tafsirSurahs[sIdx];
    const surahNumber = uSurah.number;
    const surahAyahs: Ayah[] = [];

    for (let aIdx = 0; aIdx < uSurah.ayahs.length; aIdx++) {
      const uAyah = uSurah.ayahs[aIdx];
      const tAyah = tSurah?.ayahs?.[aIdx];
      let text = uAyah.text;

      // Strip prefixed Basmalah from Ayah 1 for surahs 2-114 (except surah 9 At-Tawbah)
      if (uAyah.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9) {
        text = text
          .replace(/^بِسْمِ\s+ٱللَّهِ\s+ٱلرَّحْمَٰنِ\s+ٱلرَّحِيمِ\s*/, '')
          .replace(/^بِسْمِ\s+اللَّهِ\s+الرَّحْمَٰنِ\s+الرَّحِيمِ\s*/, '')
          .replace(/^بْسمِ\s+اللَّهِ\s+الرَّحْمٰنِ\s+الرَّحيمِ\s*/, '')
          .trim();
      }

      const ayah: Ayah = {
        number: uAyah.number,
        numberInSurah: uAyah.numberInSurah,
        surahNumber: surahNumber,
        textUthmani: text,
        translation: tAyah?.text || '',
        juz: uAyah.juz,
        page: uAyah.page,
        hizbQuarter: uAyah.hizbQuarter
      };

      surahAyahs.push(ayah);

      if (pageMap.has(uAyah.page)) {
        pageMap.get(uAyah.page)!.push(ayah);
      }
    }

    verseCache.set(surahNumber, surahAyahs);
  }

  onProgress?.('saving', 80, 'جاري الحفظ في الذاكرة المحلية للجهاز...');

  const pagesArray: { page: number; ayahs: Ayah[] }[] = [];
  for (const [p, ayahs] of pageMap.entries()) {
    pageCache.set(p, ayahs);
    pagesArray.push({ page: p, ayahs });
  }

  await setMultiplePagesToIdb(pagesArray);

  onProgress?.('done', 100, 'تم تنزيل وحفظ جميع الصفحات (604 صفحة) والتفسير بنجاح ✓');
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
