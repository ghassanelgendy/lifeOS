import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { IconButton } from './IconButton';
import { Switch } from './Switch';
import { Segmented } from './Segmented';
import { ListRow } from './Card';
import { EmptyState } from './EmptyState';
import { Toaster, toast, useToastStore } from './Toast';

describe('IconButton', () => {
  it('exposes its label as the accessible name', () => {
    render(<IconButton label="Add task"><span /></IconButton>);
    expect(screen.getByRole('button', { name: 'Add task' })).toBeTruthy();
  });
});

describe('Switch', () => {
  it('toggles and reports aria-checked', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Sound" />);
    const sw = screen.getByRole('switch', { name: 'Sound' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Segmented', () => {
  function Harness() {
    const [v, setV] = useState('a');
    return <Segmented label="View" value={v} onChange={setV} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]} />;
  }
  it('moves selection with arrow keys and wraps', () => {
    render(<Harness />);
    const a = screen.getByRole('radio', { name: 'A' });
    fireEvent.keyDown(a, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'C' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'A' }).getAttribute('tabindex')).toBe('-1');
  });
});

describe('ListRow', () => {
  it('renders a single button target when pressable', () => {
    const onPress = vi.fn();
    render(<ListRow title="Notifications" subtitle="On" onPress={onPress} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('shows title, description and action', () => {
    render(<EmptyState title="No notes" description="Create one." action={<button>New note</button>} />);
    expect(screen.getByText('No notes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New note' })).toBeTruthy();
  });
});

describe('Toast undo', () => {
  it('runs undo once and removes the toast', () => {
    useToastStore.setState({ toasts: [] });
    const undo = vi.fn();
    render(<Toaster />);
    act(() => { toast.undoable('Task deleted', undo); });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Task deleted')).toBeNull();
  });
});
