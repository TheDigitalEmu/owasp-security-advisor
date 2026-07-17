#!/usr/bin/env node
/**
 * deployment-report.js
 *
 * The short go/no-go extract from a review summary, for a deploy decision.
 *
 * Reads <findings-root>/summary.json and prints a decision plus the reasons.
 * Exit 0 to proceed, 1 to block, 2 on a usage or data error. Suitable as a CI
 * gate.
 *
 * A note on what this is: it is a convenience over a report a human already
 * read. It is NOT a substitute for reading the report, and it is not a
 * security control. If the only thing standing between a Critical and
 * production is this script's exit code, the problem is not this script.
 *
 * It blocks on coverage as well as on findings, deliberately. A review that
 * barely looked cannot clear a deploy, and a gate that says otherwise is worse
 * than no gate because it manufactures confidence.
 *
 * No dependencies. Node >= 18.
 *
 * Usage:
 *   node bin/deployment-report.js [options]
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const VERSION = '1.0.0';

const SEV_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1, Info: 0 };
const SCORED_STATUS = new Set(['open', 'accepted-risk', 'wont-fix']);

const HELP = `
deployment-report.js -- go/no-go extract from a review summary

Usage:
  node bin/deployment-report.js [options]

Options:
  -i, --input <path>       Path to summary.json. Default ./summary.json
      --block-on <sev>     Lowest severity that blocks. Default High.
                           One of: Critical, High, Medium, Low
      --min-coverage <pct> Block below this coverage. Default 70
      --allow-accepted     Do not block on findings marked accepted-risk.
                           Requires that someone actually accepted them
      --json               Emit JSON instead of prose
  -h, --help               Show this message

Exit codes:
  0  proceed
  1  blocked
  2  usage or data error

This gate reflects a review someone ran. It does not perform one, and a green
exit code means "the review that was run found nothing blocking at the coverage
it achieved". Read the coverage line. It is there because a clean result from a
review that examined a fifth of the attack surface is not a clean result.
`.trim();

function parseArgs(argv) {
  const o = {
    input: 'summary.json',
    blockOn: 'High',
    minCoverage: 70,
    allowAccepted: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '-i' || a === '--input') o.input = argv[++i];
    else if (a === '--block-on') o.blockOn = argv[++i];
    else if (a === '--min-coverage') o.minCoverage = Number(argv[++i]);
    else if (a === '--allow-accepted') o.allowAccepted = true;
    else if (a === '--json') o.json = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  if (!(o.blockOn in SEV_RANK) || o.blockOn === 'Info') {
    throw new Error(
      `--block-on must be Critical, High, Medium, or Low. Got: ${o.blockOn}`
    );
  }
  if (!Number.isFinite(o.minCoverage) || o.minCoverage < 0 || o.minCoverage > 100) {
    throw new Error('--min-coverage must be a number from 0 to 100');
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

  const path = resolve(o.input);
  if (!existsSync(path)) {
    console.error(`Not found: ${path}`);
    console.error('Run a review first. Shape: templates/summary.schema.json');
    process.exit(2);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`${path} is not valid JSON: ${e.message}`);
    process.exit(2);
  }

  if (!data.score) {
    console.error(
      'No score block. Run bin/render-report.js first; it computes the score ' +
        'from the findings and writes it back.'
    );
    process.exit(2);
  }

  const findings = data.findings || [];
  const threshold = SEV_RANK[o.blockOn];

  const blockers = findings.filter((f) => {
    if (f.verified !== true) return false;
    if (!SCORED_STATUS.has(f.status)) return false;
    if (o.allowAccepted && f.status === 'accepted-risk') return false;
    return SEV_RANK[f.severity] >= threshold;
  });

  const cov = data.score.coveragePct ?? 0;
  const coverageShort = cov < o.minCoverage;

  const reasons = [];
  for (const f of blockers) {
    reasons.push(`${f.severity} ${f.id}: ${f.title}`);
  }
  if (coverageShort) {
    reasons.push(
      `Coverage ${cov}% is below the ${o.minCoverage}% minimum. The review did ` +
        'not look at enough of the attack surface to clear a deploy.'
    );
  }

  const proceed = reasons.length === 0;
  const eng = data.engagement || {};

  if (o.json) {
    console.log(
      JSON.stringify(
        {
          decision: proceed ? 'proceed' : 'blocked',
          target: eng.target || '<target-repo>',
          commit: eng.commit || null,
          grade: data.score.grade,
          score: data.score.points,
          coveragePct: cov,
          blockOn: o.blockOn,
          blockers: blockers.map((f) => ({
            id: f.id,
            severity: f.severity,
            title: f.title,
            status: f.status,
          })),
          coverageShort,
          unverifiedCount: data.score.unverifiedCount ?? 0,
          generatedBy: `deployment-report.js ${VERSION}`,
        },
        null,
        2
      )
    );
    process.exit(proceed ? 0 : 1);
  }

  const line = '='.repeat(60);
  console.log(line);
  console.log(`  DEPLOY: ${proceed ? 'PROCEED' : 'BLOCKED'}`);
  console.log(line);
  console.log(`  Target      ${eng.target || '<target-repo>'}`);
  console.log(`  Commit      ${eng.commit || 'not recorded'}`);
  console.log(`  Reviewed    ${eng.reviewedAt || 'not recorded'}`);
  console.log(`  Grade       ${data.score.grade} (${data.score.points}/100)`);
  console.log(`  Coverage    ${cov}%`);
  console.log(`  Blocking at ${o.blockOn} and above`);
  console.log(line);

  if (proceed) {
    console.log('');
    console.log(`No verified finding at ${o.blockOn} or above, and coverage`);
    console.log(`meets the ${o.minCoverage}% minimum.`);
    const unv = data.score.unverifiedCount ?? 0;
    if (unv > 0) {
      console.log('');
      console.log(`${unv} finding(s) are unverified and held at Info. They did`);
      console.log('not block this deploy and they are not known to be safe.');
      console.log('They are unexamined. See unverified.md.');
    }
    if (o.allowAccepted) {
      const acc = findings.filter(
        (f) => f.status === 'accepted-risk' && SEV_RANK[f.severity] >= threshold
      );
      if (acc.length > 0) {
        console.log('');
        console.log(`${acc.length} accepted-risk finding(s) at or above ${o.blockOn}`);
        console.log('were excluded by --allow-accepted. They are still there.');
        for (const f of acc) {
          console.log(`  ${f.severity} ${f.id}: ${f.title}`);
          console.log(`    accepted by ${f.acceptedBy || 'NOBODY RECORDED'} on ${f.acceptedAt || 'no date'}`);
        }
      }
    }
  } else {
    console.log('');
    console.log('Reasons:');
    for (const r of reasons) console.log(`  - ${r}`);
    console.log('');
    console.log('Do not route around this by lowering --block-on. If the');
    console.log('decision is to ship anyway, that is a decision a person makes');
    console.log('and records, not a flag.');
  }

  console.log('');
  process.exit(proceed ? 0 : 1);
}

main();
