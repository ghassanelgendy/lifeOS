import React, { useRef, useState } from 'react';
import { Image as ImageIcon, X, Loader2, ExternalLink, Paperclip } from 'lucide-react';
import type { MediaAttachment } from '../types/schema';
import { uploadAttachment, validateImageFile } from '../lib/attachments';
import { cn } from '../lib/utils';

interface AttachmentManagerProps {
  attachments?: MediaAttachment[];
  onChange: (attachments: MediaAttachment[]) => void;
  category?: 'tasks' | 'notes';
  readOnly?: boolean;
  className?: string;
}

export function AttachmentManager({
  attachments = [],
  onChange,
  category = 'tasks',
  readOnly = false,
  className,
}: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<MediaAttachment | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setIsUploading(true);

    try {
      const newAttachments: MediaAttachment[] = [...attachments];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const validation = validateImageFile(file);
        if (!validation.valid) {
          setError(validation.error || 'Invalid file format');
          continue;
        }
        const uploaded = await uploadAttachment(file, category);
        newAttachments.push(uploaded);
      }
      onChange(newAttachments);
    } catch (err: any) {
      setError(err?.message || 'Failed to attach image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(attachments.filter((a) => a.id !== id));
  };

  const handleAddClick = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Grid of thumbnails */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              onClick={() => setSelectedPreview(att)}
              className="group relative aspect-video rounded-xl overflow-hidden border border-border bg-muted/40 cursor-pointer shadow-xs hover:border-primary/40 transition-all"
            >
              <img
                src={att.url}
                alt={att.name || 'Attachment'}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                <span className="text-[10px] text-white truncate max-w-[80%] font-medium">
                  {att.name}
                </span>
                <ExternalLink size={12} className="text-white shrink-0" />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => handleRemove(att.id, e)}
                  aria-label="Remove image"
                  className="absolute top-1.5 right-1.5 size-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-destructive transition-colors shadow-sm"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {!readOnly && (
        <button
          type="button"
          onClick={handleAddClick}
          disabled={isUploading}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Add image attachment"
        >
          {isUploading ? (
            <>
              <Loader2 size={16} className="animate-spin text-primary" />
              <span>Attaching image...</span>
            </>
          ) : (
            <>
              <ImageIcon size={16} />
              <span>{attachments.length > 0 ? 'Add another image...' : 'Add Image...'}</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}

      {/* Lightbox Modal */}
      {selectedPreview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedPreview(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center bg-card rounded-2xl overflow-hidden border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-3 border-b border-border bg-muted/30">
              <span className="text-xs font-medium text-foreground truncate max-w-md">
                {selectedPreview.name}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={selectedPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Open original"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedPreview(null)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-2 overflow-auto max-h-[calc(90vh-60px)] flex items-center justify-center">
              <img
                src={selectedPreview.url}
                alt={selectedPreview.name}
                className="max-h-[80vh] max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
