import fs from 'fs';
import path from 'path';

const IGNORED_DIRS = [
  'node_modules', '.git', 'dist', 'dev-dist', 'lifeOS-main',
  'ios\\App\\App\\public', 'ios\\App\\build', 'ios\\App\\CapApp-SPM\\.build',
  'ios\\App\\CapApp-SPM\\.swiftpm'
];

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.yaml', '.yml', '.toml', '.html', '.md'];

function shouldInclude(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('node_modules')) return false;
  if (normalized.includes('/.git/')) return false;
  if (normalized.startsWith('dist/') || normalized.startsWith('dev-dist/')) return false;
  if (normalized.startsWith('lifeOS-main/')) return false;
  if (normalized.includes('ios/App/App/public')) return false;
  if (normalized.includes('ios/App/build')) return false;
  if (normalized.includes('ios/App/CapApp-SPM/.build')) return false;
  if (normalized.includes('ios/App/CapApp-SPM/.swiftpm')) return false;
  const ext = path.extname(filePath);
  return EXTENSIONS.includes(ext);
}

function* walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'dev-dist' || entry.name === 'lifeOS-main') continue;
      yield* walkDir(fullPath);
    } else {
      if (shouldInclude(fullPath)) {
        yield fullPath;
      }
    }
  }
}

function analyzeJSContent(content, filePath) {
  const lines = content.split('\n');
  const exports = [];
  const functions = [];
  const classes = [];
  const interfaces = [];
  const types = [];
  const hooks = [];
  const components = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Export detection
    if (trimmed.match(/^export\s+(default\s+)?(function|const|let|var|class|interface|type)\s+([A-Za-z0-9_]+)/)) {
      const match = trimmed.match(/^export\s+(default\s+)?(function|const|let|var|class|interface|type)\s+([A-Za-z0-9_]+)/);
      if (match) {
        const name = match[3];
        const kind = match[2];
        if (kind === 'function') functions.push(name);
        else if (kind === 'class') classes.push(name);
        else if (kind === 'interface') interfaces.push(name);
        else if (kind === 'type') types.push(name);
        else if (name.startsWith('use') && name.length > 3 && name[3] === name[3].toUpperCase()) hooks.push(name);
        else exports.push(name);
      }
    }
    
    // Function detection (non-export)
    if (trimmed.match(/^(export\s+)?function\s+([A-Za-z0-9_]+)/)) {
      const match = trimmed.match(/^(export\s+)?function\s+([A-Za-z0-9_]+)/);
      if (match && !functions.includes(match[2]) && !exports.find(e => e.name === match[2])) {
        functions.push(match[2]);
      }
    }
    
    // React component detection
    if (trimmed.match(/^function\s+([A-Z][A-Za-z0-9_]*)/)) {
      const match = trimmed.match(/^function\s+([A-Z][A-Za-z0-9_]*)/);
      if (match && !components.includes(match[1])) {
        components.push(match[1]);
      }
    }
    
    // Const arrow functions
    if (trimmed.match(/^export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=/)) {
      const match = trimmed.match(/^export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=/);
      if (match && !components.includes(match[1])) {
        components.push(match[1]);
      }
    }
    
    // Hook detection
    if (trimmed.match(/^(export\s+)?function\s+(use[A-Z][A-Za-z0-9_]*)/)) {
      const match = trimmed.match(/^(export\s+)?function\s+(use[A-Z][A-Za-z0-9_]*)/);
      if (match && !hooks.includes(match[2])) {
        hooks.push(match[2]);
      }
    }
    
    // Default export detection for components
    if (trimmed.match(/^export\s+default\s+(function\s+)?([A-Z][A-Za-z0-9_]*)/)) {
      const match = trimmed.match(/^export\s+default\s+(function\s+)?([A-Z][A-Za-z0-9_]*)/);
      if (match && match[2] && !components.includes(match[2])) {
        components.push(match[2]);
      }
    }
  }

  return { exports, functions, classes, interfaces, types, hooks, components };
}

function analyzeCSSContent(content) {
  const selectors = [];
  const keyframes = [];
  
  const keyframeMatches = content.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g);
  for (const match of keyframeMatches) {
    keyframes.push(match[1]);
  }
  
  const classMatches = content.matchAll(/\.([A-Za-z0-9_-]+)\s*[{,:]/g);
  for (const match of classMatches) {
    if (!selectors.includes(match[1])) selectors.push(match[1]);
  }
  
  return { keyframes, selectors };
}

