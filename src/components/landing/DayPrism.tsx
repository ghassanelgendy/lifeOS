/**
 * "A day in lifeOS": a pinned section. While it is pinned, scrolling turns a
 * six-sided prism whose faces are live module fragments, and the chapter
 * list beside it follows. Clicking a chapter scrolls to its face.
 *
 * Under prefers-reduced-motion nothing is pinned or turned: the five chapters
 * are laid out as a plain grid.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue,
} from 'framer-motion';
import { cn } from '../../lib/utils';
import { FinanceMock, FocusMock, PrayerMock, QuranMock, SleepMock, TasksMock } from './mocks';
import { usePublicLang } from './i18n';

type Chapter = { time: string; module: string; title: string; body: string };

// One live fragment per chapter, in the same order as the copy's chapters.
const MOCKS: ReactNode[] = [
  <PrayerMock key="prayer" />, <TasksMock key="tasks" />, <FocusMock key="focus" autoStart={false} />,
  <FinanceMock key="finance" />, <QuranMock key="quran" />, <SleepMock key="sleep" />,
];

const N = MOCKS.length;
const STEP = 360 / N;
const LAST = N - 1;

function useFaceSize() {
  const [size, setSize] = useState({ w: 420, h: 330 });
  useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const w = Math.max(260, Math.min(vw >= 1024 ? 440 : 400, vw - 56));
      setSize({ w, h: vw >= 1024 ? 340 : 300 });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return size;
}

function Face({ index, position, w, h, radius, flip, children }: {
  index: number; position: MotionValue<number>; w: number; h: number; radius: number; flip: boolean; children: ReactNode;
}) {
  // Faces dim as they turn away from the viewer.
  const opacity = useTransform(position, (p) => 1 - Math.min(1, Math.abs(p - index)) * 0.7);
  return (
    <div
      className="absolute left-0 top-0 rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-raised)]"
      style={{
        width: w, height: h,
        transform: `rotateY(${(flip ? -index : index) * STEP}deg) translateZ(${radius}px)`,
        backfaceVisibility: 'hidden',
      }}
    >
      <motion.div className="size-full p-5" style={{ opacity }}>{children}</motion.div>
    </div>
  );
}

function ChapterHead({ c, active }: { c: Chapter; active: boolean }) {
  return (
    <>
      <span className="flex items-center gap-3 text-[13px] font-semibold">
        <span className={active ? 'text-[var(--lp-accent)]' : 'text-[var(--lp-ink-3)]'}>{c.time}</span>
        <span className="text-[var(--lp-ink-3)]">{c.module}</span>
      </span>
      <span className={cn('mt-0.5 block text-[20px] font-bold leading-tight tracking-tight', active ? 'text-[var(--lp-ink)]' : 'text-[var(--lp-ink-3)]')}>
        {c.title}
      </span>
    </>
  );
}

export function DayPrism({ scroller, heading }: { scroller: RefObject<HTMLDivElement | null>; heading: ReactNode }) {
  const reduce = useReducedMotion();
  const { t, rtl } = usePublicLang();
  const CHAPTERS: Chapter[] = t.day.chapters;
  const section = useRef<HTMLElement>(null);
  const { w, h } = useFaceSize();
  const radius = Math.round(w / (2 * Math.tan(Math.PI / N)));
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({ container: scroller, target: section, offset: ['start start', 'end end'] });
  const position = useSpring(useTransform(scrollYProgress, [0, 1], [0, LAST]), { stiffness: 110, damping: 24, mass: 0.5 });
  const rotateY = useTransform(position, (p) => (rtl ? p : -p) * STEP);
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = Math.min(LAST, Math.max(0, Math.round(v * LAST)));
    setActive((cur) => (cur === next ? cur : next));
  });

  const goTo = (i: number) => {
    const sc = scroller.current;
    const el = section.current;
    if (!sc || !el) return;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    const span = el.offsetHeight - sc.clientHeight;
    sc.scrollTo({ top: top + (i / LAST) * span, behavior: 'smooth' });
  };

  if (reduce) {
    return (
      <section id="day" ref={section} className="scroll-mt-16 px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-6xl">
          {heading}
          <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CHAPTERS.map((c, i) => (
              <li key={c.module} className="rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-raised)] p-5">
                <ChapterHead c={c} active />
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--lp-ink-2)]">{c.body}</p>
                <div className="mt-5 h-[260px]" dir="ltr">{MOCKS[i]}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section id="day" ref={section} className="relative overflow-x-clip" style={{ height: `${N * 72}vh` }}>
      <div className="sticky top-0 flex h-[100dvh] flex-col justify-center px-5 pb-6 pt-20 sm:px-8">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-12">
          <div>
            {heading}

            {/* chapter list: full list on desktop, the active chapter only on small screens */}
            <ol className="relative mt-6 hidden lg:block">
              <span aria-hidden className="absolute bottom-2 start-0 top-2 w-px bg-[var(--lp-line)]" />
              <motion.span aria-hidden className="absolute start-0 top-2 w-px origin-top bg-[var(--lp-accent)]" style={{ height: 'calc(100% - 16px)', scaleY: bar }} />
              {CHAPTERS.map((c, i) => (
                <li key={c.module}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={active === i ? 'step' : undefined}
                    className="block w-full rounded-[10px] py-2 pe-3 ps-6 text-start transition-colors duration-150 hover:bg-[var(--lp-hover)]"
                  >
                    <ChapterHead c={c} active={active === i} />
                    <motion.span
                      initial={false}
                      animate={{ height: active === i ? 'auto' : 0, opacity: active === i ? 1 : 0 }}
                      transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
                      className="block overflow-hidden"
                    >
                      <span className="block max-w-[44ch] pt-2 text-[15px] leading-relaxed text-[var(--lp-ink-2)]">{c.body}</span>
                    </motion.span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-6 lg:hidden" aria-live="polite">
              <ChapterHead c={CHAPTERS[active]} active />
              <p className="mt-2 min-h-[3.2em] text-[15px] leading-relaxed text-[var(--lp-ink-2)]">{CHAPTERS[active].body}</p>
              <div className="mt-4 flex gap-1.5">
                {CHAPTERS.map((c, i) => (
                  <button
                    key={c.module}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`${t.day.show} ${c.module}`}
                    className="flex h-11 flex-1 items-center"
                  >
                    <span className={cn('h-1 w-full rounded-full transition-colors duration-200', i <= active ? 'bg-[var(--lp-accent)]' : 'bg-[var(--lp-line)]')} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* the prism */}
          <div className="flex justify-center" dir="ltr">
            {/* perspective must sit on the direct parent of the turning element */}
            <div style={{ width: w, height: h, perspective: 1400 }}>
              <motion.div
                className="relative size-full"
                style={{ transformStyle: 'preserve-3d', z: -radius, rotateY }}
              >
                {CHAPTERS.map((c, i) => (
                  <Face key={c.module} index={i} position={position} w={w} h={h} radius={radius} flip={rtl}>
                    {MOCKS[i]}
                  </Face>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
