import React, { useState } from 'react';
import { useQadaaTracker, type QadaaPrayerKey } from '../hooks/useQadaaTracker';
import { QadaaSetupModal } from './QadaaSetupModal';
import { Button } from './ui';
import {
  Sparkles,
  Settings,
  Target,
  Zap,
  Calendar,
  CheckCircle2,
  Plus,
  Minus,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';

const PRAYERS_CONFIG: Array<{ key: QadaaPrayerKey; nameAr: string; nameEn: string; color: string }> = [
  { key: 'fajr', nameAr: 'الفجر', nameEn: 'Fajr', color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400' },
  { key: 'dhuhr', nameAr: 'الظهر', nameEn: 'Dhuhr', color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400' },
  { key: 'asr', nameAr: 'العصر', nameEn: 'Asr', color: 'from-orange-500/20 to-red-500/10 border-orange-500/30 text-orange-400' },
  { key: 'maghrib', nameAr: 'المغرب', nameEn: 'Maghrib', color: 'from-rose-500/20 to-purple-500/10 border-rose-500/30 text-rose-400' },
  { key: 'isha', nameAr: 'العشاء', nameEn: 'Isha', color: 'from-purple-500/20 to-blue-500/10 border-purple-500/30 text-purple-400' },
  { key: 'witr', nameAr: 'الوتر', nameEn: 'Witr', color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400' },
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
  } = useQadaaTracker();

  const [setupModalOpen, setSetupModalOpen] = useState(false);

  const activePrayers = PRAYERS_CONFIG.filter(
    (p) => p.key !== 'witr' || settings.include_witr
  );

  return (
    <div className="bg-card text-card-foreground border border-border/80 rounded-2xl p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base md:text-lg">قضاء الصلوات الفائتة (Qadaa)</h3>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {settings.madhab.toUpperCase()} · من سن {settings.takleef_age}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              متابعة قضاء الفوائت ومحاكاة الجدول الزمني التقديري ديناميكياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSetupModalOpen(true)}
            className="text-xs gap-1.5 h-8 border-border/80"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>إعادة ضبط الخطة</span>
          </Button>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="space-y-2 p-4 bg-muted/20 border border-border/50 rounded-xl">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            <span>الإنجاز الكلي: {totals.total.toLocaleString()} صلاة مقضية</span>
          </span>
          <span className="text-muted-foreground font-medium">
            المتبقي: <span className="text-foreground font-bold">{remaining.total.toLocaleString()}</span> صلاة ({remaining.completionPct}%)
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, remaining.completionPct))}%` }}
          />
        </div>
      </div>

      {/* Dual Velocity & Live Dynamic Forecasting */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Planned Pace Card */}
        <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <Target className="w-4 h-4 text-primary" />
              <span>الهدف المخطط له (Planned Target: D)</span>
            </span>
            <span className="font-bold text-primary">{velocityAndForecast.dailyTarget} صلوات / يومياً</span>
          </div>
          <p className="text-sm font-bold text-foreground">
            إنهاء خلال {velocityAndForecast.targetDuration.formatted}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>تاريخ الإتمام المخطط: {format(velocityAndForecast.targetFinishDate, 'dd MMM yyyy')}</span>
          </p>
        </div>

        {/* Actual Rolling Velocity Card */}
        <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>السرعة الفعلية (7-Day Velocity: V)</span>
            </span>
            <span className="font-bold text-amber-500">{velocityAndForecast.rolling7DayVelocity} صلوات / يومياً</span>
          </div>
          <p className="text-sm font-bold text-foreground">
            إنهاء فعلي خلال {velocityAndForecast.actualDuration.formatted}
          </p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>المتوقع: {format(velocityAndForecast.actualFinishDate, 'dd MMM yyyy')}</span>
            </span>
            {velocityAndForecast.isAhead && (
              <span className="text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">
                متقدم بـ {Math.abs(velocityAndForecast.daysDelta)} يوم 🚀
              </span>
            )}
            {velocityAndForecast.isBehind && velocityAndForecast.rolling7DayVelocity > 0 && (
              <span className="text-amber-500 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px]">
                متأخر بـ {Math.abs(velocityAndForecast.daysDelta)} يوم
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Batch Full Day Action */}
      <div className="flex items-center justify-between gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
        <div>
          <span className="text-sm font-bold text-foreground block">تسجيل يوم كامل دفعة واحدة</span>
          <span className="text-xs text-muted-foreground">
            إضافة صلاة قضاء لكل الصلوات الخمس بضغطة واحدة
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => batchFullDay(1)}
            className="font-semibold text-xs gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+1 يوم كامل</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => batchFullDay(-1)}
            className="text-xs h-8 px-2 border-border/60 text-muted-foreground"
            title="تراجع -1 عن اليوم الكامل"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Prayers Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {activePrayers.map((prayer) => {
          const rem = remaining[prayer.key as keyof typeof remaining] as number;
          const doneToday = (todayLog as any)[`${prayer.key}_count`] || 0;

          return (
            <div
              key={prayer.key}
              className={`p-3.5 rounded-xl border bg-gradient-to-b ${prayer.color} flex flex-col justify-between space-y-3 transition-all hover:scale-[1.01]`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{prayer.nameAr}</span>
                  <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">
                    {prayer.nameEn}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground block">المتبقي:</span>
                  <span className="text-base font-extrabold text-foreground tracking-tight">
                    {rem.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-block">
                    اليوم: +{doneToday}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 pt-1">
                <Button
                  size="sm"
                  onClick={() => incrementPrayer(prayer.key, 1)}
                  className="flex-1 h-8 text-xs font-bold gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>+1</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => incrementPrayer(prayer.key, 5)}
                  className="h-8 px-2 text-[11px] font-semibold border-border/60 hover:bg-muted"
                  title="إضافة 5 صلوات دفعة واحدة"
                >
                  +5
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => decrementPrayer(prayer.key, 1)}
                  disabled={doneToday <= 0}
                  className="h-8 px-2 text-muted-foreground hover:text-red-400"
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