function getFilePurpose(filePath, content) {
  const normalized = filePath.replace(/\\/g, '/');
  const ext = path.extname(normalized);
  const basename = path.basename(normalized);
  const dir = path.dirname(normalized).replace(/^\.\//, '');
  
  // Platform file patterns
  const platformMatch = basename.match(/\.(web|ios|pake)(\.test)?\.(tsx?|css)$/);
  const platform = platformMatch ? platformMatch[1] : null;
  const isTest = basename.includes('.test.');
  
  // Purpose descriptions by pattern
  if (isTest) {
    return `Unit/integration tests for the corresponding implementation file.`;
  }
  
  if (normalized === 'src/App.tsx') {
    return `Platform abstraction entry point. Delegates to platform-specific App implementation (web, iOS, or pake) via Vite's platform-resolve plugin.`;
  }
  
  if (normalized === 'src/main.tsx') {
    return `Application entry point. Bootstraps the React root component into the DOM.`;
  }
  
  if (normalized === 'src/sw.ts') {
    return `Service Worker for PWA functionality. Handles precaching, offline navigation fallback, background sync, and push notifications.`;
  }
  
  if (normalized === 'src/index.css') {
    return `Global CSS stylesheet with Tailwind CSS v4 integration, theming system (dark/light/accent colors), animations, and iOS-specific styles.`;
  }
  
  if (normalized === 'src/setupTests.ts') {
    return `Test environment setup. Imports Jest DOM matchers for Vitest compatibility.`;
  }
  
  if (dir.startsWith('src/components/ui')) {
    return `UI primitive component. Reusable design-system element used across the application.`;
  }
  
  if (dir.startsWith('src/components/dashboard')) {
    return `Dashboard widget/component. Displays aggregated life metrics and quick-view data panels.`;
  }
  
  if (dir.startsWith('src/components/analytics')) {
    return `Analytics visualization component. Renders charts, reports, and trend analysis UI.`;
  }
  
  if (dir.startsWith('src/routes')) {
    const routeName = basename.replace(/\.(web|ios|pake)?\.tsx$/, '');
    return `Page-level route component for the ${routeName} module. Renders the main view when navigating to this section.`;
  }
  
  if (dir.startsWith('src/hooks')) {
    const hookName = basename.replace(/\.(web|ios|pake)?\.ts$/, '');
    return `Custom React hook. Encapsulates ${hookName.replace('use', '')} logic for data fetching, state management, or side effects.`;
  }
  
  if (dir.startsWith('src/lib')) {
    return `Utility library module. Provides helper functions, client configuration, or domain-specific logic.`;
  }
  
  if (dir.startsWith('src/db')) {
    return `Database layer. Manages local database schema, migrations, seeding, or IndexedDB operations.`;
  }
  
  if (dir.startsWith('src/contexts')) {
    return `React Context provider. Manages shared state and provides it to descendant components via React Context API.`;
  }
  
  if (dir.startsWith('src/stores')) {
    return `Zustand state store. Manages global or domain-specific client-side state.`;
  }
  
  if (dir.startsWith('src/types')) {
    return `TypeScript type definitions. Centralized type declarations for the application.`;
  }
  
  if (dir.startsWith('api')) {
    return `Vercel serverless API route. Handles server-side logic for API endpoints.`;
  }
  
  if (dir.startsWith('supabase/functions')) {
    return `Supabase Edge Function. Serverless function running on Deno for backend operations, notifications, and integrations.`;
  }
  
  if (dir.startsWith('lib/api-client-react')) {
    return `Workspace package: API client for React. Auto-generated or custom fetch wrappers for API consumption.`;
  }
  
  if (dir.startsWith('lib/api-spec')) {
    return `Workspace package: API specification. OpenAPI schema and code generation configuration.`;
  }
  
  if (dir.startsWith('lib/api-zod')) {
    return `Workspace package: Zod-validated API types. Runtime type validation schemas for API contracts.`;
  }
  
  if (dir.startsWith('lib/db')) {
    return `Workspace package: Database schema and Drizzle ORM configuration for type-safe database access.`;
  }
  
  if (dir.startsWith('scripts')) {
    return `Build/utility script. Automates development tasks, icon generation, or deployment procedures.`;
  }
  
  if (dir.startsWith('docs')) {
    return `Project documentation. Markdown files describing architecture, requirements, or operational procedures.`;
  }
  
  if (dir.startsWith('public')) {
    return `Static asset. Served directly without bundling. Included in the built application.`;
  }
  
  if (ext === '.css') {
    return `Stylesheet. Provides CSS rules, animations, and theming for the application.`;
  }
  
  if (ext === '.json') {
    return `JSON configuration or data file. Used for settings, manifests, or structured data.`;
  }
  
  return `Source file. Part of the lifeOS application codebase.`;
}

function generateFileDoc(filePath, content) {
  const normalized = filePath.replace(/\\/g, '/');
  const ext = path.extname(filePath);
  const basename = path.basename(normalized);
  
  let analysis = {};
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    analysis = analyzeJSContent(content, filePath);
  } else if (ext === '.css') {
    analysis = analyzeCSSContent(content);
  }
  
  const purpose = getFilePurpose(normalized, content);
  
  let md = `### ${normalized}\n\n`;
  md += `**File Purpose:** ${purpose}\n\n`;
  
  if (ext === '.css') {
    if (analysis.keyframes && analysis.keyframes.length > 0) {
      md += `**Keyframes:**\n`;
      for (const kf of analysis.keyframes) {
        md += `- \`@keyframes ${kf}\` — CSS animation definition\n`;
      }
      md += '\n';
    }
    if (analysis.selectors && analysis.selectors.length > 0) {
      md += `**CSS Classes/Selectors:** ${analysis.selectors.slice(0, 20).join(', ')}${analysis.selectors.length > 20 ? ` (+${analysis.selectors.length - 20} more)` : ''}\n\n`;
    } else {
      md += `**CSS Classes/Selectors:** None (utility/reset stylesheet)\n\n`;
    }
  } else if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    const items = [];
    if (analysis.components && analysis.components.length > 0) {
      for (const c of analysis.components) {
        items.push(`- \`${c}\` (React Component)`);
      }
    }
    if (analysis.hooks && analysis.hooks.length > 0) {
      for (const h of analysis.hooks) {
        items.push(`- \`${h}\` (React Hook)`);
      }
    }
    if (analysis.functions && analysis.functions.length > 0) {
      for (const f of analysis.functions.slice(0, 15)) {
        items.push(`- \`${f}\` (Function)`);
      }
    }
    if (analysis.classes && analysis.classes.length > 0) {
      for (const c of analysis.classes) {
        items.push(`- \`${c}\` (Class)`);
      }
    }
    if (analysis.interfaces && analysis.interfaces.length > 0) {
      for (const i of analysis.interfaces) {
        items.push(`- \`${i}\` (Interface)`);
      }
    }
    if (analysis.types && analysis.types.length > 0) {
      for (const t of analysis.types) {
        items.push(`- \`${t}\` (Type)`);
      }
    }
    
    if (items.length > 0) {
      md += `**Functions & Classes:**\n${items.join('\n')}\n\n`;
    } else {
      md += `**Functions & Classes:** None (configuration or re-export module)\n\n`;
    }
    
    // Function details from analysis
    if (analysis.functions.length > 0 || analysis.hooks.length > 0 || analysis.components.length > 0) {
      md += `**Function Details:**\n`;
      for (const comp of analysis.components.slice(0, 5)) {
        md += `- **\`${comp}\`** — React component rendering UI for ${comp}.\n`;
      }
      for (const hook of analysis.hooks.slice(0, 5)) {
        md += `- **\`${hook}\`** — Custom React hook managing ${hook.replace('use', '').toLowerCase()} state and side effects.\n`;
      }
      for (const fn of analysis.functions.slice(0, 5)) {
        md += `- **\`${fn}\`** — Utility function for ${fn.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}.\n`;
      }
      md += '\n';
    }
  } else {
    md += `**Functions & Classes:** None (${ext === '.json' ? 'JSON data/config' : ext === '.md' ? 'Markdown documentation' : 'configuration file'})\n\n`;
  }
  
  md += `**Lines:** ${content.split('\n').length}\n\n`;
  md += `---\n\n`;
  
  return md;
}

