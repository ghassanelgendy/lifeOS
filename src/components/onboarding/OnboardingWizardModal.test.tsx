import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingWizardModal } from './OnboardingWizardModal';
import { useUIStore } from '../../stores/useUIStore';

const mutateAsyncMock = vi.fn().mockResolvedValue({});
const generateSmartMock = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'muslim@example.com',
      app_metadata: { provider: 'offline' },
      user_metadata: { name: 'Ghassan' },
    },
  }),
}));

vi.mock('../../hooks/useTasks', () => ({
  useCreateTask: () => ({
    mutateAsync: mutateAsyncMock,
  }),
}));

vi.mock('../../hooks/usePrayerTimes', () => ({
  usePrayerTimes: () => ({
    times: [
      { name: 'Fajr', time: new Date('2026-11-18T05:00:00'), isNext: false },
      { name: 'Dhuhr', time: new Date('2026-11-18T11:50:00'), isNext: true },
    ],
  }),
}));

vi.mock('../../lib/prayerGeocoding', () => ({
  searchCities: vi.fn().mockResolvedValue([{ lat: 51.5072, lng: -0.1276, label: 'London, United Kingdom' }]),
  reverseGeocodeLabel: vi.fn().mockResolvedValue('London, United Kingdom'),
}));

vi.mock('../../lib/onboardingRecommendations', async () => {
  const actual = await vi.importActual<typeof import('../../lib/onboardingRecommendations')>(
    '../../lib/onboardingRecommendations'
  );
  return {
    ...actual,
    generateSmartOnboardingSetup: (...args: unknown[]) => generateSmartMock(...args),
  };
});

function renderWizard() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OnboardingWizardModal />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('OnboardingWizardModal', () => {
  beforeEach(() => {
    mutateAsyncMock.mockClear();
    generateSmartMock.mockReset();
    useUIStore.setState({
      hasCompletedOnboarding: false,
      isRemoteUiSettingsReady: true,
      hasCompletedTour: false,
      isTourOpen: false,
    });
  });

  it('waits until isRemoteUiSettingsReady is true before rendering', () => {
    useUIStore.setState({ isRemoteUiSettingsReady: false, hasCompletedOnboarding: false });
    renderWizard();
    expect(screen.queryByText(/Welcome to lifeOS/i)).not.toBeInTheDocument();
  });

  it('progresses from discovery questions to suggested setup and enters lifeOS without auto-starting tour', async () => {
    const actual = await vi.importActual<typeof import('../../lib/onboardingRecommendations')>(
      '../../lib/onboardingRecommendations'
    );
    generateSmartMock.mockResolvedValue({
      ...actual.buildRecommendedSetup(actual.DEFAULT_ONBOARDING_ANSWERS),
      source: 'ai',
      profileLabel: 'Prayer-Anchored Builder',
    });

    renderWizard();

    expect(screen.getByText(/What do you want to focus on right now/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Build my setup/i }));

    await waitFor(() => {
      expect(screen.getByText('Prayer-Anchored Builder')).toBeInTheDocument();
      expect(screen.getByText('Tailored by AI')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Next: Prayer & Sync/i }));

    await waitFor(() => {
      expect(screen.getByText(/Your Prayer City/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Enter lifeOS/i }));

    await waitFor(() => {
      expect(useUIStore.getState().hasCompletedOnboarding).toBe(true);
      expect(useUIStore.getState().isTourOpen).toBe(false);
    });
  });

  it('allows skipping setup immediately from Step 1', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Skip setup/i }));
    expect(useUIStore.getState().hasCompletedOnboarding).toBe(true);
    expect(useUIStore.getState().isTourOpen).toBe(false);
  });
});
