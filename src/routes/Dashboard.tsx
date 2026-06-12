import { format } from 'date-fns';
import { useUIStore, DASHBOARD_MODE_LABELS, type DashboardMode } from '../stores/useUIStore';
import { DashboardTactical } from '../components/dashboard/DashboardTactical';
import { DashboardQuickView } from '../components/dashboard/DashboardQuickView';
import { DashboardStrategic } from '../components/dashboard/DashboardStrategic';
import { DashboardAnnualReview } from '../components/dashboard/DashboardAnnualReview';

function ModeBody({ mode }: { mode: DashboardMode }) {
  switch (mode) {
    case 'quick_view':
      return <DashboardQuickView />;
    case 'tactical':
      return <DashboardTactical />;
    case 'strategic':
      return <DashboardStrategic />;
    case 'annual_review':
      return <DashboardAnnualReview />;
    default:
      return <DashboardQuickView />;
  }
}

export default function Dashboard() {
  const dashboardMode = useUIStore((s) => s.dashboardMode);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const label = dashboardMode === 'quick_view' ? getGreeting() : DASHBOARD_MODE_LABELS[dashboardMode];

  return (
    <div className="space-y-3 sm:space-y-4 overflow-x-hidden w-full max-w-full">
      <header className="rounded-lg border border-transparent px-1 py-1 -mx-1" aria-live="polite">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{label}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </header>
      <ModeBody mode={dashboardMode} />
    </div>
  );
}
