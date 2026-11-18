import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageWidgetsSection } from './PageWidgetsSection';
import { PAGE_WIDGET_DEFAULTS, useUIStore } from '../../stores/useUIStore';

describe('PageWidgetsSection', () => {
  beforeEach(() => {
    useUIStore.setState({
      pageWidgetOrder: {
        dashboard: [...PAGE_WIDGET_DEFAULTS.dashboard],
        habits: [...PAGE_WIDGET_DEFAULTS.habits],
        sleep: [...PAGE_WIDGET_DEFAULTS.sleep],
      },
      pageWidgetVisible: {
        dashboard: PAGE_WIDGET_DEFAULTS.dashboard.reduce((a, id) => ({ ...a, [id]: true }), {}),
        habits: PAGE_WIDGET_DEFAULTS.habits.reduce((a, id) => ({ ...a, [id]: true }), {}),
        sleep: PAGE_WIDGET_DEFAULTS.sleep.reduce((a, id) => ({ ...a, [id]: true }), {}),
      },
    });
  });

  it('auto-selects Sleep tab from ?widgets=sleep and toggles, reorders, compacts, and resets widgets', () => {
    render(
      <MemoryRouter initialEntries={['/settings?section=layout&widgets=sleep']}>
        <PageWidgetsSection />
      </MemoryRouter>
    );

    const sleepTab = screen.getByRole('tab', { name: /Sleep/i });
    expect(sleepTab.getAttribute('aria-selected')).toBe('true');

    // Toggle off "Sleep stages hypnogram"
    const timelineSwitch = screen.getByRole('switch', { name: 'Sleep stages hypnogram' });
    expect(timelineSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(timelineSwitch);
    expect(useUIStore.getState().pageWidgetVisible.sleep.timeline).toBe(false);

    // Move "Sleep stages hypnogram" up to first slot
    fireEvent.click(screen.getByRole('button', { name: 'Move Sleep stages hypnogram up' }));
    expect(useUIStore.getState().pageWidgetOrder.sleep[0]).toBe('timeline');

    // Compact keeps essential Sleep widgets (score & sessions)
    fireEvent.click(screen.getByRole('button', { name: /Compact/i }));
    expect(useUIStore.getState().pageWidgetVisible.sleep).toEqual({
      score: true,
      timeline: false,
      metrics: false,
      weekly: false,
      sessions: true,
    });

    // Reset restores defaults
    fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
    expect(useUIStore.getState().pageWidgetOrder.sleep).toEqual(PAGE_WIDGET_DEFAULTS.sleep);
    expect(useUIStore.getState().pageWidgetVisible.sleep.timeline).toBe(true);
  });

  it('switches to Habits and recovers cleanly when all sections are toggled off', () => {
    render(
      <MemoryRouter initialEntries={['/settings?section=layout']}>
        <PageWidgetsSection />
      </MemoryRouter>
    );

    expect(screen.getByRole('tab', { name: /Habits/i }).getAttribute('aria-selected')).toBe('true');

    ['Stats cards', 'Prayer tracking', 'This week grid', "Today's habits"].forEach((label) => {
      fireEvent.click(screen.getByRole('switch', { name: label }));
    });

    expect(screen.getByText(/All Habits sections are currently hidden/i)).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /Show All/i })[0]);
    expect(useUIStore.getState().pageWidgetVisible.habits.today).toBe(true);
    expect(screen.queryByText(/All Habits sections are currently hidden/i)).toBeNull();
  });
});
