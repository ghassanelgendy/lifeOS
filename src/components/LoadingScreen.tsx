import { Spinner } from './ui/Spinner';

export function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
      <div className="flex flex-col items-center gap-4 relative z-10">
        <div className="relative flex items-center justify-center size-14">
          <Spinner size="xl" className="absolute inset-0" decorative />
          <div className="size-5 rounded-full bg-primary" />
        </div>

        <div className="flex items-center gap-1 mt-1">
          <span className="text-lg font-bold tracking-wider uppercase text-foreground/90">
            lifeOS
          </span>
        </div>
      </div>
    </div>
  );
}
