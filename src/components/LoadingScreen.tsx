export function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background soft glowing orb */}
      <div className="absolute w-[200px] h-[200px] rounded-full bg-primary/10 blur-[50px] animate-pulse duration-[3000ms]" />

      <div className="flex flex-col items-center gap-4 relative z-10">
        {/* Animated loader graphic */}
        <div className="relative flex items-center justify-center size-14">
          {/* Outer spinning dash ring */}
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" style={{ animationDuration: '1.2s' }} />
          
          {/* Inner pulsing core */}
          <div className="size-5 rounded-full bg-primary shadow-lg shadow-primary/20 animate-pulse" style={{ animationDuration: '1.5s' }} />
        </div>

        {/* Text */}
        <div className="flex items-center gap-1 mt-1">
          <span className="text-lg font-bold tracking-wider uppercase text-foreground/90">
            lifeOS
          </span>
        </div>
      </div>
    </div>
  );
}
