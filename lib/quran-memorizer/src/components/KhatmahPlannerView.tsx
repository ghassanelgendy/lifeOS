import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Target,
  Flame,
  Calendar,
  Sparkles,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  BookOpen,
  Clock,
  UserCheck,
  Compass,
  FileText,
  Bookmark,
  X,
} from 'lucide-react';
import {
  KhatmahPlan,
  KhatmahGoalType,
  KhatmahDirection,
  LinkedLifeOSTask,
  LinkedLifeOSHabit,
  LinkedLifeOSEvent,
  SheikhHalqahNote,
  ReadingWirdPlan,
} from '../types/quran';
import { SURAHS } from '../services/quranData';

const KHATMAH_STORAGE_KEY = 'quran_khatmah_plan_v1';
const READING_WIRD_STORAGE_KEY = 'quran_reading_wird_v1';
const HALQAH_NOTES_STORAGE_KEY = 'quran_halqah_notes_v1';

interface KhatmahPlannerViewProps {
  linkedTasks?: LinkedLifeOSTask[];
  linkedHabits?: LinkedLifeOSHabit[];
  linkedEvents?: LinkedLifeOSEvent[];
  onToggleTask?: (taskId: string) => void;
  onToggleHabit?: (habitId: string, isCompleted: boolean) => void;
  onUpdateHabitDescription?: (habitId: string, description: string) => void;
  onCreateTask?: (title: string, dueDate: string) => void;
  onCreateHalqahNote?: (note: SheikhHalqahNote) => void;
  onOpenReader?: (page: number, surahNumber?: number) => void;
}

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

const calculateSmartAyahRange = (page: number, surah: typeof SURAHS[0]) => {
  const nextSurah = SURAHS.find((s) => s.id === surah.id + 1);
  const nextSurahPageStart = nextSurah ? nextSurah.pageStart : 605;
  const surahPageSpan = Math.max(1, nextSurahPageStart - surah.pageStart);

  if (surah.versesCount <= 10 || surahPageSpan <= 1) {
    return { startAyah: 1, endAyah: surah.versesCount };
  }

  const offset = Math.max(0, page - surah.pageStart);
  const startAyah = Math.max(1, Math.floor((offset / surahPageSpan) * surah.versesCount) + 1);
  const endAyah =
    offset >= surahPageSpan - 1
      ? surah.versesCount
      : Math.min(surah.versesCount, Math.ceil(((offset + 1) / surahPageSpan) * surah.versesCount));

  return { startAyah, endAyah };
};

