/*
  Consolidate and merge PRD.md, CODEBASE_SRS.md, and CODEBASE_DOCUMENTATION.md
  into a logical, topic-oriented static set of documentation pages.
*/

import prdRaw from '../../PRD.md?raw';
import srsRaw from '../../CODEBASE_SRS.md?raw';
import docsRaw from '../../CODEBASE_DOCUMENTATION.md?raw';

export interface WikiDocPage {
  id: string;
  title: string;
  category: 'Getting Started' | 'Core Features' | 'Technical Deep Dives' | 'Deployment & Operations';
  content: string;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeTitle(title: string): string {
  return title
    .replace(/[#]+/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

/* Helper to extract a major H2 section from raw markdown */
function getSection(raw: string, headingTitle: string): string {
  const lines = raw.split(/\r?\n/);
  let startIndex = -1;
  let endIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ') && lines[i].toLowerCase().includes(headingTitle.toLowerCase())) {
      startIndex = i;
      break;
    }
  }
  if (startIndex === -1) return '';
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      endIndex = i;
      break;
    }
  }
  const sectionLines = endIndex === -1 ? lines.slice(startIndex) : lines.slice(startIndex, endIndex);
  return sectionLines.join('\n').trim();
}

/* Helper to extract an H3 sub-section under functional requirements */
function getSubSection(raw: string, subHeadingTitle: string): string {
  const lines = raw.split(/\r?\n/);
  let startIndex = -1;
  let endIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('### ') && lines[i].toLowerCase().includes(subHeadingTitle.toLowerCase())) {
      startIndex = i;
      break;
    }
  }
  if (startIndex === -1) return '';
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith('### ') || lines[i].startsWith('## ')) {
      endIndex = i;
      break;
    }
  }
  const sectionLines = endIndex === -1 ? lines.slice(startIndex) : lines.slice(startIndex, endIndex);
  return sectionLines.join('\n').trim();
}

// Custom curated pages compiling the 3 sources
const homeContent = `
# lifeOS Documentation Portal

Welcome to the official developer and user documentation for **lifeOS** — a local-first, privacy-centric personal operating system that unifies tasks, habits, schedules, finances, and health under a single dashboard.

This portal consolidates the product vision, software specification, and codebase architecture into organized, topic-oriented guides.

### 📚 Documentation Sections

#### Getting Started
- [[Vision, Principles & Roadmap]] — Product strategy, target personas, and features roadmap.
- [[System Architecture & Tech Stack]] — High-level code structure and platform wrappers (Web, iOS, Desktop).

#### Feature Specs & User Guides
- [[Task Management & Focus Mode]] — Smart lists, focus states, and Picture-in-Picture timers.
- [[Habits, Streaks & Prayer Trackers]] — Routine trackers, streak mechanics, and prayer time algorithms.
- [[Digital Wellbeing, Screen Time & Sleep]] — Sleep logging, screen limits, and physical health tracking.
- [[Finance & Expense Monitoring]] — Personal balance tracking, ledger entries, and budgeting.
- [[Calendar, Notes & Weekly Reports]] — iCal feed synchronization, markdown editor, and weekly wraps.

#### Technical Implementation
- [[Database Schema & Data Models]] — Entity definitions, relations, and local SQL schemas.
- [[Offline Mode, Sync Queue & Service Workers]] — Background workers, offline sync queues, and notifications.
- [[Build, Package & Deployment Guide]] — PWA caching, Codemagic pipelines, and Capacitor native runtimes.

*Use the search bar above (press \`/\` or \`Ctrl+K\`) or click the **Open Knowledge Graph** tab in the sidebar to view references.*
`;

const visionContent = `
# Vision, Principles & Roadmap

This page merges the product requirements, goals, target demographics, and product design principles of **lifeOS**.

${getSection(prdRaw, "Executive Summary")}

${getSection(prdRaw, "Product Vision")}

${getSection(prdRaw, "Target Users")}

${getSection(prdRaw, "Product Principles")}

${getSection(prdRaw, "Release Roadmap")}
`;

const architectureContent = `
# System Architecture & Tech Stack

This section explains the technical framework, system design, directory structures, and non-functional specifications of lifeOS, derived from the Software Requirements Specification (SRS) and codebase layouts.

${getSection(srsRaw, "Overall Description")}

${getSection(srsRaw, "Non-Functional Requirements")}

${getSection(srsRaw, "External Interface Requirements")}
`;

