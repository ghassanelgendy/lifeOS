import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Bookmark,
  Sun,
  Sunset,
  Moon,
  Sunrise,
  ArrowRight,
  Shield,
  Plane,
  Heart,
  RotateCcw,
  CheckCircle2,
  BookOpen,
  Settings2,
  Smartphone,
  Volume2,
  VolumeX,
  Type,
  ChevronLeft,
  ChevronRight,
  Flame,
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
  const handleIncrement = (id: string, count: number) => {
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
  };

  const handleResetZekr = (id: string) => {
    updateCount({ zekrId: id, count: 0 });
  };

  const handleResetCurrentCategory = () => {
    const ids = displayedAzkar.map((i) => i.id);
    resetCategory(ids);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight flex items-center gap-2">
                <span>الأذكار والأدعية</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                  Offline
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">حصن المسلم والأدعية النبوية الصحيحة</p>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTasbihOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-105 transition-all shadow-sm"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">سبحة إلكترونية</span>
              <span className="sm:hidden">سبحة</span>
            </button>

            <button
              onClick={() => setShowFavoritesOnly((v) => !v)}
              className={cn(
                'p-2 rounded-xl border transition-colors',
                showFavoritesOnly
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
              title="الأذكار المفضلة"
            >
              <Bookmark size={18} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
            </button>

            <button
              onClick={() => setShowPreferences((v) => !v)}
              className={cn(
                'p-2 rounded-xl border transition-colors',
                showPreferences
                  ? 'bg-primary/20 border-primary/40 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
              title="إعدادات القراءة والخط"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>

        {/* Preferences Drawer */}
        {showPreferences && (
          <div className="border-t border-border bg-card/60 backdrop-blur-md px-4 sm:px-6 py-3 animate-in slide-in-from-top-2 duration-150">
            <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
              {/* Font size */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Type size={14} /> حجم الخط:
                </span>
                {(['sm', 'base', 'lg', 'xl'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setFontSize(sz)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg border uppercase font-mono font-medium transition-colors',
                      fontSize === sz
                        ? 'bg-primary text-primary-foreground border-primary'
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
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors',
                    hapticFeedback
                      ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  <Smartphone size={13} />
                  <span>الاهتزاز</span>
                </button>

                <button
                  onClick={toggleSound}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors',
                    soundEnabled
                      ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  <span>الصوت</span>
                </button>

                <button
                  onClick={toggleAutoAdvance}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors',
                    autoAdvance
                      ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  <span>التمرير التلقائي عند الإتمام</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Contextual Recommendation Banner */}
        {!searchQuery && !showFavoritesOnly && (
          <div className="relative overflow-hidden p-5 sm:p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                  {contextual.badge}
                </span>
                <span className="text-xs text-muted-foreground">{contextual.reason}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-arabic-quran text-foreground">
                {contextual.category}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSelectedCategory(contextual.category)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm',
                  (selectedCategory === contextual.category || !selectedCategory)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80 text-foreground'
                )}
              >
                {(selectedCategory === contextual.category || !selectedCategory) ? 'قيد القراءة الآن' : 'عرض الآن'}
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (showFavoritesOnly) setShowFavoritesOnly(false);
            }}
            placeholder="ابحث بالاسم أو النص (مثال: آية الكرسي، سيد الاستغفار، السفر)..."
            className="w-full pl-4 pr-11 py-3 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            dir="rtl"
          />
        </div>

        {/* Categories Horizontal Carousel */}
        {!searchQuery && !showFavoritesOnly && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">التصنيفات الشائعة</span>
              <span>{categories.length} تصنيف</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
              {categories.map((cat) => {
                const isSelected = (selectedCategory || contextual.category) === cat.name;
                const isContext = contextual.category === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => {
                      setSelectedCategory(cat.name);
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs whitespace-nowrap transition-all shrink-0',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-sm'
                        : 'bg-card hover:bg-secondary/60 text-muted-foreground hover:text-foreground border-border'
                    )}
                  >
                    {isContext && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                    <span>{cat.name}</span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                      isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    )}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Category Title & Progress Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-1 border-b border-border/60">
          <div>
            <h3 className="text-xl font-bold font-arabic-quran text-foreground flex items-center gap-2">
              <span>{activeCategoryTitle}</span>
              <span className="text-xs font-sans font-normal text-muted-foreground">
                ({displayedAzkar.length} ذكر)
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              مكتمل اليوم: {categoryStats.completed} من {categoryStats.total} ({categoryStats.percent}%)
            </p>
          </div>

          <div className="flex items-center gap-3">
            {categoryStats.completed > 0 && (
              <button
                onClick={handleResetCurrentCategory}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="تصفير تكرار هذا القسم اليوم"
              >
                <RotateCcw size={13} />
                <span>إعادة تصفير القسم</span>
              </button>
            )}

            {/* Visual mini bar */}
            <div className="w-28 sm:w-36 h-2 bg-secondary rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${categoryStats.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Azkar List Cards */}
        {displayedAzkar.length === 0 ? (
          <div className="text-center py-16 bg-card/40 rounded-2xl border border-dashed border-border space-y-3">
            <BookOpen size={36} className="mx-auto text-muted-foreground/60" />
            <p className="text-sm font-medium text-muted-foreground">
              {showFavoritesOnly ? 'لم تقم بحفظ أي أذكار في المفضلة بعد.' : 'لا توجد أذكار تطابق هذا البحث.'}
            </p>
            {showFavoritesOnly && (
              <p className="text-xs text-muted-foreground/80">
                انقر على أيقونة الإشارة المرجعية بجانب أي ذكر لإضافته هنا.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
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
