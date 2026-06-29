import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinanceBudgetRing } from './FinanceBudgetRing';
import { CURRENCY_SYMBOL } from '../lib/utils';

describe('FinanceBudgetRing Component', () => {
  it('renders correctly when under budget', () => {
    render(
      <FinanceBudgetRing totalBudget={1000} totalSpent={400} privacyMode={false} />
    );
    
    // 40% used
    expect(screen.getByText('40%')).toBeInTheDocument();
    
    // Spent
    expect(screen.getByText(`${CURRENCY_SYMBOL}400`)).toBeInTheDocument();
    
    // Remaining
    expect(screen.getByText(`${CURRENCY_SYMBOL}600`)).toBeInTheDocument();
    
    // Ring percentage text color (primary)
    expect(screen.getByText('40%')).toHaveClass('text-primary');
  });

  it('renders correctly when over budget', () => {
    render(
      <FinanceBudgetRing totalBudget={1000} totalSpent={1200} privacyMode={false} />
    );
    
    // 100% used (capped at 100 for visual)
    expect(screen.getByText('100%')).toBeInTheDocument();
    
    // Spent
    expect(screen.getByText(`${CURRENCY_SYMBOL}1,200`)).toBeInTheDocument();
    
    // Remaining (negative)
    expect(screen.getByText(`−${CURRENCY_SYMBOL}200`)).toBeInTheDocument();
    
    // Ring percentage text color (red)
    expect(screen.getByText('100%')).toHaveClass('text-red-400');
  });

  it('handles zero budget safely (avoids division by zero)', () => {
    render(
      <FinanceBudgetRing totalBudget={0} totalSpent={100} privacyMode={false} />
    );
    
    // 0% used
    expect(screen.getByText('0%')).toBeInTheDocument();
    
    // Spent
    expect(screen.getByText(`${CURRENCY_SYMBOL}100`)).toBeInTheDocument();
    
    // Remaining
    expect(screen.getByText(`−${CURRENCY_SYMBOL}100`)).toBeInTheDocument();
  });

  it('applies blur when privacyMode is true', () => {
    render(
      <FinanceBudgetRing totalBudget={1000} totalSpent={400} privacyMode={true} />
    );
    
    const spentElement = screen.getByText(`${CURRENCY_SYMBOL}400`);
    expect(spentElement).toHaveClass('blur-sm');
    
    const remainingElement = screen.getByText(`${CURRENCY_SYMBOL}600`);
    expect(remainingElement).toHaveClass('blur-sm');
  });
});
