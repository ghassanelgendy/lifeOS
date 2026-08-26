import React, { useState, useEffect } from 'react';
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
  Star,
  AlertTriangle,
  Bookmark,
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

export const KhatmahPlannerView: React.FC<KhatmahPlannerViewProps> = ({
  linkedTasks = [],
  linkedHabits = [],
  linkedEvents = [],
  onToggleTask,
  onToggleHabit,
  onUpdateHabitDescription,
  onCreateTask,
  onCreateHalqahNote,
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

  // New Halqah Note Form State
  const [noteSurahName, setNoteSurahName] = useState('سورة البقرة');
  const [noteAyahRange, setNoteAyahRange] = useState('170 - 185');
  const [noteMistakes, setNoteMistakes] = useState('');
  const [noteRating, setNoteRating] = useState<'mumtaz' | 'jayyid_jiddan' | 'jayyid' | 'yahatadj_tathbeet'>('jayyid_jiddan');

  // Plan Form State
  const [title, setTitle] = useState('خطة حفظ القرآن (من سورة الناس إلى سورة البقرة)');
  const [direction, setDirection] = useState<KhatmahDirection>('reverse');
  const [customStartPage, setCustomStartPage] = useState(604);
  const [goalType, setGoalType] = useState<KhatmahGoalType>('pages_per_day');
  const [pagesPerDay, setPagesPerDay] = useState(1);
  const [juzCount, setJuzCount] = useState(1);
  const [targetDays, setTargetDays] = useState(30);

  useEffect(() => {
    if (plan) {
      localStorage.setItem(KHATMAH_STORAGE_KEY, JSON.stringify(plan));
    } else {
      localStorage.removeItem(KHATMAH_STORAGE_KEY);
    }
  }, [plan]);

  useEffect(() => {
    localStorage.setItem(READING_WIRD_STORAGE_KEY, JSON.stringify(readingWird));
  }, [readingWird]);

  useEffect(() => {
    localStorage.setItem(HALQAH_NOTES_STORAGE_KEY, JSON.stringify(halqahNotes));
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

    if (onCreateTask) {
      onCreateTask(
        `حفظ القرآن - الصفحة ${nextCurrentPage} (سورة ${surah.name})`,
        todayStr
      );
    }

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
      surahName: noteSurahName,
      ayahRange: noteAyahRange,
      mistakesNote: noteMistakes.trim(),
      rating: noteRating,
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

  const handleDeletePlan = () => {
    if (confirm('هل أنت تأكد من رغبتك في حذف خطة الخاتمة الحالية؟')) {
      setPlan(null);
    }
  };

  const quranHabits = linkedHabits.filter((h) =>
    /quran|memoriz|حفظ|مراجعة|تلاوة|قران|قرآن|قراٰن|ورد|تحفيظ|صفحة|صفحه|صفحات/i.test(h.title)
  );

  const sheikhEvents = linkedEvents.filter((e) =>
    /sheikh|حفظ|قران|قرآن|تسميع|تحفيظ|تثبيت|شيخ|tahfez|quran/i.test(e.title)
  );

  const totalPages = plan ? Math.abs(plan.endPage - plan.startPage) + 1 : 604;
  const pagesCompleted = plan ? Math.abs(plan.currentPage - plan.startPage) : 0;
  const progressPercent = Math.min(100, Math.round((pagesCompleted / totalPages) * 100));

  const currentSurah = getSurahForPage(plan ? plan.currentPage : 604);
  const isReverse = plan ? plan.direction === 'reverse' : true;
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
        <div className="p-5 rounded-3xl border border-emerald-500/30 bg-emerald-950/20 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-2 font-arabic-title">
              <Target className="size-4 text-emerald-400 shrink-0" />
              <span>🎯 ورد الحفظ الجديد والتكرار</span>
            </h3>
            {plan && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {plan.pagesPerDay} صفحة / يومياً
              </span>
            )}
          </div>

          {!plan ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground">لم تقم بإنشاء خطة حفظ بعد.</p>
              <button
                onClick={() => setShowNewPlanModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                + إنشاء خطة حفظ جديدة
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-semibold">الموقع الحالي:</span>
                <span className="font-bold text-foreground">صفحة {plan.currentPage} (سورة {currentSurah.name})</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-semibold">الورد القادم:</span>
                <span className="font-bold text-emerald-400">صفحة {nextTargetPage} (سورة {nextSurah.name})</span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                  <Flame className="size-3.5 fill-current" /> سلسلة {plan.streakDays} أيام
                </span>
                <button
                  onClick={handleLogProgress}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" /> تسجيل إنجاز الحفظ
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Reading & Tilawah Wird (ورد التلاوة والقراءة اليومية) */}
        <div className="p-5 rounded-3xl border border-indigo-500/30 bg-indigo-950/20 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-indigo-400 flex items-center gap-2 font-arabic-title">
              <BookOpen className="size-4 text-indigo-400 shrink-0" />
              <span>📖 ورد التلاوة والقراءة اليومية</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {readingWird.pagesPerDay} صفحة يومياً
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold">وصلت الآن في التلاوة إلى:</span>
              <span className="font-bold text-foreground">صفحة {readingWird.currentPage} (سورة {currentReadingSurah.name})</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold">الهدف اليومي للتلاوة:</span>
              <span className="font-bold text-indigo-400">صفحة {Math.min(604, readingWird.currentPage + readingWird.pagesPerDay)}</span>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                <Flame className="size-3.5 fill-current" /> سلسلة {readingWird.streakDays} أيام قراءة
              </span>
              <button
                onClick={handleLogReadingWird}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Bookmark className="size-3.5" /> تسجيل إنجاز التلاوة (+{readingWird.pagesPerDay} صفحة)
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Main Plan Overview Banner */}
      {plan && (
        <div className="p-6 rounded-3xl border border-border bg-card shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{plan.title}</h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {plan.direction === 'reverse' ? 'من الناس إلى البقرة' : 'خطة نشطة'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                معدل الإنجاز: <span className="font-bold text-foreground">{plan.pagesPerDay} صفحة / يومياً</span> • الانتهاء المتوقع:{' '}
                <span className="font-semibold text-emerald-400">
                  {new Date(plan.targetEndDate).toLocaleDateString('ar-EG')}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewPlanModal(true)}
                className="px-3 py-1.5 rounded-xl bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                تغيير الخطة
              </button>
              <button
                onClick={handleDeletePlan}
                className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="حذف الخاتمة"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground">نسبة التقدم الكلي في خطة الحفظ</span>
              <span className="text-emerald-400">{progressPercent}% ({pagesCompleted} من {totalPages} صفحة)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-secondary overflow-hidden border border-border/40 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* lifeOS Connected Habits & Sheikh Halqah Recitation Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Connected Habits Card */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2 font-arabic-title">
              <Sparkles className="size-4 text-amber-400 shrink-0" />
              <span>العادات القرآنية (lifeOS Habits) ({quranHabits.length})</span>
            </h3>
          </div>

          {quranHabits.length === 0 ? (
            <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
              لا توجد عادات قرآنية في lifeOS Habits (مثل: حفظ صفحة، ورد القرآن).
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
              {quranHabits.map((habit) => (
                <div
                  key={habit.id}
                  className={`p-3 rounded-xl border transition-all ${
                    habit.is_completed_today
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-border/60 bg-secondary/30'
                  }`}
                >
                  <div
                    onClick={() => {
                      const nextState = !habit.is_completed_today;
                      if (onToggleHabit) onToggleHabit(habit.id, nextState);
                      if (nextState) {
                        if (/حفظ|memoriz|تحفيظ/i.test(habit.title)) {
                          handleLogProgress();
                        } else if (/ورد|تلاوة|قراءة|reading|tilawah/i.test(habit.title)) {
                          handleLogReadingWird();
                        }
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

                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
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
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-bold border border-emerald-500/30 transition-all cursor-pointer shrink-0"
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
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2 font-arabic-title">
              <UserCheck className="size-4 text-indigo-400 shrink-0" />
              <span>جلسات التسميع وملاحظات الأخطاء مع الشيخ</span>
            </h3>
            <button
              onClick={() => setShowHalqahNoteModal(true)}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow-sm cursor-pointer flex items-center gap-1"
            >
              <Plus className="size-3" /> إضافة ملاحظات حلقة
            </button>
          </div>

          {/* Calendar Events List */}
          {sheikhEvents.length > 0 && (
            <div className="space-y-1.5 mb-3">
              <span className="text-[11px] font-bold text-muted-foreground block">الحلقات المجدولة في التقويم:</span>
              {sheikhEvents.map((evt) => (
                <div key={evt.id} className="p-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between text-xs">
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
              <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
                لا توجد ملاحظات أخطاء مسجلة بعد. اضغط على "+ إضافة ملاحظات حلقة" لتدوين الأخطاء والمتشابهات بعد كل جلسة مع الشيخ.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pl-1">
                {halqahNotes.map((note) => (
                  <div key={note.id} className="p-3 rounded-xl border border-border/60 bg-secondary/20 space-y-1.5 relative">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{note.surahName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">({note.ayahRange})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          note.rating === 'mumtaz'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : note.rating === 'jayyid_jiddan'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : note.rating === 'jayyid'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {note.rating === 'mumtaz' ? '🌟 ممتاز' : note.rating === 'jayyid_jiddan' ? '✨ جيد جداً' : note.rating === 'jayyid' ? '🟢 جيد' : '⚠️ يحتاج تثبيت'}
                        </span>

                        <button
                          onClick={() => handleDeleteHalqahNote(note.id)}
                          className="text-muted-foreground hover:text-rose-500 p-1"
                          title="حذف الملاحظة"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-foreground bg-background/60 p-2 rounded-lg border border-border/40 leading-relaxed font-semibold">
                      📝 {note.mistakesNote}
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

      {/* New Plan Modal */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 space-y-4 shadow-2xl overflow-hidden isolate">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 font-arabic-title">
              <Target className="size-5 text-emerald-500 shrink-0" />
              <span>إنشاء خطة خاتمة مخصصة</span>
            </h3>

            <form onSubmit={handleCreatePlan} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground">نقطة البداية واتجاه الحفظ</label>
                <select
                  value={direction}
                  onChange={(e) => handleDirectionChange(e.target.value as KhatmahDirection)}
                  className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-muted-foreground">اسم الخاتمة</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">استراتيجية الإنجاز</label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value as KhatmahGoalType)}
                  className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
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
                    className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
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
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
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
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlanModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md"
                >
                  بدء الخاتمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Sheikh Halqah Note Modal */}
      {showHalqahNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 space-y-4 shadow-2xl overflow-hidden isolate">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 font-arabic-title">
              <FileText className="size-5 text-indigo-400 shrink-0" />
              <span>تدوين ملاحظات وأخطاء حلقة التسميع</span>
            </h3>

            <form onSubmit={handleAddHalqahNote} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground">اسم السورة</label>
                <select
                  value={noteSurahName}
                  onChange={(e) => setNoteSurahName(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
                >
                  {SURAHS.map((s) => (
                    <option key={s.id} value={`سورة ${s.name}`}>
                      سورة {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">نطاق الآيات</label>
                <input
                  type="text"
                  value={noteAyahRange}
                  onChange={(e) => setNoteAyahRange(e.target.value)}
                  placeholder="مثال: من 170 إلى 190"
                  className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">تقييم الجلسة مع الشيخ</label>
                <select
                  value={noteRating}
                  onChange={(e) => setNoteRating(e.target.value as any)}
                  className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
                >
                  <option value="mumtaz">🌟 ممتاز (بدون أخطاء)</option>
                  <option value="jayyid_jiddan">✨ جيد جداً (أخطاء بسيطة جداً)</option>
                  <option value="jayyid">🟢 جيد (أخطاء متوسطة)</option>
                  <option value="yahatadj_tathbeet">⚠️ يحتاج تثبيت ومراجعة مكثفة</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">تدوين الأخطاء والملاحظات</label>
                <textarea
                  value={noteMistakes}
                  onChange={(e) => setNoteMistakes(e.target.value)}
                  placeholder="اكتب ملاحظات الشيخ وأخطاء التشكيل والمتشابهات هنا..."
                  rows={3}
                  className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHalqahNoteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md"
                >
                  حفظ الملاحظة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
