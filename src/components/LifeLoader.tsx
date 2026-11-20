/**
 * Creative loading screen for the iOS (Capacitor) app.
 * A breathing core with three orbiting dots (tasks, habits, health) that
 * trace a ring as they pass, plus a softly pulsing wordmark.
 * Pure CSS, theme-aware (uses --color-primary), respects reduced motion.
 */
const STYLES = `
@keyframes lifeloader-orbit { to { transform: rotate(360deg); } }
@keyframes lifeloader-breathe {
  0%, 100% { transform: scale(0.85); opacity: 0.75; }
  50% { transform: scale(1.15); opacity: 1; }
}
@keyframes lifeloader-halo {
  0% { transform: scale(0.8); opacity: 0.35; }
  100% { transform: scale(1.9); opacity: 0; }
}
@keyframes lifeloader-fade {
  0%, 100% { opacity: 0.45; letter-spacing: 0.28em; }
  50% { opacity: 1; letter-spacing: 0.34em; }
}
.lifeloader-orbit { animation: lifeloader-orbit 2.4s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
.lifeloader-orbit-2 { animation-duration: 3.2s; animation-direction: reverse; }
.lifeloader-orbit-3 { animation-duration: 4.2s; }
.lifeloader-core { animation: lifeloader-breathe 2.4s ease-in-out infinite; }
.lifeloader-halo { animation: lifeloader-halo 2.4s ease-out infinite; }
.lifeloader-word { animation: lifeloader-fade 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .lifeloader-orbit, .lifeloader-core, .lifeloader-halo, .lifeloader-word { animation: none; }
}
`;

const ORBITS = [
  { cls: 'lifeloader-orbit', size: 'size-[5.5rem]', dot: 'size-2.5', opacity: 'opacity-100' },
  { cls: 'lifeloader-orbit lifeloader-orbit-2', size: 'size-[7.5rem]', dot: 'size-2', opacity: 'opacity-70' },
  { cls: 'lifeloader-orbit lifeloader-orbit-3', size: 'size-[9.5rem]', dot: 'size-1.5', opacity: 'opacity-45' },
];

export function LifeLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="min-h-screen w-full flex flex-col items-center justify-center bg-background overflow-hidden"
    >
      <style>{STYLES}</style>

      <div className="relative flex items-center justify-center size-40">
        <span className="lifeloader-halo absolute size-10 rounded-full bg-primary/30" />

        {ORBITS.map(({ cls, size, dot, opacity }) => (
          <span
            key={size}
            aria-hidden
            className={`${cls} absolute ${size} rounded-full border border-primary/15`}
          >
            <span
              className={`absolute left-1/2 top-0 ${dot} ${opacity} -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]`}
            />
          </span>
        ))}

        <span className="lifeloader-core size-5 rounded-full bg-primary shadow-[0_0_24px_var(--color-primary)]" />
      </div>

      <span className="lifeloader-word mt-8 text-sm font-semibold uppercase text-foreground/90">
        lifeOS
      </span>
    </div>
  );
}
