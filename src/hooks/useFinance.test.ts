import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getBreakdownFromTransactions } from './useFinance';
import type { Transaction } from '../types/schema';

describe('useFinance: getBreakdownFromTransactions', () => {
  beforeAll(() => {
    // Set system time to October 15, 2023 for predictable 'current month' logic
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-10-15T12:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('filters transactions to the current month and calculates accurate totals', () => {
    const mockTransactions: Partial<Transaction>[] = [
      // Current month expenses (October 2023)
      { id: '1', amount: 100, type: 'expense', category: 'food', date: '2023-10-01' },
      { id: '2', amount: 50.5, direction: 'Out', category: 'transport', date: '2023-10-14' },
      
      // Current month income (October 2023)
      { id: '3', amount: 2000, type: 'income', category: 'salary', date: '2023-10-05' },
      { id: '4', amount: 500, direction: 'In', category: 'freelance', date: '2023-10-10' },

      // Past month transactions (September 2023) - Should be IGNORED
      { id: '5', amount: 999, type: 'expense', category: 'shopping', date: '2023-09-30' },
      { id: '6', amount: 5000, type: 'income', category: 'salary', date: '2023-09-01' },
    ];

    const result = getBreakdownFromTransactions(mockTransactions as Transaction[]);

    // Only October transactions should be counted
    expect(result.transactions).toHaveLength(4);

    // Summing Income: 2000 + 500 = 2500
    expect(result.totalIncome).toBe(2500);

    // Summing Expenses: 100 + 50.5 = 150.5
    expect(result.totalExpenses).toBe(150.5);

    // Balance: 2500 - 150.5 = 2349.5
    expect(result.balance).toBe(2349.5);

    // Category Breakdowns
    expect(result.expensesByCategory).toEqual({
      food: 100,
      transport: 50.5
    });
    
    expect(result.incomeByCategory).toEqual({
      salary: 2000,
      freelance: 500
    });
  });

  it('handles empty transaction arrays safely', () => {
    const result = getBreakdownFromTransactions([]);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.expensesByCategory).toEqual({});
    expect(result.incomeByCategory).toEqual({});
  });

  it('correctly rounds decimals to prevent floating point drift', () => {
    const mockTransactions: Partial<Transaction>[] = [
      { id: '1', amount: 10.33, type: 'expense', category: 'food', date: '2023-10-01' },
      { id: '2', amount: 10.33, type: 'expense', category: 'food', date: '2023-10-02' },
      { id: '3', amount: 10.33, type: 'expense', category: 'food', date: '2023-10-03' },
    ];

    const result = getBreakdownFromTransactions(mockTransactions as Transaction[]);
    
    // 10.33 * 3 = 30.99
    expect(result.totalExpenses).toBe(30.99);
    expect(result.expensesByCategory['food']).toBe(30.99);
  });
});
