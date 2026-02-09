/**
 * Full-screen loading state. Uses --color-primary so it matches the user's accent theme.
 */
export function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden">
      {/* Soft glow from center using accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 45%, var(--color-primary) 0%, transparent 55%)`,
          opacity: 0.12,
        }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(var(--color-primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-10">
        {/* Wordmark: life + spinning O + S — spaced so the circle never overlaps text */}
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl font-bold tracking-tight text-foreground select-none">life</span>
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0"
            style={{ animationDuration: '0.9s' }}
            aria-hidden
          />
          <span className="text-3xl font-bold tracking-tight text-foreground select-none">S</span>
        </div>

        {/* Bouncing dots */}
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: '0.6s',
              }}
              aria-hidden
            />
          ))}
        </div>

        <p className="text-sm text-muted-foreground font-medium tracking-wide">
          Getting things ready
        </p>
      </div>

      {/* Bottom indeterminate bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{
            width: '36%',
            animation: 'loading-bar 1.4s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}
