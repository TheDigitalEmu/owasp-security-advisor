#!/usr/bin/env node
/**
 * render-report.js
 *
 * Renders a review summary into the Markdown and HTML reports.
 *
 * Reads <findings-root>/summary.json (shape: templates/summary.schema.json),
 * computes the posture score, and writes report.md and report.html.
 *
 * This script is the executable form of rubrics/scoring.md. That document is
 * authoritative: if this script and the rubric ever disagree, this script is
 * the bug. Do not "improve" the scoring here without changing the rubric in
 * the same commit, or the two will drift and the number will stop meaning
 * anything.
 *
 * No dependencies. Node >= 18.
 *
 * Usage:
 *   node bin/render-report.js [options]
 *
 * Options:
 *   -i, --input <path>      Path to summary.json. Default ./summary.json
 *   -o, --out-dir <path>    Output directory. Default: directory of --input
 *   -t, --templates <path>  Template directory. Default: ../templates
 *       --stdout            Print the Markdown report to stdout, write nothing
 *       --strict            Exit non-zero if any severity mismatch is found
 *   -h, --help              Show this message
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = '1.0.0';

/* ---------------------------------------------------------------- scoring -
 * rubrics/scoring.md section 1.
 */

const IMPACT = { Catastrophic: 4, Severe: 3, Moderate: 2, Minor: 1 };
const REACH = { Open: 4, Authenticated: 3, Constrained: 2, Theoretical: 1 };

// MATRIX[impact][reachability]
const MATRIX = {
  4: { 4: 'Critical', 3: 'Critical', 2: 'High', 1: 'Medium' },
  3: { 4: 'Critical', 3: 'High', 2: 'Medium', 1: 'Low' },
  2: { 4: 'High', 3: 'Medium', 2: 'Low', 1: 'Low' },
  1: { 4: 'Medium', 3: 'Low', 2: 'Low', 1: 'Info' },
};

const SEV_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1, Info: 0 };
const RANK_SEV = ['Info', 'Low', 'Medium', 'High', 'Critical'];

const WEIGHT = { Critical: 40, High: 20, Medium: 8, Low: 3, Info: 0 };

// Statuses that count toward the score. rubrics/scoring.md section 3.
const SCORED_STATUS = new Set(['open', 'accepted-risk', 'wont-fix']);

/**
 * Severity from the matrix, then capped by the verification ceiling.
 * rubrics/scoring.md sections 1 and 2. The ceiling always wins.
 */
function computeSeverity(f) {
  const i = IMPACT[f.impact];
  const r = REACH[f.reachability];
  if (!i || !r) {
    throw new Error(
      `${f.id}: unknown impact "${f.impact}" or reachability "${f.reachability}"`
    );
  }
  const matrix = MATRIX[i][r];

  let ceiling = 'Critical';
  if (f.verified !== true) ceiling = 'Info';
  else if (f.confidence === 'low') ceiling = 'Low';
  else if (f.confidence === 'medium') ceiling = 'Medium';

  return SEV_RANK[matrix] <= SEV_RANK[ceiling] ? matrix : ceiling;
}

function gradeFromScore(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 50) return 'C';
  if (score >= 25) return 'D';
  return 'F';
}

const GRADE_RANK = { A: 0, B: 1, C: 2, D: 3, F: 4 };
const RANK_GRADE = ['A', 'B', 'C', 'D', 'F'];

const GRADE_READING = {
  A: 'No verified issue above Low. Ship.',
  B: 'Verified Mediums present. Ship with them tracked and dated.',
  C: 'Material verified issues. Fix before exposing to untrusted users.',
  D: 'Serious verified issues. Do not expose to untrusted users.',
  F: 'Critical verified issues. Do not deploy.',
};

