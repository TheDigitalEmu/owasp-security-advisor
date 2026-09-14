#!/usr/bin/env node
/**
 * consensus.js
 *
 * Combines N independent review passes over the SAME fixed enumeration into one
 * consensus, so the finding set and the ratings stop drifting run to run. It
 * does not score and does not render: it writes the consensus into summary.json
 * and render-report.js takes it from there. rubrics/scoring.md stays the single
 * source of truth for severity.
 *
 * Why this works where free-form voting does not: every pass verdicts the same
 * element ids from enumerate.js, so N passes are N verdict vectors over one key
 * set, directly comparable. We vote per key, not over ragged finding lists.
 *
 * Combination rules (rubrics/scoring.md section 5a):
 *   Verdict (discovery): any pass says "finding" -> finding. else any "gap" ->
 *     gap. else clear. Easy to become a finding, hard to become clear. The
 *     rating stage then disciplines the union so junk falls to Info.
 *   Rating (per finding):
 *     impact, reachability: highest level any pass backed WITH a citation.
 *       An uncited level does not raise the axis.
 *     verified: AND across filing passes (true only if every filing pass verified).
 *     confidence: minimum (most cautious) across filing passes.
 *   Disagreement is recorded per element and as a document-level rate, and is a
 *   STABILITY measure, never a completeness or correctness measure.
 *
 * What it does NOT fix: shared model bias. N passes by one model can all miss the
 * same thing with zero disagreement. A low disagreement rate means the review was
 * consistent, not that it was right or complete. Only heterogeneous samplers
 * (different models, or a human) make agreement mean more than consistency.
 *
 * No dependencies. Node >= 18.
 *
 * Usage:
 *   node bin/consensus.js --enumeration <enumeration.json> --samples <file...> --out <summary.json>
 *   node bin/consensus.js --enumeration e.json --samples-dir <dir> --out summary.json
 *
 * Each sample file: { "pass": <n>, "sampler": "<model or human>",
 *   "elements": [ { "id", "verdict", "evidence"?, "finding"? } ] }
 * where finding = { impact, reachability, verified, confidence, title,
 *   axisCitations: { impact, reachability } }.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const VERSION = '1.5.0';

const IMPACT_RANK = { Catastrophic: 4, Severe: 3, Moderate: 2, Minor: 1 };
const REACH_RANK = { Open: 4, Authenticated: 3, Constrained: 2, Theoretical: 1 };
const CONF_RANK = { high: 3, medium: 2, low: 1 };
const RANK_IMPACT = { 4: 'Catastrophic', 3: 'Severe', 2: 'Moderate', 1: 'Minor' };
const RANK_REACH = { 4: 'Open', 3: 'Authenticated', 2: 'Constrained', 1: 'Theoretical' };
const RANK_CONF = { 3: 'high', 2: 'medium', 1: 'low' };

const HELP = `
consensus.js -- combine N review passes into one consensus

Usage:
  node bin/consensus.js --enumeration <enumeration.json> --samples <f1> <f2>... --out <summary.json>
  node bin/consensus.js --enumeration <enumeration.json> --samples-dir <dir> --out <summary.json>

Options:
  --enumeration <path>  The fixed element list from enumerate.js. Required
  --samples <paths...>  One or more sample files (one per pass)
  --samples-dir <dir>   A directory of sample .json files, used as the passes
  --out <path>          Where to write the merged summary.json. Required
  --engagement <path>   Optional JSON with the engagement block to carry through
  -h, --help            Show this message

It writes the consensus enumeration verdicts, a synthesised findings[] (severity
is left for render-report.js to compute from the consensus axes), and a
document-level disagreementRate. Then run render-report.js on the output.

disagreementRate is a STABILITY measure only. Passes by one model that share a
blind spot agree with each other and are still wrong. Agreement means the review
was consistent, not correct or complete.
`.trim();

function parseArgs(argv) {
  const o = { enumeration: null, samples: [], samplesDir: null, out: null, engagement: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '--enumeration') o.enumeration = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--samples-dir') o.samplesDir = argv[++i];
    else if (a === '--engagement') o.engagement = argv[++i];
    else if (a === '--samples') {
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o.samples.push(argv[++i]);
    } else throw new Error(`Unknown option: ${a}`);
  }
  return o;
}

function readJson(p) {
  return JSON.parse(readFileSync(resolve(p), 'utf8'));
}

// Highest axis level any filing pass backed with a non-empty citation.
function consensusAxis(samples, axis, rankMap, invMap) {
  let best = 0;
  for (const s of samples) {
    const level = s.finding && s.finding[axis];
    const cited =
      s.finding && s.finding.axisCitations && s.finding.axisCitations[axis] &&
      String(s.finding.axisCitations[axis]).trim() !== '' &&
      !/^n\/?a$/i.test(String(s.finding.axisCitations[axis]).trim());
    const rank = rankMap[level] || 0;
    // Minor / Theoretical are the floors and need no citation to hold.
    const isFloor = rank === 1;
    if (rank > best && (cited || isFloor)) best = rank;
  }
  if (best === 0) best = 1; // floor
  return invMap[best];
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
  if (!o.enumeration || !o.out) {
    console.error('--enumeration and --out are required.');
    process.exit(2);
  }

  let samplePaths = o.samples.slice();
  if (o.samplesDir) {
    const dir = resolve(o.samplesDir);
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.json')) samplePaths.push(join(dir, f));
    }
  }
  if (samplePaths.length === 0) {
    console.error('No sample files given. Use --samples or --samples-dir.');
    process.exit(2);
  }

  const enumeration = readJson(o.enumeration);
  const passes = samplePaths.map(readJson);
  const samplers = passes.map((p, i) => p.sampler || `pass-${p.pass ?? i + 1}`);
  const distinctSamplers = [...new Set(samplers)];

  // Index each pass's verdicts by element id. A pass missing an id = gap for it.
  const byId = new Map();
  for (const el of enumeration.elements) byId.set(el.id, []);
  passes.forEach((p) => {
    const seen = new Set();
    for (const e of p.elements || []) {
      if (!byId.has(e.id)) continue; // ignore ids outside the fixed set
      byId.get(e.id).push(e);
      seen.add(e.id);
    }
    // Any id this pass did not mention is a gap for this pass.
    for (const id of byId.keys()) {
      if (!seen.has(id)) byId.get(id).push({ id, verdict: 'gap' });
    }
  });

  const elements = [];
  const findings = [];
  let disagreeCount = 0;
  let fSeq = 0;

  for (const el of enumeration.elements) {
    const samples = byId.get(el.id);
    const verdicts = samples.map((s) => s.verdict || 'gap');
    const anyFinding = verdicts.includes('finding');
    const anyGap = verdicts.includes('gap');
    const consensusVerdict = anyFinding ? 'finding' : anyGap ? 'gap' : 'clear';
    const unanimous = verdicts.every((v) => v === verdicts[0]);
    if (!unanimous) disagreeCount++;
    const agreement =
      verdicts.filter((v) => v === consensusVerdict).length / verdicts.length;

    const outEl = {
      id: el.id,
      kind: el.kind,
      name: el.name,
      verdict: consensusVerdict,
      consensus: {
        verdictSamples: verdicts,
        verdictAgreement: Math.round(agreement * 100) / 100,
      },
    };

    if (consensusVerdict === 'finding') {
      const filing = samples.filter((s) => s.verdict === 'finding' && s.finding);
      if (filing.length > 0) {
        const impact = consensusAxis(filing, 'impact', IMPACT_RANK, RANK_IMPACT);
        const reachability = consensusAxis(filing, 'reachability', REACH_RANK, RANK_REACH);
        const verified = filing.every((s) => s.finding.verified === true);
        const confidence =
          RANK_CONF[Math.min(...filing.map((s) => CONF_RANK[s.finding.confidence] || 1))];

        const ratingSamples = filing.map((s) => ({
          impact: s.finding.impact,
          reachability: s.finding.reachability,
          verified: s.finding.verified,
          confidence: s.finding.confidence,
        }));
        const divergence = {};
        for (const axis of ['impact', 'reachability', 'verified', 'confidence']) {
          const vals = [...new Set(ratingSamples.map((r) => String(r[axis])))];
          if (vals.length > 1) divergence[axis] = vals;
        }

        fSeq += 1;
        const id = `F-${String(fSeq).padStart(3, '0')}`;
        findings.push({
          id,
          title: filing[0].finding.title || el.name,
          impact,
          reachability,
          verified,
          confidence,
          status: 'open',
          component: el.id,
          ratingSamples,
          ratingDivergence: divergence,
        });
        outEl.consensus.finding = id;
        outEl.consensus.ratingDivergence = divergence;
      }
    }
    elements.push(outEl);
  }

  const disagreementRate = Math.round((disagreeCount / enumeration.elements.length) * 100) / 100;

  const engagement = o.engagement ? readJson(o.engagement) : {
    target: enumeration.root || '<target-repo>',
    reviewedAt: new Date().toISOString(),
    mode: 'review',
    scope: { included: [], excluded: [] },
  };

  const summary = {
    schemaVersion: '1.0.0',
    engagement,
    enumeration: {
      generatedBy: enumeration.generatedBy,
      profile: enumeration.profile,
      entrySource: enumeration.entrySource,
      elements,
    },
    consensus: {
      passes: passes.length,
      samplers: distinctSamplers,
      disagreementRate,
      generatedBy: `consensus.js ${VERSION}`,
      note:
        'disagreementRate is a stability measure, not completeness or correctness. ' +
        (distinctSamplers.length > 1
          ? 'Passes came from more than one sampler, so agreement carries some weight.'
          : 'All passes came from one sampler, so agreement means the review was consistent, not that it was right or complete.'),
    },
    findings,
  };

  writeFileSync(resolve(o.out), JSON.stringify(summary, null, 2) + '\n');

  console.log(`Combined ${passes.length} pass(es) over ${enumeration.elements.length} elements.`);
  console.log(`Findings in consensus: ${findings.length}. Disagreement rate: ${disagreementRate}.`);
  console.log(`Samplers: ${distinctSamplers.join(', ')}.`);
  if (distinctSamplers.length === 1) {
    console.log('One sampler: agreement means consistency, not correctness. Shared blind spots are invisible here.');
  }
  console.log(`Wrote ${resolve(o.out)}. Now run render-report.js on it.`);
}

main();
