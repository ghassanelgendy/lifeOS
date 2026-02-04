import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle,
  Dumbbell,
  LayoutDashboard,
  Plus,
  Settings,
  FileText,
  Target,
  Wallet,
  Shield,
  Moon,
  Sun
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { togglePrivacyMode, privacyMode, theme, setTheme } = useUIStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Command Menu"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[640px] w-full bg-popover text-popover-foreground shadow-2xl rounded-xl border border-border p-2 z-[9999]"
      overlayClassName="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999]"
    >
      <div className="flex items-center border-b border-border px-3">
        <Command.Input
          placeholder="Type a command or search..."
          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden py-2 px-1 scrollbar-hide">
        <Command.Empty className="py-6 text-center text-sm">No results found.</Command.Empty>

        <Command.Group heading="Quick Actions" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          <Command.Item
            onSelect={() => runCommand(() => {
              navigate('/health');
              // Would trigger modal via global state in a full implementation
            })}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Add InBody Scan</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/habits'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            <span>Log Habit</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/finance'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <Wallet className="mr-2 h-4 w-4" />
            <span>Add Transaction</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/calendar'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <Calendar className="mr-2 h-4 w-4" />
            <span>New Event</span>
          </Command.Item>
        </Command.Group>

        <Command.Separator className="my-1 h-px bg-border" />

        <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          <Command.Item
            onSelect={() => runCommand(() => navigate('/'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/health'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <Dumbbell className="mr-2 h-4 w-4" />
            <span>Health & Bio-Metrics</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/habits'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <Target className="mr-2 h-4 w-4" />
            <span>Habits</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/academics'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <FileText className="mr-2 h-4 w-4" />
            <span>Academics</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/calendar'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <Calendar className="mr-2 h-4 w-4" />
            <span>Calendar</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/finance'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <Wallet className="mr-2 h-4 w-4" />
            <span>Finance</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => navigate('/settings'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Command.Item>
        </Command.Group>

        <Command.Separator className="my-1 h-px bg-border" />

        <Command.Group heading="Preferences" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          <Command.Item
            onSelect={() => runCommand(togglePrivacyMode)}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            <Shield className="mr-2 h-4 w-4" />
            <span>{privacyMode ? 'Disable' : 'Enable'} Privacy Mode</span>
          </Command.Item>
          <Command.Item
            onSelect={() => runCommand(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
            className="group relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            <span>Toggle {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
      
      <div className="border-t border-border pt-2 px-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">ESC</kbd> to close</span>
        <span><kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">K</kbd></span>
      </div>
    </Command.Dialog>
  );
}
