import React, { useState, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Search,
  Bookmark,
  RotateCcw,
  BookOpen,
  Settings2,
  Smartphone,
  Volume2,
  VolumeX,
  Type,
  Sun,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  useAllAzkar,
  useAzkarCategories,
  useTodayAzkarProgress,
  useAzkarFavorites,
  useContextualAzkarCategory,
  stripTashkeel,
} from '../hooks/useAzkar';
import { useAzkarStore } from '../stores/useAzkarStore';
import { ZekrCard } from '../components/azkar/ZekrCard';
import { TasbihCounterModal } from '../components/azkar/TasbihCounterModal';
import type { AzkarItem } from '../types/azkar';

export default function AzkarRoute() {
  const allAzkar = useAllAzkar();
  const categories = useAzkarCategories();
  const { progress, updateCount, resetCategory } = useTodayAzkarProgress();
  const { favoriteIds, isFavorite, toggleFavorite } = useAzkarFavorites();
  const contextual = useContextualAzkarCategory();

  const {
    selectedCategory,
    setSelectedCategory,
    fontSize,
    setFontSize,
    hapticFeedback,
    toggleHaptic,
    soundEnabled,
    toggleSound,
    autoAdvance,
    toggleAutoAdvance,
    showTashkeel,
    toggleTashkeel,
  } = useAzkarStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isTasbihOpen, setIsTasbihOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  // Filtered azkar items based on category / search / favorites
  const displayedAzkar = useMemo(() => {
    let list: AzkarItem[] = allAzkar;

    if (showFavoritesOnly) {
      return list.filter((item) => favoriteIds.includes(item.id));
    }

    if (searchQuery.trim()) {
      const q = stripTashkeel(searchQuery);
      return list.filter((item) => {
        const text = stripTashkeel(item.zekr);
        const cat = stripTashkeel(item.category);
        const desc = stripTashkeel(item.description);
        const ref = stripTashkeel(item.reference);
        return text.includes(q) || cat.includes(q) || desc.includes(q) || ref.includes(q);
      });
    }

    if (selectedCategory) {
      return list.filter((item) => item.category === selectedCategory);
    }

    // Default view: recommend contextual category
    return list.filter((item) => item.category === contextual.category);
  }, [allAzkar, selectedCategory, searchQuery, showFavoritesOnly, favoriteIds, contextual.category]);

  const activeCategoryTitle = showFavoritesOnly
    ? 'الأذكار المفضلة'
    : searchQuery
    ? `نتائج البحث عن "${searchQuery}"`
    : selectedCategory || contextual.category;

  // Calculate completion percentage for the current category
  const categoryStats = useMemo(() => {
    if (!displayedAzkar.length) return { completed: 0, total: 0, percent: 0 };
    let completed = 0;
    for (const item of displayedAzkar) {
      const done = progress.counts[item.id] || 0;
      if (done >= item.count) completed++;
    }
    const percent = Math.round((completed / displayedAzkar.length) * 100);
    return { completed, total: displayedAzkar.length, percent };
  }, [displayedAzkar, progress.counts]);

  // Handle counter increments
  const handleIncrement = useCallback(
    (id: string, count: number) => {
      const item = allAzkar.find((i) => i.id === id);
      const cat = item?.category;
      // Check if category is now fully completed
      const catItems = allAzkar.filter((i) => i.category === cat);
      let allDone = true;
      for (const ci of catItems) {
        const current = ci.id === id ? count : progress.counts[ci.id] || 0;
        if (current < ci.count) {
          allDone = false;
          break;
        }
      }
      updateCount({ zekrId: id, count, categoryName: cat, categoryCompleted: allDone });
    },
    [allAzkar, progress.counts, updateCount]
  );

  const handleResetZekr = useCallback(
    (id: string) => {
      updateCount({ zekrId: id, count: 0 });
    },
    [updateCount]
  );

  const handleResetCurrentCategory = useCallback(() => {
    const ids = displayedAzkar.map((i) => i.id);
    resetCategory(ids);
  }, [displayedAzkar, resetCategory]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 md:pb-10">
      {/* Top Header */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sun size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">الأذكار والأدعية</h1>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTasbihOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">سبحة إلكترونية</span>
              <span className="sm:hidden">سبحة</span>
            </button>

            <button
              onClick={() => setShowFavoritesOnly((v) => !v)}
              aria-pressed={showFavoritesOnly}
              aria-label="الأذكار المفضلة"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                showFavoritesOnly
                  ? 'border-amber-500/40 bg-amber-500/20 text-amber-500'
                  : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
              title="الأذكار المفضلة"
            >
              <Bookmark size={18} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
            </button>

            <button
              onClick={() => setShowPreferences((v) => !v)}
              aria-pressed={showPreferences}
              aria-label="إعدادات القراءة والخط"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                showPreferences
                  ? 'border-primary/40 bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
              title="إعدادات القراءة والخط"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>

        {/* Preferences Drawer */}
        {showPreferences && (
          <div className="border-t border-border bg-card/60 px-4 py-3 backdrop-blur-md sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-xs">
              {/* Font size */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Type size={14} /> حجم الخط:
                </span>
                {(['sm', 'base', 'lg', 'xl'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setFontSize(sz)}
                    aria-pressed={fontSize === sz}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 font-mono font-medium uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      fontSize === sz
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {sz}
                  </button>
                ))}
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleHaptic}
                  className={cn(
                    'flex items-center gap-1 rounded-lg border px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    hapticFeedback
                      ? 'border-primary/40 bg-primary/10 font-medium text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  <Smartphone size={13} />
                  <span>الاهتزاز</span>
                </button>

                <button
                  onClick={toggleSound}
                  className={cn(
                    'flex items-center gap-1 rounded-lg border px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    soundEnabled
                      ? 'border-primary/40 bg-primary/10 font-medium text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  <span>الصوت</span>
                </button>

                <button
                  onClick={toggleAutoAdvance}
                  className={cn(
                    'flex items-center gap-1 rounded-lg border px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    autoAdvance
                      ? 'border-primary/40 bg-primary/10 font-medium text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  <span>التمرير التلقائي عند الإتمام</span>
                </button>

                <button
                  onClick={toggleTashkeel}
                  className={cn(
                    'flex items-center gap-1 rounded-lg border px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    showTashkeel
                      ? 'border-primary/40 bg-primary/10 font-medium text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  <span>إظهار التشكيل</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:px-6">
        {/* Contextual Recommendation Banner */}
        {!searchQuery && !showFavoritesOnly && (
          <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  {contextual.badge}
                </span>
                <span className="text-xs text-muted-foreground">{contextual.reason}</span>
              </div>
              <h2 className="font-arabic-quran text-xl font-bold text-foreground sm:text-2xl" lang="ar" dir="rtl">
                {contextual.category}
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setSelectedCategory(contextual.category)}
                className={cn(
                  'rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  selectedCategory === contextual.category || !selectedCategory
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                )}
              >
                {(selectedCategory === contextual.category || !selectedCategory) ? 'قيد القراءة الآن' : 'عرض الآن'}
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (showFavoritesOnly) setShowFavoritesOnly(false);
            }}
            placeholder="ابحث بالاسم أو النص (مثال: آية الكرسي، سيد الاستغفار، السفر)..."
            aria-label="البحث في الأذكار"
            className="w-full rounded-xl border border-border bg-card py-3 pr-11 pl-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            dir="rtl"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="مسح البحث"
              className="absolute left-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Categories Horizontal Carousel */}
        {!searchQuery && !showFavoritesOnly && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">التصنيفات الشائعة</span>
              <span>{categories.length} تصنيف</span>
            </div>

            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 scroll-smooth">
              {categories.map((cat) => {
                const isSelected = (selectedCategory || contextual.category) === cat.name;
                const isContext = contextual.category === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isSelected
                        ? 'border-primary bg-primary font-semibold text-primary-foreground shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    )}
                  >
                    {isContext && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />}
                    <span lang="ar" dir="rtl">{cat.name}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 font-mono text-[10px]',
                        isSelected
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-secondary text-muted-foreground'
                      )}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Category Title & Progress Indicator */}
        <div className="flex flex-col justify-between gap-3 border-b border-border/60 pb-1 pt-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-arabic-quran flex items-center gap-2 text-xl font-bold text-foreground">
              <span lang="ar" dir="rtl">{activeCategoryTitle}</span>
              <span className="font-sans text-xs font-normal text-muted-foreground">
                ({displayedAzkar.length} ذكر)
              </span>
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              مكتمل اليوم: {categoryStats.completed} من {categoryStats.total} ({categoryStats.percent}%)
            </p>
          </div>

          <div className="flex items-center gap-3">
            {categoryStats.completed > 0 && (
              <button
                onClick={handleResetCurrentCategory}
                className="flex items-center gap-1 rounded-lg text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="تصفير تكرار هذا القسم اليوم"
              >
                <RotateCcw size={13} />
                <span>إعادة تصفير القسم</span>
              </button>
            )}

            {/* Visual mini bar */}
            <div
              className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-secondary sm:w-36"
              role="progressbar"
              aria-valuenow={categoryStats.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`نسبة الإتمام ${categoryStats.percent}%`}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${categoryStats.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Azkar List Cards */}
        {displayedAzkar.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-border bg-card/40 py-16 text-center" dir="rtl">
            <BookOpen size={36} className="mx-auto text-muted-foreground/60" />
            <p className="text-sm font-medium text-muted-foreground" lang="ar">
              {showFavoritesOnly ? 'لم تقم بحفظ أي أذكار في المفضلة بعد.' : 'لا توجد أذكار تطابق هذا البحث.'}
            </p>
            {showFavoritesOnly && (
              <p className="text-xs text-muted-foreground/80" lang="ar">
                انقر على أيقونة الإشارة المرجعية بجانب أي ذكر لإضافته هنا.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-5 animate-in fade-in duration-300">
            {displayedAzkar.map((item, index) => (
              <ZekrCard
                key={item.id}
                item={item}
                index={index}
                total={displayedAzkar.length}
                completedCount={progress.counts[item.id] || 0}
                isFavorite={isFavorite(item.id)}
                onIncrement={handleIncrement}
                onReset={handleResetZekr}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tasbih Modal */}
      <TasbihCounterModal isOpen={isTasbihOpen} onClose={() => setIsTasbihOpen(false)} />
    </div>
  );
}
