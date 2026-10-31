import React, { useState, useMemo } from 'react';
import { Modal, Button, Input } from './ui';
import {
  calculateQadaaBaseline,
  formatDurationFromDays,
  MADHAB_MINIMUMS,
  type QadaaCalculationParams,
} from '../hooks/useQadaaTracker';
import type { QadaaSettings, QadaaMadhab, QadaaCalculationBasis } from '../types/schema';
import { Calendar, Check, Compass, Sparkles, TrendingUp } from 'lucide-react';
import { addDays, format } from 'date-fns';

interface QadaaSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSettings: QadaaSettings;
  onSave: (settings: Partial<QadaaSettings>) => Promise<any>;
}

export const QadaaSetupModal: React.FC<QadaaSetupModalProps> = ({
  open,
  onOpenChange,
  currentSettings,
  onSave,
}) => {
  const [madhab, setMadhab] = useState<QadaaMadhab>(currentSettings.madhab || 'shafii');
  const [calculationBasis, setCalculationBasis] = useState<QadaaCalculationBasis>(
    currentSettings.calculation_basis || 'actual_age'
  );
  const [currentAge, setCurrentAge] = useState<number>(currentSettings.current_age || 23);
  const [takleefAge, setTakleefAge] = useState<number>(currentSettings.takleef_age || 14);
  const [isLunar, setIsLunar] = useState<boolean>(currentSettings.is_lunar_calendar ?? true);
  const [includeWitr, setIncludeWitr] = useState<boolean>(currentSettings.include_witr ?? false);
  const [dailyTarget, setDailyTarget] = useState<number>(currentSettings.daily_target_prayers || 5);
  const [isSaving, setIsSaving] = useState(false);

  // Live calculation based on inputs
  const calculation = useMemo(() => {
    const params: QadaaCalculationParams = {
      madhab,
      calculationBasis,
      currentAge,
      takleefAge,
      isLunarCalendar: isLunar,
      includeWitr,
    };
    const base = calculateQadaaBaseline(params);
    const D = Math.max(1, dailyTarget);
    const daysNeeded = Math.ceil(base.totalTarget / D);
    const finishDate = addDays(new Date(), daysNeeded);
    const duration = formatDurationFromDays(daysNeeded);

    return {
      ...base,
      daysNeeded,
      finishDate,
      duration,
    };
  }, [madhab, calculationBasis, currentAge, takleefAge, isLunar, includeWitr, dailyTarget]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave({
        madhab,
        calculation_basis: calculationBasis,
        current_age: currentAge,
        takleef_age: calculation.effectiveTakleef,
        is_lunar_calendar: isLunar,
        include_witr: includeWitr,
        target_fajr: calculation.targetPerPrayer,
        target_dhuhr: calculation.targetPerPrayer,
        target_asr: calculation.targetPerPrayer,
        target_maghrib: calculation.targetPerPrayer,
        target_isha: calculation.targetPerPrayer,
        target_witr: includeWitr ? calculation.targetPerPrayer : 0,
        daily_target_prayers: dailyTarget,
        is_active: true,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="إعداد خطة قضاء الصلوات (Qadaa Setup)"
      className="max-w-2xl"
    >
      <div className="space-y-6 py-2 text-card-foreground">
        <div className="flex items-center gap-2 p-3 bg-primary/10 text-primary rounded-xl text-xs">
          <Compass className="w-4 h-4 shrink-0" />
          <span>حساب دقيق لسن التكليف وقضاء الفوائت وفق المذاهب الأربعة مع حساب الجدول الزمني ديناميكياً</span>
        </div>

        {/* Section 1: Madhab Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">المذهب الفقهي (Fiqh Madhab)</span>
            <span className="text-xs text-muted-foreground font-normal">ضوابط سن البلوغ والوتر</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'shafii', name: 'الشافعية', desc: 'أدنى بلوغ: 9 سنوات' },
              { key: 'maliki', name: 'المالكية', desc: 'أدنى بلوغ: 9 سنوات' },
              { key: 'hanbali', name: 'الحنابلة', desc: 'أدنى بلوغ: 10 للذكر' },
              { key: 'hanafi', name: 'الحنفية', desc: 'أدنى بلوغ: 12 + الوتر واجب' },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setMadhab(m.key as QadaaMadhab);
                  if (m.key === 'hanafi') setIncludeWitr(true);
                }}
                className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                  madhab === m.key
                    ? 'border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary'
                    : 'border-border/60 hover:border-border hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-sm">{m.name}</span>
                  {madhab === m.key && <Check className="w-4 h-4 text-primary" />}
                </div>
                <span className="text-[11px] opacity-80 mt-1">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Takleef Basis */}
        <div className="space-y-3 p-4 bg-muted/20 border border-border/50 rounded-xl">
          <span className="text-sm font-semibold block">تحديد سن التكليف (Takleef Determination)</span>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-muted/40 cursor-pointer transition">
              <input
                type="radio"
                name="basis"
                value="actual_age"
                checked={calculationBasis === 'actual_age'}
                onChange={() => setCalculationBasis('actual_age')}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium">السن التقريبي للبلوغ الفعلي (موصى به عند الإجماع)</p>
                <p className="text-xs text-muted-foreground">
                  إذا تذكرت السن الذي ظهرت فيه أول علامة للبلوغ (كالاحتلام ونحوه)
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-muted/40 cursor-pointer transition">
              <input
                type="radio"
                name="basis"
                value="jumhur_15"
                checked={calculationBasis === 'jumhur_15'}
                onChange={() => setCalculationBasis('jumhur_15')}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium">بلوغ السن عند الجمهور (15 سنة قمرية)</p>
                <p className="text-xs text-muted-foreground">
                  الحد الأقصى للتكليف عند الشافعية والمالكية والحنابلة وأبي يوسف ومحمد
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-muted/40 cursor-pointer transition">
              <input
                type="radio"
                name="basis"
                value="madhab_minimum"
                checked={calculationBasis === 'madhab_minimum'}
                onChange={() => setCalculationBasis('madhab_minimum')}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium">
                  أدنى سن للأمارات في مذهب {MADHAB_MINIMUMS[madhab]?.label.split(' ')[0]} (
                  {MADHAB_MINIMUMS[madhab]?.male} سنوات)
                </p>
                <p className="text-xs text-muted-foreground">
                  الأحوط لمن أراد الحساب من أدنى سن محتمل شرعاً
                </p>
              </div>
            </label>
          </div>

          {/* Age inputs */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-xs text-muted-foreground block mb-1">عمرك الحالي (Current Age)</span>
              <Input
                type="number"
                min={10}
                max={120}
                value={currentAge}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentAge(Number(e.target.value) || 0)}
              />
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                سن التكليف المحسوب (Takleef Age)
              </span>
              <Input
                type="number"
                min={9}
                max={currentAge}
                disabled={calculationBasis !== 'actual_age'}
                value={calculation.effectiveTakleef}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTakleefAge(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Precision & Witr Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/10 cursor-pointer">
            <input
              type="checkbox"
              checked={isLunar}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsLunar(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
            <div>
              <p className="text-sm font-medium">السنة القمرية الهجرية (354.37 يوم)</p>
              <p className="text-[11px] text-muted-foreground">المعتمدة شرعاً في الفقه الإسلامي</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/10 cursor-pointer">
            <input
              type="checkbox"
              checked={includeWitr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncludeWitr(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
            <div>
              <p className="text-sm font-medium">قضاء صلاة الوتر (6 صلوات يومياً)</p>
              <p className="text-[11px] text-muted-foreground">
                {madhab === 'hanafi' ? 'واجب عند الحنفية' : 'سنة مؤكدة ومستحب'}
              </p>
            </div>
          </label>
        </div>

        {/* Section 4: Daily Capacity (D) */}
        <div className="space-y-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>معدلك اليومي الملتزم به (Daily Capacity: D)</span>
            </span>
            <span className="text-xs text-primary font-bold">{dailyTarget} صلوات / يومياً</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDailyTarget((prev) => Math.max(1, prev - 1))}
            >
              -1
            </Button>
            <Input
              type="number"
              min={1}
              max={50}
              value={dailyTarget}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDailyTarget(Math.max(1, Number(e.target.value) || 1))}
              className="text-center font-bold text-lg"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDailyTarget((prev) => prev + 1)}
            >
              +1
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { label: 'صلاة مع صلاة (5/يوم)', val: 5 },
              { label: 'صلاتين مع صلاة (10/يوم)', val: 10 },
              { label: '3 صلوات مع صلاة (15/يوم)', val: 15 },
              { label: 'معدل خفيف (2/يوم)', val: 2 },
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setDailyTarget(p.val)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                  dailyTarget === p.val
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : 'border-border/60 hover:bg-muted text-muted-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 5: Real-time Dynamic Projection Summary */}
        <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>النتيجة والجدول الزمني المحسوب ديناميكياً</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 bg-background rounded-lg border border-border/40">
              <span className="text-[11px] text-muted-foreground block">السنوات الفائتة</span>
              <span className="text-base font-bold text-foreground">
                {calculation.missedYears} سنة
              </span>
            </div>
            <div className="p-2.5 bg-background rounded-lg border border-border/40">
              <span className="text-[11px] text-muted-foreground block">إجمالي الأيام</span>
              <span className="text-base font-bold text-foreground">
                {calculation.missedDays.toLocaleString()} يوم
              </span>
            </div>
            <div className="p-2.5 bg-background rounded-lg border border-border/40">
              <span className="text-[11px] text-muted-foreground block">لكل صلاة مفردة</span>
              <span className="text-base font-bold text-foreground">
                {calculation.targetPerPrayer.toLocaleString()}
              </span>
            </div>
            <div className="p-2.5 bg-primary/10 rounded-lg border border-primary/30">
              <span className="text-[11px] text-primary block font-medium">إجمالي الصلوات</span>
              <span className="text-base font-bold text-primary">
                {calculation.totalTarget.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-center">
            <p className="text-xs text-muted-foreground">
              بمعدلك المختار (<span className="font-bold text-foreground">{dailyTarget} صلوات يومياً</span>):
            </p>
            <p className="text-base font-bold text-primary mt-0.5">
              ستنتهي بإذن الله خلال {calculation.duration.formatted}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>تاريخ الإتمام التقديري: {format(calculation.finishDate, 'dd MMMM yyyy')}</span>
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-border/50 pt-4 flex sm:flex-row-reverse gap-2">
          <Button onClick={handleSave} disabled={isSaving} className="font-semibold gap-2">
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'جارِ الحفظ...' : 'حفظ واعتماد الخطة'}</span>
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
};
