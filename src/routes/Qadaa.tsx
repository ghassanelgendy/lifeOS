import React from 'react';
import { QadaaWidget } from '../components/QadaaWidget';
import { Compass, Info } from 'lucide-react';

export const Qadaa: React.FC = () => {
  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              قضاء الصلوات الفائتة (Qadaa Prayers)
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              متابعة قضاء الفوائت من سن التكليف بحسابات المذاهب الأربعة مع تقدير الجدول الزمني ديناميكياً
            </p>
          </div>
        </div>
      </div>

      {/* Main Qadaa Widget */}
      <QadaaWidget />

      {/* Fiqh Guidance & Principles Card */}
      <div className="p-5 bg-card text-card-foreground border border-border/70 rounded-2xl space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm text-primary">
          <Info className="w-4 h-4" />
          <span>إرشادات وضوابط فقهية في قضاء الفوائت (Fiqh Principles)</span>
        </div>
        <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside leading-relaxed">
          <li>
            <strong className="text-foreground">حكم القضاء:</strong> ذهب جمهور الفقهاء من المذاهب الأربعة إلى وجوب قضاء الصلوات المفروضة الفائتة على المستطيع، لما ورد عن النبي ﷺ: «فَدَيْنُ اللَّهِ أَحَقُّ أَنْ يُقْضَى».
          </li>
          <li>
            <strong className="text-foreground">كيفية القضاء والترتيب:</strong> يُستحب أو يجب (بحسب المذهب) تقديم الفائتة أو قضائها مع كل صلاة حاضرة (مثل قضاء فجر مع فجر اليوم، وظهر مع ظهر اليوم).
          </li>
          <li>
            <strong className="text-foreground">الأوقات المنهي عنها:</strong> تجوز صلاة القضاء في جميع الأوقات عند جمهور الفقهاء؛ لأنها صلاة ذات سبب وفريضة واجبة.
          </li>
          <li>
            <strong className="text-foreground">الاستطاعة وعدم المشقة:</strong> ينبغي للعبد أن يقضي ما في وسعه وطاقته دون أن يلحقه حرج أو مشقة تُعطله عن كسبه وواجباته الأساسية.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Qadaa;
