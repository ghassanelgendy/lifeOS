import type { MediaAttachment } from '../types/schema';

export const R2_PUBLIC_BASE_URL = 'https://pub-4ec7697d65bc4179a305600c7075c68e.r2.dev';

export interface AttachmentUploadOptions {
  category?: 'tasks' | 'notes';
  customUrl?: string;
}

/**
 * Validates image file type and size.
 * Enforces images only and max 15MB.
 */
export function validateImageFile(file: File, maxSizeBytes: number = 15 * 1024 * 1024): { valid: boolean; error?: string } {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Only image files (JPEG, PNG, WebP, GIF, SVG) are allowed.' };
  }
  if (file.size > maxSizeBytes) {
    const sizeMb = Math.round(maxSizeBytes / (1024 * 1024));
    return { valid: false, error: `File is too large. Maximum size is ${sizeMb}MB.` };
  }
  return { valid: true };
}

/**
 * Converts a raw File to base64 Data URL for local/offline fallback display.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Generate a safe unique filename key.
 */
export function generateAttachmentKey(file: File, category: 'tasks' | 'notes' = 'tasks', userId: string = 'shared'): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const cleanExt = ext.replace(/[^a-z0-9]/g, '');
  const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const dateStr = new Date().toISOString().slice(0, 10);
  return `${category}/${dateStr}/${userId}-${uniqueId}.${cleanExt}`;
}

/**
 * Upload an image file.
 * If a presigned URL or R2 worker endpoint is configured, it will PUT there.
 * Otherwise, stores safely in localStorage / offline base64 data url or the public bucket url.
 */
export async function uploadAttachment(
  file: File,
  category: 'tasks' | 'notes' = 'tasks',
  userId: string = 'shared'
): Promise<MediaAttachment> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  const fileId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const key = generateAttachmentKey(file, category, userId);

  // If Cloudflare Worker / presigned endpoint is available via env or local edge function:
  const presignEndpoint = (import.meta as any).env?.VITE_R2_UPLOAD_ENDPOINT;
  
  if (presignEndpoint) {
    try {
      const res = await fetch(presignEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, contentType: file.type }),
      });
      if (res.ok) {
        const { uploadUrl, publicUrl } = await res.json();
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (uploadRes.ok) {
          return {
            id: fileId,
            url: publicUrl || `${R2_PUBLIC_BASE_URL}/${key}`,
            name: file.name,
            size: file.size,
            type: file.type,
            created_at: new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('Presigned R2 upload failed, falling back to local data URL:', e);
    }
  }

  // Direct client fallback: generate responsive data URL (or direct R2 object URL if proxy/worker configured)
  const dataUrl = await fileToDataUrl(file);
  return {
    id: fileId,
    url: dataUrl,
    name: file.name,
    size: file.size,
    type: file.type,
    created_at: new Date().toISOString(),
  };
}
