import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppJoyrideTour } from './AppJoyrideTour';
import { useUIStore } from '../stores/useUIStore';

let capturedProps: { run?: boolean; steps?: Array<{ target: string }> } | null = null;

vi.mock('react-joyride', () => ({
  Joyride: (props: { run?: boolean; steps?: Array<{ target: string }> }) => {
    capturedProps = props;
    return <div data-testid="mock-joyride" data-run={String(props.run)} />;
  },
  STATUS: { FINISHED: 'finished', SKIPPED: 'skipped' },
  ACTIONS: { SKIP: 'skip', CLOSE: 'close' },
  EVENTS: { TOUR_END: 'tour:end' },
}));

vi.mock('../lib/theme', () => ({
  useEffectiveTheme: () => 'light',
}));

describe('AppJoyrideTour', () => {
  beforeEach(() => {
    capturedProps = null;
    document.body.innerHTML = '';
    useUIStore.setState({
      isTourOpen: false,
      isRemoteUiSettingsReady: true,
      hasCompletedOnboarding: true,
      tourSessionKey: 0,
    });
  });

  it('does not mount automatically when isTourOpen is false (opt-in only)', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppJoyrideTour />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('mock-joyride')).not.toBeInTheDocument();
  });

  it('does not run outside /dashboard even when isTourOpen is true', () => {
    useUIStore.setState({ isTourOpen: true });
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <AppJoyrideTour />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('mock-joyride')).not.toBeInTheDocument();
  });

  it('runs on /dashboard when restartTour is triggered and targets desktop selectors cleanly', () => {
    document.body.innerHTML = `
      <div data-tour="spiritual-banners"></div>
      <div data-tour="day-progress"></div>
      <div data-tour="metric-cards"></div>
      <div data-tour="due-today"></div>
      <button data-tour="brain-dump"></button>
      <nav data-tour="sidebar-nav"></nav>
    `;

    useUIStore.getState().restartTour();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppJoyrideTour />
      </MemoryRouter>
    );

    expect(screen.getByTestId('mock-joyride')).toHaveAttribute('data-run', 'true');
    const targets = capturedProps?.steps?.map((s) => s.target) ?? [];
    expect(targets).toContain('[data-tour="brain-dump"]');
    expect(targets).toContain('[data-tour="sidebar-nav"]');
    expect(targets.some((t) => t.includes(','))).toBe(false);
  });
});
