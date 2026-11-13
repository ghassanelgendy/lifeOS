import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { cn } from './ui/cn';

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
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-4">
      {/* Top Header: Badge & Trend */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-md border',
            isOverspending
              ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
          )}
        >
          {isOverspending ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
          {isOverspending ? 'Overspending' : 'Healthy Balance'}
        </span>

        <div
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            isOverspending ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {isOverspending ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
          <span>{isOverspending ? 'Worse than last period' : 'Better than last period'}</span>
        </div>
      </div>

      {/* Primary Balance */}
      <div>
        <p className="text-caption font-semibold text-muted-foreground mb-1">
          Net Balance
        </p>
        <p
          className={cn(
            'text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight leading-none',
            isOverspending ? 'text-red-400' : 'text-green-400',
            privacyMode && 'blur-sm'
          )}
        >
          {isOverspending ? '−' : ''}{formatCurrency(Math.abs(balance))}
        </p>

        {!!openingBalance && (
          <p className={cn('text-xs text-muted-foreground mt-1.5', privacyMode && 'blur-sm')}>
            Carried over from last month: {formatCurrency(openingBalance)}
          </p>
        )}
      </div>

      {/* Income / Expenses 2-Column Metric Strip */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="bg-muted/20 border border-border/60 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-caption font-medium text-muted-foreground">Income</span>
          </div>
          <p className={cn('text-base font-bold tabular-nums text-foreground', privacyMode && 'blur-sm')}>
            {formatCurrency(income)}
          </p>
        </div>

        <div className="bg-muted/20 border border-border/60 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-caption font-medium text-muted-foreground">Expenses</span>
          </div>
          <p className={cn('text-base font-bold tabular-nums text-foreground', privacyMode && 'blur-sm')}>
            {formatCurrency(expenses)}
          </p>
        </div>
      </div>

      {/* Cashflow Ratio Progress Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{
              width: `${Math.min(Math.max(incomeRatio, 0), 100)}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-caption text-muted-foreground font-medium tabular-nums">
          <span>{Math.round(incomeRatio)}% in</span>
          <span>{Math.round(100 - incomeRatio)}% out</span>
        </div>
      </div>
    </div>
  );
}
