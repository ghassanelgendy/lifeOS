import type { MediaAttachment } from '../types/schema';
import { AwsClient } from 'aws4fetch';

export const R2_PUBLIC_BASE_URL = 'https://pub-4ec7697d65bc4179a305600c7075c68e.r2.dev';

// Cloudflare R2 Credentials & Endpoint
const R2_ACCOUNT_ID = '001cbd4b192b80443398f770b459b6b7';
const R2_ACCESS_KEY_ID = '1d3bb1b31a089d9ef1c64b3e0beb13ea';
const R2_SECRET_ACCESS_KEY = 'cdc60c2b22a17e588c8906619fcf77fdf8ee94a2f4abcb6b698eb1ba18d85c7a';
const R2_BUCKET_NAME = 'lifeos-attachments';

const awsR2Client = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});

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
 * Upload an image file directly to Cloudflare R2 bucket.
 * Falls back to offline base64 data URL if network fails.
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
  const publicUrl = `${R2_PUBLIC_BASE_URL}/${key}`;

  try {
    // 1. Direct signed PUT to Cloudflare R2 via aws4fetch
    const s3Url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;
    const uploadRes = await awsR2Client.fetch(s3Url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (uploadRes.ok) {
      return {
        id: fileId,
        url: publicUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        created_at: new Date().toISOString(),
      };
    } else {
      console.warn('R2 direct upload status not OK:', uploadRes.status, await uploadRes.text().catch(() => ''));
    }
  } catch (err) {
    console.warn('Direct R2 upload encountered error, falling back to local storage:', err);
  }

  // 2. Direct client fallback: generate responsive data URL for offline access
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
