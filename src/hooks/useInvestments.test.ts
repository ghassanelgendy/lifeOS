import { describe, it, expect } from 'vitest';
import { getInvestmentBreakdown } from './useInvestments';
import type { InvestmentTransaction } from '../types/schema';

describe('useInvestments: getInvestmentBreakdown', () => {
  it('accurately calculates total income, total expense, and net balance for investments', () => {
    const mockTransactions: Partial<InvestmentTransaction>[] = [
      { id: '1', amount: 1000, type: 'income' },
      { id: '2', amount: 500, type: 'income' },
      { id: '3', amount: 200, type: 'expense' },
      { id: '4', amount: 100, type: 'expense' },
    ];

    const result = getInvestmentBreakdown(mockTransactions as InvestmentTransaction[]);

    expect(result.totalIncome).toBe(1500);
    expect(result.totalExpense).toBe(300);
    expect(result.balance).toBe(1200);
  });

  it('handles empty arrays safely', () => {
    const result = getInvestmentBreakdown([]);

    expect(result.totalIncome).toBe(0);
    expect(result.totalExpense).toBe(0);
    expect(result.balance).toBe(0);
  });

  it('handles transactions with string amounts gracefully', () => {
    // Supabase numeric fields often return as strings in the JS client
    const mockTransactions: any[] = [
      { id: '1', amount: '1000.50', type: 'income' },
      { id: '2', amount: '250.25', type: 'expense' },
    ];

    const result = getInvestmentBreakdown(mockTransactions);

    expect(result.totalIncome).toBe(1000.50);
    expect(result.totalExpense).toBe(250.25);
    expect(result.balance).toBe(750.25);
  });
});
