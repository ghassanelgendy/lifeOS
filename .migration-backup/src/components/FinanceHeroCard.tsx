import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

interface FinanceHeroCardProps {
  income: number;
  expenses: number;
  balance: number;
  privacyMode: boolean;
}

export function FinanceHeroCard({ income, expenses, balance, privacyMode }: FinanceHeroCardProps) {
  const isOverspending = balance < 0;
  const total = income + expenses;
  const incomeRatio = total > 0 ? (income / total) * 100 : 50;

  return (
    <div
      className="rounded-3xl p-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, var(--color-card) 0%, var(--color-secondary) 100%)',
        boxShadow: `0 0 0 1px ${isOverspending ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)'}, inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl"
        style={{
          background: isOverspending
            ? 'radial-gradient(circle, rgba(239,68,68,0.14), transparent 70%)'
            : 'radial-gradient(circle, rgba(34,197,94,0.10), transparent 70%)',
        }}
      />

      {/* Status badge */}
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full mb-3',
          isOverspending
            ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'
            : 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
        )}
      >
        {isOverspending ? <AlertTriangle size={10} /> : <CheckCircle size={10} />}
        {isOverspending ? 'Overspending' : 'Healthy Balance'}
      </span>

      {/* Label */}
      <p className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase mb-1">
        Net Balance
      </p>

      {/* Primary number */}
      <p
        className={cn(
          'text-[44px] font-black tabular-nums leading-none mb-1',
          isOverspending ? 'text-red-400' : 'text-green-400',
          privacyMode && 'blur-sm'
        )}
      >
        {isOverspending ? '−' : ''}{formatCurrency(Math.abs(balance))}
      </p>

      {/* Trend */}
      <div
        className={cn(
          'flex items-center gap-1 text-xs mb-5',
          isOverspending ? 'text-red-400/60' : 'text-green-400/60'
        )}
      >
        {isOverspending ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
        <span>{isOverspending ? 'Worse than last period' : 'Better than last period'}</span>
      </div>

      {/* Income / Expenses columns */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-background/40 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[11px] text-muted-foreground">Income</span>
          </div>
          <p className={cn('text-[15px] font-bold tabular-nums text-foreground', privacyMode && 'blur-sm')}>
            {formatCurrency(income)}
          </p>
        </div>
        <div className="bg-background/40 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[11px] text-muted-foreground">Expenses</span>
          </div>
          <p className={cn('text-[15px] font-bold tabular-nums text-foreground', privacyMode && 'blur-sm')}>
            {formatCurrency(expenses)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(Math.max(incomeRatio, 0), 100)}%`,
              background: 'linear-gradient(90deg, #22c55e, #16a34a)',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{Math.round(incomeRatio)}% in</span>
          <span>{Math.round(100 - incomeRatio)}% out</span>
        </div>
      </div>
    </div>
  );
}
