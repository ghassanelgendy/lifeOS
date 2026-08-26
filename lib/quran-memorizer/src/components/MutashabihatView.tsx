import React, { useState } from 'react';
import { BookOpen, Layers, Search, ArrowRightLeft } from 'lucide-react';
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
    const surahA = SURAHS.find((s) => s.id === item.surahNumber)?.transliteration || '';
    const surahB = SURAHS.find((s) => s.id === item.matchedSurah)?.transliteration || '';
    return (
      item.snippet.includes(clean) ||
      item.matchedSnippet.includes(clean) ||
      item.similarityNote.toLowerCase().includes(clean) ||
      surahA.toLowerCase().includes(clean) ||
      surahB.toLowerCase().includes(clean)
    );
  });

  return (
    <div className="space-y-4 p-4 md:p-6 rounded-2xl border border-border bg-card shadow-sm font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <Layers className="size-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Mutashabihat (المتشابهات)</h3>
            <p className="text-xs text-muted-foreground">
              Cross-reference similar Quranic verses to prevent memory confusion.
            </p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by keyword, Surah name, or verse..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Mutashabihat Cards */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
            No matching Mutashabihat entries found.
          </div>
        ) : (
          filteredItems.map((item) => {
            const surahA = SURAHS.find((s) => s.id === item.surahNumber);
            const surahB = SURAHS.find((s) => s.id === item.matchedSurah);

            return (
              <div
                key={item.id}
                className="rounded-xl border border-border/60 bg-secondary/20 p-4 space-y-3 hover:border-indigo-500/30 transition-all"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-400">
                  <span className="flex items-center gap-1">
                    <BookOpen className="size-3.5" />
                    {surahA?.transliteration} ({item.surahNumber}:{item.ayahNumber})
                  </span>
                  <ArrowRightLeft className="size-3.5 text-muted-foreground" />
                  <span className="flex items-center gap-1">
                    <BookOpen className="size-3.5" />
                    {surahB?.transliteration} ({item.matchedSurah}:{item.matchedAyah})
                  </span>
                </div>

                {/* Comparison Verses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-right dir-rtl font-arabic text-lg leading-relaxed">
                  <div className="p-3 rounded-lg bg-background border border-border/40">
                    <p className="text-foreground">{item.snippet}</p>
                    <span className="text-[10px] font-sans text-muted-foreground dir-ltr block text-left mt-1">
                      {surahA?.name} • Ayah {item.ayahNumber}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-border/40">
                    <p className="text-foreground">{item.matchedSnippet}</p>
                    <span className="text-[10px] font-sans text-muted-foreground dir-ltr block text-left mt-1">
                      {surahB?.name} • Ayah {item.matchedAyah}
                    </span>
                  </div>
                </div>

                {/* Key Difference Note */}
                <div className="text-xs text-muted-foreground bg-indigo-500/5 border border-indigo-500/10 p-2.5 rounded-lg flex items-start gap-2">
                  <span className="font-bold text-indigo-400 shrink-0">Key Difference:</span>
                  <span>{item.similarityNote}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
