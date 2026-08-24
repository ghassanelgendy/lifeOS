// ========================
// Wiki / KB Types (Logseq-inspired)
// ========================

export interface WikiPage {
  id: string;
  title: string;           // normalized: Title Case, unique
  content: string;         // markdown with [[Wiki Links]]
  is_shared?: boolean;
  shared_with?: string[];
  owner_email?: string;
  created_at: string;      // ISO-8601
  updated_at: string;      // ISO-8601
}

export interface WikiLink {
  from: string;  // page title (source)
  to: string;    // page title (target)
}

export interface WikiGraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface WikiGraphEdge {
  source: string;
  target: string;
}
