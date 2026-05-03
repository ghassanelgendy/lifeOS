import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useMotionValue, useSpring, animate } from 'framer-motion';
import {
  CheckSquare, Timer, BookOpen, Calendar, TrendingUp,
  Moon, BarChart2, Wallet, StickyNote, Flame, Layout, Activity,
  ArrowRight,
} from 'lucide-react';

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

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const rounded = useSpring(count, { stiffness: 60, damping: 20 });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, to, { duration: 1.8, ease: 'easeOut' });
    return controls.stop;
  }, [inView, count, to]);

  useEffect(() => {
    return rounded.on('change', (v) => {
      if (ref.current) ref.current.textContent = `${Math.round(v)}${suffix}`;
    });
  }, [rounded, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}

const FEATURES = [
  { icon: CheckSquare, title: 'Tasks', description: 'Smart task management with priorities, due dates, subtasks, and recurrence.', color: 'from-blue-500/20 to-blue-600/5' },
  { icon: Timer,       title: 'Focus',   description: 'Pomodoro timer to protect deep work time and track productive sessions.',   color: 'from-orange-500/20 to-orange-600/5' },
  { icon: Flame,       title: 'Habits',  description: 'Build streaks, track daily habits, and watch consistency compound.',         color: 'from-red-500/20 to-red-600/5' },
  { icon: Calendar,    title: 'Calendar', description: 'Week and month view with events, tasks, and upcoming deadlines at a glance.', color: 'from-violet-500/20 to-violet-600/5' },
  { icon: Layout,      title: 'Planner', description: 'Plan your week on a structured time-block grid to stay on top of everything.', color: 'from-purple-500/20 to-purple-600/5' },
  { icon: StickyNote,  title: 'Notes',   description: 'Capture ideas, meeting notes, and thoughts in rich Markdown notes.',          color: 'from-yellow-500/20 to-yellow-600/5' },
  { icon: Wallet,      title: 'Finance', description: 'Track income, expenses, and budgets so your money goes where you want.',     color: 'from-green-500/20 to-green-600/5' },
  { icon: Moon,        title: 'Sleep',   description: 'Log sleep sessions and review quality trends to protect your recovery.',      color: 'from-indigo-500/20 to-indigo-600/5' },
  { icon: Activity,    title: 'Health',  description: 'Log workouts, water intake, and physical activity all in one place.',        color: 'from-pink-500/20 to-pink-600/5' },
  { icon: BookOpen,    title: 'Academics', description: 'Track courses, assignments, grades, and study sessions effortlessly.',     color: 'from-cyan-500/20 to-cyan-600/5' },
  { icon: TrendingUp,  title: 'Screentime', description: 'Monitor daily screen usage and set healthy limits to reclaim focus.',    color: 'from-teal-500/20 to-teal-600/5' },
  { icon: BarChart2,   title: 'Analytics', description: "Bird's-eye view of your productivity, habits, and growth over time.",    color: 'from-emerald-500/20 to-emerald-600/5' },
];

const STATS = [
  { value: 12, suffix: '', label: 'Built-in modules' },
  { value: 100, suffix: '%', label: 'Free to use' },
  { value: 1, suffix: '', label: 'Dashboard for everything' },
];

const WORDS = ['organised', 'focused', 'consistent', 'in control'];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } }),
};

const cardVariant = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  show: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

function RotatingWord() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="relative inline-block overflow-hidden align-bottom">
      <motion.span
        key={index}
        initial={{ y: '110%', opacity: 0 }}
        animate={{ y: '0%', opacity: 1 }}
        exit={{ y: '-110%', opacity: 0 }}
        transition={{ duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-primary/60 whitespace-nowrap"
      >
        {WORDS[index]}
      </motion.span>
    </span>
  );
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      variants={cardVariant}
      custom={index % 6}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 overflow-hidden cursor-default"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className="relative flex gap-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-white/[0.06] group-hover:bg-white/[0.10] transition-colors flex items-center justify-center">
          <Icon size={18} className="text-white/70 group-hover:text-white transition-colors" />
        </div>
        <div>
          <p className="font-semibold text-sm text-white/90">{feature.title}</p>
          <p className="text-white/45 text-sm mt-0.5 leading-snug group-hover:text-white/60 transition-colors">{feature.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const statsRef = useRef(null);
  const statsInView = useInView(statsRef, { once: true });

  return (
    <div className="min-h-screen bg-[#08080c] text-white flex flex-col overflow-x-hidden overflow-y-auto selection:bg-primary/30">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-primary/10 blur-[120px]" />
        <motion.div animate={{ x: [0, -25, 0], y: [0, 30, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 4 }} className="absolute top-1/3 -right-60 w-[600px] h-[600px] rounded-full bg-violet-500/8 blur-[120px]" />
        <motion.div animate={{ x: [0, 20, 0], y: [0, -15, 0] }} transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 8 }} className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-blue-500/8 blur-[100px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#08080c]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">lifeOS</span>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">Sign in</Link>
            <Link to="/signup" className="px-4 py-1.5 rounded-lg text-sm bg-white text-black font-medium hover:bg-white/90 transition-colors">Get started</Link>
          </div>
        </div>
      </header>

      <main className="relative flex-1 overflow-y-auto">
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
          <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/50 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse inline-block" />
            Your personal operating system
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} initial="hidden" animate="show" className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            Stay <RotatingWord />
            <br />
            <span className="text-white/30">every single day.</span>
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} initial="hidden" animate="show" className="text-white/45 text-lg max-w-lg mx-auto mb-10 leading-relaxed">
            Tasks, habits, focus, finance, sleep, notes, and more — all connected in one personal dashboard.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show" className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-95 transition-all">
              Create free account
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-white/[0.08] text-sm text-white/90 hover:bg-white/[0.12] hover:text-white active:scale-95 transition-all">
              <GoogleIcon className="w-4 h-4" />
              Continue with Google
            </Link>
          </motion.div>

          <motion.p variants={fadeUp} custom={4} initial="hidden" animate="show" className="text-xs text-white/25 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-white/45 underline underline-offset-2 hover:text-white/70 transition-colors">Sign in</Link>
          </motion.p>
        </section>

        <section ref={statsRef} className="border-y border-white/[0.05] bg-white/[0.02]">
          <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-3 divide-x divide-white/[0.06]">
            {STATS.map(({ value, suffix, label }) => (
              <div key={label} className="text-center px-4">
                <p className="text-3xl sm:text-4xl font-bold text-white">
                  {statsInView ? <Counter to={value} suffix={suffix} /> : `0${suffix}`}
                </p>
                <p className="text-xs text-white/35 mt-1.5">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Everything in one place</h2>
            <p className="text-white/40 text-base max-w-md mx-auto">12 modules that cover every corner of your life — all talking to each other.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((feature, i) => <FeatureCard key={feature.title} feature={feature} index={i} />)}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.05] py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/25">
          <span className="font-semibold text-white/40">lifeOS</span>
          <div className="flex items-center gap-5">
            <a href="https://github.com/ghassanelgendy" target="_blank" rel="noreferrer" className="hover:text-white/60 transition-colors">GitHub</a>
            <a href="https://www.linkedin.com/in/ghassanelgendy/" target="_blank" rel="noreferrer" className="hover:text-white/60 transition-colors">LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
