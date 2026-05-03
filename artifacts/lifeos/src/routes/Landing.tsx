import { Link } from 'react-router-dom';
import {
  CheckSquare,
  Timer,
  BookOpen,
  Calendar,
  TrendingUp,
  Moon,
  BarChart2,
  Wallet,
  StickyNote,
  Flame,
  Layout,
  Activity,
} from 'lucide-react';
import { Button } from '../components/ui';

const FEATURES = [
  {
    icon: CheckSquare,
    title: 'Tasks',
    description: 'Manage tasks with priorities, due dates, recurrence, and subtasks.',
  },
  {
    icon: Timer,
    title: 'Focus',
    description: 'Pomodoro timer to stay in flow and track deep work sessions.',
  },
  {
    icon: Flame,
    title: 'Habits',
    description: 'Build streaks, track daily habits, and stay consistent.',
  },
  {
    icon: Calendar,
    title: 'Calendar',
    description: 'See your schedule with a week and month view, synced with events.',
  },
  {
    icon: Layout,
    title: 'Weekly Planner',
    description: 'Plan your week across a structured time-block grid.',
  },
  {
    icon: StickyNote,
    title: 'Notes',
    description: 'Capture thoughts and ideas in rich markdown notes.',
  },
  {
    icon: Wallet,
    title: 'Finance',
    description: 'Track income, expenses, and budgets to stay on top of your money.',
  },
  {
    icon: Moon,
    title: 'Sleep',
    description: 'Log sleep sessions and review quality trends over time.',
  },
  {
    icon: Activity,
    title: 'Health',
    description: 'Log workouts, water intake, and physical activity.',
  },
  {
    icon: BookOpen,
    title: 'Academics',
    description: 'Track courses, assignments, grades, and study sessions.',
  },
  {
    icon: TrendingUp,
    title: 'Screentime',
    description: 'Monitor daily screen usage and set healthy limits.',
  },
  {
    icon: BarChart2,
    title: 'Analytics',
    description: 'Get a bird\'s-eye view of your productivity and habits over time.',
  },
];

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-auto">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">lifeOS</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            Your personal operating system
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4">
            One place for your<br />
            <span className="text-primary">entire life</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Tasks, habits, focus, finance, sleep, notes, and more — all connected in a single personal dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="w-full sm:w-auto min-w-[160px]" asChild>
              <Link to="/signup">Create free account</Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[160px] gap-2" asChild>
              <Link to="/login">
                <GoogleIcon className="w-4 h-4" />
                Continue with Google
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Already have an account?{' '}
            <Link to="/login" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Sign in
            </Link>
          </p>
        </section>

        {/* Features grid */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold tracking-tight">Everything you need</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              12 built-in modules, all synced to your account.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-card p-5 flex gap-4 hover:border-border/80 transition-colors"
              >
                <div className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{title}</p>
                  <p className="text-muted-foreground text-sm mt-0.5 leading-snug">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-border bg-card/50">
          <div className="max-w-5xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight mb-3">Ready to get organised?</h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">
              Sign up for free and start building the life you want — one day at a time.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="w-full sm:w-auto min-w-[160px]" asChild>
                <Link to="/signup">Get started — it's free</Link>
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[160px]" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="font-medium">lifeOS</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ghassanelgendy"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/ghassanelgendy/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
