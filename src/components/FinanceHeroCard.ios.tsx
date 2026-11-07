import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

interface FinanceHeroCardProps {
  income: number;
  expenses: number;
  balance: number;
  openingBalance?: number;
  privacyMode: boolean;
}

export function FinanceHeroCard({ income, expenses, balance, openingBalance, privacyMode }: FinanceHeroCardProps) {
  const isOverspending = balance < 0;
  const total = income + expenses;
  const incomeRatio = total > 0 ? (income / total) * 100 : 50;

  return (
    <div
      className={cn(
        "liquid-glass-card p-5 relative overflow-hidden transition-all duration-300",
        isOverspending ? "border-red-500/25" : "border-green-500/25"
      )}
    >

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

      {!!openingBalance && (
        <p className={cn('text-[11px] text-muted-foreground/70 -mt-0.5 mb-4', privacyMode && 'blur-sm')}>
          Carried over from last month: {formatCurrency(openingBalance)}
        </p>
      )}

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
        <div className="bg-black/15 dark:bg-foreground/5 rounded-2xl p-3 border border-border">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[11px] text-muted-foreground">Income</span>
          </div>
          <p className={cn('text-[15px] font-bold tabular-nums text-foreground', privacyMode && 'blur-sm')}>
            {formatCurrency(income)}
          </p>
        </div>
        <div className="bg-black/15 dark:bg-foreground/5 rounded-2xl p-3 border border-border">
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
        <div className="h-2 rounded-full bg-foreground/5 overflow-hidden border border-border">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(Math.max(incomeRatio, 0), 100)}%`,
              background: '#30d158',
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
