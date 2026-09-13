#!/usr/bin/env node
/**
 * version.js
 *
 * Prints the installed skill version, and with --check compares it against the
 * version declared upstream. It powers the self-update protocol in
 * doctrine/01-update-protocol.md. It reads only; it never pulls, writes, or
 * mutates the skill directory.
 *
 * The authoritative local version is the `version:` field in SKILL.md
 * frontmatter. package.json and the bin VERSION constants must agree with it;
 * --check reports if they do not, because a disagreement means a prior update
 * was left incomplete.
 *
 * --check needs a git remote configured in the skill directory. It runs
 * `git ls-remote` against the origin to read upstream tags. If there is no
 * remote, it says so and exits 2 rather than guessing an upstream.
 *
 * No dependencies. Node >= 18.
 *
 * Usage:
 *   node bin/version.js
 *   node bin/version.js --check
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const VERSION = '1.1.1';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const HELP = `
version.js -- print the skill version, or check it against upstream

Usage:
  node bin/version.js            Print local version and consistency check
  node bin/version.js --check    Also compare against the upstream git remote
  node bin/version.js --json     Machine-readable output
  -h, --help                     Show this message

Exit codes:
  0   current, or plain print succeeded
  10  an update is available (only with --check)
  2   usage or data error, or no remote configured for --check

This script reads only. It does not update anything. The update procedure is
doctrine/01-update-protocol.md, and it requires a human confirmation before any
pull.
`;

/* --------------------------------------------------------------- helpers - */

// A tiny SemVer parser. Enough for MAJOR.MINOR.PATCH with an optional leading v.
function parseSemver(s) {
  if (typeof s !== 'string') return null;
  const m = s.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], raw: `${+m[1]}.${+m[2]}.${+m[3]}` };
}

// Returns negative if a < b, 0 if equal, positive if a > b.
function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function bumpKind(local, upstream) {
  if (upstream.major !== local.major) return 'MAJOR';
  if (upstream.minor !== local.minor) return 'MINOR';
  return 'PATCH';
}

// Read the version: field out of SKILL.md frontmatter. This is authoritative.
function readSkillVersion() {
  const p = join(ROOT, 'SKILL.md');
  if (!existsSync(p)) return null;
  const text = readFileSync(p, 'utf8');
  const fm = text.match(/^---\s*[\r\n]([\s\S]*?)[\r\n]---/);
  if (!fm) return null;
  const line = fm[1].split(/\r?\n/).find((l) => /^version:\s*/.test(l));
  if (!line) return null;
  return line.replace(/^version:\s*/, '').trim();
}

function readPackageVersion() {
  const p = join(ROOT, 'package.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')).version || null;
  } catch {
    return null;
  }
}

// Read VERSION consts from the sibling bin scripts, for the consistency check.
function readBinVersions() {
  const names = ['reachability.js', 'render-report.js', 'deployment-report.js', 'version.js'];
  const out = {};
  for (const n of names) {
    const p = join(HERE, n);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/const VERSION\s*=\s*['"]([^'"]+)['"]/);
    out[n] = m ? m[1] : null;
  }
  return out;
}

function git(args) {
  return execFileSync('git', ['-C', ROOT, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function hasRemote() {
  try {
    const r = git(['remote']);
    return r.length > 0;
  } catch {
    return false;
  }
}

// Read the highest SemVer tag from the origin remote without fetching objects.
function upstreamTagVersion() {
  const raw = git(['ls-remote', '--tags', '--refs', 'origin']);
  const versions = raw
    .split(/\r?\n/)
    .map((l) => l.split(/\s+/)[1] || '')
    .map((ref) => ref.replace('refs/tags/', ''))
    .map(parseSemver)
    .filter(Boolean);
  if (versions.length === 0) return null;
  versions.sort(compareSemver);
  return versions[versions.length - 1];
}

/* ------------------------------------------------------------------- main - */

function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    return 0;
  }
  const asJson = argv.includes('--json');
  const doCheck = argv.includes('--check');

  const localRaw = readSkillVersion();
  const local = parseSemver(localRaw || '');
  if (!local) {
    fail('Could not read a valid version from SKILL.md frontmatter.', asJson);
    return 2;
  }

  const pkg = readPackageVersion();
  const bins = readBinVersions();
  const consistency = [];
  if (pkg && pkg !== local.raw) {
    consistency.push(`package.json is ${pkg}, SKILL.md is ${local.raw}`);
  }
  for (const [name, v] of Object.entries(bins)) {
    if (v && v !== local.raw) consistency.push(`bin/${name} is ${v}, SKILL.md is ${local.raw}`);
  }

  const report = {
    local: local.raw,
    consistent: consistency.length === 0,
    inconsistencies: consistency,
  };

  if (!doCheck) {
    if (asJson) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      process.stdout.write(`OWASP Security Advisor version ${local.raw}\n`);
      if (consistency.length) {
        process.stdout.write('\nVersion surface is inconsistent (a prior update was incomplete):\n');
        for (const c of consistency) process.stdout.write(`  - ${c}\n`);
      }
    }
    return 0;
  }

  // --check path.
  if (!hasRemote()) {
    fail('No git remote is configured in the skill directory, so upstream cannot be read. See doctrine/01-update-protocol.md.', asJson);
    return 2;
  }

  let upstream;
  try {
    upstream = upstreamTagVersion();
  } catch (e) {
    fail(`Could not read upstream tags: ${e.message}`, asJson);
    return 2;
  }
  if (!upstream) {
    fail('The remote has no SemVer tags to compare against.', asJson);
    return 2;
  }

  const cmp = compareSemver(local, upstream);
  const updateAvailable = cmp < 0;
  report.upstream = upstream.raw;
  report.updateAvailable = updateAvailable;
  report.bump = updateAvailable ? bumpKind(local, upstream) : null;

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(`Local:    ${local.raw}\n`);
    process.stdout.write(`Upstream: ${upstream.raw}\n`);
    if (updateAvailable) {
      process.stdout.write(`\nAn update is available (${report.bump}). Follow doctrine/01-update-protocol.md.\n`);
    } else if (cmp > 0) {
      process.stdout.write('\nLocal is ahead of upstream. Nothing to pull.\n');
    } else {
      process.stdout.write('\nYou are on the latest version.\n');
    }
  }
  return updateAvailable ? 10 : 0;
}

function fail(msg, asJson) {
  if (asJson) process.stdout.write(JSON.stringify({ error: msg }, null, 2) + '\n');
  else process.stderr.write(`version.js: ${msg}\n`);
}

process.exit(main(process.argv.slice(2)));
