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
    expect(screen.queryByText(/Set up lifeOS/i)).not.toBeInTheDocument();
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

    expect(screen.getByLabelText(/Set up lifeOS around your day/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Start/i }));
    expect(await screen.findByText(/What do you want help with/i)).toBeInTheDocument();

    // Default focus includes prayers, so the prayer-backlog question is asked.
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Do you have prayers to make up/i)).toBeInTheDocument();
    for (const heading of [/How do you plan your day/i, /Anything you want to build or quit/i, /Your devices and daily limits/i]) {
      fireEvent.click(screen.getByRole('button', { name: /^Next/i }));
      expect(await screen.findByText(heading)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: /Build my setup/i }));

    expect(await screen.findByText(/Built with AI from your answers/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Prayer-Anchored Builder')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Looks good/i }));
    expect(await screen.findByText(/Which pages go in your sidebar/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Starter habits and tasks/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/Where do you pray/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/You're ready/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enter lifeOS/i }));

    await waitFor(() => {
      expect(useUIStore.getState().hasCompletedOnboarding).toBe(true);
      expect(useUIStore.getState().isTourOpen).toBe(false);
    });
  });

  it('skips the prayer-backlog question when prayers are not a focus', async () => {
    renderWizard();
    // Untick the prayer focus area, then step forward.
    fireEvent.click(screen.getByRole('button', { name: /^Start/i }));
    fireEvent.click(await screen.findByText(/Guard 5 Prayers/i));
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }));
    expect(await screen.findByText(/How do you plan your day/i)).toBeInTheDocument();
    expect(screen.queryByText(/Do you have prayers to make up/i)).not.toBeInTheDocument();
  });

  it('allows skipping setup immediately from Step 1', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Skip setup/i }));
    expect(useUIStore.getState().hasCompletedOnboarding).toBe(true);
    expect(useUIStore.getState().isTourOpen).toBe(false);
  });
});
