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

const VERSION = '1.5.0';

const HELP = `
enumerate.js -- derive the attack-surface denominator from the code

Usage:
  node bin/enumerate.js --root <target-repo> [options]

Options:
  --root <dir>       The target repository to enumerate. Required
  --out <dir>        Where to write enumeration.json. Default: the root
  --profile <name>   auto (default) detects the framework. Or force one:
                     next, express, django, flask, rails, go-http, php, generic
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

/*
 * Declarative profile table. Each profile has:
 *   id      a short name
 *   detect  (deps, relFiles) => boolean, matched against package.json deps AND
 *           the file list, so non-Node stacks (no package.json) still match
 *   mechanical  true if its rules are precise enough to trust the count; false
 *           for the generic best-effort catch-all
 *   rules   each: { test (regex on the rel path, leading slash added),
 *           contentTest (optional regex on file body), name, tag }
 *
 * Adding a stack is adding a row, not writing a function. Regex + fs only, so
 * the script stays dependency-free and needs no language parser.
 */
const PROFILES = [
  {
    id: 'next',
    mechanical: true,
    detect: (deps) => !!deps.next,
    rules: [
      { test: /\/app\/.*\/route\.(t|j)sx?$/, name: 'HTTP route handler', tag: 'route' },
      { test: /\/middleware\.(t|j)s$/, name: 'Edge/middleware', tag: 'middleware' },
      { test: /\/next\.config\.(t|j|mj|cj)s$/, name: 'Response headers / config', tag: 'config-headers' },
      { test: /\/actions?\.(t|j)sx?$/, contentTest: /["']use server["']/, name: 'Server actions', tag: 'server-action' },
      { test: /\/(api\/)?cron\/.*\.(t|j)sx?$/, name: 'Scheduled/cron entry', tag: 'scheduled' },
    ],
  },
  {
    id: 'express',
    mechanical: true,
    detect: (deps) => !!(deps.express || deps.fastify || deps.koa || deps['@nestjs/core']),
    rules: [
      { test: /\.(t|j)s$/, contentTest: /\.(get|post|put|patch|delete|use|all)\s*\(/, name: 'Express/Koa/Nest route registration', tag: 'route' },
    ],
  },
  {
    id: 'django',
    mechanical: true,
    detect: (deps, files) => files.some((f) => /\/manage\.py$/.test('/' + f)),
    rules: [
      { test: /\/urls\.py$/, name: 'Django URLconf', tag: 'urls' },
      { test: /\/views\.py$/, name: 'Django view', tag: 'view' },
      { test: /\/consumers\.py$/, name: 'Django Channels consumer', tag: 'consumer' },
    ],
  },
  {
    id: 'flask',
    mechanical: true,
    detect: (deps, files) => files.some((f) => /\.py$/.test(f)) &&
      files.some((f) => /(flask|fastapi)/i.test(f)) === false, // detect by content below
    contentDetect: /(from\s+flask|import\s+flask|from\s+fastapi|import\s+fastapi)/,
    rules: [
      { test: /\.py$/, contentTest: /@\w+\.(route|get|post|put|delete)\s*\(/, name: 'Flask/FastAPI route', tag: 'route' },
    ],
  },
  {
    id: 'rails',
    mechanical: true,
    detect: (deps, files) => files.some((f) => /\/config\/routes\.rb$/.test('/' + f)),
    rules: [
      { test: /\/config\/routes\.rb$/, name: 'Rails routes', tag: 'routes' },
      { test: /\/app\/controllers\/.*_controller\.rb$/, name: 'Rails controller', tag: 'controller' },
    ],
  },
  {
    id: 'go-http',
    mechanical: true,
    detect: (deps, files) => files.some((f) => /\/go\.mod$/.test('/' + f)),
    rules: [
      { test: /\.go$/, contentTest: /(http\.HandleFunc|\.(GET|POST|PUT|DELETE|Handle|HandleFunc)\s*\()/, name: 'Go HTTP handler', tag: 'route' },
    ],
  },
  {
    id: 'php',
    mechanical: true,
    detect: (deps, files) => files.some((f) => /\/composer\.json$/.test('/' + f)),
    rules: [
      { test: /\/routes\/.*\.php$/, name: 'PHP/Laravel route file', tag: 'route' },
      { test: /Controller\.php$/, name: 'PHP controller', tag: 'controller' },
    ],
  },
  {
    // Catch-all. Best-effort by file name only. Never trusted as a count.
    id: 'generic',
    mechanical: false,
    detect: () => true,
    rules: [
      { test: /\/(route|router|controller|handler|endpoint|api)\.(t|j)sx?$/, name: 'Candidate request handler', tag: 'handler' },
      { test: /\/(server|app|index|main)\.(t|j)sx?$/, name: 'Candidate server entry', tag: 'server' },
    ],
  },
];

function readDeps(root) {
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return {};
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  } catch {
    return {};
  }
}

function selectProfile(root, relFiles, forced) {
  if (forced && forced !== 'auto') {
    return PROFILES.find((p) => p.id === forced) || PROFILES[PROFILES.length - 1];
  }
  const deps = readDeps(root);
  for (const p of PROFILES) {
    if (p.id === 'generic') continue;
    if (!p.detect(deps, relFiles)) continue;
    if (p.contentDetect) {
      // Confirm by content in at least one file, for profiles detect cannot pin
      // on filename alone (e.g. flask vs a plain python repo).
      const hit = relFiles.some((rf) =>
        p.contentDetect.test(safeRead(join(root, rf)))
      );
      if (!hit) continue;
    }
    return p;
  }
  return PROFILES.find((p) => p.id === 'generic');
}

// Apply a profile's rules to the file list. Deterministic: same commit, same set.
function enumerateWithProfile(profile, root, relFiles) {
  const els = [];
  for (const rf of relFiles) {
    const path = '/' + rf;
    for (const rule of profile.rules) {
      if (!rule.test.test(path)) continue;
      if (rule.contentTest && !rule.contentTest.test(safeRead(join(root, rf)))) continue;
      els.push(entry(`entry:${rule.tag}:${rf}`, `${rule.name}: ${rf}`));
      break; // one element per file, first matching rule wins
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
  const relFiles = files.map((f) => relative(root, f).replace(/\\/g, '/'));

  const profile = selectProfile(root, relFiles, o.profile);
  let entries = enumerateWithProfile(profile, root, relFiles);

  // Deduplicate and sort for a stable, reproducible list.
  const seen = new Set();
  entries = entries
    .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Honest source and warnings.
  const warnings = [];
  let entrySource;
  const manualRequired = !profile.mechanical;
  if (profile.mechanical) {
    entrySource = `mechanical (${profile.id} profile)`;
  } else {
    entrySource = 'best-effort (no framework profile matched; entry-point coverage is manual)';
    warnings.push(
      'No framework profile matched. Entry points were guessed by file name, ' +
        'so this denominator is best-effort. Enumerate entry points by hand and ' +
        'treat entry-point coverage as only as honest as the reviewer. Profiles ' +
        'tried: ' + PROFILES.filter((p) => p.id !== 'generic').map((p) => p.id).join(', ') + '.'
    );
  }
  if (profile.mechanical && entries.length === 0) {
    warnings.push(
      `The ${profile.id} profile matched but found zero entry points. That is ` +
        'usually a broken rule or a repo laid out unusually, not an app with no ' +
        'attack surface. Enumerate by hand before trusting coverage.'
    );
  }

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
    profile: profile.id,
    entrySource,
    manualEnumerationRequired: manualRequired,
    warnings,
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
  console.log(`Profile: ${profile.id}. Entry source: ${entrySource}.`);
  for (const w of warnings) console.log(`WARNING: ${w}`);
  console.log(`Wrote ${outPath}`);
  console.log('');
  console.log('Next: copy elements into summary.json under "enumeration" and give');
  console.log('every one a verdict (clear, finding, or gap). An element with no');
  console.log('verdict counts as a gap and lowers coverage.');
}

main();
