#!/usr/bin/env node
/**
 * enumerate.js
 *
 * Derives the attack-surface denominator from the code, so coverage is measured
 * against a fixed set the reviewer did not invent this run. This is the fix for
 * self-referential coverage: without it, the reviewer writes both how many entry
 * points exist and how many were traced, traces everything noticed, and reports
 * 100% no matter how little was looked at.
 *
 * It emits enumeration.json: one element per mechanically discovered entry point,
 * plus one element per fixed sink class. The reviewer then records a verdict
 * (clear, finding, or gap) on every element. render-report.js computes coverage
 * from those verdicts, and an element left without a verdict counts as a gap.
 *
 * What it can and cannot do, stated plainly:
 *   - Entry points are found by file-shape rules per framework. A framework with
 *     no profile, or a hand-rolled server, is enumerated as "manual": the tool
 *     says so, and coverage for that part is only as honest as the reviewer.
 *   - Sink classes are a fixed list of ten. Every run must verdict all ten, so a
 *     whole class cannot silently vanish even when the instances are missed.
 *
 * It reads the tree. It does not judge whether anything is a vulnerability.
 *
 * No dependencies. Node >= 18.
 *
 * Usage:
 *   node bin/enumerate.js --root <target-repo> [--out <dir>] [--profile auto|next|generic]
 */

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, relative, basename } from 'node:path';

const VERSION = '1.4.1';

const HELP = `
enumerate.js -- derive the attack-surface denominator from the code

Usage:
  node bin/enumerate.js --root <target-repo> [options]

Options:
  --root <dir>       The target repository to enumerate. Required
  --out <dir>        Where to write enumeration.json. Default: the root
  --profile <name>   auto (default), next, or generic. auto detects the framework
  -h, --help         Show this message

Output: enumeration.json, a fixed list of attack-surface elements. Every element
needs a verdict (clear, finding, or gap) in summary.json before render-report.js
will treat coverage as trustworthy. An element with no verdict is a gap.

This does not find vulnerabilities. It fixes the denominator so that a review
which looked at less can no longer report full coverage.
`.trim();

// The ten sink classes from doctrine/06 Phase 3. Fixed. Every run verdicts all.
const SINK_CLASSES = [
  ['sink:query-execution', 'Query execution: strings sent to the datastore'],
  ['sink:command-execution', 'Command execution: process spawn, shell'],
  ['sink:filesystem', 'File system: path construction, read, write, extract'],
  ['sink:network-egress', 'Network egress: outbound requests with input-influenced URL (SSRF)'],
  ['sink:rendering', 'Rendering: template interpolation, HTML, response headers'],
  ['sink:deserialisation', 'Deserialisation: objects from untrusted bytes'],
  ['sink:authorisation', 'Authorisation decisions: where a permission is computed'],
  ['sink:cryptography', 'Cryptography: signing, verification, encryption, randomness'],
  ['sink:redirects', 'Redirects: a location computed from input'],
  ['sink:logging', 'Logging: untrusted data into a log something else parses'],
];

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage',
  '.turbo', '.vercel', 'vendor', '.cache', 'security-findings',
]);

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(join(dir, e.name), acc);
    } else {
      acc.push(join(dir, e.name));
    }
  }
  return acc;
}

function detectProfile(root, files) {
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.next) return 'next';
      if (deps.express || deps.fastify || deps.koa || deps['@nestjs/core']) return 'node-http';
    } catch {
      // fall through to generic
    }
  }
  return 'generic';
}

