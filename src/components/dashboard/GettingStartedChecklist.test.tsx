import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GettingStartedChecklist } from './GettingStartedChecklist';
import { useUIStore } from '../../stores/useUIStore';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../hooks/useTasks', () => ({
  useTodayTasks: () => ({ data: [] }),
  useCompletedTasks: () => ({ data: [] }),
}));

vi.mock('../../hooks/useHabits', () => ({
  useTodayHabitLogs: () => ({ data: [] }),
}));

vi.mock('../../hooks/useAzkar', () => ({
  useTodayAzkarProgress: () => ({ progress: { counts: {} } }),
}));

vi.mock('../../hooks/useScreentime', () => ({
  useTodayScreentime: () => ({ totalMinutes: 0 }),
}));

vi.mock('../../hooks/useSleep', () => ({
  useLastNightSleepMinutes: () => 0,
}));

describe('GettingStartedChecklist deep-links', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useUIStore.setState({
      hasCompletedOnboarding: true,
      hasDismissedGettingStarted: false,
      prayerLocationLabel: 'Cairo, Egypt',
      onboardingChecklistExtras: {},
      onboardingProfile: {
        focusAreas: ['salah_anchor', 'finance_rizq'],
        workflowStyle: 'prayer_anchored',
        tailoredChecklistKeys: ['prayer_city', 'daily_routine', 'first_task', 'reality_sync', 'finance_check'],
      },
    });
  });

  it('redirects each checklist action directly to its exact target section or quick-create flow', () => {
    render(
      <MemoryRouter>
        <GettingStartedChecklist />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set city' }));
    expect(navigateMock).toHaveBeenCalledWith('/settings?section=prayer');

    fireEvent.click(screen.getByRole('button', { name: 'Open Habits' }));
    expect(navigateMock).toHaveBeenCalledWith('/habits?section=prayers');

    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(navigateMock).toHaveBeenCalledWith('/tasks?quick=add');

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(navigateMock).toHaveBeenCalledWith('/screentime');

    fireEvent.click(screen.getByRole('button', { name: 'Open Finance' }));
    expect(navigateMock).toHaveBeenCalledWith('/finance?quick=expense');
  });
});
