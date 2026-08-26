import React from 'react';
import { Calendar, CheckCircle2, Award, Clock, BookOpen, ChevronLeft } from 'lucide-react';
import { HifdhRecord, RatingGrade } from '../types/quran';
import { SURAHS } from '../services/quranData';

interface RevisionSchedulerProps {
  dueReviews: HifdhRecord[];
  allRecords: HifdhRecord[];
  onSelectReview: (record: HifdhRecord) => void;
  onGradeReview: (surahNumber: number, startAyah: number, endAyah: number, grade: RatingGrade) => void;
}

export const RevisionScheduler: React.FC<RevisionSchedulerProps> = ({
  dueReviews,
  allRecords,
  onSelectReview,
  onGradeReview,
}) => {
  const totalMemorized = allRecords.filter((r) => r.status === 'memorized').length;
  const totalReviewing = allRecords.filter((r) => r.status === 'reviewing' || r.status === 'memorizing').length;

  return (
    <div dir="rtl" className="space-y-4 font-arabic-body text-right">
      {/* Stats Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
          <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalMemorized}</p>
            <p className="text-xs text-muted-foreground font-semibold">المقاطع المتقنة تماماً</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 flex items-center gap-3">
          <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <BookOpen className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalReviewing}</p>
            <p className="text-xs text-muted-foreground font-semibold">المقاطع قيد التثبيت والمراجعة</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
          <div className="size-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Calendar className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{dueReviews.length}</p>
            <p className="text-xs text-muted-foreground font-semibold">المطلوب مراجعته اليوم</p>
          </div>
        </div>
      </div>

      {/* Due Reviews Queue */}
      <div className="p-5 rounded-3xl border border-border bg-card space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="size-4 text-amber-500" />
            جدول المراجعة اليومية المتباعدة (ورد التثبيت)
          </h3>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {dueReviews.length} مقطع مستحق
          </span>
        </div>

        {dueReviews.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-2xl text-xs text-muted-foreground space-y-2">
            <Award className="size-10 mx-auto text-emerald-500/80 mb-2" />
            <p className="font-bold text-foreground text-sm">أنت متقن لجميع ورد اليوم!</p>
            <p>لا توجد مقاطع مستحقة للمراجعة حالياً. يمكنك البدء في حفظ سورة جديدة أو تلاوة حرة.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {dueReviews.map((record) => {
              const surah = SURAHS.find((s) => s.id === record.surahNumber);
              return (
                <div
                  key={`${record.surahNumber}-${record.ayahStart}-${record.ayahEnd}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-amber-500/10 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/20">
                      {record.surahNumber}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        سورة {surah?.name || record.surahNumber} ({surah?.transliteration})
                      </p>
                      <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                        من الآية {record.ayahStart} إلى {record.ayahEnd} • نسبة الاتقان: {record.masteryScore}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectReview(record)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all cursor-pointer shadow-md"
                    >
                      بدء المراجعة
                      <ChevronLeft className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
