import type { Tag } from '../types/schema';

/** First selected tag (in array order) with a non-null `default_list_id` wins. */
export function listIdFromTagIds(tagIds: string[], tagDefs: Tag[]): string | null {
  for (const id of tagIds) {
    const dl = tagDefs.find((t) => t.id === id)?.default_list_id;
    if (dl) return dl;
  }
  return null;
}
