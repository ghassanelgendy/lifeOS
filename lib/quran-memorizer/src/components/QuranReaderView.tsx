import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Eye,
  EyeOff,
  Volume2,
  Target,
  Bookmark,
  BookmarkPlus,
  Book,
  LayoutList,
  Award,
  SlidersHorizontal,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  Compass,
  Settings2,
  X,
  Search,
  Maximize2,
  Minimize2,
  Palette,
} from 'lucide-react';
import { Ayah, RepeatSettings, RatingGrade, MemorizationStatus } from '../types/quran';
import { fetchSurahVerses } from '../services/quranApi';
import { SURAHS } from '../services/quranData';
import { BlindModeOverlay } from './BlindModeOverlay';

const getSurahForPage = (page: number) => {
  let found = SURAHS[0];
  for (const s of SURAHS) {
    if (s.pageStart <= page) {
      found = s;
    } else {
      break;
    }
  }
  return found;
};

const JUZ_START_PAGES = Array.from({ length: 30 }, (_, i) => {
  const juzNum = i + 1;
  if (juzNum === 1) return { juz: 1, page: 1 };
  return { juz: juzNum, page: (juzNum - 2) * 20 + 22 };
});

// ─── Tajweed Color System ────────────────────────────────────────────────────
// Colors at the WORD level to preserve Arabic OpenType shaping.
// Each rule group maps to a color from the academic Tajweed color wheel.
// Priority: green > cyan > dark-blue > red > dark-red > orange > yellow > grey
const TAJWEED_COLORS = {
  // GREEN – غنة, إدغام بغنة, إقلاب, إخفاء شفوي/حقيقي, إدغام المتماثلين والمتقاربين
  green:    '#22c55e',
  // CYAN (Light Blue) – قلقلة
  cyan:     '#22d3ee',
  // DARK BLUE – تفخيم الراء
  darkBlue: '#3b82f6',
  // RED – مد الصلة الكبرى، مد الواجب (متصل/منفصل)، مد الفرق، مد اللازم
  red:      '#ef4444',
  // DARK RED (Maroon) – مد الطبيعي والعوض والبدل
  maroon:   '#b91c1c',
  // ORANGE – الألف الخنجرية، مد اللين والعارض للسكون
  orange:   '#f97316',
  // YELLOW – مد الصلة الصغرى
  yellow:   '#eab308',
  // GREY – إدغام المتجانسين، إدغام بدون غنة، همزة الوصل، اللام الشمسية، ألف التفريق
  grey:     '#9ca3af',
};

// Detect Tajweed features in a word using Uthmani text patterns.
// Returns the highest-priority color, or null if no feature detected.
const getTajweedColor = (word: string): string | null => {
  // GREEN: نون/ميم مشددتين (غنة), إخفاء (ن ساكنة + حروف إخفاء), إقلاب (ن + ب)
  // نّ / مّ = nun or mim with shadda
  if (/[نم]ّ/.test(word)) return TAJWEED_COLORS.green;
  // إقلاب: ن ساكنة + ب
  if (/نْ(?=\s*ب)|نً(?=\s*ب)|نٍ(?=\s*ب)/.test(word)) return TAJWEED_COLORS.green;
  // إخفاء حقيقي: letters of ikhfa after noon sakin/tanwin (approximate detection)
  if (/[نً][^\s]*[تثجدذزسشصضطظفقك]/.test(word)) return TAJWEED_COLORS.green;

  // CYAN: قلقلة – [قطبجد] with sukun
  if (/[قطبجد]ْ/.test(word)) return TAJWEED_COLORS.cyan;

  // DARK BLUE: تفخيم الراء – ر (simplified: all raa, refined versions check context)
  if (/رَ|رُ|رً|رٌ|رَّ|رُّ/.test(word)) return TAJWEED_COLORS.darkBlue;

  // RED: مد واجب متصل (mad letter + همز in same word) or مد لازم (ّ after mad)
  if (/[اوي]ء|[اوي][ٔأإ]/.test(word)) return TAJWEED_COLORS.red;
  if (/[اوي]ّ/.test(word)) return TAJWEED_COLORS.red;

  // DARK RED: مد طبيعي – simple mad letters (ا و ي) in regular context
  if (/[اوي]/.test(word) && !/[اوي]ء|[اوي][ٔأإ]|[اوي]ّ/.test(word)) {
    // Only color if it's a clear natural madd (preceded by matching short vowel)
    if (/َا|ُو|ِي/.test(word)) return TAJWEED_COLORS.maroon;
  }

  // ORANGE: الألف الخنجرية ٰ or مد اللين (واو/ياء ساكنة بعد فتح)
  if (/ٰ/.test(word)) return TAJWEED_COLORS.orange;
  if (/َو[ْ]|َي[ْ]/.test(word)) return TAJWEED_COLORS.orange;

  // YELLOW: مد الصلة الصغرى (ه ضمير mim/ha between vowels – hard to detect precisely)
  // Approximate: ه followed by vowel at word end
  if (/هِ$|هُ$|هٍ$|هٌ$/.test(word)) return TAJWEED_COLORS.yellow;

  // GREY: همزة الوصل ٱ, لام شمسية (ال + sun letters), إدغام بدون غنة
  if (/ٱ/.test(word)) return TAJWEED_COLORS.grey;
  if (/^ٱل[تثدذرزسشصضطظلن]/.test(word)) return TAJWEED_COLORS.grey;
  // إدغام بدون غنة: ن ساكنة/تنوين + ل أو ر
  if (/نْ[لر]|[ًٌٍ][لر]/.test(word)) return TAJWEED_COLORS.grey;

  return null;
};

