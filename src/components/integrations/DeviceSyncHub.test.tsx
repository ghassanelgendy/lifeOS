import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeviceSyncHub } from './DeviceSyncHub';
import { useUIStore } from '../../stores/useUIStore';

const bridgeMock = {
  getAutomationStatus: vi.fn().mockResolvedValue({
    hasSmsPermission: false,
    hasUsageStatsPermission: false,
    isConfigured: true,
  }),
  requestUsageStatsPermission: vi.fn().mockResolvedValue(undefined),
  requestPermissions: vi.fn().mockResolvedValue(undefined),
  triggerScreenTimeSyncNow: vi.fn().mockResolvedValue(undefined),
};

const syncAndroidMock = vi.fn().mockResolvedValue(true);

const capacitorState = {
  platform: 'web',
  native: false,
};

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => capacitorState.platform,
    isNativePlatform: () => capacitorState.native,
  },
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-abc-123',
      email: 'user@lifeos.app',
    },
  }),
}));

vi.mock('../../lib/nativeBridge', () => ({
  LifeOSAndroidBridge: {
    getAutomationStatus: () => bridgeMock.getAutomationStatus(),
    requestUsageStatsPermission: () => bridgeMock.requestUsageStatsPermission(),
    requestPermissions: (opts: { permissions: string[] }) => bridgeMock.requestPermissions(opts),
    triggerScreenTimeSyncNow: () => bridgeMock.triggerScreenTimeSyncNow(),
  },
  syncAndroidNativeBridge: (userId: string) => syncAndroidMock(userId),
}));

describe('DeviceSyncHub', () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    capacitorState.platform = 'web';
    capacitorState.native = false;
    writeTextMock.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    Object.values(bridgeMock).forEach((fn) => fn.mockClear());
    syncAndroidMock.mockClear();
    useUIStore.setState({ onboardingChecklistExtras: {} });
  });

  it('supports 1-click browser extension pairing via window.postMessage', async () => {
    const postSpy = vi.spyOn(window, 'postMessage');

    render(<DeviceSyncHub />);

    expect(postSpy).toHaveBeenCalledWith(
      { type: 'LIFEOS_EXTENSION_PING' },
      window.location.origin
    );

    fireEvent.click(screen.getByRole('button', { name: /1-Click Connect Extension/i }));
    expect(postSpy).toHaveBeenCalledWith(
      { type: 'LIFEOS_EXTENSION_PAIR_REQUEST' },
      window.location.origin
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window,
          data: {
            type: 'LIFEOS_EXTENSION_PAIR_RESULT',
            installed: true,
            connected: true,
            userEmail: 'user@lifeos.app',
          },
        })
      );
    });

    expect(await screen.findByText('Connected: user@lifeos.app')).toBeTruthy();
    expect(useUIStore.getState().onboardingChecklistExtras.reviewed_integrations).toBe(true);
    postSpy.mockRestore();
  });

  it('generates pre-filled Chronos 1-line setup commands with active user_id', async () => {
    render(<DeviceSyncHub />);

    fireEvent.click(screen.getByRole('tab', { name: /Windows \/ Linux PC/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Linux' }));
    fireEvent.click(screen.getByRole('button', { name: /Copy 1-Line Terminal Setup/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });
    const cmd = writeTextMock.mock.calls[0][0] as string;
    expect(cmd).toContain('~/.chronos/config.json');
    expect(cmd).toContain('"user_id":"user-abc-123"');
    expect(cmd).toContain('"source":"chronos-screentime"');
  });

  it('copies pre-filled iPhone Bank SMS URL without requiring manual User ID entry', async () => {
    render(<DeviceSyncHub />);

    fireEvent.click(screen.getByRole('tab', { name: /iPhone \/ Watch/i }));
    fireEvent.click(screen.getByRole('button', { name: /Copy Personalized URL/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });
    const url = writeTextMock.mock.calls[0][0] as string;
    expect(url).toContain('/functions/v1/process-sms?user_id=user-abc-123');
  });

  it('wires native Android bridge permissions and immediate sync controls', async () => {
    capacitorState.platform = 'android';
    capacitorState.native = true;

    render(<DeviceSyncHub />);

    expect(await screen.findByText('Needs Permission')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /1\. Allow Usage Access/i }));
    await waitFor(() => {
      expect(syncAndroidMock).toHaveBeenCalledWith('user-abc-123');
      expect(bridgeMock.requestUsageStatsPermission).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /2\. Allow Bank SMS Auto-Log/i }));
    await waitFor(() => {
      expect(bridgeMock.requestPermissions).toHaveBeenCalledWith({ permissions: ['sms'] });
    });

    fireEvent.click(screen.getByRole('button', { name: /Sync Now/i }));
    await waitFor(() => {
      expect(bridgeMock.triggerScreenTimeSyncNow).toHaveBeenCalledTimes(1);
    });
  });
});
