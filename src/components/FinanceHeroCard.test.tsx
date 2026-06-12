import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinanceHeroCard } from './FinanceHeroCard';
import { CURRENCY_SYMBOL } from '../lib/utils';

describe('FinanceHeroCard Component', () => {
  it('renders positive balance correctly', () => {
    const { container } = render(
      <FinanceHeroCard income={5000} expenses={2000} balance={3000} privacyMode={false} />
    );
    
    // Check main balance
    expect(screen.getByText(`${CURRENCY_SYMBOL}3,000`)).toBeInTheDocument();
    
    // Check badge
    expect(screen.getByText('Healthy Balance')).toBeInTheDocument();
    
    // Check text color class (green for positive)
    const balanceElement = screen.getByText(`${CURRENCY_SYMBOL}3,000`);
    expect(balanceElement).toHaveClass('text-green-400');
  });

  it('renders negative balance correctly with minus sign', () => {
    render(
      <FinanceHeroCard income={1000} expenses={4000} balance={-3000} privacyMode={false} />
    );
    
    // Check main balance (absolute value is rendered with a prefix minus sign)
    expect(screen.getByText(`−${CURRENCY_SYMBOL}3,000`)).toBeInTheDocument();
    
    // Check badge
    expect(screen.getByText('Overspending')).toBeInTheDocument();
    
    // Check text color class (red for negative)
    const balanceElement = screen.getByText(`−${CURRENCY_SYMBOL}3,000`);
    expect(balanceElement).toHaveClass('text-red-400');
  });

  it('applies blur when privacyMode is true', () => {
    render(
      <FinanceHeroCard income={5000} expenses={2000} balance={3000} privacyMode={true} />
    );
    
    const balanceElement = screen.getByText(`${CURRENCY_SYMBOL}3,000`);
    expect(balanceElement).toHaveClass('blur-sm');
    
    const incomeElement = screen.getByText(`${CURRENCY_SYMBOL}5,000`);
    expect(incomeElement).toHaveClass('blur-sm');
    
    const expenseElement = screen.getByText(`${CURRENCY_SYMBOL}2,000`);
    expect(expenseElement).toHaveClass('blur-sm');
  });

  it('calculates the ratio correctly when income and expenses are 0', () => {
    render(
      <FinanceHeroCard income={0} expenses={0} balance={0} privacyMode={false} />
    );
    
    // Check that it defaults to 50/50 when total is 0 to avoid division by zero
    expect(screen.getByText('50% in')).toBeInTheDocument();
    expect(screen.getByText('50% out')).toBeInTheDocument();
  });
});