// Next.js App Router entry points, by file shape. Deterministic: a glob result.
function enumerateNext(root, files) {
  const els = [];
  for (const f of files) {
    const rel = relative(root, f).replace(/\\/g, '/');
    const name = basename(f);
    if (/\/app\/.*\/route\.(t|j)sx?$/.test('/' + rel) || /^app\/.*route\.(t|j)sx?$/.test(rel)) {
      els.push(entry(`entry:route:${rel}`, `HTTP route handler: ${rel}`));
    } else if (name === 'middleware.ts' || name === 'middleware.js') {
      els.push(entry(`entry:middleware:${rel}`, `Edge/middleware: ${rel}`));
    } else if (/next\.config\.(t|j|mj|cj)s$/.test(name)) {
      els.push(entry(`entry:config-headers:${rel}`, `Response headers / config: ${rel}`));
    } else if (/actions?\.(t|j)sx?$/.test(name)) {
      const body = safeRead(f);
      if (/["']use server["']/.test(body)) {
        els.push(entry(`entry:server-action:${rel}`, `Server actions: ${rel}`));
      }
    } else if (/\/(api\/)?cron\//.test('/' + rel)) {
      els.push(entry(`entry:scheduled:${rel}`, `Scheduled/cron entry: ${rel}`));
    }
  }
  return els;
}

// Generic: HTTP-ish and boundary files by name, best-effort, flagged low-confidence.
function enumerateGeneric(root, files) {
  const els = [];
  for (const f of files) {
    const rel = relative(root, f).replace(/\\/g, '/');
    const name = basename(f).toLowerCase();
    if (/(route|router|controller|handler|endpoint|api)\.(t|j)sx?$/.test(name)) {
      els.push(entry(`entry:handler:${rel}`, `Candidate request handler: ${rel}`));
    } else if (/(server|app|index|main)\.(t|j)sx?$/.test(name)) {
      els.push(entry(`entry:server:${rel}`, `Candidate server entry: ${rel}`));
    }
  }
  return els;
}

function entry(id, name) {
  return { id, kind: 'entryPoint', name, verdict: null };
}

function safeRead(f) {
  try {
    return readFileSync(f, 'utf8');
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const o = { root: null, out: null, profile: 'auto', help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '--root') o.root = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--profile') o.profile = argv[++i];
    else throw new Error(`Unknown option: ${a}`);
  }
  return o;
}

function main() {
  let o;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (o.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (!o.root) {
    console.error('--root is required (the target repository to enumerate).');
    process.exit(2);
  }
  const root = resolve(o.root);
  if (!existsSync(root)) {
    console.error(`Not found: ${root}`);
    process.exit(2);
  }

  const files = walk(root);
  const profile = o.profile === 'auto' ? detectProfile(root, files) : o.profile;

  let entries;
  let entrySource;
  if (profile === 'next') {
    entries = enumerateNext(root, files);
    entrySource = 'mechanical (next profile)';
  } else if (profile === 'generic' || profile === 'node-http') {
    entries = enumerateGeneric(root, files);
    entrySource = 'best-effort (no framework profile matched; treat entry-point coverage as manual)';
  } else {
    entries = enumerateGeneric(root, files);
    entrySource = `unknown profile "${profile}", used generic`;
  }

  // Deduplicate and sort for a stable, reproducible list.
  const seen = new Set();
  entries = entries
    .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => a.id.localeCompare(b.id));

  const sinks = SINK_CLASSES.map(([id, name]) => ({
    id,
    kind: 'sinkClass',
    name,
    verdict: null,
  }));

  const manifest = {
    schemaVersion: '1.0.0',
    generatedBy: `enumerate.js ${VERSION}`,
    root: relative(process.cwd(), root).replace(/\\/g, '/') || '.',
    profile,
    entrySource,
    counts: { entryPoints: entries.length, sinkClasses: sinks.length },
    // Every element needs a verdict of clear | finding | gap in summary.json.
    // An element with verdict null is treated as a gap by render-report.js.
    elements: [...entries, ...sinks],
  };

  const outDir = o.out ? resolve(o.out) : root;
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'enumeration.json');
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Enumerated ${entries.length} entry point(s) and ${sinks.length} sink classes.`);
  console.log(`Profile: ${profile}. Entry source: ${entrySource}.`);
  console.log(`Wrote ${outPath}`);
  console.log('');
  console.log('Next: copy elements into summary.json under "enumeration" and give');
  console.log('every one a verdict (clear, finding, or gap). An element with no');
  console.log('verdict counts as a gap and lowers coverage.');
}

main();
