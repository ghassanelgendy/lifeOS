import { useEffect, useRef, useState } from 'react';
import { Landmark, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button, Input, ConfirmSheet } from './ui';
import {
  useUserBanks,
  useEnsureDefaultBanks,
  useAddBank,
  useRenameBank,
  useRemoveBank,
} from '../hooks/useUserBanks';

export function BankAccountsSettingsSection() {
  const { data: banks = [], isLoading } = useUserBanks();
  const ensureDefaultBanks = useEnsureDefaultBanks();
  const addBank = useAddBank();
  const renameBank = useRenameBank();
  const removeBank = useRemoveBank();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const hasEnsuredDefaults = useRef(false);
  useEffect(() => {
    if (isLoading || banks.length > 0 || hasEnsuredDefaults.current) return;
    hasEnsuredDefaults.current = true;
    ensureDefaultBanks.mutate();
  }, [isLoading, banks.length, ensureDefaultBanks]);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addBank.mutate(trimmed, { onSuccess: () => setNewName('') });
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const commitEditing = (oldName: string) => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingId(null);
      return;
    }
    renameBank.mutate(
      { id: editingId, oldName, newName: trimmed },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const pendingDeleteBank = banks.find((b) => b.id === pendingDeleteId);

  return (
    <section id="settings-accounts" className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-20">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold">Bank accounts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the accounts (banks, cash, cards) available when logging a transaction. Renaming an account keeps
          all of its past transactions linked to it under the new name.
        </p>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="e.g. Cash, QNB, SAIB…"
            className="flex-1"
          />
          <Button size="sm" onClick={handleAdd} disabled={addBank.isPending || !newName.trim()}>
            <Plus size={16} className="mr-1" /> Add
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : banks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {banks.map((bank) => (
              <div key={bank.id} className="flex items-center justify-between rounded-lg border border-border p-3 gap-2">
                {editingId === bank.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditing(bank.name);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1"
                    />
                    <Button size="sm" variant="ghost" onClick={() => commitEditing(bank.name)} disabled={renameBank.isPending}>
                      <Check size={16} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X size={16} />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <Landmark size={16} className="text-muted-foreground shrink-0" />
                      <p className="font-medium truncate">{bank.name}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => startEditing(bank.id, bank.name)}>
                        <Pencil size={16} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingDeleteId(bank.id)}>
                        <Trash2 size={16} className="text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDeleteBank && (
        <ConfirmSheet
          isOpen
          title={`Remove ${pendingDeleteBank.name}?`}
          message="It will no longer be selectable for new transactions. Existing transactions keep their history and are not deleted."
          confirmLabel="Remove"
          confirmVariant="destructive"
          onConfirm={() => {
            removeBank.mutate(pendingDeleteBank.id);
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </section>
  );
}
