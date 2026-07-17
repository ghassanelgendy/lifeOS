import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Coins,
  Plus,
  Trash2,
  Gift,
  History,
  Settings,
  Sparkles,
  Award,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  usePointsBalance,
  usePointsTransactions,
  useCustomRewards,
  useCreateCustomReward,
  useDeleteCustomReward,
  useRedeemReward,
  getPointsConfig,
  savePointsConfig,
} from '../hooks/usePoints';
import type { PointsConfig } from '../hooks/usePoints';
import { Modal } from '../components/ui';

export default function Points() {
  const queryClient = useQueryClient();
  const balance = usePointsBalance();
  const { data: transactions = [], isLoading: txsLoading } = usePointsTransactions();
  const { data: rewards = [], isLoading: rewardsLoading } = useCustomRewards();
  
  const createReward = useCreateCustomReward();
  const deleteReward = useDeleteCustomReward();
  const redeemReward = useRedeemReward();

  // Settings state
  const [config, setConfig] = useState<PointsConfig>(getPointsConfig);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // New reward state
  const [newTitle, setNewTitle] = useState('');
  const [newCost, setNewCost] = useState<number | ''>('');
  const [newIcon, setNewIcon] = useState('gift');
  const [isAddingReward, setIsAddingReward] = useState(false);

  // Status/Error state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Calculate week stats (July 1st, 2026 cutoff checked in hooks)
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const weekEarned = transactions
    .filter((tx) => new Date(tx.created_at) >= oneWeekAgo && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const weekSpent = Math.abs(
    transactions
      .filter((tx) => new Date(tx.created_at) >= oneWeekAgo && tx.amount < 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCost) return;
    try {
      setErrorMsg(null);
      await createReward.mutateAsync({
        title: newTitle.trim(),
        cost: Number(newCost),
        icon: newIcon,
      });
      setNewTitle('');
      setNewCost('');
      setIsAddingReward(false);
      showNotification('Reward created successfully!', false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create reward');
    }
  };

  const handleDeleteReward = async (id: string) => {
    try {
      setErrorMsg(null);
      await deleteReward.mutateAsync(id);
      showNotification('Reward deleted successfully!', false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete reward');
    }
  };

  const handleRedeemReward = async (reward: any) => {
    try {
      setErrorMsg(null);
      await redeemReward.mutateAsync(reward);
      showNotification(`Redeemed "${reward.title}"! -${reward.cost} pts`, false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to redeem reward');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    savePointsConfig(config);
    setIsSettingsOpen(false);
    showNotification('Points config saved!', false);
    // Invalidate queries to update rescue calculations
    queryClient.invalidateQueries({ queryKey: ['points-transactions'] });
  };

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      {/* Alert Notifications */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertTriangle className="size-4 shrink-0" />
          <p className="font-semibold">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400 animate-in fade-in slide-in-from-top-4 duration-300">
          <Sparkles className="size-4 shrink-0" />
          <p className="font-semibold">{successMsg}</p>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Points &amp; Gamification</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Earn points by crushing tasks/habits. Redeem them for real life rewards.</p>
        </div>
      </div>

      {/* Balance Card & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between md:col-span-1 min-h-[160px]">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Coins className="size-24 text-amber-400" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Points Balance</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold tracking-tight text-amber-400 tabular-nums">
                {balance.toLocaleString()}
              </span>
              <span className="text-sm font-medium text-muted-foreground">pts</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-4">
            <Award className="size-3.5 text-amber-500/80" />
            Started July 1st, 2026
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between min-h-[160px]">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Earned (Last 7 Days)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold tracking-tight text-emerald-400 tabular-nums">
                +{weekEarned.toLocaleString()}
              </span>
              <span className="text-sm font-medium text-muted-foreground">pts</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-4">
            <TrendingUp className="size-3.5 text-emerald-500/80" />
            Completing tasks/habits on time
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between min-h-[160px]">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spent (Last 7 Days)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold tracking-tight text-rose-400 tabular-nums">
                -{weekSpent.toLocaleString()}
              </span>
              <span className="text-sm font-medium text-muted-foreground">pts</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-4">
            <Gift className="size-3.5 text-rose-500/80" />
            Redeeming rewards &amp; rescuing tasks
          </div>
        </div>
      </div>

      {/* Rewards Store & Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rewards Store Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-1.5">
              <Gift className="size-5 text-amber-400" />
              Rewards Store
            </h2>
            <button
              onClick={() => setIsAddingReward(!isAddingReward)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-95 active:scale-95 transition-all shadow-sm"
            >
              <Plus className="size-3.5" />
              Add Reward
            </button>
          </div>

          {/* Add Reward Form */}
          {isAddingReward && (
            <form onSubmit={handleCreateReward} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-md animate-in slide-in-from-top-2 duration-300">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Reward</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Reward title (e.g., Cheat Meal)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="Cost (e.g., 200)"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value === '' ? '' : Number(e.target.value))}
                  className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingReward(false)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-95"
                >
                  Create Reward
                </button>
              </div>
            </form>
          )}

          {rewardsLoading ? (
            <p className="text-sm text-muted-foreground">Loading rewards...</p>
          ) : rewards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card/30">
              <Gift className="size-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-semibold">No custom rewards set yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add rewards you can claim as treats when you earn enough points.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rewards.map((reward) => {
                const canAfford = balance >= reward.cost;
                return (
                  <div
                    key={reward.id}
                    className="group relative rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-border transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500 group-hover:scale-110 transition-transform">
                          <Gift className="size-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight text-foreground">{reward.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 tabular-nums font-semibold flex items-center gap-1">
                            <Coins className="size-3 text-amber-400" />
                            {reward.cost} pts
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteReward(reward.id)}
                        className="rounded-lg p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete reward"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleRedeemReward(reward)}
                      disabled={!canAfford}
                      className={cn(
                        'w-full mt-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1',
                        canAfford
                          ? 'bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98]'
                          : 'bg-secondary text-muted-foreground cursor-not-allowed opacity-60'
                      )}
                    >
                      Redeem Reward
                      <ChevronRight className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ledger Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-1.5">
              <History className="size-5 text-muted-foreground" />
              Points History
            </h2>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            {txsLoading ? (
              <p className="text-sm text-muted-foreground p-4">Loading history...</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transaction history yet</p>
            ) : (
              <div className="divide-y divide-border/60 max-h-[420px] overflow-y-auto">
                {transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-3.5 hover:bg-secondary/20 transition-colors">
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-xs text-foreground truncate">{tx.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(tx.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-xs font-black tabular-nums shrink-0',
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {isPositive ? '+' : ''}
                        {tx.amount}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
}
