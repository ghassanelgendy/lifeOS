import React, { useState } from 'react';
import { BookOpen, Layers, Search, ArrowLeftRight } from 'lucide-react';
import { MUTASHABIHAT_SAMPLE, SURAHS } from '../services/quranData';

interface MutashabihatViewProps {
  currentSurahNumber?: number;
  currentAyahNumber?: number;
}

export const MutashabihatView: React.FC<MutashabihatViewProps> = ({
  currentSurahNumber,
  currentAyahNumber,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = MUTASHABIHAT_SAMPLE.filter((item) => {
    if (currentSurahNumber && currentAyahNumber) {
      if (item.surahNumber === currentSurahNumber && item.ayahNumber === currentAyahNumber) {
        return true;
      }
    }
    if (!searchQuery.trim()) return true;
    const clean = searchQuery.trim().toLowerCase();
    const surahA = SURAHS.find((s) => s.id === item.surahNumber)?.name || '';
    const surahB = SURAHS.find((s) => s.id === item.matchedSurah)?.name || '';
    return (
      item.snippet.includes(clean) ||
      item.matchedSnippet.includes(clean) ||
      item.similarityNote.includes(clean) ||
      surahA.includes(clean) ||
      surahB.includes(clean)
    );
  });

  return (
    <div className="space-y-4 p-5 md:p-7 rounded-3xl border border-border bg-card shadow-sm font-sans dir-rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <Layers className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">دليل متشابهات القرآن الكريم</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              مقارنة وتوجيه الآيات المتشابهة لتثبيت الحفظ ومنع التداخل.
            </p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="ابحث باسم السورة، بالكلمة، أو بالآية المتشابهة..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-2xl border border-border bg-background pr-10 pl-4 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </div>

      {/* Mutashabihat Cards */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-2xl text-xs text-muted-foreground">
            لم يتم العثور على أية متشابهات تطابق البحث.
          </div>
        ) : (
          filteredItems.map((item) => {
            const surahA = SURAHS.find((s) => s.id === item.surahNumber);
            const surahB = SURAHS.find((s) => s.id === item.matchedSurah);

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border/60 bg-secondary/20 p-4 md:p-5 space-y-3 hover:border-indigo-500/30 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between text-xs font-bold text-indigo-400">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="size-4" />
                    سورة {surahA?.name} (الآية {item.ayahNumber})
                  </span>
                  <ArrowLeftRight className="size-4 text-muted-foreground" />
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="size-4" />
                    سورة {surahB?.name} (الآية {item.matchedAyah})
                  </span>
                </div>

                {/* Comparison Verses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-right dir-rtl font-arabic text-xl leading-[2.2]">
                  <div className="p-4 rounded-xl bg-background border border-border/40 space-y-1">
                    <p className="text-foreground">{item.snippet}</p>
                    <span className="text-[10px] font-sans text-muted-foreground block text-right font-bold pt-1">
                      سورة {surahA?.name} • الآية {item.ayahNumber}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-background border border-border/40 space-y-1">
                    <p className="text-foreground">{item.matchedSnippet}</p>
                    <span className="text-[10px] font-sans text-muted-foreground block text-right font-bold pt-1">
                      سورة {surahB?.name} • الآية {item.matchedAyah}
                    </span>
                  </div>
                </div>

                {/* Key Difference Note */}
                <div className="text-xs text-muted-foreground bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-start gap-2">
                  <span className="font-bold text-indigo-400 shrink-0">الفارق اللفظي الدقيق:</span>
                  <span className="font-semibold text-foreground">{item.similarityNote}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
