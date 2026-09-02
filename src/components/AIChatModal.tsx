import React from 'react';
import { Modal } from './ui';
import Chat from '../routes/Chat';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export function AIChatModal({ isOpen, onClose, initialPrompt = '' }: AIChatModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Assistant"
      className="max-w-4xl h-[85vh] p-0 flex flex-col overflow-hidden"
      panelStyle={{ height: '85vh', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
    >
      <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
        <Chat isModal={true} initialPrompt={initialPrompt} onCloseModal={onClose} />
      </div>
    </Modal>
  );
}