function score(findings) {
  const scored = findings.filter(
    (f) => f.verified === true && SCORED_STATUS.has(f.status)
  );

  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
  for (const f of scored) counts[f.severity] += 1;

  const raw =
    100 -
    WEIGHT.Critical * counts.Critical -
    WEIGHT.High * counts.High -
    WEIGHT.Medium * counts.Medium -
    WEIGHT.Low * counts.Low;
  const points = Math.max(0, raw);

  // The override. rubrics/scoring.md section 3.
  // One Critical is not offset by everything else being clean.
  let grade = gradeFromScore(points);
  if (counts.Critical > 0) {
    grade = 'F';
  } else if (counts.High > 0) {
    grade = RANK_GRADE[Math.max(GRADE_RANK[grade], GRADE_RANK.C)];
  }

  return { points, grade, counts, scoredCount: scored.length };
}

/* --------------------------------------------------------------- template -
 * Minimal renderer. {{token}} substitution, plus BEGIN:/END: repeated blocks.
 * Deliberately not a template engine: a security tool should not grow a
 * dependency to print a table.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A pipe in a value would break out of a Markdown table cell.
function escapeMd(s) {
  return String(s).replace(/\|/g, '\\|');
}

function substitute(text, vars, escape) {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key) => {
    if (!(key in vars)) return whole;
    const v = vars[key];
    if (v === null || v === undefined || v === '') return '';
    // *Html-suffixed values are pre-rendered markup and must pass through raw.
    return key.endsWith('Html') ? String(v) : escape(v);
  });
}

function renderBlock(template, blockName, items, vars, escape) {
  const begin = `<!-- BEGIN:${blockName} -->`;
  const end = `<!-- END:${blockName} -->`;
  const a = template.indexOf(begin);
  const b = template.indexOf(end);
  if (a === -1 || b === -1) return template;

  const inner = template.slice(a + begin.length, b);
  const rendered = items
    .map((item) => substitute(inner, { ...vars, ...item }, escape))
    .join('');

  return template.slice(0, a) + rendered + template.slice(b + end.length);
}

function stripLeadingComment(text) {
  const t = text.trimStart();
  if (!t.startsWith('<!--')) return text;
  const close = t.indexOf('-->');
  if (close === -1) return text;
  return t.slice(close + 3).trimStart();
}

/* ------------------------------------------------------------------- view -*/

function list(items, kind) {
  if (!items || items.length === 0) {
    return kind === 'html'
      ? '<p class="kv">None recorded.</p>'
      : '_None recorded._';
  }
  return kind === 'html'
    ? '<ul>' + items.map((i) => `<li>${escapeHtml(i)}</li>`).join('') + '</ul>'
    : items.map((i) => `- ${i}`).join('\n');
}

function topPriority(findings) {
  const live = findings
    .filter((f) => f.verified === true && SCORED_STATUS.has(f.status))
    .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);

  if (live.length === 0) {
    return (
      'No verified finding above Info. Read the coverage figure before ' +
      'concluding anything from that: an unfinished review also produces ' +
      'no findings.'
    );
  }
  const t = live[0];
  return `**${t.id}: ${t.title}** (${t.severity}). ${t.summary || ''}`.trim();
}

function coverageWarning(pct, grade, cov) {
  if (cov.entryPointsEnumerated === 0) {
    return (
      'No entry points were recorded. Coverage is unknown, so the grade ' +
      'above is not supported by any statement about how much was looked at. ' +
      'Treat this report as incomplete.'
    );
  }
  if (pct < 80 && (grade === 'A' || grade === 'B')) {
    return (
      `Coverage is ${pct}%. This grade is not a clean bill of health: ` +
      `${cov.entryPointsEnumerated - cov.entryPointsTraced} of ` +
      `${cov.entryPointsEnumerated} enumerated entry points were never traced. ` +
      'A high score at low coverage is an unfinished review.'
    );
  }
  if (pct < 50) {
    return (
      `Coverage is ${pct}%. Most of the enumerated attack surface was not ` +
      'traced. The findings below are real, but the absence of others is not ' +
      'evidence of their absence.'
    );
  }
  return '';
}

/* -------------------------------------------------------------------- cli -*/

