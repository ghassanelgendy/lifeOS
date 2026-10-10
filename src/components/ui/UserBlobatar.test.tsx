import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { UserBlobatar } from './UserBlobatar';

describe('UserBlobatar Component', () => {
  it('renders avatar image correctly for user email', () => {
    const { container } = render(<UserBlobatar identifier="testuser@lifeos.app" size={40} />);
    const img = container.querySelector('img');
    expect(img).toBeDefined();
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('data:image/svg+xml');
  });

  it('renders with fallback seed when identifier is null or empty', () => {
    const { container } = render(<UserBlobatar identifier="" size={32} />);
    const img = container.querySelector('img');
    expect(img).toBeDefined();
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain('data:image/svg+xml');
  });

  it('sets custom title and size style correctly', () => {
    render(<UserBlobatar identifier="user123" size={48} title="Custom Assistant Avatar" />);
    const avatarEl = screen.getByTitle('Custom Assistant Avatar');
    expect(avatarEl).toBeDefined();
    expect(avatarEl.style.width).toBe('48px');
    expect(avatarEl.style.height).toBe('48px');
  });

  it('renders unbordered avatar without rounded-full and ring classes', () => {
    const { container } = render(<UserBlobatar identifier="user123" size={24} unbordered />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).not.toContain('rounded-full');
    expect(wrapper.className).not.toContain('ring-1');
  });
});
