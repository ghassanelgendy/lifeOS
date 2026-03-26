import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Car,
  Zap,
  Gamepad2,
  Heart,
  GraduationCap,
  ShoppingBag,
  ArrowLeftRight,
  MoreHorizontal,
  Briefcase,
  Code2,
  TrendingUp as TrendingUpIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, startOfDay, differenceInCalendarDays } from 'date-fns';
import { cn, formatCurrency, formatTime12h } from '../lib/utils';
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  getBreakdownFromTransactions,
  useBudgets,
} from '../hooks/useFinance';
import { FinanceHeroCard } from '../components/FinanceHeroCard';
import { FinanceBudgetRing } from '../components/FinanceBudgetRing';
import { useUserBanks, useEnsureDefaultBanks } from '../hooks/useUserBanks';
import {
  useInvestmentAccounts,
  useInvestmentTransactions,
  useEnsureDefaultInvestmentAccounts,
  useCreateInvestmentTransaction,
  useUpdateInvestmentTransaction,
  useDeleteInvestmentTransaction,
  getInvestmentBreakdown,
} from '../hooks/useInvestments';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../stores/useUIStore';
import { DetailsSheet, Button, Input, Select, ConfirmSheet } from '../components/ui';
import type { Transaction, CreateInput, TransactionCategory, InvestmentTransaction } from '../types/schema';

const EXPENSE_CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: 'food', label: 'Food & Dining' },
  { value: 'transport', label: 'Transportation' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'health', label: 'Health' },
  { value: 'education', label: 'Education' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'ipn', label: 'IPN' },
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
  ipn: '#a855f7',
  other_expense: '#6b7280',
  salary: '#22c55e',
  freelance: '#3b82f6',
  investment: '#8b5cf6',
  other_income: '#6b7280',
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  food: Utensils,
  transport: Car,
  utilities: Zap,
  entertainment: Gamepad2,
  health: Heart,
  education: GraduationCap,
  shopping: ShoppingBag,
  ipn: ArrowLeftRight,
  other_expense: MoreHorizontal,
  salary: Briefcase,
  freelance: Code2,
  investment: TrendingUpIcon,
  other_income: Plus,
};

type FinanceTab = 'transactions' | 'banks' | 'investments';