const renderTajweedWord = (word: string, wordIdx: number) => {
  const color = getTajweedColor(word);
  if (color) {
    return (
      <span key={wordIdx} style={{ color }} className="inline">
        {word}{' '}
      </span>
    );
  }
  return <React.Fragment key={wordIdx}>{word} </React.Fragment>;
};

const renderTajweedText = (text: string) => {
  const words = text.split(/\s+/);
  return words.map((word, idx) => renderTajweedWord(word, idx));
};

interface WirdMarker {
  surahNumber: number;
  ayahNumber: number;
  page: number;
}

interface QuranReaderViewProps {
  surahNumber: number;
  onSelectSurah: (surahNumber: number) => void;
  currentAyahIndex: number;
  onSelectAyah: (ayahNumber: number) => void;
  startAyah: number;
  endAyah: number;
  onStartAyahChange: (val: number) => void;
  onEndAyahChange: (val: number) => void;
  isAudioPlaying: boolean;
  repeatSettings: RepeatSettings;
  onChangeRepeatSettings: (settings: RepeatSettings) => void;
  onGradeVerse?: (grade: RatingGrade) => void;
  onMarkMemorized?: () => void;
  getVerseMastery?: (surahNumber: number, ayahNumber: number) => { status: MemorizationStatus; masteryScore: number } | null;

  // Sync Locations & Highlights
  memorizationPage?: number;
  memorizationEndPage?: number;
  readingPage?: number;
  readingEndPage?: number;
  memorizationMarker?: WirdMarker;
  readingMarker?: WirdMarker;
  onSetMemorizationMarker?: (surahNumber: number, ayahNumber: number, page: number) => void;
  onSetReadingMarker?: (surahNumber: number, ayahNumber: number, page: number) => void;
  onSyncMemorization?: () => void;
  onSyncReading?: () => void;
  onOpenHalqahNote?: () => void;
  onBookmarkAyah?: (surahName: string, surahNumber: number, ayahNumber: number, ayahText: string) => void;
}

