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
  const blur = privacyMode && 'blur-sm';

  return (
    <div className="liquid-glass-card p-5">
      <p className="text-[13px] text-muted-foreground">Net balance</p>

      <p
        className={cn(
          'text-[34px] font-bold tabular-nums leading-tight',
          isOverspending ? 'text-destructive' : 'text-foreground',
          blur
        )}
      >
        {isOverspending ? '−' : ''}
        {formatCurrency(Math.abs(balance))}
      </p>

      {!!openingBalance && (
        <p className={cn('text-[13px] text-muted-foreground mt-0.5', blur)}>
          Carried over from last month: {formatCurrency(openingBalance)}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 divide-x divide-border">
        <div className="pr-4">
          <p className="text-[13px] text-muted-foreground">Income</p>
          <p className={cn('text-[17px] font-semibold tabular-nums', blur)}>{formatCurrency(income)}</p>
        </div>
        <div className="pl-4">
          <p className="text-[13px] text-muted-foreground">Expenses</p>
          <p className={cn('text-[17px] font-semibold tabular-nums', blur)}>{formatCurrency(expenses)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-[#30d158]"
            style={{
              width: `${Math.min(Math.max(incomeRatio, 0), 100)}%`,
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <div className="flex justify-between text-[13px] text-muted-foreground mt-1.5">
          <span>{Math.round(incomeRatio)}% in</span>
          <span>{Math.round(100 - incomeRatio)}% out</span>
        </div>
      </div>
    </div>
  );
}
