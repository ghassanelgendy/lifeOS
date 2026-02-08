import { useState } from 'react';
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Trash2,
  Banknote
} from 'lucide-react';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { format } from 'date-fns';
import { cn, formatCurrency } from '../lib/utils';
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useCategoryBreakdown
} from '../hooks/useFinance';
import { useUIStore } from '../stores/useUIStore';
import { Modal, Button, Input, Select } from '../components/ui';
import type { Transaction, CreateInput, TransactionCategory } from '../types/schema';

const EXPENSE_CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: 'food', label: 'Food & Dining' },
  { value: 'transport', label: 'Transportation' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'health', label: 'Health' },
  { value: 'education', label: 'Education' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other_expense', label: 'Other' },
];

const INCOME_CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: 'salary', label: 'Salary' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'investment', label: 'Investment' },
  { value: 'other_income', label: 'Other' },
];

const CATEGORY_COLORS: Record<string, string> = {
  food: '#ef4444',
  transport: '#f97316',
  utilities: '#eab308',
  entertainment: '#22c55e',
  health: '#3b82f6',
  education: '#8b5cf6',
  shopping: '#ec4899',
  other_expense: '#6b7280',
  salary: '#22c55e',
  freelance: '#3b82f6',
  investment: '#8b5cf6',
  other_income: '#6b7280',
};

export default function Finance() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { expensesByCategory, totalExpenses, totalIncome, balance } = useCategoryBreakdown();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const { privacyMode } = useUIStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState<Partial<CreateInput<Transaction>>>({
    type: 'expense',
    category: 'food',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    is_recurring: false,
  });

  // Prepare pie chart data
  const pieChartData = Object.entries(expensesByCategory).map(([category, amount]) => ({
    name: EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category,
    value: amount,
    color: CATEGORY_COLORS[category],
  }));

  // Modal handlers
  const handleOpenModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date.split('T')[0],
        is_recurring: transaction.is_recurring,
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        type: 'expense',
        category: 'food',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
        is_recurring: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTransaction) {
      updateTransaction.mutate({
        id: editingTransaction.id,
        data: formData,
      }, {
        onSuccess: () => setIsModalOpen(false),
      });
    } else {
      createTransaction.mutate(formData as CreateInput<Transaction>, {
        onSuccess: () => setIsModalOpen(false),
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this transaction?')) {
      deleteTransaction.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">Track income, expenses, and budgets</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus size={18} />
          Add Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Income</p>
              <p className={cn("text-2xl font-bold text-green-500 tabular-nums", privacyMode && "blur-sm")}>
                {formatCurrency(totalIncome)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-500/10">
              <ArrowUpRight className="text-green-500" size={24} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className={cn("text-2xl font-bold text-red-500 tabular-nums", privacyMode && "blur-sm")}>
                {formatCurrency(totalExpenses)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-red-500/10">
              <ArrowDownRight className="text-red-500" size={24} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className={cn(
                "text-2xl font-bold tabular-nums",
                balance >= 0 ? "text-green-500" : "text-red-500",
                privacyMode && "blur-sm"
              )}>
                {formatCurrency(balance)}
              </p>
            </div>
            <div className={cn("p-3 rounded-full", balance >= 0 ? "bg-green-500/10" : "bg-red-500/10")}>
              <Banknote className={balance >= 0 ? "text-green-500" : "text-red-500"} size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown Chart */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4">Expense Breakdown</h2>
          {pieChartData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | undefined) => [formatCurrency(value || 0), 'Amount']}
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px'
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              No expense data for this month
            </div>
          )}
        </div>

        {/* Category List */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4">By Category</h2>
          <div className="space-y-3">
            {pieChartData.length > 0 ? (
              pieChartData
                .sort((a, b) => b.value - a.value)
                .map((item) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="flex-1 text-sm">{item.name}</span>
                    <span className={cn("font-medium tabular-nums", privacyMode && "blur-sm")}>
                      {formatCurrency(item.value)}
                    </span>
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(item.value / totalExpenses) * 100}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                  </div>
                ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No expenses recorded</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Transactions</h2>
        </div>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.slice(0, 20).map((transaction) => {
                const categoryLabel = transaction.type === 'income'
                  ? INCOME_CATEGORIES.find(c => c.value === transaction.category)?.label
                  : EXPENSE_CATEGORIES.find(c => c.value === transaction.category)?.label;

                return (
                  <tr key={transaction.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(transaction.date), 'MMM d')}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {transaction.description || '-'}
                      {transaction.is_recurring && (
                        <span className="ml-2 text-xs bg-secondary px-1.5 py-0.5 rounded">Recurring</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[transaction.category]}20`,
                          color: CATEGORY_COLORS[transaction.category]
                        }}
                      >
                        {categoryLabel}
                      </span>
                    </td>
                    <td className={cn(
                      "px-4 py-3 text-right font-medium tabular-nums",
                      transaction.type === 'income' ? "text-green-500" : "text-red-500",
                      privacyMode && "blur-sm"
                    )}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleOpenModal(transaction)}
                          className="icon-touch p-1.5 rounded hover:bg-secondary transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="icon-touch p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-border">
          {transactions.slice(0, 20).map((transaction) => {
            const categoryLabel = transaction.type === 'income'
              ? INCOME_CATEGORIES.find(c => c.value === transaction.category)?.label
              : EXPENSE_CATEGORIES.find(c => c.value === transaction.category)?.label;

            return (
              <div key={transaction.id} className="p-3 flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  transaction.type === 'income' ? "bg-green-500/10" : "bg-red-500/10"
                )}>
                  {transaction.type === 'income'
                    ? <ArrowUpRight className="text-green-500" size={18} />
                    : <ArrowDownRight className="text-red-500" size={18} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{transaction.description || categoryLabel}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(transaction.date), 'MMM d')}
                    {transaction.is_recurring && ' · Recurring'}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "font-medium tabular-nums",
                    transaction.type === 'income' ? "text-green-500" : "text-red-500",
                    privacyMode && "blur-sm"
                  )}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </div>
                  <div className="flex justify-end gap-1 mt-1">
                    <button
                      onClick={() => handleOpenModal(transaction)}
                      className="icon-touch p-1 rounded hover:bg-secondary transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="icon-touch p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTransaction ? 'Edit Transaction' : 'New Transaction'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-secondary rounded-lg">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'expense', category: 'food' })}
              className={cn(
                "flex-1 py-2 rounded text-sm font-medium transition-colors",
                formData.type === 'expense' ? "bg-red-500 text-white" : "hover:bg-background/50"
              )}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'income', category: 'salary' })}
              className={cn(
                "flex-1 py-2 rounded text-sm font-medium transition-colors",
                formData.type === 'income' ? "bg-green-500 text-white" : "hover:bg-background/50"
              )}
            >
              Income
            </button>
          </div>

          <Input
            label="Amount"
            type="number"
            step="0.01"
            min={0}
            value={formData.amount === 0 ? '' : formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
            required
          />

          <Select
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as TransactionCategory })}
            options={formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES}
          />

          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />

          <Input
            label="Description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What was this for?"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_recurring"
              checked={formData.is_recurring}
              onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
              className="rounded border-border"
            />
            <label htmlFor="is_recurring" className="text-sm">Recurring transaction</label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTransaction.isPending || updateTransaction.isPending}>
              {editingTransaction ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