const tasksFocusContent = `
# Task Management & Focus Mode

This page details the functional design and code specifications for tasks and productivity features. It integrates task prioritization, smart lists, focus sessions, and the Picture-in-Picture (PiP) focus window.

${getSubSection(srsRaw, "Task Management")}

${getSubSection(srsRaw, "Focus Sessions")}
`;

const habitsPrayerContent = `
# Habits, Streaks & Prayer Trackers

This guide outlines the specifications for routine-building habits (including streak calculations, auto-pilot adjustments) and integrated Islamic prayer timing algorithms (geocoding, notification dispatch).

${getSubSection(srsRaw, "Habit Tracking")}

${getSubSection(srsRaw, "Prayer Times & Habits")}
`;

const wellbeingSleepContent = `
# Digital Wellbeing, Screen Time & Sleep

This section covers health metrics, sleep analysis logs, and screen time monitoring features that foster digital wellbeing.

${getSubSection(srsRaw, "Sleep Tracking")}

${getSubSection(srsRaw, "Digital Wellbeing / Screen Time")}

${getSubSection(srsRaw, "Health & Body Metrics")}
`;

const financeContent = `
# Finance & Expense Monitoring

This section details the functional specifications for financial tracking, including accounts, transaction categories, and expense insights.

${getSubSection(srsRaw, "Finance Management")}
`;

const calendarNotesContent = `
# Calendar, Notes & Weekly Reports

This page covers note-taking structures (Markdown notes, folders), iCal calendar sync integrations, and weekly/monthly performance wraps.

${getSubSection(srsRaw, "Calendar & Events")}

${getSubSection(srsRaw, "Notes & Knowledge Management")}

${getSubSection(srsRaw, "Analytics, Reports & Wraps")}
`;

const databaseContent = `
# Database Schema & Data Models

This page explains the local-first schema and entity definitions used inside lifeOS, detailing SQL tables and Drizzle ORM models.

${getSection(srsRaw, "Data Requirements")}

${getSection(prdRaw, "Appendix A: Entity Definitions")}
`;

const offlineContent = `
# Offline Mode, Sync Queue & Service Workers

This technical guide covers lifeOS's local-first architecture, background service workers, offline action queue, and push notification configurations.

${getSubSection(srsRaw, "Offline Support & Data Sync")}

${getSubSection(srsRaw, "Notifications")}
`;

const buildDeployContent = `
# Build, Package & Deployment Guide

This guide explains the deployment pipelines, Capacitor configuration for native iOS standalone apps, and Pake configuration for native desktop packaging.

### Build Pipelines
lifeOS utilizes custom Vite modes to compile assets optimized for different wrappers:
- \`pnpm build\` — Standard web build outputs to \`/dist\`
- \`pnpm build:ios\` — iOS-optimized assets synchronized via Capacitor
- \`pnpm build:pake\` — Desktop-optimized packaging

### CI/CD Workflow
The CI/CD pipeline is configured in \`codemagic.yaml\` for automated iOS unsigned builds. It triggers on pushes to the \`main\` branch, running:
1. Web asset build via \`pnpm build:ios\`
2. Capacitor sync via \`pnpm cap sync ios\`
3. iOS project compilation via \`xcodebuild\`

### Capacitor Native Settings
The hybrid runtime is configured in \`capacitor.config.ts\`, specifying the appId \`com.ghassanelgendy.lifeos\`, deep link scheme \`lifeos://\`, keyboard behaviors, and splash screen delays.
`;

let ALL_PAGES: WikiDocPage[] = [
  {
    id: 'home',
    title: 'Wiki Home',
    category: 'Getting Started',
    content: homeContent.trim()
  },
  {
    id: 'vision-strategy',
    title: 'Vision, Principles & Roadmap',
    category: 'Getting Started',
    content: visionContent.trim()
  },
  {
    id: 'system-architecture',
    title: 'System Architecture & Tech Stack',
    category: 'Getting Started',
    content: architectureContent.trim()
  },
  {
    id: 'tasks-focus',
    title: 'Task Management & Focus Mode',
    category: 'Core Features',
    content: tasksFocusContent.trim()
  },
  {
    id: 'habits-prayer',
    title: 'Habits, Streaks & Prayer Trackers',
    category: 'Core Features',
    content: habitsPrayerContent.trim()
  },
  {
    id: 'wellbeing-sleep',
    title: 'Digital Wellbeing, Screen Time & Sleep',
    category: 'Core Features',
    content: wellbeingSleepContent.trim()
  },
  {
    id: 'finance-budgeting',
    title: 'Finance & Expense Monitoring',
    category: 'Core Features',
    content: financeContent.trim()
  },
  {
    id: 'calendar-notes',
    title: 'Calendar, Notes & Weekly Reports',
    category: 'Core Features',
    content: calendarNotesContent.trim()
  },
  {
    id: 'database-schema',
    title: 'Database Schema & Data Models',
    category: 'Technical Deep Dives',
    content: databaseContent.trim()
  },
  {
    id: 'offline-sync',
    title: 'Offline Mode, Sync Queue & Service Workers',
    category: 'Technical Deep Dives',
    content: offlineContent.trim()
  },
  {
    id: 'build-deploy',
    title: 'Build, Package & Deployment Guide',
    category: 'Deployment & Operations',
    content: buildDeployContent.trim()
  }
];

