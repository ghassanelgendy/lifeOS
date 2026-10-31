#!/usr/bin/env node
/**
 * lifeOS - Google Analytics MCP CLI Client
 *
 * Allows developers and agents to interact with Google Analytics via the
 * local Google Analytics MCP server over stdio.
 *
 * Usage:
 *   node scripts/query-google-analytics.mjs tools
 *   node scripts/query-google-analytics.mjs accounts
 *   node scripts/query-google-analytics.mjs report <propertyId> [metric1,metric2] [dim1,dim2]
 *   node scripts/query-google-analytics.mjs realtime <propertyId> [metric1,metric2]
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import readline from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const runnerScript = resolve(__dirname, 'run-google-analytics-mcp.sh');

class McpClient {
  constructor() {
    this.proc = null;
    this.rl = null;
    this.requestId = 1;
    this.pending = new Map();
  }

  async connect(allowWrite = false) {
    const args = allowWrite ? ['--allow-write'] : [];
    this.proc = spawn(runnerScript, args, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'inherit'],
      env: process.env,
    });

    this.rl = readline.createInterface({
      input: this.proc.stdout,
      crlfDelay: Infinity,
    });

    this.rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch (err) {
        // Non-JSON line or log output
      }
    });

    // Initialize MCP handshake
    await this.call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'lifeos-query-client', version: '1.0.0' },
    });

    // Send initialized notification
    this.notify('notifications/initialized', {});
  }

  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      this.pending.set(id, { resolve, reject });
      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      this.proc.stdin.write(payload);
    });
  }

  notify(method, params = {}) {
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
    this.proc.stdin.write(payload);
  }

  async callTool(name, args = {}) {
    return this.call('tools/call', { name, arguments: args });
  }

  async listTools() {
    return this.call('tools/list', {});
  }

  close() {
    if (this.rl) this.rl.close();
    if (this.proc) this.proc.kill();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  const client = new McpClient();

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`
lifeOS Google Analytics MCP CLI

Commands:
  tools                            List all available MCP tools and their schemas
  accounts                         Retrieve Google Analytics accounts and properties
  property <propertyId>            Get property details
  report <propertyId> [metrics]    Run basic GA4 report (e.g. activeUsers,sessions)
  realtime <propertyId> [metrics]  Run realtime report
  help                             Show this help message

Environment variables (.env or shell):
  GOOGLE_APPLICATION_CREDENTIALS  Path to service account JSON or OAuth credentials
  GOOGLE_CLOUD_PROJECT            Google Cloud Project ID
  GA4_PROPERTY_ID                 Default GA4 Property ID
`);
    return;
  }

  try {
    await client.connect();

    if (command === 'tools') {
      const res = await client.listTools();
      console.log('\nAvailable Google Analytics MCP Tools:');
      console.log('--------------------------------------------------');
      for (const t of res.tools || []) {
        console.log(`\n• ${t.name}:`);
        console.log(`  ${t.description || 'No description'}`);
        if (t.inputSchema?.properties) {
          console.log('  Parameters:');
          for (const [pName, pVal] of Object.entries(t.inputSchema.properties)) {
            const req = t.inputSchema.required?.includes(pName) ? '(required)' : '(optional)';
            console.log(`    - ${pName} ${req}: ${pVal.type || 'any'} - ${pVal.description || ''}`);
          }
        }
      }
    } else if (command === 'accounts') {
      console.log('Fetching Google Analytics account summaries...');
      const res = await client.callTool('get_account_summaries', {});
      console.log(JSON.stringify(res, null, 2));
    } else if (command === 'property') {
      const propertyId = args[1] || process.env.GA4_PROPERTY_ID;
      if (!propertyId) {
        console.error('Error: Property ID required. Usage: node query-google-analytics.mjs property <propertyId>');
        process.exit(1);
      }
      console.log(`Fetching details for property ${propertyId}...`);
      const res = await client.callTool('get_property_details', { property_id: propertyId });
      console.log(JSON.stringify(res, null, 2));
    } else if (command === 'report') {
      const propertyId = args[1] || process.env.GA4_PROPERTY_ID;
      if (!propertyId) {
        console.error('Error: Property ID required. Usage: node query-google-analytics.mjs report <propertyId>');
        process.exit(1);
      }
      const metrics = (args[2] || 'activeUsers,screenPageViews').split(',').map((name) => ({ name }));
      const dimensions = (args[3] || 'date').split(',').map((name) => ({ name }));

      console.log(`Running report for property ${propertyId}...`);
      const res = await client.callTool('run_report', {
        property_id: propertyId,
        metrics,
        dimensions,
        date_ranges: [{ start_date: '30daysAgo', end_date: 'today' }],
      });
      console.log(JSON.stringify(res, null, 2));
    } else if (command === 'realtime') {
      const propertyId = args[1] || process.env.GA4_PROPERTY_ID;
      if (!propertyId) {
        console.error('Error: Property ID required. Usage: node query-google-analytics.mjs realtime <propertyId>');
        process.exit(1);
      }
      const metrics = (args[2] || 'activeUsers').split(',').map((name) => ({ name }));

      console.log(`Running realtime report for property ${propertyId}...`);
      const res = await client.callTool('run_realtime_report', {
        property_id: propertyId,
        metrics,
      });
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.error(`Unknown command: "${command}". Run with --help for usage.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error executing MCP tool:', err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
