import React, { useState, useEffect } from 'react';
import { Target, Flame, Calendar, Sparkles, CheckCircle2, Circle, Plus, Trash2, BookOpen, Clock, UserCheck } from 'lucide-react';
import { KhatmahPlan, KhatmahGoalType, LinkedLifeOSTask, LinkedLifeOSEvent } from '../types/quran';

const KHATMAH_STORAGE_KEY = 'quran_khatmah_plan_v1';

interface KhatmahPlannerViewProps {
  linkedTasks?: LinkedLifeOSTask[];
  linkedHabits?: LinkedLifeOSHabit[];
  linkedEvents?: LinkedLifeOSEvent[];
  onToggleTask?: (taskId: string) => void;
  onToggleHabit?: (habitId: string, isCompleted: boolean) => void;
  onCreateTask?: (title: string, dueDate: string) => void;
}

export const KhatmahPlannerView: React.FC<KhatmahPlannerViewProps> = ({
  linkedTasks = [],
  linkedHabits = [],
  linkedEvents = [],
  onToggleTask,
  onToggleHabit,
  onCreateTask,
}) => {
  const [plan, setPlan] = useState<KhatmahPlan | null>(() => {
    try {
      const saved = localStorage.getItem(KHATMAH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showNewPlanModal, setShowNewPlanModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('خطة حفظ القرآن الكريم');
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

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    let calculatedPages = pagesPerDay;
    if (goalType === 'juz_in_days') {
      const totalPages = juzCount * 20;
      calculatedPages = Math.max(1, Math.ceil(totalPages / Math.max(1, targetDays)));
    }

    const totalPagesToRead = 604;
    const daysRequired = Math.ceil(totalPagesToRead / Math.max(1, calculatedPages));
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysRequired);

    const newPlan: KhatmahPlan = {
      id: Date.now().toString(),
      title,
      goalType,
      pagesPerDay: calculatedPages,
      startPage: 1,
      endPage: 604,
      currentPage: 1,
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
    const nextCurrentPage = Math.min(plan.endPage, plan.currentPage + plan.pagesPerDay);

    const updated: KhatmahPlan = {
      ...plan,
      currentPage: nextCurrentPage,
      streakDays: nextStreak,
      lastCompletedDate: todayStr,
    };
    setPlan(updated);

    if (onCreateTask) {
      onCreateTask(
        `حفظ القرآن - الصفحة ${nextCurrentPage}`,
        todayStr
      );
    }
  };

  const handleDeletePlan = () => {
    if (confirm('هل أنت تأكد من رغبتك في حذف خطة الخاتمة الحالية؟')) {
      setPlan(null);
    }
  };

  const quranTasks = linkedTasks.filter((t) =>
    /quran|memoriz|حفظ|مراجعة|تلاوة|قران|قرآن/i.test(t.title)
  );

  const quranHabits = linkedHabits.filter((h) =>
    /quran|memoriz|حفظ|مراجعة|تلاوة|قران|قرآن|ورد|تحفيظ/i.test(h.title)
  );

  const sheikhEvents = linkedEvents.filter((e) =>
    /sheikh|حفظ|قران|قرآن|تسميع|تحفيظ|تثبيت|شيخ|tahfez|quran/i.test(e.title)
  );

  const totalPages = plan ? plan.endPage - plan.startPage + 1 : 604;
  const pagesCompleted = plan ? plan.currentPage - plan.startPage : 0;
  const progressPercent = Math.min(100, Math.round((pagesCompleted / totalPages) * 100));

  return (
    <div className="space-y-6 font-sans dir-rtl">
      {/* Top Banner / Plan Summary */}
      {!plan ? (
        <div className="p-6 md:p-8 rounded-3xl border border-emerald-500/30 bg-emerald-950/25 backdrop-blur-md text-center space-y-4 shadow-xl">
          <div className="size-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto text-3xl border border-emerald-500/20">
            🎯
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">إنشاء خطة الخاتمة والحفظ التفاعلية</h2>
            <p className="text-xs md:text-sm text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
              حدد هدفك اليومي مثل "صفحة واحدة يومياً" أو "إنهاء ٥ أجزاء في ٣٠ يوماً". تابع نسبة الإنجاز وسلسلة الالتزام مع ربط تلقائي بمهام lifeOS وجلسات الشيخ.
            </p>
          </div>
          <button
            onClick={() => setShowNewPlanModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="size-4" /> بدء خطة خاتمة جديدة
          </button>
        </div>
      ) : (
        <div className="p-6 rounded-3xl border border-border bg-card shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{plan.title}</h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  خطة نشطة
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                معدل الإنجاز: <span className="font-bold text-foreground">{plan.pagesPerDay} صفحة / يومياً</span> • تاريخ الانتهاء المتوقع:{' '}
                <span className="font-semibold text-emerald-400">
                  {new Date(plan.targetEndDate).toLocaleDateString('ar-EG')}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-bold">
                <Flame className="size-4 fill-current animate-pulse" />
                سلسلة {plan.streakDays} أيام متتالية
              </div>
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
              <span className="text-muted-foreground">نسبة التقدم الكلي في المصحف</span>
              <span className="text-emerald-400">{progressPercent}% ({pagesCompleted} من {totalPages} صفحة)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-secondary overflow-hidden border border-border/40 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Action Log Button */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40 flex-wrap gap-2">
            <div className="text-xs text-muted-foreground">
              الصفحة الحالية: <span className="font-bold text-foreground">صفحة {plan.currentPage}</span>
            </div>
            <button
              onClick={handleLogProgress}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="size-4" /> تسجيل إنجاز اليوم (+{plan.pagesPerDay} صفحة)
            </button>
          </div>
        </div>
      )}

      {/* lifeOS Connected Tasks, Habits & Sheikh Calendar Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Connected Tasks Card */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              مهام الحفظ (lifeOS Tasks) ({quranTasks.length})
            </h3>
          </div>

          {quranTasks.length === 0 ? (
            <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
              لا توجد مهام قرآنية حالية في lifeOS.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pl-1">
              {quranTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onToggleTask && onToggleTask(task.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    task.is_completed
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-muted-foreground line-through'
                      : 'border-border/60 bg-secondary/30 hover:bg-secondary/60 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {task.is_completed ? (
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-bold">{task.title}</span>
                  </div>
                  {task.due_date && (
                    <span className="text-[10px] text-muted-foreground font-mono bg-background px-2 py-0.5 rounded-md border border-border/40">
                      {task.due_date}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connected Habits Card */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="size-4 text-amber-400" />
              العادات القرآنية (lifeOS Habits) ({quranHabits.length})
            </h3>
          </div>

          {quranHabits.length === 0 ? (
            <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
              لا توجد عادات قرآنية في lifeOS Habits (مثل: ورد القرآن، تحفيظ).
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pl-1">
              {quranHabits.map((habit) => (
                <div
                  key={habit.id}
                  onClick={() => onToggleHabit && onToggleHabit(habit.id, !habit.is_completed_today)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    habit.is_completed_today
                      ? 'border-amber-500/30 bg-amber-500/5 text-muted-foreground line-through'
                      : 'border-border/60 bg-secondary/30 hover:bg-secondary/60 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {habit.is_completed_today ? (
                      <CheckCircle2 className="size-4 text-amber-500 shrink-0" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-bold">{habit.title}</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {habit.is_completed_today ? 'تم اليوم' : 'غير مكتمل'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connected Sheikh Recitation Calendar Sessions Card */}
        <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="size-4 text-indigo-400" />
              جلسات التحفيظ والتسميع مع الشيخ ({sheikhEvents.length})
            </h3>
          </div>

          {sheikhEvents.length === 0 ? (
            <div className="p-4 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
              لا توجد أحداث مجدولة في التقويم (أضف حدثاً بعنوان "قرآن" أو "تحفيظ" أو "تسميع" أو "الشيخ").
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pl-1">
              {sheikhEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{evt.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(evt.start_time).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* New Plan Modal */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Target className="size-5 text-emerald-500" />
              إنشاء خطة خاتمة مخصصة
            </h3>

            <form onSubmit={handleCreatePlan} className="space-y-3">
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
    </div>
  );
};