export const KhatmahPlannerView: React.FC<KhatmahPlannerViewProps> = ({
  linkedTasks = [],
  linkedHabits = [],
  linkedEvents = [],
  onToggleTask,
  onToggleHabit,
  onUpdateHabitDescription,
  onCreateTask,
  onCreateHalqahNote,
  onOpenReader,
}) => {
  // Memorization Plan State
  const [plan, setPlan] = useState<KhatmahPlan | null>(() => {
    try {
      const saved = localStorage.getItem(KHATMAH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Reading Wird State
  const [readingWird, setReadingWird] = useState<ReadingWirdPlan>(() => {
    try {
      const saved = localStorage.getItem(READING_WIRD_STORAGE_KEY);
      return saved
        ? JSON.parse(saved)
        : { currentPage: 1, pagesPerDay: 4, streakDays: 0 };
    } catch {
      return { currentPage: 1, pagesPerDay: 4, streakDays: 0 };
    }
  });

  // Sheikh Halqah Notes State
  const [halqahNotes, setHalqahNotes] = useState<SheikhHalqahNote[]>(() => {
    try {
      const saved = localStorage.getItem(HALQAH_NOTES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modals state
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showHalqahNoteModal, setShowHalqahNoteModal] = useState(false);

  // Lock body scroll when any modal is open to prevent background scrolling
  const isAnyModalOpen = showNewPlanModal || showHalqahNoteModal;

  useEffect(() => {
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isAnyModalOpen]);

  // New Halqah Note Form State
  const [noteSurahId, setNoteSurahId] = useState<number>(2);
  const [noteStartAyah, setNoteStartAyah] = useState<number>(1);
  const [noteEndAyah, setNoteEndAyah] = useState<number>(7);
  const [noteMistakes, setNoteMistakes] = useState('');
  const [noteRating, setNoteRating] = useState<'mumtaz' | 'jayyid_jiddan' | 'jayyid' | 'yahatadj_tathbeet'>('jayyid_jiddan');
  const [noteWirdType, setNoteWirdType] = useState<'memorization' | 'reading' | 'general'>('memorization');

  const selectedNoteSurahMeta = SURAHS.find((s) => s.id === noteSurahId) || SURAHS[0];

  const getSmartWirdInfo = (type: 'memorization' | 'reading') => {
    if (type === 'memorization' && plan) {
      const page = plan.currentPage;
      const surah = getSurahForPage(page);
      const range = calculateSmartAyahRange(page, surah);
      return { type, page, surah, startAyah: range.startAyah, endAyah: range.endAyah, label: 'ورد الحفظ اليومي' };
    }
    const page = readingWird.currentPage;
    const surah = getSurahForPage(page);
    const range = calculateSmartAyahRange(page, surah);
    return { type: 'reading' as const, page, surah, startAyah: range.startAyah, endAyah: range.endAyah, label: 'ورد التلاوة اليومي' };
  };

  const handleOpenSmartHalqahNoteModal = (preferredType: 'memorization' | 'reading' = 'memorization') => {
    const targetType = (preferredType === 'memorization' && plan) ? 'memorization' : 'reading';
    const smart = getSmartWirdInfo(targetType);
    setNoteSurahId(smart.surah.id);
    setNoteStartAyah(smart.startAyah);
    setNoteEndAyah(smart.endAyah);
    setNoteWirdType(smart.type);
    setShowHalqahNoteModal(true);
  };

  const applyWirdPreset = (type: 'memorization' | 'reading') => {
    const smart = getSmartWirdInfo(type);
    setNoteSurahId(smart.surah.id);
    setNoteStartAyah(smart.startAyah);
    setNoteEndAyah(smart.endAyah);
    setNoteWirdType(type);
  };

  const handleNoteSurahChange = (id: number) => {
    setNoteSurahId(id);
    setNoteStartAyah(1);
    const meta = SURAHS.find((s) => s.id === id);
    setNoteEndAyah(meta ? Math.min(7, meta.versesCount) : 7);
  };

  // Plan Form State
  const [title, setTitle] = useState('خطة حفظ القرآن (من سورة الناس إلى سورة البقرة)');
  const [direction, setDirection] = useState<KhatmahDirection>('reverse');
  const [customStartPage, setCustomStartPage] = useState(604);
  const [goalType, setGoalType] = useState<KhatmahGoalType>('pages_per_day');
  const [pagesPerDay, setPagesPerDay] = useState(1);
  const [juzCount, setJuzCount] = useState(1);
  const [targetDays, setTargetDays] = useState(30);

  // Listen for background updates & cloud sync hydration
  useEffect(() => {
    const handleSync = () => {
      try {
        const savedPlan = localStorage.getItem(KHATMAH_STORAGE_KEY);
        if (savedPlan) setPlan(JSON.parse(savedPlan));

        const savedReading = localStorage.getItem(READING_WIRD_STORAGE_KEY);
        if (savedReading) setReadingWird(JSON.parse(savedReading));

        const savedNotes = localStorage.getItem(HALQAH_NOTES_STORAGE_KEY);
        if (savedNotes) setHalqahNotes(JSON.parse(savedNotes));
      } catch {}
    };

    window.addEventListener('quran_plan_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('quran_plan_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  useEffect(() => {
    if (!plan) return;
    const str = JSON.stringify(plan);
    if (localStorage.getItem(KHATMAH_STORAGE_KEY) !== str) {
      localStorage.setItem(KHATMAH_STORAGE_KEY, str);
      window.dispatchEvent(new Event('quran_plan_updated'));
    }
  }, [plan]);

  useEffect(() => {
    const str = JSON.stringify(readingWird);
    if (localStorage.getItem(READING_WIRD_STORAGE_KEY) !== str) {
      localStorage.setItem(READING_WIRD_STORAGE_KEY, str);
      window.dispatchEvent(new Event('quran_plan_updated'));
    }
  }, [readingWird]);

  useEffect(() => {
    const str = JSON.stringify(halqahNotes);
    if (localStorage.getItem(HALQAH_NOTES_STORAGE_KEY) !== str) {
      localStorage.setItem(HALQAH_NOTES_STORAGE_KEY, str);
      window.dispatchEvent(new Event('quran_plan_updated'));
    }
  }, [halqahNotes]);

  const handleDirectionChange = (newDir: KhatmahDirection) => {
    setDirection(newDir);
    if (newDir === 'reverse') {
      setTitle('خطة حفظ القرآن (من سورة الناس إلى سورة البقرة)');
    } else if (newDir === 'juz_amma') {
      setTitle('خطة حفظ جزء عمَّ (من سورة النبأ إلى الناس)');
    } else if (newDir === 'forward') {
      setTitle('خطة حفظ القرآن (من سورة الفاتحة إلى الناس)');
    } else if (newDir === 'custom') {
      setTitle(`خطة حفظ القرآن (من الصفحة ${customStartPage})`);
    }
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    let calculatedPages = pagesPerDay;
    if (goalType === 'juz_in_days') {
      const totalPages = juzCount * 20;
      calculatedPages = Math.max(1, Math.ceil(totalPages / Math.max(1, targetDays)));
    }

    let startP = 604;
    let endP = 1;

    if (direction === 'reverse') {
      startP = 604;
      endP = 1;
    } else if (direction === 'juz_amma') {
      startP = 582;
      endP = 604;
    } else if (direction === 'forward') {
      startP = 1;
      endP = 604;
    } else if (direction === 'custom') {
      startP = Math.min(604, Math.max(1, customStartPage));
      endP = 604;
    }

    const totalPagesToRead = Math.abs(endP - startP) + 1;
    const daysRequired = Math.ceil(totalPagesToRead / Math.max(1, calculatedPages));
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysRequired);

    const newPlan: KhatmahPlan = {
      id: Date.now().toString(),
      title: title.trim() || 'خطة حفظ القرآن',
      goalType,
      direction,
      pagesPerDay: calculatedPages,
      startPage: startP,
      endPage: endP,
      currentPage: startP,
      startDate: new Date().toISOString(),
      targetEndDate: targetDate.toISOString(),
      streakDays: 0,
    };

    setPlan(newPlan);
    setShowNewPlanModal(false);
  };

  const handleLogProgress = () => {
    if (!plan) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const isConsecutive = plan.lastCompletedDate
      ? (new Date(todayStr).getTime() - new Date(plan.lastCompletedDate).getTime()) / (1000 * 3600 * 24) <= 1
      : true;

    const nextStreak = isConsecutive ? (plan.streakDays || 0) + 1 : 1;
    const isReverse = plan.direction === 'reverse';

    let nextCurrentPage = plan.currentPage;
    if (isReverse) {
      nextCurrentPage = Math.max(plan.endPage, plan.currentPage - plan.pagesPerDay);
    } else {
      nextCurrentPage = Math.min(plan.endPage, plan.currentPage + plan.pagesPerDay);
    }

    const updated: KhatmahPlan = {
      ...plan,
      currentPage: nextCurrentPage,
      streakDays: nextStreak,
      lastCompletedDate: todayStr,
    };
    setPlan(updated);

    const surah = getSurahForPage(nextCurrentPage);

    if (onUpdateHabitDescription && linkedHabits.length > 0) {
      const targetHabit = linkedHabits.find((h) =>
        /quran|memoriz|حفظ|مراجعة|تلاوة|قران|قرآن|قراٰن|ورد|تحفيظ|صفحة|صفحه|صفحات/i.test(h.title)
      );
      if (targetHabit) {
        onUpdateHabitDescription(
          targetHabit.id,
          `الورد القادم للحفظ: الصفحة ${nextCurrentPage} (سورة ${surah.name})`
        );
      }
    }
  };

  const handleLogReadingWird = () => {
    const readingHabit = linkedHabits.find(
      (h) => /ورد|تلاوة|قراءة|reading|tilawah/i.test(h.title) && !/حفظ|memoriz|تحفيظ|تسميع/i.test(h.title)
    );

    // If a linked reading habit exists, completing it (via useLogHabit → the
    // wird-advance helper) is what updates progress AND advances the reading
    // wird — so avoid advancing manually here to prevent double-advancing.
    if (readingHabit && !readingHabit.is_completed_today && onToggleHabit) {
      onToggleHabit(readingHabit.id, true);
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isConsecutive = readingWird.lastReadDate
      ? (new Date(todayStr).getTime() - new Date(readingWird.lastReadDate).getTime()) / (1000 * 3600 * 24) <= 1
      : true;

    const nextStreak = isConsecutive ? readingWird.streakDays + 1 : 1;
    const nextPage = Math.min(604, readingWird.currentPage + readingWird.pagesPerDay);

    setReadingWird({
      ...readingWird,
      currentPage: nextPage === 604 ? 1 : nextPage,
      streakDays: nextStreak,
      lastReadDate: todayStr,
    });
  };

  const handleAddHalqahNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteMistakes.trim()) return;

    const newNote: SheikhHalqahNote = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      surahName: `سورة ${selectedNoteSurahMeta.name}`,
      ayahRange: `من الآية ${noteStartAyah} إلى ${noteEndAyah}`,
      mistakesNote: noteMistakes.trim(),
      rating: noteRating,
      wirdType: noteWirdType,
      pageNumber: selectedNoteSurahMeta.pageStart,
    };

    setHalqahNotes([newNote, ...halqahNotes]);

    if (onCreateHalqahNote) {
      onCreateHalqahNote(newNote);
    }

    setNoteMistakes('');
    setShowHalqahNoteModal(false);
  };

  const handleDeleteHalqahNote = (id: string) => {
    setHalqahNotes(halqahNotes.filter((n) => n.id !== id));
  };

  const quranHabits = linkedHabits.filter((h) =>
    /quran|memoriz|حفظ|مراجعة|تلاوة|قران|قرآن|قراٰن|ورد|تحفيظ|صفحة|صفحه|صفحات/i.test(h.title)
  );

  // The reading streak is driven by the linked reading habit (e.g. الورد اليومي)
  // as the source of truth, falling back to the wird's own counter when no
  // reading habit is linked.
  const readingHabitStreak =
    linkedHabits.find((h) => /ورد|تلاوة|قراءة|reading|tilawah/i.test(h.title) && !/حفظ|memoriz|تحفيظ|تسميع/i.test(h.title))?.streakDays ??
    readingWird.streakDays;

  const sheikhEvents = linkedEvents.filter((e) =>
    /sheikh|حفظ|قران|قرآن|تسميع|تحفيظ|تثبيت|شيخ|tahfez|quran/i.test(e.title)
  );

  // Reverse if stored direction says so, OR if the page order descends (end < start).
  const isReverse = plan ? (plan.direction === 'reverse' || plan.endPage < plan.startPage) : true;

  const currentSurah = getSurahForPage(plan ? plan.currentPage : 604);
  const nextTargetPage = plan
    ? isReverse
      ? Math.max(plan.endPage, plan.currentPage - plan.pagesPerDay)
      : Math.min(plan.endPage, plan.currentPage + plan.pagesPerDay)
    : 603;
  const nextSurah = getSurahForPage(nextTargetPage);

  const currentReadingSurah = getSurahForPage(readingWird.currentPage);

  return (
    <div dir="rtl" className="space-y-6 font-arabic-body text-right">

      {/* DUAL WIRDS DISPLAY: ورد الحفظ + ورد التلاوة والقراءة */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* 1. Memorization Wird (ورد الحفظ والتكرار) */}
        <div className="p-6 rounded-3xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-xl space-y-3 shadow-lg active:scale-[0.99] transition-all">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-2 font-arabic-title">
              <Target className="size-4 text-emerald-400 shrink-0" />
              <span>ورد الحفظ الجديد والتكرار</span>
            </h3>
            {plan && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {plan.pagesPerDay} صفحة / يومياً
              </span>
            )}
          </div>

          {!plan ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground">لم تقم بإنشاء خطة حفظ بعد.</p>
              <button
                onClick={() => setShowNewPlanModal(true)}
                className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                + إنشاء خطة حفظ جديدة
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Quick Jump / Change Current Memorization Surah/Page */}
              <div className="p-2.5 rounded-2xl bg-background/50 border border-border/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-bold">موضعك الحالي في الحفظ:</span>
                  <span className="font-extrabold text-emerald-400">صفحة {plan.currentPage} (سورة {currentSurah.name})</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">تغيير السورة:</label>
                    <select
                      value={currentSurah.id}
                      onChange={(e) => {
                        const surahId = Number(e.target.value);
                        const meta = SURAHS.find((s) => s.id === surahId);
                        if (meta) {
                          const updated = { ...plan, currentPage: meta.pageStart };
                          setPlan(updated);
                          localStorage.setItem(KHATMAH_STORAGE_KEY, JSON.stringify(updated));
                          localStorage.setItem('quran_memorization_marker_v1', JSON.stringify({ surahNumber: meta.id, ayahNumber: 1, page: meta.pageStart }));
                          localStorage.setItem('quran_active_page_v1', meta.pageStart.toString());
                          window.dispatchEvent(new Event('quran_plan_updated'));
                          window.dispatchEvent(new Event('quran_active_page_updated'));
                        }
                      }}
                      className="w-full h-10 bg-secondary/80 text-foreground font-bold text-xs rounded-xl px-2 border border-border focus:outline-none"
                    >
                      {SURAHS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.id}. سورة {s.name} (ص {s.pageStart})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">رقم الصفحة (1-604):</label>
                    <input
                      type="number"
                      min={1}
                      max={604}
                      value={plan.currentPage}
                      onChange={(e) => {
                        const p = Math.min(604, Math.max(1, Number(e.target.value)));
                        const meta = getSurahForPage(p);
                        const updated = { ...plan, currentPage: p };
                        setPlan(updated);
                        localStorage.setItem(KHATMAH_STORAGE_KEY, JSON.stringify(updated));
                        localStorage.setItem('quran_memorization_marker_v1', JSON.stringify({ surahNumber: meta.id, ayahNumber: 1, page: p }));
                        localStorage.setItem('quran_active_page_v1', p.toString());
                        window.dispatchEvent(new Event('quran_plan_updated'));
                        window.dispatchEvent(new Event('quran_active_page_updated'));
                      }}
                      className="w-full h-10 bg-secondary/80 text-foreground font-bold text-xs rounded-xl px-2 border border-border text-center focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground font-semibold">الورد القادم:</span>
                <span className="font-bold text-emerald-400">صفحة {nextTargetPage} (سورة {nextSurah.name})</span>
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                    <Flame className="size-3.5 fill-current" /> سلسلة {plan.streakDays} أيام
                  </span>
                  <button
                    onClick={handleLogProgress}
                    className="px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="size-3.5" /> تسجيل إنجاز الحفظ (+{plan.pagesPerDay} ص)
                  </button>
                </div>
                
                {onOpenReader && (
                  <button
                    onClick={() => onOpenReader(plan.currentPage, currentSurah.id)}
                    className="w-full py-2 px-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                  >
                    <BookOpen className="size-3.5 text-emerald-400" />
                    <span>فتح ورد الحفظ في المصحف (ص {plan.currentPage})</span>
                  </button>
                )}

                <button
                  onClick={() => handleOpenSmartHalqahNoteModal('memorization')}
                  className="w-full py-2 px-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                >
                  <FileText className="size-3.5 text-emerald-400" />
                  <span>تدوين ملاحظة تسميع لورد الحفظ اليومي</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Reading & Tilawah Wird (ورد التلاوة والقراءة اليومية) */}
        <div className="p-6 rounded-3xl border border-indigo-500/30 bg-indigo-950/20 backdrop-blur-xl space-y-3 shadow-lg active:scale-[0.99] transition-all">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-indigo-400 flex items-center gap-2 font-arabic-title">
              <BookOpen className="size-4 text-indigo-400 shrink-0" />
              <span>ورد التلاوة والقراءة اليومية</span>
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {readingWird.pagesPerDay} صفحة يومياً
            </span>
          </div>

          <div className="space-y-3">
            {/* Quick Jump / Change Current Reading Surah/Page */}
            <div className="p-2.5 rounded-2xl bg-background/50 border border-border/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-bold">موضعك الحالي في التلاوة:</span>
                <span className="font-extrabold text-indigo-400">صفحة {readingWird.currentPage} (سورة {currentReadingSurah.name})</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">تغيير السورة:</label>
                  <select
                    value={currentReadingSurah.id}
                    onChange={(e) => {
                      const surahId = Number(e.target.value);
                      const meta = SURAHS.find((s) => s.id === surahId);
                      if (meta) {
                        const updated = { ...readingWird, currentPage: meta.pageStart };
                        setReadingWird(updated);
                        localStorage.setItem(READING_WIRD_STORAGE_KEY, JSON.stringify(updated));
                        localStorage.setItem('quran_reading_marker_v1', JSON.stringify({ surahNumber: meta.id, ayahNumber: 1, page: meta.pageStart }));
                        localStorage.setItem('quran_active_page_v1', meta.pageStart.toString());
                        window.dispatchEvent(new Event('quran_plan_updated'));
                        window.dispatchEvent(new Event('quran_active_page_updated'));
                      }
                    }}
                    className="w-full h-10 bg-secondary/80 text-foreground font-bold text-xs rounded-xl px-2 border border-border focus:outline-none"
                  >
                    {SURAHS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id}. سورة {s.name} (ص {s.pageStart})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">رقم الصفحة (1-604):</label>
                  <input
                    type="number"
                    min={1}
                    max={604}
                    value={readingWird.currentPage}
                    onChange={(e) => {
                      const p = Math.min(604, Math.max(1, Number(e.target.value)));
                      const meta = getSurahForPage(p);
                      const updated = { ...readingWird, currentPage: p };
                      setReadingWird(updated);
                      localStorage.setItem(READING_WIRD_STORAGE_KEY, JSON.stringify(updated));
                      localStorage.setItem('quran_reading_marker_v1', JSON.stringify({ surahNumber: meta.id, ayahNumber: 1, page: p }));
                      localStorage.setItem('quran_active_page_v1', p.toString());
                      window.dispatchEvent(new Event('quran_plan_updated'));
                      window.dispatchEvent(new Event('quran_active_page_updated'));
                    }}
                    className="w-full h-10 bg-secondary/80 text-foreground font-bold text-xs rounded-xl px-2 border border-border text-center focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-muted-foreground font-semibold">الهدف اليومي للتلاوة:</span>
              <span className="font-bold text-indigo-400">صفحة {Math.min(604, readingWird.currentPage + readingWird.pagesPerDay)}</span>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                  <Flame className="size-3.5 fill-current" /> سلسلة {readingHabitStreak} أيام قراءة
                </span>
                <button
                  onClick={handleLogReadingWird}
                  className="px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Bookmark className="size-3.5" /> تسجيل إنجاز التلاوة (+{readingWird.pagesPerDay} صفحة)
                </button>
              </div>

              {onOpenReader && (
                <button
                  onClick={() => onOpenReader(readingWird.currentPage, currentReadingSurah.id)}
                  className="w-full py-2 px-3 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold text-xs border border-indigo-500/40 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                >
                  <BookOpen className="size-3.5 text-indigo-400" />
                  <span>فتح ورد التلاوة في المصحف (ص {readingWird.currentPage})</span>
                </button>
              )}

              <button
                onClick={() => handleOpenSmartHalqahNoteModal('reading')}
                className="w-full py-2 px-3 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <FileText className="size-3.5 text-indigo-400" />
                <span>تدوين ملاحظة على ورد التلاوة اليومي</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* lifeOS Connected Habits & Sheikh Halqah Recitation Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Connected Habits Card */}
        <div className="p-6 rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2 font-arabic-title">
              <Sparkles className="size-4 text-amber-400 shrink-0" />
              <span>العادات القرآنية (lifeOS Habits) ({quranHabits.length})</span>
            </h3>
          </div>

          {quranHabits.length === 0 ? (
            <div className="p-4 border border-dashed border-border rounded-2xl text-center text-xs text-muted-foreground">
              لا توجد عادات قرآنية في lifeOS Habits (مثل: حفظ صفحة، ورد القرآن).
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto overscroll-contain pl-1">
              {quranHabits.map((habit) => (
                <div
                  key={habit.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    habit.is_completed_today
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-border/60 bg-secondary/30'
                  }`}
                >
                  <div
                    onClick={() => {
                      const nextState = !habit.is_completed_today;
                      // Completion is persisted via useLogHabit, which also advances
                      // the linked Quran wird (الورد اليومي → reading, حفظ صفحه → memorization).
                      if (onToggleHabit) onToggleHabit(habit.id, nextState);
                      if (nextState && onUpdateHabitDescription && /حفظ|memoriz|تحفيظ/i.test(habit.title)) {
                        const surah = getSurahForPage(nextTargetPage);
                        onUpdateHabitDescription(
                          habit.id,
                          `الورد القادم للحفظ: الصفحة ${nextTargetPage} (سورة ${surah.name})`
                        );
                      }
                    }}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {habit.is_completed_today ? (
                        <CheckCircle2 className="size-4 text-amber-500 shrink-0" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={`text-xs font-bold ${habit.is_completed_today ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {habit.title}
                      </span>
                    </div>

                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      {habit.is_completed_today ? 'تم اليوم' : 'غير مكتمل'}
                    </span>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border/30 flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-muted-foreground font-semibold truncate max-w-[200px]">
                      {habit.description || 'لا يوجد وصف حالياً'}
                    </span>
                    <button
                      onClick={() => {
                        if (onUpdateHabitDescription) {
                          const nextP = nextTargetPage;
                          const surah = getSurahForPage(nextP);
                          const desc = `الورد القادم للحفظ: الصفحة ${nextP} (سورة ${surah.name})`;
                          onUpdateHabitDescription(habit.id, desc);
                          alert(`تم تحديث تفاصيل العادة إلى:\n"${desc}"`);
                        }
                      }}
                      className="px-2.5 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-bold border border-emerald-500/30 transition-all cursor-pointer shrink-0 active:scale-95"
                      title="مزامنة الورد القادم مع تفاصيل العادة في lifeOS"
                    >
                      مزامنة الورد القادم
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sheikh Recitation Sessions & Notes for Mistakes */}
        <div className="p-4 md:p-6 rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl space-y-3 shadow-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <UserCheck className="size-4" />
              </div>
              <h3 className="text-xs md:text-sm font-bold text-foreground font-arabic-title truncate">
                جلسات وملاحظات التسميع
              </h3>
            </div>
            <button
              onClick={() => handleOpenSmartHalqahNoteModal('memorization')}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              <Plus className="size-3.5" />
              <span>إضافة ملاحظة</span>
            </button>
          </div>

          {/* Calendar Events List */}
          {sheikhEvents.length > 0 && (
            <div className="space-y-1.5 mb-3">
              <span className="text-[11px] font-bold text-muted-foreground block">الحلقات المجدولة في التقويم:</span>
              {sheikhEvents.map((evt) => (
                <div key={evt.id} className="p-2.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">{evt.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(evt.start_time).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Mistakes & Notes History List */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-muted-foreground block">سجل ملاحظات وأخطاء التسميع ({halqahNotes.length}):</span>
            
            {halqahNotes.length === 0 ? (
              <div className="p-4 border border-dashed border-border rounded-2xl text-center text-xs text-muted-foreground">
                لا توجد ملاحظات أخطاء مسجلة بعد. اضغط على "+ إضافة ملاحظات حلقة" لتدوين الأخطاء والمتشابهات بعد كل جلسة مع الشيخ.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto overscroll-contain pl-1">
                {halqahNotes.map((note) => (
                  <div key={note.id} className="p-3.5 rounded-2xl border border-border/60 bg-secondary/20 space-y-1.5 relative">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{note.surahName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">({note.ayahRange})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          note.rating === 'mumtaz'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : note.rating === 'jayyid_jiddan'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : note.rating === 'jayyid'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {note.rating === 'mumtaz' ? 'ممتاز' : note.rating === 'jayyid_jiddan' ? 'جيد جداً' : note.rating === 'jayyid' ? 'جيد' : 'يحتاج تثبيت'}
                        </span>

                        <button
                          onClick={() => handleDeleteHalqahNote(note.id)}
                          className="text-muted-foreground hover:text-rose-500 p-1 transition-colors"
                          title="حذف الملاحظة"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-foreground bg-background/60 p-2.5 rounded-xl border border-border/40 leading-relaxed font-semibold">
                      {note.mistakesNote}
                    </p>

                    <span className="text-[9px] text-muted-foreground block text-left font-mono">
                      {new Date(note.date).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* iOS Native Bottom Sheet Modal for New Plan */}
      {showNewPlanModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowNewPlanModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-[2.5rem] sm:rounded-3xl border border-border/60 bg-card/95 backdrop-blur-2xl p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[85vh] sm:max-h-[90vh] overscroll-contain pb-safe animate-in slide-in-from-bottom-5 duration-200"
            >
              {/* iOS Sheet Drag Handle Pill */}
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-1" />

              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 font-arabic-title">
                  <Target className="size-5 text-emerald-500 shrink-0" />
                  <span>إنشاء خطة خاتمة مخصصة</span>
                </h3>

                <button
                  onClick={() => setShowNewPlanModal(false)}
                  className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleCreatePlan} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">نقطة البداية واتجاه الحفظ</label>
                  <select
                    value={direction}
                    onChange={(e) => handleDirectionChange(e.target.value as KhatmahDirection)}
                    className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="reverse">من سورة الناس إلى سورة البقرة (الصفحة 604 ← 1 عكسياً)</option>
                    <option value="juz_amma">من جزء عمَّ (سورة النبأ ← الناس - الصفحة 582)</option>
                    <option value="forward">من سورة الفاتحة إلى سورة الناس (الصفحة 1 → 604)</option>
                    <option value="custom">تحديد صفحة بداية مخصصة</option>
                  </select>
                </div>

                {direction === 'custom' && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">صفحة البداية المخصصة (1-604)</label>
                    <input
                      type="number"
                      min={1}
                      max={604}
                      value={customStartPage}
                      onChange={(e) => setCustomStartPage(Math.min(604, Math.max(1, Number(e.target.value))))}
                      className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-muted-foreground">اسم الخاتمة</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground">استراتيجية الإنجاز</label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value as KhatmahGoalType)}
                    className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                  >
                    <option value="pages_per_day">عدد صفحات ثابت يومياً (مثال: صفحة واحدة)</option>
                    <option value="juz_in_days">إنهاء عدد أجزاء في أيام محددة</option>
                  </select>
                </div>

                {goalType === 'pages_per_day' ? (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">الصفحات يومياً</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={pagesPerDay}
                      onChange={(e) => setPagesPerDay(Number(e.target.value))}
                      className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground">عدد الأجزاء</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={juzCount}
                        onChange={(e) => setJuzCount(Number(e.target.value))}
                        className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground">خلال كم يوم؟</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={targetDays}
                        onChange={(e) => setTargetDays(Number(e.target.value))}
                        className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowNewPlanModal(false)}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold text-muted-foreground hover:bg-secondary active:scale-95 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md active:scale-95 transition-all"
                  >
                    بدء الخاتمة
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* iOS Native Bottom Sheet Modal for Sheikh Halqah Note */}
      {showHalqahNoteModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowHalqahNoteModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-[2.5rem] sm:rounded-3xl border border-border/60 bg-card/95 backdrop-blur-2xl p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[85vh] sm:max-h-[90vh] overscroll-contain pb-safe animate-in slide-in-from-bottom-5 duration-200"
            >
              {/* iOS Sheet Drag Handle Pill */}
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-1" />

              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 font-arabic-title">
                  <FileText className="size-5 text-indigo-400 shrink-0" />
                  <span>تدوين ملاحظات وأخطاء حلقة التسميع</span>
                </h3>

                <button
                  onClick={() => setShowHalqahNoteModal(false)}
                  className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleAddHalqahNote} className="space-y-3.5">
                {/* Smart Wird Presets Quick Select */}
                <div className="space-y-2 pb-1">
                  <label className="text-xs font-bold text-muted-foreground block">
                    تعبئة تلقائية سريعة من ورد اليوم:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {plan && (
                      <button
                        type="button"
                        onClick={() => applyWirdPreset('memorization')}
                        className={`p-2.5 rounded-2xl border text-right transition-all cursor-pointer ${
                          noteWirdType === 'memorization'
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm'
                            : 'bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span>ورد الحفظ اليومي</span>
                          <span className="text-[10px] opacity-75">صفحة {getSmartWirdInfo('memorization').page}</span>
                        </div>
                        <div className="text-xs font-bold mt-0.5 text-foreground">
                          سورة {getSmartWirdInfo('memorization').surah.name} (الآيات {getSmartWirdInfo('memorization').startAyah}-{getSmartWirdInfo('memorization').endAyah})
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => applyWirdPreset('reading')}
                      className={`p-2.5 rounded-2xl border text-right transition-all cursor-pointer ${
                        noteWirdType === 'reading'
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-300 shadow-sm'
                          : 'bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span>ورد التلاوة اليومي</span>
                        <span className="text-[10px] opacity-75">صفحة {getSmartWirdInfo('reading').page}</span>
                      </div>
                      <div className="text-xs font-bold mt-0.5 text-foreground">
                        سورة {getSmartWirdInfo('reading').surah.name} (الآيات {getSmartWirdInfo('reading').startAyah}-{getSmartWirdInfo('reading').endAyah})
                      </div>
                    </button>
                  </div>
                </div>

                <div className="px-3 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-indigo-400 shrink-0" />
                  <span>
                    محدَّد تلقائياً لـ {noteWirdType === 'memorization' ? 'ورد الحفظ' : 'ورد التلاوة'}: سورة {selectedNoteSurahMeta.name} (الآيات {noteStartAyah} إلى {noteEndAyah})
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground">اسم السورة</label>
                  <select
                    value={noteSurahId}
                    onChange={(e) => handleNoteSurahChange(Number(e.target.value))}
                    className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                  >
                    {SURAHS.map((s) => (
                      <option key={s.id} value={s.id}>
                        سورة {s.name} ({s.transliteration})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">من الآية</label>
                    <select
                      value={noteStartAyah}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setNoteStartAyah(val);
                        if (val > noteEndAyah) setNoteEndAyah(val);
                      }}
                      className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                    >
                      {Array.from({ length: selectedNoteSurahMeta.versesCount }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>
                          الآية {num}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-muted-foreground">إلى الآية</label>
                    <select
                      value={noteEndAyah}
                      onChange={(e) => setNoteEndAyah(Number(e.target.value))}
                      className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                    >
                      {Array.from(
                        { length: selectedNoteSurahMeta.versesCount - noteStartAyah + 1 },
                        (_, i) => noteStartAyah + i
                      ).map((num) => (
                        <option key={num} value={num}>
                          الآية {num}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground">تقييم الجلسة مع الشيخ</label>
                  <select
                    value={noteRating}
                    onChange={(e) => setNoteRating(e.target.value as any)}
                    className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                  >
                    <option value="mumtaz">ممتاز (بدون أخطاء)</option>
                    <option value="jayyid_jiddan">جيد جداً (أخطاء بسيطة جداً)</option>
                    <option value="jayyid">جيد (أخطاء متوسطة)</option>
                    <option value="yahatadj_tathbeet">يحتاج تثبيت ومراجعة مكثفة</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground">تدوين الأخطاء والملاحظات</label>
                  <textarea
                    value={noteMistakes}
                    onChange={(e) => setNoteMistakes(e.target.value)}
                    placeholder="اكتب ملاحظات الشيخ وأخطاء التشكيل والمتشابهات هنا..."
                    rows={3}
                    className="w-full mt-1 rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowHalqahNoteModal(false)}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold text-muted-foreground hover:bg-secondary active:scale-95 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md active:scale-95 transition-all"
                  >
                    حفظ الملاحظة
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
