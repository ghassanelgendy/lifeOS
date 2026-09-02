import React, { useState } from 'react';
import { Users, UserPlus, X, Check, Mail, ShieldCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { triggerHaptics } from '../../lib/nativeBridge';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityName: string;
  entityType: 'list' | 'note';
  sharedWith?: string[];
  onShare: (email: string) => void;
  onUnshare: (email: string) => void;
}

export function ShareModal({
  isOpen,
  onClose,
  title,
  entityName,
  entityType,
  sharedWith = [],
  onShare,
  onUnshare,
}: ShareModalProps) {
  const [emailInput, setEmailInput] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = emailInput.trim().toLowerCase();
    if (!clean) return;
    if (!clean.includes('@') || !clean.includes('.')) {
      alert('Please enter a valid email address.');
      return;
    }
    if (sharedWith.includes(clean)) {
      alert('This user is already a collaborator.');
      return;
    }

    onShare(clean);
    void triggerHaptics('success');
    setSuccessMessage(`Invited ${clean} to collaborate on this ${entityType}!`);
    setEmailInput('');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRemoveCollaborator = (email: string) => {
    onUnshare(email);
    void triggerHaptics('medium');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4 py-1 text-foreground font-sans">
        {/* Header summary */}
        <div className="rounded-xl border border-border/50 bg-secondary/30 p-3 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <Users className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold truncate">{entityName}</p>
            <p className="text-xs text-muted-foreground">
              Collaborate in real-time on this {entityType === 'list' ? 'shared todo list' : 'shared note'} with another user.
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAddCollaborator} className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Invite Collaborator
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="colleague@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
            >
              <UserPlus className="size-3.5" />
              Invite
            </button>
          </div>
        </form>

        {successMessage && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-2.5 text-xs font-medium flex items-center gap-2">
            <Check className="size-4 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Current Collaborators */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Collaborators ({sharedWith.length})
            </span>
          </div>

          {sharedWith.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              No active collaborators yet. Invite someone above to share this {entityType}.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {sharedWith.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-card hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                      {email[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{email}</p>
                      <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                        <ShieldCheck className="size-3" /> Can view & edit
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCollaborator(email)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    title="Remove collaborator"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
