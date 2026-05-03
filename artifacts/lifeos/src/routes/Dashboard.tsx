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
  const label = DASHBOARD_MODE_LABELS[dashboardMode];

  return (
    <div className="space-y-3 sm:space-y-4">
      <header className="rounded-lg border border-transparent px-1 py-1 -mx-1" aria-live="polite">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{label}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </header>
      <ModeBody mode={dashboardMode} />
    </div>
  );
}
