/**
 * Minimal full-screen loading. No minimum delay — disappears as soon as auth is ready.
 */
export function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <span className="text-xl font-semibold tracking-tight text-foreground">lifeOS</span>
    </div>
  );
}
