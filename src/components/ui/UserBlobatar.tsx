import React from 'react';
import { Blobatar } from '@blobatar/react';
import { cn } from '../../lib/utils';

export interface UserBlobatarProps {
  /** Identifier used to deterministically generate the avatar (e.g. user ID, email, or display name) */
  identifier?: string | null;
  /** Size in pixels (default: 36) */
  size?: number;
  /** Optional custom CSS classes for the container */
  className?: string;
  /** Custom alt / title attribute */
  title?: string;
}

export const UserBlobatar: React.FC<UserBlobatarProps> = ({
  identifier,
  size = 36,
  className,
  title,
}) => {
  // Use user id/email or a clean default seed
  const seed = (identifier && identifier.trim().length > 0) ? identifier.trim() : 'lifeos-user';

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden shadow-xs ring-1 ring-border/50 bg-secondary/30',
        className
      )}
      style={{ width: size, height: size }}
      title={title || seed}
    >
      <Blobatar name={seed} size={size} />
    </div>
  );
};