// Clean titles and filter duplicates
const seen = new Set<string>();
ALL_PAGES = ALL_PAGES.filter((p) => {
  const key = normalizeTitle(p.title).toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

/* Build a lookup set of all page titles so we can convert matching
   inline text into [[Wiki Links]]. */
function buildTitleSet(pages: WikiDocPage[]): Set<string> {
  const set = new Set<string>();
  for (const p of pages) {
    set.add(normalizeTitle(p.title).toLowerCase());
  }
  return set;
}

/* Walk the content and wrap any known page title with [[...]].
   Uses regex splits to avoid nesting links. */
function autoLink(content: string, knownTitles: Set<string>): string {
  const parts = content.split(/(\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\))/);
  const titles = Array.from(knownTitles).sort((a, b) => b.length - a.length);

  for (let i = 0; i < parts.length; i++) {
    const isLink = 
      (parts[i].startsWith('[[') && parts[i].endsWith(']]')) || 
      (parts[i].startsWith('[') && parts[i].includes(']('));
      
    if (isLink) {
      continue;
    }
    
    let part = parts[i];
    for (const t of titles) {
      const escaped = escapeRegExp(t);
      const re = new RegExp(`\\b(${escaped})\\b`, 'gi');
      part = part.replace(re, (match) => `[[${match}]]`);
    }
    parts[i] = part;
  }
  return parts.join('');
}

const titleSet = buildTitleSet(ALL_PAGES);
ALL_PAGES = ALL_PAGES.map((p) => ({
  ...p,
  content: autoLink(p.content, titleSet),
}));

/* ── Exports ── */
export const WIKI_PAGES: readonly WikiDocPage[] = ALL_PAGES;

export function getWikiPage(idOrTitle: string): WikiDocPage | undefined {
  const needle = normalizeTitle(idOrTitle).toLowerCase();
  return ALL_PAGES.find(
    (p) => p.id === needle || normalizeTitle(p.title).toLowerCase() === needle
  );
}

export function searchWikiPages(query: string): WikiDocPage[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL_PAGES.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q)
  );
}

export interface WikiGraphNodeInfo {
  id: string;
  title: string;
  type: 'page' | 'heading';
}

export function getWikiLinkGraph(): { 
  nodes: WikiGraphNodeInfo[]; 
  edges: { source: string; target: string }[] 
} {
  const nodes: WikiGraphNodeInfo[] = [];
  const edges: { source: string; target: string }[] = [];
  
  // Add all pages as primary nodes
  for (const p of ALL_PAGES) {
    nodes.push({ id: p.title, title: p.title, type: 'page' });
  }
  
  for (const page of ALL_PAGES) {
    // Extract H2/H3 headings as subnodes to flesh out the graph with sections
    const lines = page.content.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (match) {
        const headingText = normalizeTitle(match[2]);
        const headingId = `${page.title}#${headingText}`;
        
        // Add heading as a subnode if it doesn't already exist
        if (!nodes.some(n => n.id === headingId)) {
          nodes.push({ id: headingId, title: headingText, type: 'heading' });
        }
        // Connect parent page to the heading subnode
        edges.push({ source: page.title, target: headingId });
      }
    }
    
    // Extract standard links between major pages
    const matches = page.content.match(/\[\[([^\]]+)\]\]/g);
    if (!matches) continue;
    const links = [...new Set(matches.map((m) => normalizeTitle(m.slice(2, -2))))];
    for (const link of links) {
      if (link !== page.title) {
        const targetPage = ALL_PAGES.find(p => normalizeTitle(p.title).toLowerCase() === link.toLowerCase());
        if (targetPage) {
          edges.push({ source: page.title, target: targetPage.title });
        }
      }
    }
  }
  return { nodes, edges };
}
