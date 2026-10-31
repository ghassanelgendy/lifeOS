# Google Analytics MCP Integration in lifeOS

This document details the installation, configuration, and practical usage of the official [Google Analytics Model Context Protocol (MCP) Server](https://github.com/googleanalytics/google-analytics-mcp) within **lifeOS**.

---

## 1. Overview

The Google Analytics MCP server exposes Google Analytics 4 (GA4) Admin and Data APIs as Model Context Protocol (MCP) tools. This enables AI assistants (such as Antigravity, Claude Code, Cursor, and Windsurf) as well as command-line scripts to query real-time traffic, run analytical reports, inspect funnel performance, and fetch property metadata directly inside the lifeOS workspace.

### Key Capabilities & Tools

| MCP Tool | API Used | Purpose |
| :--- | :--- | :--- |
| `get_account_summaries` | Admin API | Lists all GA accounts and GA4 properties available to the credentials. |
| `get_property_details` | Admin API | Fetches configuration and metadata for a specific GA4 property. |
| `list_google_ads_links` | Admin API | Displays Google Ads accounts linked to the GA4 property. |
| `list_property_annotations` | Admin API | Lists release notes, marketing dates, and campaign annotations. |
| `create_property_annotation`| Admin API | Creates an annotation (requires `--allow-write` and edit scope). |
| `get_custom_dimensions_and_metrics` | Admin API | Inspects configured custom dimensions and metrics. |
| `run_report` | Data API | Executes core reports with date ranges, dimensions, metrics, and filters. |
| `run_realtime_report` | Data API | Retrieves live real-time user and event activity. |
| `run_funnel_report` | Data API | Calculates multi-step user conversion funnels. |
| `run_conversions_report` | Data API | Analyzes conversion events and key performance indicators. |

---

## 2. Directory Structure

```text
lifeos/
├── index.html                     # gtag.js loader for G-E33S655RMQ
├── src/
│   ├── lib/gtag.ts                # Typed tracking utilities & domain events
│   └── components/
│       └── GoogleAnalyticsTracker.tsx # SPA route & auth sync tracker
├── tools/
│   └── google-analytics-mcp/      # Cloned official MCP server repository
│       ├── .venv/                 # Dedicated Python 3.12 virtual environment
│       ├── setup.sh               # One-step environment setup script
│       └── pyproject.toml         # Package definition and dependencies
├── scripts/
│   ├── run-google-analytics-mcp.sh# Stdio MCP server runner (loads .env & auto-detects creds)
│   ├── setup-ga4-property.py      # Automated property locator, link & provisioner
│   ├── test-google-analytics-mcp.py# Automated diagnostics & JSON-RPC tester
│   └── query-google-analytics.mjs # Interactive CLI query client for lifeOS
├── .mcp.json                      # Project MCP server registration (Claude Code, Cursor)
└── .env.example                   # Environment configuration template
```

---

## 3. Quick Start & Setup

### A. Environment Initialization
Run the setup script to create the Python virtual environment and install the server in editable mode:
```bash
pnpm analytics:setup
# or manually:
bash tools/google-analytics-mcp/setup.sh
```

### B. Verify Connectivity & Tools
Verify that the MCP server responds to the MCP JSON-RPC protocol over stdio:
```bash
pnpm analytics:test
```

### C. Inspect Available Tools & Schemas
```bash
pnpm analytics:query tools
```

---

## 4. Google Cloud Authentication

To query real Google Analytics properties, you need credentials with access to your GA4 account.

### Option 1: Service Account (Recommended for Automation)
1. Go to [Google Cloud Console](https://console.cloud.google.com/) and enable:
   - **Google Analytics Admin API**
   - **Google Analytics Data API**
2. Create a Service Account and download the JSON key.
3. In Google Analytics (Admin > Property Access Management), add the service account email as a **Viewer** (or **Editor** if using annotations).
4. Add the credentials path to your `.env` or `.env.local` file:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   GOOGLE_CLOUD_PROJECT=your-gcp-project-id
   GA4_PROPERTY_ID=123456789
   ```

### Option 2: Application Default Credentials (ADC) with gcloud
```bash
gcloud auth application-default login \
  --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform
```

---

## 5. IDE & AI Agent Configuration

### 1. Antigravity IDE & CLI
Configured in `~/.gemini/config/mcp_config.json`:
```json
{
  "mcpServers": {
    "google-analytics": {
      "command": "/bin/bash",
      "args": ["/home/ghesso/lifeos/scripts/run-google-analytics-mcp.sh"],
      "disabled": false
    }
  }
}
```

### 2. Project-level `.mcp.json` (Claude Code / Cursor / Windsurf)
Configured in `.mcp.json`:
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?..."
    },
    "google-analytics": {
      "command": "/bin/bash",
      "args": ["scripts/run-google-analytics-mcp.sh"]
    }
  }
}
```

---

## 6. Querying Google Analytics from lifeOS CLI

Use `scripts/query-google-analytics.mjs` to execute queries directly:

```bash
# List all accounts and properties accessible to the credentials:
pnpm analytics:query accounts

# Fetch details for a specific GA4 property:
pnpm analytics:query property <PROPERTY_ID>

# Run a 30-day user/pageview report:
pnpm analytics:query report <PROPERTY_ID> activeUsers,screenPageViews date

# Fetch real-time active users:
pnpm analytics:query realtime <PROPERTY_ID> activeUsers
```

---

## 7. Deep Frontend Tracking Integration (`G-E33S655RMQ`)

The lifeOS web application deeply integrates GA4 (`G-E33S655RMQ`) across all navigation and domains:

1. **Tag Injection**: Initialized in `index.html` via standard `gtag.js`.
2. **SPA Route Navigation**: `<GoogleAnalyticsTracker />` mounted inside `<Router>` in `src/App.web.tsx` catches all route transitions (`/dashboard`, `/tasks`, `/habits`, `/calendar`, `/finance`, etc.) and dispatches accurate `page_view` events.
3. **User Identity Sync**: Authenticated user IDs from `useAuth()` are automatically bound to GA4 sessions for cohort analysis without exposing PII.
4. **Domain Event Utilities** (`src/lib/gtag.ts`):
   - `trackTaskCreated()` & `trackTaskCompleted()`
   - `trackHabitLogged()`
   - `trackFocusSession()`
   - `trackPrayerLogged()`
   - `trackTransactionLogged()`
   - `trackNoteCreated()`

---

## 8. Linking Credentials & Auto-Provisioning

Simply place your Google Cloud Service Account or OAuth JSON file in the project root:
```bash
cp /path/to/downloaded-key.json ./service-account.json
pnpm analytics:link
```
The script will auto-detect the credentials, query Google Analytics Admin API to locate the property matching `G-E33S655RMQ`, and write all configuration directly into `.env`.
To programmatically provision a new property and web data stream under your Google Analytics account:
```bash
pnpm analytics:link --create
```
