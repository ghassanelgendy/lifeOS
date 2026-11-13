/**
 * The hero's app frame: the lifeOS dashboard drawn as live HTML, standing in
 * 3D. It starts tipped back and lies flat as the page scrolls, and leans a
 * few degrees toward the pointer. Two tiles float above it on their own depth.
 */
import { useRef, type RefObject } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import {
  BarChart3, BookOpen, Calendar, Check, CheckSquare, Coins, FileText, Flame, LayoutDashboard, Moon, Wallet,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { FinanceMock, FocusMock, HabitsMock, PrayerStrip, SleepMock, TasksMock, panel } from './mocks';

const NAV = [
  { icon: LayoutDashboard, name: 'Dashboard', active: true },
  { icon: CheckSquare, name: 'Tasks' },
  { icon: Flame, name: 'Habits' },
  { icon: BookOpen, name: 'Quran' },
  { icon: Calendar, name: 'Calendar' },
  { icon: Wallet, name: 'Finance' },
  { icon: Moon, name: 'Sleep' },
  { icon: FileText, name: 'Notes' },
  { icon: BarChart3, name: 'Analytics' },
];

const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());

export function HeroFrame({ scroller }: { scroller: RefObject<HTMLDivElement | null> }) {
  const reduce = useReducedMotion();
  const zone = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scroller });

  // Scroll: tipped back at the top of the page, flat after ~520px.
  const tip = useSpring(useTransform(scrollY, [0, 520], [22, 0], { clamp: true }), { stiffness: 140, damping: 26, mass: 0.5 });
  const scale = useSpring(useTransform(scrollY, [0, 520], [0.94, 1], { clamp: true }), { stiffness: 140, damping: 26, mass: 0.5 });
  const lift = useTransform(scrollY, [0, 520], [110, 36], { clamp: true });
  const liftFar = useTransform(lift, (v) => v * 1.5);

  // Pointer: a small lean toward the cursor.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const leanY = useSpring(useTransform(px, [-0.5, 0.5], [-7, 7]), { stiffness: 120, damping: 18 });
  const leanX = useSpring(useTransform(py, [-0.5, 0.5], [4, -4]), { stiffness: 120, damping: 18 });
  const rotateX = useTransform([tip, leanX], ([a, b]: number[]) => a + b);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse' || !zone.current) return;
    const r = zone.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { px.set(0); py.set(0); };

  return (
    // The frame shows the app as it is (English, left-to-right), whatever the page language.
    <div ref={zone} dir="ltr" onPointerMove={onMove} onPointerLeave={onLeave} className="relative" style={{ perspective: 1800 }}>
      <motion.div
        className="relative"
        style={reduce ? undefined : { rotateX, rotateY: leanY, scale, transformStyle: 'preserve-3d', transformOrigin: '50% 0%' }}
      >
        <div className="overflow-hidden rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-bg)] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)]">
          {/* window bar */}
          <div className="flex h-10 items-center gap-2 border-b border-[var(--lp-line)] bg-[var(--lp-raised)] px-4">
            <span className="size-2.5 rounded-full bg-[var(--lp-line)]" />
            <span className="size-2.5 rounded-full bg-[var(--lp-line)]" />
            <span className="size-2.5 rounded-full bg-[var(--lp-line)]" />
            <span className="ml-3 font-mono text-[12px] text-[var(--lp-ink-3)]">lifeOS / dashboard</span>
          </div>

          <div className="flex">
            <nav aria-hidden className="hidden w-[188px] shrink-0 flex-col gap-0.5 border-r border-[var(--lp-line)] bg-[var(--lp-raised)] p-3 md:flex">
              {NAV.map(({ icon: Icon, name, active }) => (
                <span
                  key={name}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[14px]',
                    active ? 'bg-[var(--lp-sunken)] font-semibold text-[var(--lp-ink)]' : 'text-[var(--lp-ink-3)]',
                  )}
                >
                  <Icon size={15} />
                  {name}
                </span>
              ))}
            </nav>

            <div className="min-w-0 flex-1 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-bold tracking-tight text-[var(--lp-ink)]">Today</p>
                  <p className="text-[12px] text-[var(--lp-ink-3)]">{today}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--lp-line)] bg-[var(--lp-raised)] px-3 py-1 text-[12px] font-semibold tabular-nums text-[var(--lp-warn)]">
                  <Coins size={13} /> 120 XP
                </span>
              </div>

              <div className="mb-3"><PrayerStrip /></div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className={cn(panel, 'p-4 md:col-span-5 md:h-[264px]')}><TasksMock /></div>
                <div className={cn(panel, 'p-4 md:col-span-3 md:h-[264px]')}><FocusMock /></div>
                <div className={cn(panel, 'hidden p-4 md:col-span-4 md:block md:h-[264px]')}><HabitsMock /></div>
                <div className={cn(panel, 'hidden p-4 md:col-span-7 md:block md:h-[212px]')}><FinanceMock /></div>
                <div className={cn(panel, 'hidden p-4 md:col-span-5 md:block md:h-[212px]')}><SleepMock /></div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating tiles, each on its own depth. They hang off the frame's outer corners
            (the empty foot of the sidebar, and the window bar) so they never cover content. */}
        {!reduce && (
          <>
            <motion.div
              aria-hidden
              style={{ z: lift }}
              className="absolute -left-16 bottom-10 hidden w-[196px] items-center gap-3 rounded-[14px] border border-[var(--lp-line)] bg-[var(--lp-raised)] px-4 py-3 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.9)] xl:flex"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--lp-sunken)] text-[var(--lp-warn)]"><Flame size={17} /></span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[var(--lp-ink)]">12 day streak</span>
                <span className="block truncate text-[12px] text-[var(--lp-ink-3)]">Morning azkar</span>
              </span>
            </motion.div>
            <motion.div
              aria-hidden
              style={{ z: liftFar }}
              className="absolute -right-14 top-14 hidden w-[196px] items-center gap-3 rounded-[14px] border border-[var(--lp-line)] bg-[var(--lp-raised)] px-4 py-3 shadow-[0_24px_48px_-16px_rgb(0_0_0/0.9)] xl:flex"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--lp-sunken)] text-[var(--lp-ok)]"><Check size={17} strokeWidth={3} /></span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[var(--lp-ink)]">Fajr, on time</span>
                <span className="block text-[12px] tabular-nums text-[var(--lp-ink-3)]">+20 XP earned</span>
              </span>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
