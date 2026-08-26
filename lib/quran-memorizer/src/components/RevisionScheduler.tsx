import React from 'react';
import { Calendar, CheckCircle2, Award, Clock, BookOpen, ChevronRight } from 'lucide-react';
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
    <div className="space-y-4 font-sans">
      {/* Stats Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{totalMemorized}</p>
            <p className="text-xs text-muted-foreground">Memorized Portions</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <BookOpen className="size-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{totalReviewing}</p>
            <p className="text-xs text-muted-foreground">Active Learning</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Calendar className="size-5" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{dueReviews.length}</p>
            <p className="text-xs text-muted-foreground">Due for Revision Today</p>
          </div>
        </div>
      </div>

      {/* Due Reviews Queue */}
      <div className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="size-4 text-amber-500" />
            Today's Revision Queue (المراجعة اليومية)
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {dueReviews.length} Due
          </span>
        </div>

        {dueReviews.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground space-y-1">
            <Award className="size-8 mx-auto text-emerald-500/80 mb-2" />
            <p className="font-semibold text-foreground">All caught up for today!</p>
            <p>Your revision queue is complete. You can start a new Surah or practice free reading.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dueReviews.map((record) => {
              const surah = SURAHS.find((s) => s.id === record.surahNumber);
              return (
                <div
                  key={`${record.surahNumber}-${record.ayahStart}-${record.ayahEnd}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-amber-500/10 text-amber-500 font-bold text-xs flex items-center justify-center shrink-0">
                      {record.surahNumber}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {surah?.transliteration || `Surah ${record.surahNumber}`} ({surah?.name})
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Ayah {record.ayahStart} – {record.ayahEnd} • Mastery: {record.masteryScore}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectReview(record)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-all cursor-pointer"
                    >
                      Practice Now
                      <ChevronRight className="size-3.5" />
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
