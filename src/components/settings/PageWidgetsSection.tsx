import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  ExternalLink,
  Eye,
  EyeOff,
  Gauge,
  GripVertical,
  LayoutGrid,
  ListChecks,
  Moon,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../lib/utils';
import { PAGE_WIDGET_DEFAULTS, useUIStore } from '../../stores/useUIStore';

export type LayoutWidgetPage = 'habits' | 'sleep';

interface WidgetMeta {
  label: string;
  description: string;
  icon: typeof BarChart3;
}

const PAGE_META: Record<
  LayoutWidgetPage,
  {
    title: string;
    subtitle: string;
    href: string;
    essentialIds: string[];
    widgets: Record<string, WidgetMeta>;
  }
> = {
  habits: {
    title: 'Habits',
    subtitle: 'Works across mobile, tablet, and desktop',
    href: '/habits',
    essentialIds: ['prayer', 'today'],
    widgets: {
      stats: {
        label: 'Stats cards',
        description: 'Today on-track count, weekly adherence %, best streak, and active count',
        icon: BarChart3,
      },
      prayer: {
        label: 'Prayer tracking',
        description: 'Daily 5 prayers status, Qadaa counter, and missed prayer backlog',
        icon: Compass,
      },
      weekly: {
        label: 'This week grid',
        description: '7-day visual completion grid across all scheduled habits',
        icon: CalendarDays,
      },
      today: {
        label: "Today's habits",
        description: 'Check-off list of your Jannah, Detox, and daily routines',
        icon: CheckCircle2,
      },
    },
  },
  sleep: {
    title: 'Sleep',
    subtitle: 'Applies to Sleep cards and charts on every device',
    href: '/sleep',
    essentialIds: ['score', 'sessions'],
    widgets: {
      score: {
        label: 'Last night summary',
        description: 'Total hours asleep, efficiency score, stage ring, and duration bars',
        icon: Moon,
      },
      timeline: {
        label: 'Sleep stages hypnogram',
        description: 'Continuous Deep, Core, REM, and Awake timeline through the night',
        icon: Activity,
      },
      metrics: {
        label: '7-day rolling averages',
        description: 'Average duration, deep continuity score, and Deep/REM percentages',
        icon: Gauge,
      },
      weekly: {
        label: '30-day trends chart',
        description: 'Night-by-night bar chart against your 30-day average line',
        icon: BarChart3,
      },
      sessions: {
        label: 'Recent sessions list',
        description: 'Tap any logged night (7d or 30d) to inspect individual stage details',
        icon: ListChecks,
      },
    },
  },
};

