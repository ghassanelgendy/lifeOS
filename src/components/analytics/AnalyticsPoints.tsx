import { useMemo } from 'react';
import { Coins, TrendingUp, TrendingDown, ClipboardCheck, Award, HeartHandshake, History, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import type { PointTransaction } from '../../types/schema';

interface AnalyticsPointsProps {
  transactions: PointTransaction[];
  rangeDays: number;
  rangeLabel: string;
  analyticsShowTips: boolean;
}

export function AnalyticsPoints({
  transactions,
  rangeDays,
  rangeLabel,
  analyticsShowTips,
}: AnalyticsPointsProps) {
  // Filter transactions within the selected range (7, 30, 90 days)
  const rangeTransactions = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    return transactions.filter(t => new Date(t.created_at) >= cutoff);
  }, [transactions, rangeDays]);

  // Aggregate points KPIs
  const kpis = useMemo(() => {
    let earned = 0;
    let spent = 0;
    let tasksEarned = 0;
    let habitsEarned = 0;
    let rescuesSpent = 0;
    let rewardsSpent = 0;

    for (const tx of rangeTransactions) {
      if (tx.amount > 0) {
        earned += tx.amount;
        if (tx.description.toLowerCase().includes('task')) {
          tasksEarned += tx.amount;
        } else if (tx.description.toLowerCase().includes('habit') || tx.description.toLowerCase().includes('streak') || tx.description.toLowerCase().includes('rescue')) {
          habitsEarned += tx.amount;
        }
      } else {
        const absVal = Math.abs(tx.amount);
        spent += absVal;
        if (tx.reference_type === 'habit_rescue' || tx.description.toLowerCase().includes('rescue')) {
          rescuesSpent += absVal;
        } else {
          rewardsSpent += absVal;
        }
      }
    }

    const net = earned - spent;

    return {
      earned,
      spent,
      net,
      tasksEarned,
      habitsEarned,
      rescuesSpent,
      rewardsSpent,
    };
  }, [rangeTransactions]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Overview Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
            <Coins size={20} />
          </div>
          <h2 className="text-xl font-bold">Points System</h2>
        </div>

        {analyticsShowTips && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">How Points Work</p>
            <p className="mt-2 text-sm text-muted-foreground">
              You earn points by completing tasks on time (+10 points) and logging scheduled habits. Habits points scale with streak lengths and adherence weight. 
              You can redeem your balance to buy custom rewards or rescue a broken habit streak.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Earned</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-500">+{kpis.earned}p</p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp size={14} className="text-emerald-500" />
              <span>Points gained in last {rangeDays} days</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Redeemed</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-rose-500">-{kpis.spent}p</p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingDown size={14} className="text-rose-500" />
              <span>Spent on rescues & custom rewards</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Net Change</p>
              <p className={cn(
                "mt-2 text-3xl font-bold tabular-nums",
                kpis.net >= 0 ? "text-amber-500" : "text-rose-400"
              )}>
                {kpis.net >= 0 ? '+' : ''}{kpis.net}p
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles size={14} className="text-amber-500" />
              <span>Net balance impact</span>
            </div>
          </div>
        </div>

        {/* Earning vs Spending breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Earnings Breakdown */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/10 flex items-center gap-2">
              <ClipboardCheck size={18} className="text-emerald-500" />
              <p className="font-semibold text-lg">Earnings Breakdown</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Task Completions</span>
                  <span className="font-semibold">{kpis.tasksEarned}p</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${kpis.earned > 0 ? (kpis.tasksEarned / kpis.earned) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Habits & Streaks</span>
                  <span className="font-semibold">{kpis.habitsEarned}p</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${kpis.earned > 0 ? (kpis.habitsEarned / kpis.earned) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Other Bonuses</span>
                  <span className="font-semibold">{Math.max(0, kpis.earned - kpis.tasksEarned - kpis.habitsEarned)}p</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${kpis.earned > 0 ? (Math.max(0, kpis.earned - kpis.tasksEarned - kpis.habitsEarned) / kpis.earned) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Spending Breakdown */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/10 flex items-center gap-2">
              <HeartHandshake size={18} className="text-rose-500" />
              <p className="font-semibold text-lg">Spending Breakdown</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Streak Rescues</span>
                  <span className="font-semibold">{kpis.rescuesSpent}p</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${kpis.spent > 0 ? (kpis.rescuesSpent / kpis.spent) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Custom Rewards</span>
                  <span className="font-semibold">{kpis.rewardsSpent}p</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${kpis.spent > 0 ? (kpis.rewardsSpent / kpis.spent) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Transaction History Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="p-2 bg-secondary/80 text-muted-foreground rounded-xl">
            <History size={20} />
          </div>
          <h2 className="text-xl font-bold">Transaction History</h2>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          {rangeTransactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No transactions recorded in this period.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20 font-sans">
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Description</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rangeTransactions.slice(0, 15).map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-secondary/15 transition-colors font-sans">
                    <td className="p-4 text-muted-foreground whitespace-nowrap">
                      {format(new Date(tx.created_at), 'MMM d, h:mm a')}
                    </td>
                    <td className="p-4 font-medium">{tx.description}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-semibold",
                        tx.reference_type === 'habit_rescue'
                          ? "bg-amber-500/10 text-amber-500"
                          : tx.amount < 0
                            ? "bg-rose-500/10 text-rose-500"
                            : "bg-emerald-500/10 text-emerald-500"
                      )}>
                        {tx.reference_type === 'habit_rescue' ? 'Rescue' : tx.amount < 0 ? 'Spent' : 'Earned'}
                      </span>
                    </td>
                    <td className={cn(
                      "p-4 text-right font-bold tabular-nums whitespace-nowrap",
                      tx.amount > 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}p
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      
    </div>
  );
}