export default function Finance() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('transactions');
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: banks = [], isLoading: banksLoading } = useUserBanks();
  const { data: investmentAccounts = [], isLoading: invAccountsLoading } = useInvestmentAccounts();
  const { data: investmentTransactions = [], isLoading: invTxLoading } = useInvestmentTransactions();
  const ensureDefaultBanks = useEnsureDefaultBanks();
  const ensureDefaultInvestmentAccounts = useEnsureDefaultInvestmentAccounts();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const createInvestmentTransaction = useCreateInvestmentTransaction();
  const updateInvestmentTransaction = useUpdateInvestmentTransaction();
  const deleteInvestmentTransaction = useDeleteInvestmentTransaction();
  const { privacyMode } = useUIStore();
  const { data: budgets = [] } = useBudgets();

  const { user } = useAuth();
  const hasEnsuredDefaults = useRef(false);
  const hasEnsuredInvDefaults = useRef(false);

  // Ensure default banks exist once
  useEffect(() => {
    if (!user?.id || banksLoading || banks.length > 0 || hasEnsuredDefaults.current) return;
    hasEnsuredDefaults.current = true;
    ensureDefaultBanks.mutate();
  }, [user?.id, banksLoading, banks.length]);

  // Ensure default investment accounts (Thndr, Fawry) exist once
  useEffect(() => {
    if (!user?.id || invAccountsLoading || activeTab !== 'investments' || hasEnsuredInvDefaults.current) return;
    if (investmentAccounts.length > 0) {
      hasEnsuredInvDefaults.current = true;
      return;
    }
    hasEnsuredInvDefaults.current = true;
    ensureDefaultInvestmentAccounts.mutate();
  }, [user?.id, invAccountsLoading, investmentAccounts.length, activeTab]);

  const [selectedBank, setSelectedBank] = useState<string>(''); // '' = All (consolidated)
  const [selectedQNBAccount, setSelectedQNBAccount] = useState<'all' | 'debit' | 'credit'>('all'); // Only when bank is QNB
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvestmentAccount, setSelectedInvestmentAccount] = useState<string>(''); // '' = All
  const filteredInvestmentTransactions =
    selectedInvestmentAccount === ''
      ? investmentTransactions
      : investmentTransactions.filter((t) => t.account_id === selectedInvestmentAccount);
  const investmentBreakdown = getInvestmentBreakdown(filteredInvestmentTransactions);

  const bankFilteredTransactions =
    selectedBank === ''
      ? transactions
      : transactions.filter((t) => (t.bank || '').trim() === selectedBank);

  // QNB account filter (visible only when bank is QNB): debit 0050/**7893, credit ****1473
  const QNB_DEBIT = /0050|\*\*7893|7893/;
  const QNB_CREDIT = /1473|\*\*\*1473/;
  const filteredTransactions = useMemo(() => {
    if (selectedBank !== 'QNB' || selectedQNBAccount === 'all') return bankFilteredTransactions;
    return bankFilteredTransactions.filter((t) => {
      const acc = (t.account || '').replace(/\s/g, '');
      if (selectedQNBAccount === 'debit') return QNB_DEBIT.test(acc);
      if (selectedQNBAccount === 'credit') return QNB_CREDIT.test(acc);
      return true;
    });
  }, [bankFilteredTransactions, selectedBank, selectedQNBAccount]);

  // Month selector for hero card stats
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => startOfMonth(new Date()));
  const isCurrentMonth =
    format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  const { selectedMonthIncome, selectedMonthExpenses, selectedMonthBalance } = useMemo(() => {
    const monthStr = format(selectedMonth, 'yyyy-MM');
    let income = 0;
    let expenses = 0;
    filteredTransactions.forEach((t) => {
      if (!(t.date || '').startsWith(monthStr)) return;
      const amt = Number(t.amount) || 0;
      const dir =
        t.direction === 'In' || t.direction === 'Out'
          ? t.direction
          : t.type === 'income'
            ? 'In'
            : 'Out';
      if (dir === 'In') income += amt;
      else expenses += amt;
    });
    return {
      selectedMonthIncome: income,
      selectedMonthExpenses: expenses,
      selectedMonthBalance: income - expenses,
    };
  }, [filteredTransactions, selectedMonth]);

  // --- Correction Transaction (reconciliation) ---
  // "Detected balance" is computed from transactions for the selected bank/card identity.
  const computeDetectedBalanceForIdentity = (
    bankName: string,
    qnbCard: 'debit' | 'credit'
  ): number => {
    const normalizedBank = (bankName || '').trim();
    if (!normalizedBank) return 0;

    const matchesIdentity = (t: Transaction) => {
      const tBank = (t.bank || '').trim();
      if (normalizedBank !== 'QNB') return tBank === normalizedBank;
      if (tBank !== 'QNB') return false;
      const acc = (t.account || '').replace(/\s/g, '');
      if (qnbCard === 'debit') return QNB_DEBIT.test(acc);
      return QNB_CREDIT.test(acc);
    };

    // IMPORTANT: Keep "detected" consistent with Dashboard calculations.
    // Dashboard uses `useCategoryBreakdown()` which uses `getBreakdownFromTransactions()` for the CURRENT month window
    // and rounds only at the end. So we reuse that exact function here.
    const identityTx = transactions.filter(matchesIdentity);
    return getBreakdownFromTransactions(identityTx).balance;
  };

  const [isCorrectionSheetOpen, setIsCorrectionSheetOpen] = useState(false);
  const [correctionBank, setCorrectionBank] = useState<string>('');
  const [correctionQNBCard, setCorrectionQNBCard] = useState<'debit' | 'credit'>('debit');
  const [correctionRealAmount, setCorrectionRealAmount] = useState<number>(0);

  const correctionDetectedBalance = useMemo(() => {
    if (!correctionBank) return 0;
    return computeDetectedBalanceForIdentity(correctionBank, correctionQNBCard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correctionBank, correctionQNBCard, transactions]);

  const correctionDiff = correctionRealAmount - correctionDetectedBalance;
  const correctionConfirmDisabled =
    !correctionBank ||
    !Number.isFinite(correctionRealAmount) ||
    Math.abs(correctionDiff) < 0.01;

  const handleOpenCorrectionSheet = () => {
    const defaultBank = selectedBank !== '' ? selectedBank : banks[0]?.name || 'Orange Cash';
    const nextCard: 'debit' | 'credit' =
      defaultBank === 'QNB'
        ? selectedQNBAccount === 'credit'
          ? 'credit'
          : 'debit'
        : 'debit';

    setCorrectionBank(defaultBank);
    setCorrectionQNBCard(nextCard);
    setCorrectionRealAmount(computeDetectedBalanceForIdentity(defaultBank, nextCard));
    setIsCorrectionSheetOpen(true);
  };

  const handleConfirmCorrection = () => {
    if (correctionConfirmDisabled) return;

    const diff = correctionDiff;
    const isPositive = diff > 0;
    const today = new Date().toISOString().split('T')[0];
    const absAmount = Math.abs(diff);

    const payload: CreateInput<Transaction> = {
      type: isPositive ? 'income' : 'expense',
      category: isPositive ? 'other_income' : 'other_expense',
      amount: Math.round(absAmount * 100) / 100,
      description: 'Correction Transaction',
      date: today,
      time: undefined,
      is_recurring: false,
      bank: correctionBank,
      transaction_type: 'Correction Transaction',
      direction: isPositive ? 'In' : 'Out',
      ...(correctionBank === 'QNB'
        ? {
            account: correctionQNBCard === 'debit' ? '0050/**7893' : '****1473',
          }
        : {}),
    };

    createTransaction.mutate(payload, {
      onSuccess: () => setIsCorrectionSheetOpen(false),
    });
  };

  const totalBudgetLimit = useMemo(
    () => budgets.reduce((sum, b) => sum + Number(b.monthly_limit), 0),
    [budgets]
  );

  // View all + date filter (month or day)
  const [viewAllTransactions, setViewAllTransactions] = useState(false);
  type DateFilterMode = 'all' | 'month' | 'day';
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all');
  const [filterMonth, setFilterMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [filterDay, setFilterDay] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const dateFilteredTransactions = useMemo(() => {
    if (dateFilterMode === 'all') return filteredTransactions;
    if (dateFilterMode === 'month' && filterMonth)
      return filteredTransactions.filter((t) => (t.date || '').startsWith(filterMonth));
    if (dateFilterMode === 'day' && filterDay)
      return filteredTransactions.filter((t) => (t.date || '').split('T')[0] === filterDay);
    return filteredTransactions;
  }, [filteredTransactions, dateFilterMode, filterMonth, filterDay]);

  // Search: matches description, entity, bank, account, transaction_type
  const searchFilteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return dateFilteredTransactions;
    return dateFilteredTransactions.filter((t) => {
      const meta = [
        t.description,
        t.entity,
        t.bank,
        t.account,
        t.transaction_type,
        t.category,
        t.direction,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return meta.includes(q);
    });
  }, [dateFilteredTransactions, searchQuery]);

  const displayedTransactions = viewAllTransactions
    ? searchFilteredTransactions
    : searchFilteredTransactions.slice(0, 20);
  const { expensesByCategory, totalExpenses } =
    getBreakdownFromTransactions(filteredTransactions);

  const bankOptions = useMemo(() => {
    const fromBanks = banks.map((b) => b.name);
    const fromTx = transactions.map((t) => t.bank).filter(Boolean) as string[];
    return [...new Set([...fromBanks, ...fromTx])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [banks, transactions]);

  const perBankStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyTx = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const byBank: Record<string, { cashIn: number; cashOut: number; cashflow: number }> = {};
    monthlyTx.forEach((t) => {
      const bank = (t.bank || '').trim() || '—';
      if (!byBank[bank]) byBank[bank] = { cashIn: 0, cashOut: 0, cashflow: 0 };
      const amt = Number(t.amount) || 0;
      const dir =
        t.direction === 'In' || t.direction === 'Out'
          ? t.direction
          : t.type === 'income'
            ? 'In'
            : 'Out';
      if (dir === 'In') byBank[bank].cashIn += amt;
      else if (dir === 'Out') byBank[bank].cashOut += amt;
      byBank[bank].cashflow = byBank[bank].cashIn - byBank[bank].cashOut;
    });
    return byBank;
  }, [transactions]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [editingInvestmentTransaction, setEditingInvestmentTransaction] = useState<InvestmentTransaction | null>(null);
  const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(null);
  const [deleteInvestmentId, setDeleteInvestmentId] = useState<string | null>(null);
  const [investmentFormData, setInvestmentFormData] = useState<Partial<CreateInput<InvestmentTransaction>>>({
    type: 'income',
    category: 'investment',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    is_recurring: false,
    account_id: '',
    entity: '',
    direction: 'In',
  });
  const [formData, setFormData] = useState<Partial<CreateInput<Transaction>>>({
    type: 'expense',
    category: 'food',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    is_recurring: false,
    bank: '',
    transaction_type: '',
    entity: '',
    direction: 'Out',
    account: '',
  });

  // Graph type: category (bar), overtime (line/area), accounts (by bank – only when All view)
  type GraphType = 'category' | 'overtime' | 'accounts';
  const [graphType, setGraphType] = useState<GraphType>('category');
  useEffect(() => {
    if (selectedBank !== '' && graphType === 'accounts') setGraphType('category');
  }, [selectedBank, graphType]);

  // Expense-by-category data (for bar chart and category list)
  const chartData = useMemo(
    () =>
      Object.entries(expensesByCategory)
        .map(([category, amount]) => ({
          name: EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category,
          value: amount,
          color: CATEGORY_COLORS[category],
        }))
        .sort((a, b) => b.value - a.value),
    [expensesByCategory]
  );

  // Over time: dynamic period based on available transactions.
  // - If data spans <= ~60 days: show DAILY points.
  // - Otherwise: show MONTHLY aggregates (up to last 6 months with data).
  const overtimeData = useMemo(() => {
    if (filteredTransactions.length === 0) return [];

    // Determine earliest and latest transaction months
    const dates = filteredTransactions
      .map((t) => new Date(t.date))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (dates.length === 0) return [];

    const earliest = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
    const latest = dates.reduce((max, d) => (d > max ? d : max), dates[0]);

    const daySpan = Math.max(1, differenceInCalendarDays(startOfDay(latest), startOfDay(earliest)) + 1);

    // If the data spans roughly <= 2 months, show daily points
    if (daySpan <= 60) {
      const points: {
        label: string;
        fullLabel: string;
        income: number;
        expense: number;
        balance: number;
      }[] = [];

      for (let i = 0; i < daySpan; i++) {
        const d = startOfDay(earliest);
        d.setDate(d.getDate() + i);
        const dayStr = d.toISOString().split('T')[0];
        const inRange = filteredTransactions.filter((t) => (t.date || '').split('T')[0] === dayStr);
        let income = 0;
        let expense = 0;
        inRange.forEach((t) => {
          const amt = Number(t.amount) || 0;
          const dir =
            t.direction === 'In' || t.direction === 'Out'
              ? t.direction
              : t.type === 'income'
                ? 'In'
                : 'Out';
          if (dir === 'In') income += amt;
          else if (dir === 'Out') expense += amt;
        });
        points.push({
          label: format(d, 'MMM d'),
          fullLabel: format(d, 'MMM d, yyyy'),
          income: Math.round(income * 100) / 100,
          expense: Math.round(expense * 100) / 100,
          balance: Math.round((income - expense) * 100) / 100,
        });
      }
      return points;
    }

    // Otherwise: show monthly aggregates for the active data window (up to last 6 months)
    const startMonth = startOfMonth(earliest);
    const endMonth = startOfMonth(latest);
    const totalMonths =
      (endMonth.getFullYear() - startMonth.getFullYear()) * 12 +
      (endMonth.getMonth() - startMonth.getMonth()) +
      1;

    const monthsToShow = Math.min(6, Math.max(1, totalMonths));
    const anchor = endMonth;

    return Array.from({ length: monthsToShow }, (_, i) => {
      const d = subMonths(anchor, monthsToShow - 1 - i);
      const start = startOfMonth(d).toISOString().split('T')[0];
      const end = endOfMonth(d).toISOString().split('T')[0];

      const inRange = filteredTransactions.filter(
        (t) => t.date >= start && t.date <= end
      );
      let income = 0;
      let expense = 0;
      inRange.forEach((t) => {
        const amt = Number(t.amount) || 0;
        const dir =
          t.direction === 'In' || t.direction === 'Out'
            ? t.direction
            : t.type === 'income'
              ? 'In'
              : 'Out';
        if (dir === 'In') income += amt;
        else if (dir === 'Out') expense += amt;
      });
      return {
        label: format(d, 'MMM'),
        fullLabel: format(d, 'MMMM yyyy'),
        income: Math.round(income * 100) / 100,
        expense: Math.round(expense * 100) / 100,
        balance: Math.round((income - expense) * 100) / 100,
      };
    });
  }, [filteredTransactions]);

  // By account: per-bank totals (only meaningful when viewing All)
  const accountsData = useMemo(() => {
    const byBank: Record<string, { income: number; expense: number }> = {};
    filteredTransactions.forEach((t) => {
      const bank = (t.bank || '').trim() || '—';
      if (!byBank[bank]) byBank[bank] = { income: 0, expense: 0 };
      const amt = Number(t.amount) || 0;
      const dir =
        t.direction === 'In' || t.direction === 'Out'
          ? t.direction
          : t.type === 'income'
            ? 'In'
            : 'Out';
      if (dir === 'In') byBank[bank].income += amt;
      else if (dir === 'Out') byBank[bank].expense += amt;
    });
    return Object.entries(byBank)
      .map(([name, { income, expense }]) => ({
        name,
        income: Math.round(income * 100) / 100,
        expense: Math.round(expense * 100) / 100,
        balance: Math.round((income - expense) * 100) / 100,
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [filteredTransactions]);

  // Modal handlers
  const handleOpenModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      const d = transaction.date.split('T')[0];
      setFormData({
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount,
        description: transaction.description,
        date: d,
        time: transaction.time ? transaction.time.slice(0, 5) : '',
        is_recurring: transaction.is_recurring,
        bank: transaction.bank ?? '',
        transaction_type: transaction.transaction_type ?? '',
        entity: transaction.entity ?? '',
        direction: transaction.direction ?? (transaction.type === 'income' ? 'In' : 'Out'),
        account: transaction.account ?? '',
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        type: 'expense',
        category: 'food',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        is_recurring: false,
        bank: '',
        transaction_type: '',
        entity: '',
        direction: 'Out',
        account: '',
      });
    }
    setIsModalOpen(true);
  };

  const sanitizePayload = (data: Partial<CreateInput<Transaction>>): CreateInput<Transaction> => {
    const out = { ...data } as Record<string, unknown>;
    ['time', 'bank', 'transaction_type', 'entity', 'account'].forEach((k) => {
      if (out[k] === '') delete out[k];
    });
    if (out.direction === '') delete out.direction;
    return out as CreateInput<Transaction>;
  };

  const transactionFormRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = sanitizePayload(formData as Partial<CreateInput<Transaction>>);
    if (editingTransaction) {
      updateTransaction.mutate({
        id: editingTransaction.id,
        data: payload,
      }, {
        onSuccess: () => setIsModalOpen(false),
      });
    } else {
      createTransaction.mutate(payload, {
        onSuccess: () => setIsModalOpen(false),
      });
    }
  };

  const handleConfirmTransaction = () => {
    transactionFormRef.current?.requestSubmit();
  };

  const handleDelete = (id: string) => {
    setDeleteTransactionId(id);
  };

  // Investment modal handlers (must be before any early return to keep hook order stable)
  const handleOpenInvestmentModal = (tx?: InvestmentTransaction) => {
    if (tx) {
      setEditingInvestmentTransaction(tx);
      setInvestmentFormData({
        type: tx.type,
        category: tx.category,
        amount: tx.amount,
        description: tx.description,
        date: tx.date.split('T')[0],
        time: tx.time?.slice(0, 5) ?? '',
        is_recurring: tx.is_recurring,
        account_id: tx.account_id,
        entity: tx.entity,
        direction: tx.direction ?? (tx.type === 'income' ? 'In' : 'Out'),
      });
    } else {
      setEditingInvestmentTransaction(null);
      setInvestmentFormData({
        type: 'income',
        category: 'investment',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        is_recurring: false,
        account_id: investmentAccounts[0]?.id ?? '',
        entity: '',
        direction: 'In',
      });
    }
    setIsInvestmentModalOpen(true);
  };

  const sanitizeInvestmentPayload = (data: Partial<CreateInput<InvestmentTransaction>>): CreateInput<InvestmentTransaction> => {
    const out = { ...data } as Record<string, unknown>;
    ['time', 'description', 'entity', 'direction', 'transaction_type'].forEach((k) => {
      if (out[k] === '' || out[k] == null) delete out[k];
    });
    return out as CreateInput<InvestmentTransaction>;
  };

  const investmentFormRef = useRef<HTMLFormElement>(null);

  const handleSubmitInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    const accountId = investmentFormData.account_id || investmentAccounts[0]?.id;
    if (!accountId) return;
    const payload = sanitizeInvestmentPayload({
      ...investmentFormData,
      account_id: accountId,
    });
    if (editingInvestmentTransaction) {
      updateInvestmentTransaction.mutate(
        { id: editingInvestmentTransaction.id, data: payload },
        { onSuccess: () => setIsInvestmentModalOpen(false) }
      );
    } else {
      createInvestmentTransaction.mutate(payload, { onSuccess: () => setIsInvestmentModalOpen(false) });
    }
  };

  const handleConfirmInvestment = () => {
    investmentFormRef.current?.requestSubmit();
  };

  const handleDeleteInvestment = (id: string) => {
    setDeleteInvestmentId(id);
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
        {activeTab === 'transactions' && (
          <Button onClick={() => handleOpenModal()} className="p-2" aria-label="Add transaction">
            <Plus size={22} />
          </Button>
        )}
        {activeTab === 'investments' && (
          <Button onClick={() => handleOpenInvestmentModal()} className="p-2" aria-label="Add investment transaction">
            <Plus size={22} />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-secondary/50 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'transactions' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Transactions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('banks')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'banks' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Banks
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('investments')}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'investments' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Investments
        </button>
      </div>

      {/* Transactions tab */}
      {activeTab === 'transactions' && (
        <>
      {/* Month Selector */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setSelectedMonth((prev) => subMonths(prev, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-foreground min-w-[120px] text-center">
          {format(selectedMonth, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={() => setSelectedMonth((prev) => addMonths(prev, 1))}
          disabled={isCurrentMonth}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-full transition-colors',
            isCurrentMonth
              ? 'text-muted-foreground/30 cursor-default'
              : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
          )}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Wallet / Bank Selector */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Select
          value={selectedBank}
          onChange={(e) => {
            setSelectedBank(e.target.value);
            if (e.target.value !== 'QNB') setSelectedQNBAccount('all');
          }}
          options={[
            { value: '', label: 'All (consolidated)' },
            ...bankOptions.map((name) => ({ value: name, label: name })),
          ]}
          className="w-full sm:w-auto max-w-[200px]"
        />
        {selectedBank === 'QNB' && (
          <Select
            value={selectedQNBAccount}
            onChange={(e) => setSelectedQNBAccount(e.target.value as 'all' | 'debit' | 'credit')}
            options={[
              { value: 'all', label: 'All cards' },
              { value: 'debit', label: 'Debit (0050/**7893)' },
              { value: 'credit', label: 'Credit (****1473)' },
            ]}
            className="w-full sm:w-auto max-w-[180px]"
          />
        )}
      </div>

      {/* Hero Summary Card */}
      <FinanceHeroCard
        income={selectedMonthIncome}
        expenses={selectedMonthExpenses}
        balance={selectedMonthBalance}
        privacyMode={privacyMode}
      />

      {/* Budget Ring (only when budgets are configured) */}
      {budgets.length > 0 && (
        <FinanceBudgetRing
          totalBudget={totalBudgetLimit}
          totalSpent={selectedMonthExpenses}
          privacyMode={privacyMode}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart card with iOS-style graph type selector */}
        <div className="rounded-2xl border border-border bg-card p-4 md:p-6 shadow-sm overflow-hidden">
          {/* iOS-style segmented control */}
          <div className="flex p-1 bg-secondary/50 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => setGraphType('category')}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                graphType === 'category'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              By category
            </button>
            <button
              type="button"
              onClick={() => setGraphType('overtime')}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                graphType === 'overtime'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Over time
            </button>
            {selectedBank === '' && (
              <button
                type="button"
                onClick={() => setGraphType('accounts')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                  graphType === 'accounts'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                By account
              </button>
            )}
          </div>

          <div
            className="w-full -mx-1 select-none"
            style={{ height: 260, minHeight: 260, minWidth: 0 }}
            role="img"
            aria-label="Chart"
          >
            {graphType === 'category' && (
              chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={92}
                      tick={{ fontSize: 13, fill: 'var(--color-muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Spent']}
                      contentStyle={{
                        backgroundColor: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        fontSize: 14,
                        padding: '10px 14px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        color: '#ffffff',
                      }}
                      cursor={false}
                      itemStyle={{ paddingTop: 4 }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                      {chartData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No expenses this month
                </div>
              )
            )}

            {graphType === 'overtime' && (
              overtimeData.some((d) => d.income !== 0 || d.expense !== 0) ? (
                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                  <AreaChart
                    data={overtimeData}
                    margin={{ top: 12, right: 12, left: 4, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        fontSize: 13,
                        padding: '10px 14px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                      formatter={(value, name) => [
                        formatCurrency(typeof value === 'number' ? value : 0),
                        name === 'income' ? 'Income' : 'Expense',
                      ]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ''}
                    />
                    <Area type="monotone" dataKey="income" stroke="rgb(34, 197, 94)" strokeWidth={2} fill="url(#incomeGrad)" />
                    <Area type="monotone" dataKey="expense" stroke="rgb(239, 68, 68)" strokeWidth={2} fill="url(#expenseGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No data in the last 6 months
                </div>
              )
            )}

            {graphType === 'accounts' && selectedBank === '' && (
              accountsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                  <BarChart
                    data={accountsData}
                    layout="vertical"
                    margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      tick={{ fontSize: 13, fill: 'var(--color-muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        fontSize: 13,
                        padding: '10px 14px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                      formatter={(value) => [formatCurrency(typeof value === 'number' ? value : 0), 'Balance']}
                      labelFormatter={(label) => label === '—' ? 'No bank' : label}
                    />
                    <Bar dataKey="balance" radius={[0, 6, 6, 0]} maxBarSize={24} fill="var(--color-primary)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No account data
                </div>
              )
            )}
          </div>
        </div>

        {/* Category List – iOS style */}
        <div className="rounded-2xl border border-border bg-card p-4 md:p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">By Category</h2>
          <div className="space-y-3">
            {chartData.length > 0 ? (
              chartData.map((item) => (
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
                          width: `${totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0}%`,
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

      {/* Recent / All Transactions */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, var(--color-card) 0%, var(--color-secondary) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 24px rgba(0,0,0,0.25)',
        }}
      >
        <div className="px-4 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-foreground">
              {viewAllTransactions ? 'All Transactions' : 'Recent Transactions'}
            </h2>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setViewAllTransactions(!viewAllTransactions)}
            >
              {viewAllTransactions ? 'show recent' : 'view all'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-sky-400 bg-sky-400/10 ring-1 ring-sky-400/20 hover:bg-sky-400/20 transition-colors"
            >
              <Plus size={12} />
              Add Transaction
            </button>
            <button
              type="button"
              onClick={() => handleOpenCorrectionSheet()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-amber-200 bg-amber-500/10 ring-1 ring-amber-500/20 hover:bg-amber-500/20 transition-colors"
            >
              <Edit2 size={12} />
              Correction
            </button>
          </div>
        </div>
        {viewAllTransactions && (
          <div className="px-4 pb-3 border-b border-border flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Filter:</span>
            <div className="flex p-0.5 bg-secondary/50 rounded-lg">
              {(['all', 'month', 'day'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDateFilterMode(mode)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    dateFilterMode === mode
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {mode === 'all' ? 'All' : mode === 'month' ? 'Month' : 'Day'}
                </button>
              ))}
            </div>
            {dateFilterMode === 'month' && (
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              />
            )}
            {dateFilterMode === 'day' && (
              <input
                type="date"
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
              />
            )}
            <Input
              type="search"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-auto sm:min-w-[180px] text-xs"
            />
            <span className="text-xs text-muted-foreground">
              {displayedTransactions.length} tx
            </span>
          </div>
        )}
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Bank</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Entity</th>
                <th className="px-4 py-3 text-left font-medium">Direction</th>
                <th className="px-4 py-3 text-left font-medium">Account</th>
                <th className="px-4 py-3 text-left font-medium">Details</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedTransactions.map((transaction) => {
                const categoryLabel = transaction.type === 'income'
                  ? INCOME_CATEGORIES.find(c => c.value === transaction.category)?.label
                  : EXPENSE_CATEGORIES.find(c => c.value === transaction.category)?.label;
                const timeStr = transaction.time ? formatTime12h(transaction.time) : '';

                return (
                  <tr key={transaction.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(transaction.date), 'MMM d')}
                      {timeStr && <span className="block text-xs">{timeStr}</span>}
                    </td>
                    <td className={cn(
                      "px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap",
                      transaction.type === 'income' ? "text-green-500" : "text-red-500",
                      privacyMode && "blur-sm"
                    )}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{transaction.bank || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{transaction.transaction_type || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{transaction.entity || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{transaction.direction || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{transaction.account || '-'}</td>
                    <td className="px-4 py-3 font-medium max-w-[140px] truncate" title={transaction.description ?? undefined}>
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
        <div className="md:hidden divide-y divide-white/[0.04]">
          {displayedTransactions.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10">No transactions</p>
          )}
          {displayedTransactions.map((transaction) => {
            const categoryLabel =
              transaction.type === 'income'
                ? INCOME_CATEGORIES.find((c) => c.value === transaction.category)?.label
                : EXPENSE_CATEGORIES.find((c) => c.value === transaction.category)?.label;
            const catColor = CATEGORY_COLORS[transaction.category] ?? '#6b7280';
            const CatIcon = CATEGORY_ICONS[transaction.category] ?? MoreHorizontal;
            const title = transaction.entity || transaction.description || categoryLabel || '—';

            return (
              <div key={transaction.id} className="flex items-center gap-3 px-4 py-3">
                {/* Category icon */}
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${catColor}18` }}
                >
                  <CatIcon size={18} style={{ color: catColor }} />
                </div>

                {/* Title + category */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {categoryLabel}
                    {transaction.is_recurring && ' · Recurring'}
                  </p>
                </div>

                {/* Amount + date */}
                <div className="text-right flex-shrink-0">
                  <p
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      transaction.type === 'income' ? 'text-green-400' : 'text-red-400',
                      privacyMode && 'blur-sm'
                    )}
                  >
                    {transaction.type === 'income' ? '+' : '−'}{formatCurrency(transaction.amount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {format(new Date(transaction.date), 'MMM d')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 ml-1">
                  <button
                    onClick={() => handleOpenModal(transaction)}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(transaction.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Correction sheet */}
      <DetailsSheet
        isOpen={isCorrectionSheetOpen}
        onClose={() => setIsCorrectionSheetOpen(false)}
        onConfirm={handleConfirmCorrection}
        title="Correction Transaction"
        confirmDisabled={createTransaction.isPending || correctionConfirmDisabled}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Set real current amount</p>
            <p className="text-xs text-muted-foreground">
              A dummy adjustment transaction will be added to match your real balance.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Select
              label="Bank"
              value={correctionBank}
              onChange={(e) => {
                setCorrectionBank(e.target.value);
                // If switching away from QNB, keep card selection deterministic.
                if (e.target.value !== 'QNB') setCorrectionQNBCard('debit');
              }}
              options={[
                ...(banks.map((b) => ({ value: b.name, label: b.name })) as { value: string; label: string }[]),
              ]}
            />

            {correctionBank === 'QNB' && (
              <Select
                label="Card"
                value={correctionQNBCard}
                onChange={(e) => setCorrectionQNBCard(e.target.value as 'debit' | 'credit')}
                options={[
                  { value: 'debit', label: 'Debit (0050/**7893)' },
                  { value: 'credit', label: 'Credit (****1473)' },
                ]}
              />
            )}

            <Input
              label="Real amount"
              type="number"
              step="0.01"
              value={correctionRealAmount === 0 ? '' : correctionRealAmount}
              onChange={(e) => {
                const next = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                setCorrectionRealAmount(next);
              }}
            />
          </div>

          <div className="rounded-2xl bg-secondary/30 p-3 space-y-1 border border-border">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Detected balance</span>
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {formatCurrency(correctionDetectedBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Adjustment</span>
              <span
                className={cn(
                  'text-xs font-semibold tabular-nums',
                  correctionDiff >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {correctionDiff >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(correctionDiff))}
              </span>
            </div>
          </div>
        </div>
      </DetailsSheet>

      {/* Transaction sheet (same style as task Details) */}
      <DetailsSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmTransaction}
        title={editingTransaction ? 'Edit Transaction' : 'New Transaction'}
        confirmDisabled={createTransaction.isPending || updateTransaction.isPending}
      >
        <form id="transaction-form" ref={transactionFormRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-secondary rounded-lg">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, type: 'expense', category: 'food', direction: 'Out' }))}
              className={cn(
                "flex-1 py-2 rounded text-sm font-medium transition-colors",
                formData.type === 'expense' ? "bg-red-500 text-white" : "hover:bg-background/50"
              )}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, type: 'income', category: 'salary', direction: 'In' }))}
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
            onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 }))}
            required
          />

          <Select
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value as TransactionCategory }))}
            options={formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
              required
            />
            <Input
              label="Time"
              type="time"
              value={formData.time ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, time: e.target.value || undefined }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Bank"
              value={formData.bank ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, bank: e.target.value || undefined }))}
              options={[
                { value: '', label: '—' },
                ...bankOptions.map((name) => ({ value: name, label: name })),
              ]}
            />
            <Select
              label="Direction"
              value={formData.direction ?? 'Out'}
              onChange={(e) => setFormData((prev) => ({ ...prev, direction: e.target.value as 'In' | 'Out' }))}
              options={[
                { value: 'In', label: 'In' },
                { value: 'Out', label: 'Out' },
              ]}
            />
          </div>

          <Input
            label="Type"
            value={formData.transaction_type ?? ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, transaction_type: e.target.value || undefined }))}
            placeholder="e.g. IPN Transfer"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Entity"
              value={formData.entity ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, entity: e.target.value || undefined }))}
              placeholder="Counterparty"
            />
            <Input
              label="Account"
              value={formData.account ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, account: e.target.value || undefined }))}
              placeholder="e.g. ***50"
            />
          </div>

          <Input
            label="Details"
            value={formData.description || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="What was this for?"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_recurring"
              checked={formData.is_recurring}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_recurring: e.target.checked }))}
              className="rounded border-border"
            />
            <label htmlFor="is_recurring" className="text-sm">Recurring transaction</label>
          </div>
        </form>
      </DetailsSheet>
        </>
      )}

      {/* Banks tab */}
      {activeTab === 'banks' && (
        <div className="rounded-2xl border border-border bg-card p-4 md:p-6 overflow-hidden">
          <h2 className="text-lg font-semibold mb-4">Your Banks</h2>
          <p className="text-sm text-muted-foreground mb-4">Cash In, Cash Out, and Cashflow per bank (current month).</p>
          <div className="space-y-2">
            {bankOptions.length === 0 && !banksLoading && (
              <p className="text-sm text-muted-foreground">No banks yet. Add a transaction and select a bank to create one.</p>
            )}
            {bankOptions.map((bankName) => {
              const stats = perBankStats[bankName] ?? { cashIn: 0, cashOut: 0, cashflow: 0 };
              return (
                <div key={bankName} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 px-4 rounded-lg bg-secondary/30">
                  <span className="font-medium shrink-0 w-24">{bankName}</span>
                  <div className="flex flex-wrap gap-4 sm:ml-auto">
                    <div>
                      <span className="text-xs text-muted-foreground">Cash In</span>
                      <p className={cn("font-semibold tabular-nums text-green-500", privacyMode && "blur-sm")}>
                        {formatCurrency(stats.cashIn)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Cash Out</span>
                      <p className={cn("font-semibold tabular-nums text-red-500", privacyMode && "blur-sm")}>
                        {formatCurrency(stats.cashOut)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Cashflow</span>
                      <p className={cn(
                        "font-semibold tabular-nums",
                        stats.cashflow >= 0 ? "text-green-500" : "text-red-500",
                        privacyMode && "blur-sm"
                      )}>
                        {formatCurrency(stats.cashflow)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Investments tab */}
      {activeTab === 'investments' && (
        <>
          {(invAccountsLoading || invTxLoading) ? (
            <div className="flex justify-center h-64 items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Account:</span>
                <Select
                  value={selectedInvestmentAccount}
                  onChange={(e) => setSelectedInvestmentAccount(e.target.value)}
                  options={[
                    { value: '', label: 'All' },
                    ...investmentAccounts.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                  className="w-full sm:w-auto max-w-[200px]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Income</p>
                  <p className={cn("text-2xl font-bold text-green-500 tabular-nums", privacyMode && "blur-sm")}>
                    {formatCurrency(investmentBreakdown.totalIncome)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <p className={cn("text-2xl font-bold text-red-500 tabular-nums", privacyMode && "blur-sm")}>
                    {formatCurrency(investmentBreakdown.totalExpense)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className={cn(
                    "text-2xl font-bold tabular-nums",
                    investmentBreakdown.balance >= 0 ? "text-green-500" : "text-red-500",
                    privacyMode && "blur-sm"
                  )}>
                    {formatCurrency(investmentBreakdown.balance)}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h2 className="font-semibold">Investment Transactions</h2>
                  <p className="text-sm text-muted-foreground">Thndr and Fawry — separate from your main finances</p>
                </div>
                <div className="divide-y divide-border">
                  {filteredInvestmentTransactions.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No investment transactions yet.</div>
                  ) : (
                    filteredInvestmentTransactions.map((tx) => {
                      const account = investmentAccounts.find((a) => a.id === tx.account_id);
                      const catLabel = tx.type === 'income'
                        ? INCOME_CATEGORIES.find((c) => c.value === tx.category)?.label
                        : EXPENSE_CATEGORIES.find((c) => c.value === tx.category)?.label;
                      return (
                        <div key={tx.id} className="p-4 flex items-center gap-3 hover:bg-secondary/20">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                            tx.type === 'income' ? "bg-green-500/10" : "bg-red-500/10"
                          )}>
                            {tx.type === 'income' ? <ArrowUpRight className="text-green-500" size={18} /> : <ArrowDownRight className="text-red-500" size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{tx.description || catLabel}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(tx.date), 'MMM d')} · {account?.name ?? '—'}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className={cn(
                              "font-medium tabular-nums",
                              tx.type === 'income' ? "text-green-500" : "text-red-500",
                              privacyMode && "blur-sm"
                            )}>
                              {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                            </span>
                            <button onClick={() => handleOpenInvestmentModal(tx)} className="p-1.5 rounded hover:bg-secondary" title="Edit">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteInvestment(tx.id)} className="p-1.5 rounded hover:bg-destructive/20 text-destructive" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <DetailsSheet
                isOpen={isInvestmentModalOpen}
                onClose={() => setIsInvestmentModalOpen(false)}
                onConfirm={handleConfirmInvestment}
                title={editingInvestmentTransaction ? 'Edit Investment' : 'New Investment'}
                confirmDisabled={createInvestmentTransaction.isPending || updateInvestmentTransaction.isPending}
              >
                <form id="investment-form" ref={investmentFormRef} onSubmit={handleSubmitInvestment} className="space-y-4">
                  <div className="flex gap-2 p-1 bg-secondary rounded-lg">
                    <button
                      type="button"
                      onClick={() => setInvestmentFormData((prev) => ({ ...prev, type: 'expense', category: 'other_expense', direction: 'Out' }))}
                      className={cn(
                        "flex-1 py-2 rounded text-sm font-medium transition-colors",
                        investmentFormData.type === 'expense' ? "bg-red-500 text-white" : "hover:bg-background/50"
                      )}
                    >
                      Out
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvestmentFormData((prev) => ({ ...prev, type: 'income', category: 'investment', direction: 'In' }))}
                      className={cn(
                        "flex-1 py-2 rounded text-sm font-medium transition-colors",
                        investmentFormData.type === 'income' ? "bg-green-500 text-white" : "hover:bg-background/50"
                      )}
                    >
                      In
                    </button>
                  </div>
                  <Select
                    label="Account"
                    value={investmentFormData.account_id ?? ''}
                    onChange={(e) => setInvestmentFormData((prev) => ({ ...prev, account_id: e.target.value }))}
                    options={investmentAccounts.map((a) => ({ value: a.id, label: a.name }))}
                    required
                  />
                  <Input
                    label="Amount"
                    type="number"
                    step="0.01"
                    min={0}
                    value={investmentFormData.amount === 0 ? '' : investmentFormData.amount}
                    onChange={(e) => setInvestmentFormData((prev) => ({ ...prev, amount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 }))}
                    required
                  />
                  <Select
                    label="Category"
                    value={investmentFormData.category}
                    onChange={(e) => setInvestmentFormData((prev) => ({ ...prev, category: e.target.value as TransactionCategory }))}
                    options={investmentFormData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Date"
                      type="date"
                      value={investmentFormData.date ?? ''}
                      onChange={(e) => setInvestmentFormData((prev) => ({ ...prev, date: e.target.value }))}
                      required
                    />
                    <Input
                      label="Time"
                      type="time"
                      value={investmentFormData.time ?? ''}
                      onChange={(e) => setInvestmentFormData((prev) => ({ ...prev, time: e.target.value || undefined }))}
                    />
                  </div>
                  <Input
                    label="Details"
                    value={investmentFormData.description || ''}
                    onChange={(e) => setInvestmentFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="What was this for?"
                  />
                </form>
              </DetailsSheet>
            </>
          )}
        </>
      )}
      <ConfirmSheet
        isOpen={!!deleteTransactionId}
        title="Delete Transaction"
        message="Delete this transaction?"
        confirmLabel="Delete"
        onCancel={() => setDeleteTransactionId(null)}
        onConfirm={() => {
          if (!deleteTransactionId) return;
          deleteTransaction.mutate(deleteTransactionId);
          setDeleteTransactionId(null);
        }}
        isLoading={deleteTransaction.isPending}
      />
      <ConfirmSheet
        isOpen={!!deleteInvestmentId}
        title="Delete Investment Transaction"
        message="Delete this investment transaction?"
        confirmLabel="Delete"
        onCancel={() => setDeleteInvestmentId(null)}
        onConfirm={() => {
          if (!deleteInvestmentId) return;
          deleteInvestmentTransaction.mutate(deleteInvestmentId);
          setDeleteInvestmentId(null);
        }}
        isLoading={deleteInvestmentTransaction.isPending}
      />
    </div>
  );
}