export function PageWidgetsSection({ variant = 'web' }: { variant?: 'web' | 'ios' }) {
  const [searchParams] = useSearchParams();
  const requestedPage = searchParams.get('widgets');

  const [selectedPage, setSelectedPage] = useState<LayoutWidgetPage>(() =>
    requestedPage === 'sleep' ? 'sleep' : 'habits'
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    if (requestedPage === 'habits' || requestedPage === 'sleep') {
      setSelectedPage(requestedPage);
    }
  }, [requestedPage]);

  const {
    pageWidgetOrder,
    pageWidgetVisible,
    setPageWidgetOrder,
    setPageWidgetVisible,
    togglePageWidget,
    movePageWidget,
    resetPageWidgets,
  } = useUIStore();

  const meta = PAGE_META[selectedPage];
  const defaultOrder = PAGE_WIDGET_DEFAULTS[selectedPage] ?? [];
  const savedOrder = pageWidgetOrder?.[selectedPage] ?? [];
  const order = [
    ...savedOrder.filter((id) => defaultOrder.includes(id)),
    ...defaultOrder.filter((id) => !savedOrder.includes(id)),
  ];

  const isWidgetVisible = (id: string) => pageWidgetVisible?.[selectedPage]?.[id] !== false;
  const visibleCount = order.filter(isWidgetVisible).length;
  const allHidden = visibleCount === 0;
  const allShown = visibleCount === order.length;

  const handleShowAll = () => {
    const allTrue = order.reduce<Record<string, boolean>>((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
    setPageWidgetVisible(selectedPage, allTrue);
  };

  const handleCompactPreset = () => {
    const essential = new Set(meta.essentialIds);
    const nextVisible = order.reduce<Record<string, boolean>>((acc, id) => {
      acc[id] = essential.has(id);
      return acc;
    }, {});
    setPageWidgetVisible(selectedPage, nextVisible);
  };

  const handleDropOn = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const next = [...order];
    const fromIdx = next.indexOf(draggedId);
    const toIdx = next.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedId(null);
      return;
    }
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggedId);
    setPageWidgetOrder(selectedPage, next);
    setDraggedId(null);
  };

  return (
    <section
      className={cn(
        'overflow-hidden',
        variant === 'ios'
          ? 'liquid-glass-card'
          : 'rounded-xl border border-border bg-card'
      )}
    >
      <div className="p-4 border-b border-border flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid size={16} className="text-primary shrink-0" />
            <h2 className="font-semibold">Page Widgets</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Show, hide, or drag to reorder sections inside Habits and Sleep.
          </p>
        </div>

        <Link
          to={meta.href}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors"
        >
          Open {meta.title}
          <ExternalLink size={12} />
        </Link>
      </div>

      <div className="p-4 space-y-3">
        {/* Segmented page selector + quick presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <div
            className="inline-flex rounded-xl border border-border bg-secondary/40 p-1 gap-1"
            role="tablist"
            aria-label="Layout page"
          >
            {(['habits', 'sleep'] as const).map((pageKey) => {
              const pageDefaults = PAGE_WIDGET_DEFAULTS[pageKey] ?? [];
              const shownOnPage = pageDefaults.filter(
                (id) => pageWidgetVisible?.[pageKey]?.[id] !== false
              ).length;
              const active = selectedPage === pageKey;
              return (
                <button
                  key={pageKey}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedPage(pageKey)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>{PAGE_META[pageKey].title}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                      active
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {shownOnPage}/{pageDefaults.length}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!allShown && (
              <Button variant="outline" size="sm" onClick={handleShowAll} className="gap-1">
                <Eye size={13} />
                Show All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompactPreset}
              className="gap-1"
              title="Keep only core action widgets visible"
            >
              <Sparkles size={13} />
              Compact
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetPageWidgets(selectedPage)}
              className="gap-1"
            >
              <RotateCcw size={13} />
              Reset
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {meta.subtitle} — drag cards or use arrows to reorder.
        </p>

        {allHidden && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <EyeOff size={14} />
              All {meta.title} sections are currently hidden.
            </span>
            <Button size="sm" variant="outline" onClick={handleShowAll}>
              Show All
            </Button>
          </div>
        )}

        {/* Widget cards */}
        <div className="space-y-2">
          {order.map((id, index) => {
            const visible = isWidgetVisible(id);
            const info = meta.widgets[id];
            const Icon = info?.icon ?? LayoutGrid;
            const label = info?.label ?? id;
            const description = info?.description ?? '';

            return (
              <div
                key={id}
                draggable
                onDragStart={() => setDraggedId(id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOn(id)}
                onDragEnd={() => setDraggedId(null)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all',
                  visible
                    ? 'border-border bg-card shadow-xs'
                    : 'border-border/50 bg-secondary/20 opacity-70',
                  draggedId === id && 'ring-2 ring-primary/50 scale-[0.99]'
                )}
              >
                <span
                  className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
                  title="Drag to reorder"
                  aria-hidden="true"
                >
                  <GripVertical size={16} />
                </span>

                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                    visible
                      ? 'border-primary/25 bg-primary/10 text-primary'
                      : 'border-border bg-secondary/40 text-muted-foreground'
                  )}
                >
                  <Icon size={15} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={visible}
                    aria-label={label}
                    onClick={() => togglePageWidget(selectedPage, id)}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      visible ? 'bg-primary' : 'bg-secondary'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
                        visible ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => movePageWidget(selectedPage, id, 'up')}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30"
                      title="Move up"
                      aria-label={`Move ${label} up`}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePageWidget(selectedPage, id, 'down')}
                      disabled={index === order.length - 1}
                      className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30"
                      title="Move down"
                      aria-label={`Move ${label} down`}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