function parseArgs(argv) {
  const out = {
    input: 'summary.json',
    outDir: null,
    templates: join(HERE, '..', 'templates'),
    stdout: false,
    strict: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '-i' || a === '--input') out.input = argv[++i];
    else if (a === '-o' || a === '--out-dir') out.outDir = argv[++i];
    else if (a === '-t' || a === '--templates') out.templates = argv[++i];
    else if (a === '--stdout') out.stdout = true;
    else if (a === '--strict') out.strict = true;
    else if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
  }
  return out;
}

const HELP = `
render-report.js -- render a review summary into report.md and report.html

Usage:
  node bin/render-report.js [options]

Options:
  -i, --input <path>      Path to summary.json. Default ./summary.json
  -o, --out-dir <path>    Output directory. Default: directory of --input
  -t, --templates <path>  Template directory. Default: ../templates
      --stdout            Print Markdown to stdout, write nothing
      --strict            Exit 1 if an authored severity disagrees with the
                          computed one
  -h, --help              Show this message

The scoring model is rubrics/scoring.md. This script implements it; the
document is authoritative. Severity is impact multiplied by reachability,
then capped by the verification ceiling: an unverified finding cannot exceed
Info, low confidence cannot exceed Low, medium confidence cannot exceed
Medium.

Coverage is reported next to the score and is never folded into it. A high
score at low coverage is an unfinished review.
`.trim();

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }

  if (opts.help) {
    console.log(HELP);
    process.exit(0);
  }

  const inputPath = resolve(opts.input);
  if (!existsSync(inputPath)) {
    console.error(`Not found: ${inputPath}`);
    console.error('Expected a summary.json. Shape: templates/summary.schema.json');
    process.exit(2);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch (e) {
    console.error(`${inputPath} is not valid JSON: ${e.message}`);
    process.exit(2);
  }

  const findings = data.findings || [];
  const problems = [];

  // Recompute every severity. The authored value is a claim; the rubric
  // decides. A mismatch usually means the reviewer reasoned backwards from a
  // severity they had already picked, which is exactly what the rubric exists
  // to stop.
  for (const f of findings) {
    let computed;
    try {
      computed = computeSeverity(f);
    } catch (e) {
      console.error(e.message);
      process.exit(2);
    }
    if (f.severity !== computed) {
      problems.push(
        `${f.id}: authored severity ${f.severity}, rubric says ${computed} ` +
          `(impact ${f.impact}, reachability ${f.reachability}, ` +
          `verified ${f.verified}, confidence ${f.confidence})`
      );
      f.severity = computed;
    }
  }

  if (problems.length > 0) {
    console.error('Severity mismatches (the rubric wins, values corrected):');
    for (const p of problems) console.error(`  ${p}`);
    if (opts.strict) process.exit(1);
  }

  const s = score(findings);
  const cov = data.coverage || { entryPointsEnumerated: 0, entryPointsTraced: 0 };
  const pct =
    cov.entryPointsEnumerated > 0
      ? Math.round((cov.entryPointsTraced / cov.entryPointsEnumerated) * 100)
      : 0;

  const eng = data.engagement || {};
  const unverifiedCount = findings.filter((f) => f.verified !== true).length;
  const warning = coverageWarning(pct, s.grade, cov);

  const sorted = [...findings].sort(
    (a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]
  );

  const base = {
    version: VERSION,
    target: eng.target || '<target-repo>',
    reviewedAt: eng.reviewedAt || 'not recorded',
    reviewer: eng.reviewer || 'not recorded',
    commit: eng.commit || 'not recorded',
    mode: eng.mode || 'review',
    asvsLevel: eng.asvsLevel || 'not stated',
    grade: s.grade,
    score: s.points,
    gradeReading: GRADE_READING[s.grade],
    criticalCount: s.counts.Critical,
    highCount: s.counts.High,
    mediumCount: s.counts.Medium,
    lowCount: s.counts.Low,
    infoCount: s.counts.Info,
    unverifiedCount,
    entryPointsEnumerated: cov.entryPointsEnumerated,
    entryPointsTraced: cov.entryPointsTraced,
    coveragePct: pct,
    doctrineCompletedCount: (cov.doctrinePassesCompleted || []).length,
    doctrineApplicableCount: (cov.doctrinePassesApplicable || []).length,
    topPriority: topPriority(findings),
    noFindingsNote:
      findings.length === 0
        ? 'No findings were recorded. Check the coverage figure above before ' +
          'reading that as a clean result.'
        : '',
  };

  const items = sorted.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    sevClass: f.severity.toLowerCase().slice(0, 4),
    impact: f.impact,
    reachability: f.reachability,
    verified: f.verified ? 'yes' : 'no, held at Info by the ceiling',
    confidence: f.confidence,
    status: f.status,
    component: f.component || 'not recorded',
    owasp: (f.owasp || []).join(', ') || 'none',
    asvs: (f.asvs || []).join(', ') || 'none',
    cwe: (f.cwe || []).join(', ') || 'none',
    summary: f.summary || '',
    file: f.file || '',
    entryPoint: (f.location && f.location.entryPoint) || 'not recorded',
    sink: (f.location && f.location.sink) || 'not recorded',
    control: (f.location && f.location.control) || 'none found',
  }));

  // Markdown
  const mdVars = {
    ...base,
    coverageWarning: warning ? `> **Coverage warning.** ${warning}` : '',
    scopeIncluded: list((eng.scope || {}).included, 'md'),
    scopeExcluded: list((eng.scope || {}).excluded, 'md'),
    areasNotReviewed: list(cov.areasNotReviewed, 'md'),
  };
  let md = stripLeadingComment(readFileSync(join(opts.templates, 'report.md'), 'utf8'));
  md = renderBlock(md, 'findings', items, mdVars, escapeMd);
  md = substitute(md, mdVars, escapeMd);

  if (opts.stdout) {
    process.stdout.write(md);
    process.exit(problems.length > 0 && opts.strict ? 1 : 0);
  }

  // HTML
  const htmlVars = {
    ...base,
    coverageWarningHtml: warning
      ? `<strong>Coverage warning.</strong> ${escapeHtml(warning)}`
      : '',
    scopeIncludedHtml: list((eng.scope || {}).included, 'html'),
    scopeExcludedHtml: list((eng.scope || {}).excluded, 'html'),
    areasNotReviewedHtml: list(cov.areasNotReviewed, 'html'),
  };
  let html = readFileSync(join(opts.templates, 'report.html'), 'utf8');
  html = renderBlock(html, 'findings', items, htmlVars, escapeHtml);
  html = substitute(html, htmlVars, escapeHtml);

  const outDir = resolve(opts.outDir || dirname(inputPath));
  writeFileSync(join(outDir, 'report.md'), md, 'utf8');
  writeFileSync(join(outDir, 'report.html'), html, 'utf8');

  // Write the computed score back so summary.json stays the machine-readable
  // truth rather than a stale claim beside a fresh report.
  data.score = {
    points: s.points,
    grade: s.grade,
    counts: s.counts,
    coveragePct: pct,
    unverifiedCount,
    computedBy: `render-report.js ${VERSION}`,
  };
  writeFileSync(inputPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`Grade ${s.grade} (${s.points}/100) at ${pct}% coverage.`);
  console.log(
    `Critical ${s.counts.Critical}, High ${s.counts.High}, ` +
      `Medium ${s.counts.Medium}, Low ${s.counts.Low}, Info ${s.counts.Info}. ` +
      `${unverifiedCount} unverified.`
  );
  if (warning) console.log(`Coverage warning: ${warning}`);
  console.log(`Wrote ${join(outDir, 'report.md')}`);
  console.log(`Wrote ${join(outDir, 'report.html')}`);

  process.exit(problems.length > 0 && opts.strict ? 1 : 0);
}

main();