// Main documentation builder
console.log('Building documentation...');

const files = [];
for (const filePath of walkDir('.')) {
  const normalized = filePath.replace(/\\/g, '/');
  files.push(normalized);
}

files.sort();

// Generate index
let output = `# lifeOS Complete Codebase Documentation\n\n`;
output += `Generated comprehensive documentation covering every source file in the lifeOS project.\n\n`;
output += `## Table of Contents\n\n`;

// Group files by directory for the TOC
const groups = {};
for (const f of files) {
  const dir = path.dirname(f).replace(/^\.\//, '') || 'Root';
  if (!groups[dir]) groups[dir] = [];
  groups[dir].push(f);
}

for (const dir of Object.keys(groups).sort()) {
  output += `### ${dir}\n`;
  for (const f of groups[dir]) {
    const anchor = f.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    output += `- [${f}](#${anchor})\n`;
  }
  output += '\n';
}

// Generate file documentation
for (const f of files) {
  try {
    const content = fs.readFileSync(f, 'utf-8');
    const anchor = f.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    output += `<a name="${anchor}"></a>\n`;
    output += generateFileDoc(f, content);
  } catch (err) {
    console.error(`Error reading ${f}:`, err.message);
  }
}

fs.writeFileSync('CODEBASE_DOCUMENTATION.md', output, 'utf-8');
console.log(`Documentation written for ${files.length} files.`);
