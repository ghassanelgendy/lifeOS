import React, { useState } from 'react';
import { useQadaaTracker, type QadaaPrayerKey } from '../hooks/useQadaaTracker';
import { QadaaSetupModal } from './QadaaSetupModal';
import { Button } from './ui';
import {
  Compass,
  Settings,
  Target,
  Zap,
  Calendar,
  CheckCircle2,
  Plus,
  Minus,
  RotateCcw,
  ListTodo,
  Check,
  BookmarkCheck,
} from 'lucide-react';
import { format } from 'date-fns';

const PRAYERS_CONFIG: Array<{ key: QadaaPrayerKey; nameAr: string; nameEn: string }> = [
  { key: 'fajr', nameAr: 'الفجر', nameEn: 'Fajr' },
  { key: 'dhuhr', nameAr: 'الظهر', nameEn: 'Dhuhr' },
  { key: 'asr', nameAr: 'العصر', nameEn: 'Asr' },
  { key: 'maghrib', nameAr: 'المغرب', nameEn: 'Maghrib' },
  { key: 'isha', nameAr: 'العشاء', nameEn: 'Isha' },
  { key: 'witr', nameAr: 'الوتر', nameEn: 'Witr' },
];

export const QadaaWidget: React.FC = () => {
  const {
    settings,
    todayLog,
    totals,
    remaining,
    velocityAndForecast,
    incrementPrayer,
    decrementPrayer,
    batchFullDay,
    saveSettings,
    pushTasks,
    isPushingTasks,
    syncHabit,
    isSyncingHabit,
  } = useQadaaTracker();

  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [taskPushFeedback, setTaskPushFeedback] = useState<string | null>(null);
  const [habitSyncFeedback, setHabitSyncFeedback] = useState<string | null>(null);

  const activePrayers = PRAYERS_CONFIG.filter(
    (p) => p.key !== 'witr' || settings.include_witr
  );

  const handlePushTasks = async () => {
    try {
      const res = await pushTasks();
      if (res.created > 0) {
        setTaskPushFeedback(`تم دفع ${res.created} مهام لليوم`);
      } else {
        setTaskPushFeedback('مهام اليوم مضافة بالفعل');
      }
      setTimeout(() => setTaskPushFeedback(null), 3000);
    } catch {
      setTaskPushFeedback('خطأ في الاتصال');
      setTimeout(() => setTaskPushFeedback(null), 3000);
    }
  };

  const handleSyncHabit = async () => {
    try {
      await syncHabit();
      setHabitSyncFeedback('تمت مزامنة العادة');
      setTimeout(() => setHabitSyncFeedback(null), 3000);
    } catch {
      setHabitSyncFeedback('خطأ في المزامنة');
      setTimeout(() => setHabitSyncFeedback(null), 3000);
    }
  };

  return (
    <div className="bg-card text-card-foreground border border-border/70 rounded-2xl p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base md:text-lg text-foreground">قضاء الصلوات الفائتة</h3>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary/80 text-muted-foreground border border-border/50">
                مذهب {settings.madhab.toUpperCase()} · سن {settings.takleef_age}
              </span>
              {settings.auto_push_tasks && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                  <ListTodo className="w-3 h-3" />
                  <span>دفع تلقائي (قبل الفريضة بـ {settings.task_offset_minutes ?? 60} د)</span>
                </span>
              )}
              {settings.auto_sync_habit && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
                  <BookmarkCheck className="w-3 h-3" />
                  <span>مزامنة العادة</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              متابعة الفوائت ومحاكاة الجدول الزمني التقديري ديناميكياً مع مزامنة العادات والمهام
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Push tasks button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePushTasks}
            disabled={isPushingTasks}
            className="text-xs gap-1.5 h-8 border-border/80 cursor-pointer"
            title="دفع صلوات القضاء المتبقية لليوم كمهام في قائمة المهام"
          >
            {taskPushFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">{taskPushFeedback}</span>
              </>
            ) : (
              <>
                <ListTodo className="w-3.5 h-3.5" />
                <span>دفع كمهام لليوم</span>
              </>
            )}
          </Button>

          {/* Sync habit button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncHabit}
            disabled={isSyncingHabit}
            className="text-xs gap-1.5 h-8 border-border/80 cursor-pointer"
            title="إنشاء ومزامنة عادة قضاء الصلوات اليومية في جدول العادات"
          >
            {habitSyncFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">{habitSyncFeedback}</span>
              </>
            ) : (
              <>
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>مزامنة العادة</span>
              </>
            )}
          </Button>

          {/* Settings modal */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSetupModalOpen(true)}
            className="text-xs gap-1.5 h-8 border-border/80 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>ضبط الخطة</span>
          </Button>
        </div>
      </div>

      {/* Overall Progress Strip */}
      <div className="p-4 bg-muted/20 border border-border/60 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold text-foreground">
              المقضي: {totals.total.toLocaleString()} صلاة
            </span>
          </div>
          <div className="text-muted-foreground text-xs">
            المتبقي: <span className="text-foreground font-bold tabular-nums">{remaining.total.toLocaleString()}</span> صلاة ({remaining.completionPct}%)
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, remaining.completionPct))}%` }}
          />
        </div>
      </div>

      {/* Dual Velocity & Live Dynamic Forecasting */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Planned Target */}
        <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Target className="w-3.5 h-3.5 text-primary" />
              <span>الهدف اليومي المخطط</span>
            </span>
            <span className="font-bold text-primary tabular-nums">
              {velocityAndForecast.dailyTarget} صلوات / يوم
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            المدة المقدرة: {velocityAndForecast.targetDuration.formatted}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>تاريخ الإتمام المخطط: {format(velocityAndForecast.targetFinishDate, 'dd MMM yyyy')}</span>
          </p>
        </div>

        {/* Actual Rolling Velocity */}
        <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>متوسط السرعة (آخر 7 أيام)</span>
            </span>
            <span className="font-bold text-foreground tabular-nums">
              {velocityAndForecast.rolling7DayVelocity} صلوات / يوم
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            الإنهاء الفعلي المتوقع: {velocityAndForecast.actualDuration.formatted}
          </p>
          <div className="flex items-center justify-between text-xs flex-wrap gap-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{format(velocityAndForecast.actualFinishDate, 'dd MMM yyyy')}</span>
            </span>
            {velocityAndForecast.isAhead && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded text-[11px] border border-emerald-500/20">
                متقدم بـ {Math.abs(velocityAndForecast.daysDelta)} يوم
              </span>
            )}
            {velocityAndForecast.isBehind && velocityAndForecast.rolling7DayVelocity > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded text-[11px] border border-amber-500/20">
                متأخر بـ {Math.abs(velocityAndForecast.daysDelta)} يوم
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Batch Full Day Action Bar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-muted/20 border border-border/60 rounded-xl flex-wrap">
        <div>
          <span className="text-xs md:text-sm font-semibold text-foreground block">تسجيل يوم كامل دفعة واحدة</span>
          <span className="text-xs text-muted-foreground">
            إضافة صلاة قضاء لكل الصلوات الخمس بضغطة واحدة
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => batchFullDay(1)}
            className="font-semibold text-xs gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+1 يوم كامل</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => batchFullDay(-1)}
            className="text-xs h-8 px-2 border-border/60 text-muted-foreground hover:text-foreground cursor-pointer"
            title="تراجع -1 عن اليوم الكامل"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Prayers Cards Grid - Refurbished Anti-Slop Flat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {activePrayers.map((prayer) => {
          const rem = remaining[prayer.key as keyof typeof remaining] as number;
          const doneToday = (todayLog as any)[`${prayer.key}_count`] || 0;

          return (
            <div
              key={prayer.key}
              className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-border transition-colors flex flex-col justify-between space-y-3 shadow-none"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">{prayer.nameAr}</span>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/60">
                    {prayer.nameEn}
                  </span>
                </div>
                <div className="mt-2.5">
                  <span className="text-[11px] text-muted-foreground block">المتبقي</span>
                  <span className="text-xl md:text-2xl font-bold text-foreground tracking-tight tabular-nums block">
                    {rem.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5">
                  <span className="text-[11px] font-medium text-foreground bg-muted/50 border border-border/40 px-2 py-0.5 rounded-md inline-block tabular-nums">
                    اليوم: +{doneToday}
                  </span>
                </div>
              </div>

              {/* Action Buttons Stepper */}
              <div className="flex items-center gap-1 pt-1 border-t border-border/40">
                <Button
                  size="sm"
                  onClick={() => incrementPrayer(prayer.key, 1)}
                  className="flex-1 h-8 text-xs font-semibold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>+1</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => incrementPrayer(prayer.key, 5)}
                  className="h-8 px-2 text-[11px] font-semibold border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="إضافة 5 صلوات دفعة واحدة"
                >
                  +5
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => decrementPrayer(prayer.key, 1)}
                  disabled={doneToday <= 0}
                  className="h-8 px-2 text-muted-foreground hover:text-rose-500 cursor-pointer disabled:opacity-30"
                  title="تراجع -1"
                >
                  <Minus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Setup Modal */}
      <QadaaSetupModal
        open={setupModalOpen}
        onOpenChange={setSetupModalOpen}
        currentSettings={settings}
        onSave={saveSettings}
      />
    </div>
  );
};
