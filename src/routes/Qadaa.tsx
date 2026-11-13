import React from 'react';
import { Info } from 'lucide-react';
import { QadaaWidget } from '../components/QadaaWidget';
import { PageHeader } from '../components/ui';

const IOS = import.meta.env.MODE === 'ios';

export const Qadaa: React.FC = () => {
  return (
    <div className={IOS ? "space-y-5 w-full max-w-7xl mx-auto px-3 sm:px-6 pb-28 sm:pb-12" : "w-full max-w-7xl mx-auto px-3 sm:px-6 pb-28 sm:pb-12 space-y-6"}>
      {!IOS && (
        <PageHeader
          title="قضاء الصلوات الفائتة (Qadaa Prayers)"
          subtitle="متابعة قضاء الفوائت من سن التكليف بحسابات المذاهب الأربعة مع تقدير الجدول الزمني ديناميكياً"
        />
      )}

      {/* Main Qadaa Widget */}
      <QadaaWidget />

      {/* Fiqh Guidance & Principles Card */}
      <div className={IOS ? "p-4 bg-card text-card-foreground rounded-[20px] space-y-3" : "p-5 bg-card text-card-foreground border border-border/70 rounded-2xl space-y-3"}>
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