export const QuranReaderView: React.FC<QuranReaderViewProps> = ({
  surahNumber,
  onSelectSurah,
  currentAyahIndex,
  onSelectAyah,
  startAyah,
  endAyah,
  onStartAyahChange,
  onEndAyahChange,
  isAudioPlaying,
  repeatSettings,
  onChangeRepeatSettings,
  onGradeVerse,
  onMarkMemorized,
  getVerseMastery,
  memorizationPage,
  memorizationEndPage,
  readingPage,
  readingEndPage,
  memorizationMarker,
  readingMarker,
  onSetMemorizationMarker,
  onSetReadingMarker,
  onSyncMemorization,
  onSyncReading,
  onOpenHalqahNote,
  onBookmarkAyah,
}) => {
  const [verses, setVerses] = useState<Ayah[]>([]);
  const [viewMode, setViewMode] = useState<'page' | 'ayah'>(() => {
    try {
      const saved = localStorage.getItem('quran_view_mode_v1');
      if (saved === 'page' || saved === 'ayah') return saved;
    } catch {}
    return 'page';
  });

  useEffect(() => {
    try {
      localStorage.setItem('quran_view_mode_v1', viewMode);
    } catch {}
  }, [viewMode]);

  const [loading, setLoading] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showTajweed, setShowTajweed] = useState(() => {
    try {
      return localStorage.getItem('quran_tajweed_enabled_v1') === 'true';
    } catch {
      return false;
    }
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolsSheet, setShowToolsSheet] = useState(false);
  const [showSurahPicker, setShowSurahPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTab, setPickerTab] = useState<'surahs' | 'juz' | 'page'>('surahs');
  const [pageInputVal, setPageInputVal] = useState('');
  const [bookmarkToast, setBookmarkToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('quran_tajweed_enabled_v1', showTajweed.toString());
    } catch {}
  }, [showTajweed]);

  // Lock background scroll when modal sheets are open
  useEffect(() => {
    if (showSurahPicker || showToolsSheet) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showSurahPicker, showToolsSheet]);

  const touchStartXRef = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartXRef.current;

    if (diffX > 40) {
      // Swiped Right (Left-to-Right in RTL) -> Move to Next Page
      if (activePage < 604) handlePageChange(activePage + 1);
    } else if (diffX < -40) {
      // Swiped Left (Right-to-Left in RTL) -> Move to Previous Page
      if (activePage > 1) handlePageChange(activePage - 1);
    }
    touchStartXRef.current = null;
  };

  const currentSurah = SURAHS.find((s) => s.id === surahNumber) || SURAHS[0];

  // Active Page Number (1 - 604) for Page Navigation
  const [activePage, setActivePage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('quran_active_page_v1');
      if (saved) {
        const parsed = Number(saved);
        if (parsed >= 1 && parsed <= 604) return parsed;
      }
    } catch {}
    return memorizationPage || readingPage || currentSurah?.pageStart || 1;
  });

  // Page View Mode: 'single' (Classic Single Page Mushaf) vs 'all' (All Pages of Surah)
  const [pageLayout, setPageLayout] = useState<'single' | 'all'>(() => {
    try {
      const saved = localStorage.getItem('quran_page_layout_v1');
      if (saved === 'single' || saved === 'all') return saved;
    } catch {}
    return 'single';
  });

  useEffect(() => {
    try {
      localStorage.setItem('quran_active_page_v1', activePage.toString());
      localStorage.setItem('quran_page_layout_v1', pageLayout);
    } catch {}
  }, [activePage, pageLayout]);

  useEffect(() => {
    const handleActivePageSync = () => {
      try {
        const saved = localStorage.getItem('quran_active_page_v1');
        if (saved) {
          const parsed = Number(saved);
          if (parsed >= 1 && parsed <= 604) {
            setActivePage(parsed);
          }
        }
      } catch {}
    };

    window.addEventListener('quran_active_page_updated', handleActivePageSync);
    window.addEventListener('storage', handleActivePageSync);
    return () => {
      window.removeEventListener('quran_active_page_updated', handleActivePageSync);
      window.removeEventListener('storage', handleActivePageSync);
    };
  }, []);

  const handlePageChange = (newPage: number) => {
    const clampedPage = Math.min(604, Math.max(1, newPage));
    setActivePage(clampedPage);
    const targetSurah = getSurahForPage(clampedPage);
    if (targetSurah.id !== surahNumber) {
      onSelectSurah(targetSurah.id);
    }
    // Scroll window/container to top of the new page
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {}
  };

  useEffect(() => {
    const surahMeta = SURAHS.find((s) => s.id === surahNumber);
    if (surahMeta) {
      const nextSurah = SURAHS.find((s) => s.id === surahNumber + 1);
      const surahEndPage = nextSurah ? nextSurah.pageStart - 1 : 604;
      if (activePage < surahMeta.pageStart || activePage > surahEndPage) {
        setActivePage(surahMeta.pageStart);
      }
    }
  }, [surahNumber]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchSurahVerses(surahNumber)
      .then((data) => {
        if (isMounted) {
          setVerses(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [surahNumber]);

  // Group verses by page for Pages View
  const versesByPage = useMemo(() => {
    const map = new Map<number, Ayah[]>();
    verses.forEach((v) => {
      const p = v.page;
      if (!map.has(p)) {
        map.set(p, []);
      }
      map.get(p)!.push(v);
    });
    return map;
  }, [verses]);

  const currentJuzNumber = useMemo(() => {
    return JUZ_START_PAGES.reduce((acc, curr) => (activePage >= curr.page ? curr.juz : acc), 1);
  }, [activePage]);

  const filteredSurahs = useMemo(() => {
    if (!pickerSearch.trim()) return SURAHS;
    const q = pickerSearch.trim().toLowerCase();
    return SURAHS.filter(
      (s) =>
        s.name.includes(q) ||
        s.transliteration.toLowerCase().includes(q) ||
        s.id.toString() === q
    );
  }, [pickerSearch]);

  return (
    <div dir="rtl" className="space-y-3 font-arabic-body text-right">
      {/* 1. ULTRA-CLEAN iOS NATIVE HEADER BAR (No Wrapping, No Overlap) */}
      <div className="w-full px-2.5 py-1.5 rounded-2xl bg-card/90 backdrop-blur-2xl border border-border shadow-sm flex items-center justify-between gap-2 font-arabic-title">
        {/* Right: Surah & Page Selector Pill Trigger */}
        <button
          type="button"
          onClick={() => setShowSurahPicker(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/60 hover:bg-secondary border border-border text-xs font-bold text-foreground transition-all cursor-pointer active:scale-95 max-w-[200px] truncate"
        >
          <Book className="size-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">سورة {currentSurah.name}</span>
          <span className="text-[10px] text-emerald-400 font-mono shrink-0">ص {activePage}</span>
          <ChevronDown className="size-3 text-muted-foreground shrink-0" />
        </button>

        {/* Center: Segmented Pill (المصحف / الآيات) */}
        <div className="flex items-center p-0.5 rounded-xl bg-secondary/80 border border-border text-[11px] font-bold shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('page')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'page'
                ? 'bg-card text-emerald-400 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Book className="size-3" />
            <span>المصحف</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('ayah')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'ayah'
                ? 'bg-card text-emerald-400 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutList className="size-3" />
            <span>الآيات</span>
          </button>
        </div>

        {/* Left: Tajweed, Tafseer, Fullscreen & Secondary Tools Sheet */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowTajweed(!showTajweed)}
            className={`h-8 px-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
              showTajweed
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-secondary/60 text-muted-foreground border-border hover:bg-secondary'
            }`}
            title="تلوين أحرف التجويد"
          >
            <Palette className="size-3.5" />
            <span className="hidden sm:inline text-[11px]">التجويد</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTranslation(!showTranslation)}
            className={`h-8 px-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
              showTranslation
                ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                : 'bg-secondary/60 text-muted-foreground border-border hover:bg-secondary'
            }`}
            title="عرض التفسير الميسر"
          >
            <BookOpen className="size-3.5" />
            <span className="hidden sm:inline text-[11px]">التفسير</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`h-8 w-8 rounded-xl border flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
              isFullscreen
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-secondary/60 text-muted-foreground hover:text-foreground border-border hover:bg-secondary'
            }`}
            title={isFullscreen ? 'إلغاء وضع ملء الشاشة' : 'وضع ملء الشاشة والمطالعة'}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setShowToolsSheet(true)}
            className="h-8 w-8 rounded-xl bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border flex items-center justify-center cursor-pointer transition-all active:scale-95"
            title="خيارات وإعدادات القراءة والتكرار"
          >
            <Settings2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 2. SLIM QUICK MARKERS & PAGE CONTROLS */}
      <div className="flex items-center justify-between gap-1.5 px-1 overflow-x-auto no-scrollbar text-[11px] font-bold font-arabic-title">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSyncMemorization}
            className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
            title={`الانتقال إلى موضع الحفظ (ص ${memorizationPage})`}
          >
            <Target className="size-3 text-emerald-400" />
            <span>الحفظ: ص {memorizationPage}</span>
          </button>

          <button
            type="button"
            onClick={onSyncReading}
            className="px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/25 transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
            title={`الانتقال إلى موضع التلاوة (ص ${readingPage})`}
          >
            <Bookmark className="size-3 text-indigo-400" />
            <span>التلاوة: ص {readingPage}</span>
          </button>

          {onOpenHalqahNote && (
            <button
              type="button"
              onClick={onOpenHalqahNote}
              className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
              title="تدوين ملاحظة وتسميع الحلقة"
            >
              <FileText className="size-3 text-amber-400" />
              <span>ملاحظة الحلقة</span>
            </button>
          )}
        </div>

        {/* Page Switch Buttons */}
        {viewMode === 'page' && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 font-mono">
            <button
              type="button"
              onClick={() => activePage > 1 && handlePageChange(activePage - 1)}
              disabled={activePage <= 1}
              className="h-6 px-2 rounded-md bg-secondary/60 hover:bg-secondary text-foreground disabled:opacity-30 cursor-pointer flex items-center gap-0.5 border border-border"
            >
              <ChevronRight className="size-3" />
              <span className="font-arabic-title text-[10px]">السابقة</span>
            </button>
            <span className="px-1 text-emerald-400 font-bold">ص {activePage}</span>
            <button
              type="button"
              onClick={() => activePage < 604 && handlePageChange(activePage + 1)}
              disabled={activePage >= 604}
              className="h-6 px-2 rounded-md bg-secondary/60 hover:bg-secondary text-foreground disabled:opacity-30 cursor-pointer flex items-center gap-0.5 border border-border"
            >
              <span className="font-arabic-title text-[10px]">التالية</span>
              <ChevronLeft className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Bookmark Added Toast Notification */}
      {bookmarkToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <BookmarkPlus className="size-4 shrink-0 text-amber-300" />
          <span>{bookmarkToast}</span>
        </div>
      )}

      {/* 3. iOS NATIVE SURAH & JUZ PICKER MODAL/SHEET (Portaled to Body with z-[999]) */}
      {showSurahPicker &&
        createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
            onClick={() => setShowSurahPicker(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-card/95 backdrop-blur-2xl border-t sm:border border-border/70 rounded-t-[2.2rem] sm:rounded-3xl p-4 sm:p-6 space-y-3.5 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 ease-out font-arabic-title h-[88vh] sm:h-[82vh] flex flex-col overscroll-contain text-right"
              dir="rtl"
            >
              {/* iOS Drag Handle */}
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto -mt-1 shrink-0" />

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border pb-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <Book className="size-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-foreground">فهرس القرآن الكريم</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSurahPicker(false)}
                  className="h-7 w-7 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Picker Segmented Tabs: [ السور | الأجزاء | الصفحة ] */}
              <div className="grid grid-cols-3 gap-1 bg-secondary/60 p-1 rounded-xl border border-border text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setPickerTab('surahs')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    pickerTab === 'surahs' ? 'bg-card text-emerald-400 shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  السور (١١٤)
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('juz')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    pickerTab === 'juz' ? 'bg-card text-emerald-400 shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  الأجزاء (٣٠)
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('page')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    pickerTab === 'page' ? 'bg-card text-emerald-400 shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  رقم الصفحة
                </button>
              </div>

              {/* Tab 1: Surahs List */}
              {pickerTab === 'surahs' && (
                <div className="space-y-3 flex-1 overflow-hidden flex flex-col min-h-0">
                  <div className="relative shrink-0">
                    <Search className="size-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="ابحث عن اسم السورة..."
                      className="w-full pr-9 pl-3 py-2 bg-secondary/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-arabic-body"
                      autoFocus
                    />
                  </div>

                  <div className="overflow-y-auto overscroll-contain space-y-1 pr-1 flex-1 min-h-0 pb-16 touch-pan-y">
                    {filteredSurahs.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onSelectSurah(s.id);
                          handlePageChange(s.pageStart);
                          setShowSurahPicker(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer text-xs ${
                          s.id === surahNumber
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                            : 'bg-secondary/20 border-border hover:bg-secondary/50 text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center font-mono text-[11px] font-bold">
                            {s.id}
                          </span>
                          <span>سورة {s.name}</span>
                          <span className="text-[10px] text-muted-foreground">({s.type === 'Meccan' ? 'مكية' : 'مدنية'})</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                          <span>{s.versesCount} آيات</span>
                          <span className="text-emerald-400 font-bold">ص {s.pageStart}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Juz List */}
              {pickerTab === 'juz' && (
                <div className="overflow-y-auto overscroll-contain space-y-1.5 pr-1 flex-1 min-h-0 pb-16 touch-pan-y">
                  {JUZ_START_PAGES.map((j) => (
                    <button
                      key={j.juz}
                      type="button"
                      onClick={() => {
                        handlePageChange(j.page);
                        setShowSurahPicker(false);
                      }}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer text-xs ${
                        j.juz === currentJuzNumber
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                          : 'bg-secondary/20 border-border hover:bg-secondary/50 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center font-mono text-[11px] font-bold">
                          {j.juz}
                        </span>
                        <span>الجزء {j.juz}</span>
                      </div>
                      <span className="text-emerald-400 font-mono font-bold">صفحة {j.page}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Tab 3: Direct Page Jump */}
              {pickerTab === 'page' && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground block">
                      أدخل رقم الصفحة (من 1 إلى 604):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={604}
                      value={pageInputVal}
                      onChange={(e) => setPageInputVal(e.target.value)}
                      placeholder="مثال: 582"
                      className="w-full p-3 bg-secondary/40 border border-border rounded-xl text-center font-mono text-lg font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const p = Number(pageInputVal);
                      if (p >= 1 && p <= 604) {
                        handlePageChange(p);
                        setShowSurahPicker(false);
                      }
                    }}
                    disabled={!pageInputVal || Number(pageInputVal) < 1 || Number(pageInputVal) > 604}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-40 cursor-pointer"
                  >
                    الانتقال إلى الصفحة
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* 4. iOS NATIVE READING SETTINGS & TOOLS MODAL/SHEET (Portaled to Body with z-[999]) */}
      {showToolsSheet &&
        createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setShowToolsSheet(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-card/95 backdrop-blur-2xl border-t sm:border border-border/70 rounded-t-[2.2rem] sm:rounded-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-6 duration-200 font-arabic-title max-h-[85vh] flex flex-col overscroll-contain text-right"
              dir="rtl"
            >
              {/* iOS Drag Handle */}
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto -mt-2 shrink-0" />

              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="size-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-foreground">إعدادات وخيارات القراءة</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowToolsSheet(false)}
                  className="h-7 w-7 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Page Display Layout Mode */}
              {viewMode === 'page' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground block">نمط عرض الصفحات:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPageLayout('single')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                        pageLayout === 'single'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      صفحة واحدة بالمصحف
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageLayout('all')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                        pageLayout === 'all'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      جميع صفحات السورة
                    </button>
                  </div>
                </div>
              )}

              {/* Repeat Range Controls */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <SlidersHorizontal className="size-3.5 text-emerald-400" />
                    <span>تحديد نطاق التكرار:</span>
                  </label>
                  <span className="text-xs text-emerald-400 font-bold">
                    من آية {startAyah} إلى {endAyah}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">من الآية:</span>
                    <select
                      value={startAyah}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onStartAyahChange(val);
                        if (val > endAyah) onEndAyahChange(val);
                      }}
                      className="w-full h-9 bg-secondary text-xs font-bold rounded-xl px-2.5 border border-border"
                    >
                      {verses.map((a) => (
                        <option key={`start-${a.number}`} value={a.numberInSurah}>
                          الآية {a.numberInSurah}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">إلى الآية:</span>
                    <select
                      value={endAyah}
                      onChange={(e) => onEndAyahChange(Number(e.target.value))}
                      className="w-full h-9 bg-secondary text-xs font-bold rounded-xl px-2.5 border border-border"
                    >
                      {verses.map((a) => (
                        <option
                          key={`end-${a.number}`}
                          value={a.numberInSurah}
                          disabled={a.numberInSurah < startAyah}
                        >
                          الآية {a.numberInSurah}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Blind Mode Quick Toggle */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground block">اختبار الحفظ (تغطية الآيات)</span>
                  <span className="text-[11px] text-muted-foreground">إخفاء الكلمات لإتاحة التسميع الذاتي</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChangeRepeatSettings({ ...repeatSettings, blindMode: !repeatSettings.blindMode })
                  }
                  className={`h-8 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    repeatSettings.blindMode
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-secondary text-muted-foreground border-border'
                  }`}
                >
                  {repeatSettings.blindMode ? 'مُفعَّل' : 'مُعطَّل'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowToolsSheet(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                تم
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* 5. MAIN QURAN READING CANVAS (Full-Width & Minimal Mobile Padding) */}
      {viewMode === 'page' ? (
        <div className="space-y-4">
          {(() => {
            let pagesToRender = Array.from(versesByPage.entries()).sort(([a], [b]) => a - b);

            if (pageLayout === 'single') {
              const singlePageEntries = pagesToRender.filter(([p]) => p === activePage);
              if (singlePageEntries.length > 0) {
                pagesToRender = singlePageEntries;
              }
            }

            if (pagesToRender.length === 0) {
              return (
                <div className="p-8 text-center text-xs font-bold text-muted-foreground border border-dashed border-border rounded-3xl space-y-3 bg-card/60">
                  <p className="text-sm">جاري تحميل آيات صفحة {activePage}...</p>
                  <button
                    type="button"
                    onClick={() => handlePageChange(currentSurah.pageStart)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md transition-all"
                  >
                    الانتقال لبداية سورة {currentSurah.name} (ص {currentSurah.pageStart})
                  </button>
                </div>
              );
            }

            return pagesToRender.map(([pageNum, pageAyahs]) => {
              const pageSurah = getSurahForPage(pageNum);
              const hasAyahOne = pageAyahs.some((a) => a.numberInSurah === 1);

              return (
                <div
                  key={pageNum}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onDoubleClick={() => setIsFullscreen(!isFullscreen)}
                  className={`transition-all touch-pan-y ${
                    isFullscreen
                      ? 'fixed inset-0 z-[200] bg-background/98 overflow-y-auto p-3 sm:p-8 pb-24 sm:pb-28 space-y-4 font-arabic-title'
                      : 'px-2.5 py-3 sm:px-5 sm:py-6 rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-card/95 backdrop-blur-xl shadow-lg relative space-y-3'
                  }`}
                >

                  {/* Breadcrumb + Swipe Hint Bar */}
                  <div className="pb-2 mb-1 flex items-center justify-between text-[11px] text-muted-foreground font-arabic-title font-bold border-b border-border/40">
                    <span className="flex items-center gap-1 text-emerald-400 font-extrabold">
                      <BookOpen className="size-3.5 text-emerald-400 shrink-0" />
                      <span>سورة {pageSurah.name}</span>
                      <span className="text-muted-foreground/60 font-normal">•</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-extrabold text-[10px]">صفحة {pageNum}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1 select-none">
                      <span>←</span>
                      <span>اسحب للتنقل بين الصفحات</span>
                      <span>→</span>
                    </span>
                    <span className="text-foreground/60 font-mono text-[10px]">
                      الجزء {pageSurah.juzStart}
                    </span>
                  </div>

                  {/* Ornate Surah Title Banner if Ayah 1 is present */}
                  {hasAyahOne && (
                    <div className="my-2 p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-emerald-950/60 via-emerald-900/80 to-emerald-950/60 border border-emerald-500/40 text-center space-y-0.5 shadow-md font-arabic-title">
                      <div className="text-lg sm:text-2xl font-extrabold text-emerald-200 tracking-wide">
                        سُورَةُ {pageSurah.name}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-3">
                        <span>{pageSurah.type === 'Meccan' ? 'مَكِّيَّةٌ' : 'مَدَنِيَّةٌ'}</span>
                        <span>•</span>
                        <span>آيَاتُهَا {pageSurah.versesCount}</span>
                      </div>
                    </div>
                  )}

                  {/* Basmalah if Ayah 1 is present & Surah != 9 */}
                  {hasAyahOne && pageSurah.id !== 9 && (
                    <div className="text-center py-1 font-arabic-quran text-xl sm:text-2xl text-emerald-400/90 select-none tracking-normal">
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                    </div>
                  )}

                  {/* Continuous Mushaf Page Text (Maximized reading area) */}
                  <div className="dir-rtl text-justify font-arabic-quran text-2xl sm:text-3xl leading-[2.4] sm:leading-[2.8] text-foreground tracking-normal select-none font-bold">
                    {pageAyahs.map((ayah) => {
                      const isActive = currentAyahIndex === ayah.numberInSurah;
                      const inStudyRange = startAyah <= ayah.numberInSurah && ayah.numberInSurah <= endAyah;
                      const mastery = getVerseMastery ? getVerseMastery(surahNumber, ayah.numberInSurah) : null;
                      const isMemorized = mastery?.status === 'memorized';

                      const isMemMarker = memorizationMarker?.surahNumber === surahNumber && memorizationMarker?.ayahNumber === ayah.numberInSurah;
                      const isReadMarker = readingMarker?.surahNumber === surahNumber && readingMarker?.ayahNumber === ayah.numberInSurah;
                      const isMemWirdEnd = ayah.numberInSurah === endAyah;
                      const words = ayah.textUthmani.trim().split(/\s+/);

                      return (
                        <React.Fragment key={ayah.number}>
                          <span
                            onClick={() => onSelectAyah(ayah.numberInSurah)}
                            className={`cursor-pointer rounded-lg px-1 py-0.5 transition-all inline tracking-normal font-bold ${
                              isMemMarker && isReadMarker
                                ? 'bg-gradient-to-r from-emerald-500/30 to-indigo-500/30 text-foreground ring-2 ring-amber-400 shadow-md'
                                : isMemMarker
                                ? 'bg-emerald-500/25 text-emerald-200 ring-2 ring-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                                : isReadMarker
                                ? 'bg-indigo-500/25 text-indigo-200 ring-2 ring-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                                 : isActive
                                ? 'bg-gray-500/20 text-foreground ring-2 ring-gray-400/60 shadow-md'
                                : inStudyRange
                                ? 'bg-gray-500/10 border-b-2 border-gray-400/50'
                                : isMemorized
                                ? 'text-emerald-400'
                                : 'hover:bg-accent/40'
                            }`}
                          >
                            {repeatSettings.blindMode ? (
                              words.map((w, wIdx) => (
                                <span
                                  key={wIdx}
                                  className="inline mx-1 px-1 rounded transition-all duration-300 text-indigo-400/20 bg-indigo-500/20 border border-indigo-500/30 blur-[6px] hover:blur-none hover:text-foreground hover:bg-transparent select-none cursor-pointer"
                                >
                                  {w}{' '}
                                </span>
                              ))
                            ) : showTajweed ? (
                              renderTajweedText(ayah.textUthmani)
                            ) : (
                              ayah.textUthmani
                            )}
                          </span>
                          <span
                            onClick={() => onSelectAyah(ayah.numberInSurah)}
                            className={`inline-flex items-center justify-center min-w-[2rem] h-6 sm:h-7 px-1.5 mx-1 rounded-full text-xs font-bold font-mono align-middle cursor-pointer transition-all whitespace-nowrap select-none ${
                              isMemWirdEnd
                                ? 'bg-emerald-600 text-white font-black ring-2 ring-emerald-500/50 scale-105 shadow-md'
                                : isMemMarker
                                ? 'bg-emerald-500 text-white font-black shadow-[0_0_8px_rgba(16,185,129,0.5)] scale-105'
                                : isReadMarker
                                ? 'bg-indigo-600 text-white font-black shadow-[0_0_8px_rgba(99,102,241,0.5)] scale-105'
                                : isMemorized
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/80'
                                : inStudyRange
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/50'
                                : 'border border-emerald-500/40 text-emerald-400/90 bg-emerald-500/5 hover:bg-emerald-500/20'
                            }`}
                          >
                            ﴿{ayah.numberInSurah}﴾
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Active Ayah Quick Actions in Page Mode */}
                  {pageAyahs.some((a) => a.numberInSurah === currentAyahIndex) && (
                    <>
                      <div className="border-t border-border/40 pt-2 flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-secondary/60 border border-border/50">
                          <span className="text-[11px] font-bold text-foreground px-2 py-0.5">
                            آية {currentAyahIndex}:
                          </span>

                          {/* Add to Notes / Quran Bookmarks */}
                          {onBookmarkAyah && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const target = pageAyahs.find((a) => a.numberInSurah === currentAyahIndex);
                                if (target) {
                                  onBookmarkAyah(pageSurah.name, pageSurah.id, target.numberInSurah, target.textUthmani);
                                  setBookmarkToast(`تمت إضافة الآية ${target.numberInSurah} سورة ${pageSurah.name} إلى دفتر "Quran Bookmarks" في الملاحظات`);
                                  setTimeout(() => setBookmarkToast(null), 3500);
                                }
                              }}
                              className="px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer text-amber-400 hover:bg-amber-500/15"
                              title="حفظ الآية في دفتر علامات القرآن بالملاحظات"
                            >
                              <BookmarkPlus className="size-3" />
                              <span>حفظ بالملاحظات</span>
                            </button>
                          )}

                          {onSetMemorizationMarker && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const target = pageAyahs.find((a) => a.numberInSurah === currentAyahIndex);
                                if (target) {
                                  onSetMemorizationMarker(surahNumber, target.numberInSurah, target.page);
                                }
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                                memorizationMarker?.surahNumber === surahNumber && memorizationMarker?.ayahNumber === currentAyahIndex
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'text-emerald-400 hover:bg-emerald-500/15'
                              }`}
                            >
                              <Target className="size-3" />
                              <span>{memorizationMarker?.surahNumber === surahNumber && memorizationMarker?.ayahNumber === currentAyahIndex ? '✓ موضع الحفظ' : 'موضع الحفظ'}</span>
                            </button>
                          )}

                          {onSetReadingMarker && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const target = pageAyahs.find((a) => a.numberInSurah === currentAyahIndex);
                                if (target) {
                                  onSetReadingMarker(surahNumber, target.numberInSurah, target.page);
                                }
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                                readingMarker?.surahNumber === surahNumber && readingMarker?.ayahNumber === currentAyahIndex
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'text-indigo-400 hover:bg-indigo-500/15'
                              }`}
                            >
                              <Bookmark className="size-3" />
                              <span>{readingMarker?.surahNumber === surahNumber && readingMarker?.ayahNumber === currentAyahIndex ? '✓ موضع التلاوة' : 'موضع التلاوة'}</span>
                            </button>
                          )}
                        </div>

                        {onMarkMemorized && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkMemorized();
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/25 text-[11px] flex items-center gap-1 active:scale-95 cursor-pointer transition-all"
                          >
                            <Award className="size-3 text-emerald-400" />
                            <span>اعتماد كمُتقَن</span>
                          </button>
                        )}
                      </div>

                      {/* Tafsir in Page Mode if enabled */}
                      {showTranslation && (
                        <div className="text-xs text-foreground/90 leading-relaxed border-t border-border/30 pt-2 text-right dir-rtl font-arabic-body bg-secondary/30 p-2.5 rounded-xl border border-border/40">
                          <span className="font-bold text-amber-400 block mb-0.5 text-[11px]">📖 التفسير الميسر (آية {currentAyahIndex}):</span>
                          {pageAyahs.find((a) => a.numberInSurah === currentAyahIndex)?.translation}
                        </div>
                      )}
                    </>
                  )}

                  {/* Slim bottom footer */}
                  <div className="border-t border-border/30 pt-1.5 flex items-center justify-center text-[10px] text-muted-foreground/60 font-arabic-title font-bold select-none">
                    <span>ـ صفحة {pageNum} ـ</span>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        /* AYAH VIEW (LIST CARDS DISPLAY) */
        <div className="space-y-3">
          {verses.map((ayah) => {
            const isActive = currentAyahIndex === ayah.numberInSurah;
            const inStudyRange = startAyah <= ayah.numberInSurah && ayah.numberInSurah <= endAyah;
            const mastery = getVerseMastery ? getVerseMastery(surahNumber, ayah.numberInSurah) : null;
            const isMemorized = mastery?.status === 'memorized';

            const isMemMarker = memorizationMarker?.surahNumber === surahNumber && memorizationMarker?.ayahNumber === ayah.numberInSurah;
            const isReadMarker = readingMarker?.surahNumber === surahNumber && readingMarker?.ayahNumber === ayah.numberInSurah;
            const isMemWirdEnd = ayah.numberInSurah === endAyah;

            return (
              <div
                key={ayah.number}
                onClick={() => onSelectAyah(ayah.numberInSurah)}
                className={`p-3.5 sm:p-5 rounded-2xl border transition-all cursor-pointer relative ${
                  isMemWirdEnd
                    ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-950/20 shadow-lg'
                    : isMemMarker
                    ? 'border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/40 shadow-lg'
                    : isReadMarker
                    ? 'border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/40 shadow-lg'
                    : isActive
                    ? 'border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/30 shadow-lg'
                    : inStudyRange
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : 'border-border/60 bg-card hover:border-border hover:bg-accent/20'
                }`}
              >
                {/* Verse Header Info */}
                <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground font-sans flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-foreground font-bold text-[11px]">
                      الآية {ayah.numberInSurah} (ص {ayah.page})
                    </span>

                    {isMemMarker && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-[10px]">
                        <Target className="size-2.5" /> موضع الحفظ
                      </span>
                    )}

                    {isReadMarker && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 font-bold text-[10px]">
                        <Bookmark className="size-2.5" /> موضع التلاوة
                      </span>
                    )}

                    {isMemorized && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-[10px]">
                        ✨ مُتقَن
                      </span>
                    )}

                    {isActive && isAudioPlaying && (
                      <span className="text-[11px] font-bold text-emerald-400 animate-pulse flex items-center gap-1">
                        <Volume2 className="size-3.5" /> جاري التلاوة...
                      </span>
                    )}
                  </div>
                </div>

                {/* Verse Text Display */}
                {repeatSettings.blindMode && isActive ? (
                  <BlindModeOverlay
                    isBlindMode={repeatSettings.blindMode}
                    onToggleBlindMode={() =>
                      onChangeRepeatSettings({ ...repeatSettings, blindMode: false })
                    }
                    textUthmani={ayah.textUthmani}
                    onGrade={onGradeVerse}
                  />
                ) : (
                  <div className="dir-rtl text-right font-arabic-quran text-2xl sm:text-3xl leading-[2.2] sm:leading-[2.5] text-foreground tracking-normal select-none font-bold">
                    {ayah.textUthmani}
                    <span className="inline-flex items-center justify-center min-w-[2rem] h-7 sm:h-8 px-1.5 mx-1.5 rounded-full border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold align-middle whitespace-nowrap select-none">
                      ﴿{ayah.numberInSurah}﴾
                    </span>
                  </div>
                )}

                {/* Tafsir Al-Muyassar Display */}
                {showTranslation && ayah.translation && (
                  <div className="mt-3 text-xs text-foreground/90 leading-relaxed border-t border-border/30 pt-2.5 text-right dir-rtl font-arabic-body bg-secondary/30 p-2.5 rounded-xl border border-border/40">
                    <span className="font-bold text-amber-400 block mb-0.5 text-[11px]">📖 التفسير الميسر:</span>
                    {ayah.translation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
