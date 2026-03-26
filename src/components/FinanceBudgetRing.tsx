import { cn, formatCurrency } from '../lib/utils';

interface FinanceBudgetRingProps {
  totalBudget: number;
  totalSpent: number;
  privacyMode: boolean;
}

export function FinanceBudgetRing({ totalBudget, totalSpent, privacyMode }: FinanceBudgetRingProps) {
  const pct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const remaining = totalBudget - totalSpent;
  const isOver = totalSpent > totalBudget && totalBudget > 0;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'linear-gradient(145deg, #121821 0%, #1a2230 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 24px rgba(0,0,0,0.35)',
      }}
    >
      <p className="text-sm font-semibold text-[#e6edf3] mb-4">Budget</p>
      <div className="flex items-center gap-6">
        {/* Donut ring */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="10"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={isOver ? '#f87171' : '#38bdf8'}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.7s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-xl font-black', isOver ? 'text-red-400' : 'text-sky-400')}>
              {Math.round(pct)}%
            </span>
            <span className="text-[9px] text-[#8899aa]">used</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-[10px] text-[#8899aa] uppercase tracking-wider mb-0.5">Spent</p>
            <p className={cn('text-base font-bold tabular-nums text-red-400', privacyMode && 'blur-sm')}>
              {formatCurrency(totalSpent)}
            </p>
          </div>
          <div className="h-px bg-white/[0.07]" />
          <div>
            <p className="text-[10px] text-[#8899aa] uppercase tracking-wider mb-0.5">Remaining</p>
            <p
              className={cn(
                'text-base font-bold tabular-nums',
                remaining >= 0 ? 'text-[#e6edf3]' : 'text-red-400',
                privacyMode && 'blur-sm'
              )}
            >
              {remaining < 0 ? '−' : ''}{formatCurrency(Math.abs(remaining))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
