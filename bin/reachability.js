#!/usr/bin/env node
/**
 * reachability.js
 *
 * Records and checks a traced path from an entry point to a sink.
 *
 * This is the Rule 2 workbook. A finding above Info requires a path that was
 * actually traced: every hop read, every control on the path read and ruled
 * out, the framework version confirmed, and at least one honest attempt made
 * to refute the finding. This script does not verify anything for you. It
 * cannot. What it does is make an incomplete trace visible, so that "I checked"
 * has to become a list of files someone else can re-read.
 *
 * A trace nobody can check is not evidence.
 *
 * No dependencies. Node >= 18.
 *
 * Usage:
 *   node bin/reachability.js record --id <ID> [options]
 *   node bin/reachability.js check <trace.json>
 *   node bin/reachability.js check-all <dir>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const VERSION = '1.2.1';

const HELP = `
reachability.js -- record and check an entry-point-to-sink trace

Usage:
  node bin/reachability.js record --id <ID> [options]
  node bin/reachability.js check <trace.json>
  node bin/reachability.js check-all <dir>

record options:
  --id <ID>                Finding id, e.g. HIGH-004. Required
  --entry <file:line>      Entry point where untrusted input arrives. Required
  --sink <file:line>       The dangerous operation. Required
  --hop <file:line=note>   A hop on the path. Repeatable. Give at least one.
                           The note says what happens to the input there
  --control <file:line=why>  A control you read and ruled out, and why it does
                           not stop this. Repeatable
  --framework <name@ver>   Framework and the exact version you confirmed
  --framework-at <file:line>  Where you confirmed that version
  --default <text>         The framework's default behaviour for this version
  --refute <attempt=result>  A refutation you attempted and its result.
                           Repeatable. At least one is required
  --out <dir>              Output directory. Default ./traces

check:
  Reports whether a trace meets the bar for a severity above Info.
  Exit 0 if it does, 1 if it does not.

The bar, from rubrics/scoring.md section 2 and doctrine/06:
  - an entry point and a sink
  - at least one hop, each with a file, a line, and a note
  - the framework version confirmed, with a file and line for where
  - at least one refutation attempted and defeated
  - controls on the path read and explicitly ruled out, or an explicit
    statement that none were found

Failing the bar is not an error. It is the correct outcome for a finding you
have not finished verifying: mark it unverified and hold it at Info.
`.trim();

function parsePair(s, sep = '=') {
  const i = s.indexOf(sep);
  if (i === -1) return [s, ''];
  return [s.slice(0, i), s.slice(i + 1)];
}

function parseLoc(s) {
  const m = /^(.*):(\d+)$/.exec(s);
  if (!m) return { raw: s, file: s, line: null };
  return { raw: s, file: m[1], line: Number(m[2]) };
}

function parseArgs(argv) {
  const o = {
    cmd: argv[0],
    id: null,
    entry: null,
    sink: null,
    hops: [],
    controls: [],
    refutations: [],
    framework: null,
    frameworkAt: null,
    frameworkDefault: null,
    out: 'traces',
    rest: [],
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--id') o.id = argv[++i];
    else if (a === '--entry') o.entry = argv[++i];
    else if (a === '--sink') o.sink = argv[++i];
    else if (a === '--hop') o.hops.push(argv[++i]);
    else if (a === '--control') o.controls.push(argv[++i]);
    else if (a === '--refute') o.refutations.push(argv[++i]);
    else if (a === '--framework') o.framework = argv[++i];
    else if (a === '--framework-at') o.frameworkAt = argv[++i];
    else if (a === '--default') o.frameworkDefault = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (!a.startsWith('-')) o.rest.push(a);
    else throw new Error(`Unknown option: ${a}`);
  }
  return o;
}

/**
 * The Rule 2 bar. Returns a list of reasons the trace is incomplete.
 * Empty list means the trace supports a severity above Info.
 */
function check(t) {
  const gaps = [];

  if (!t.entry || !t.entry.file) gaps.push('No entry point recorded.');
  else if (t.entry.line === null)
    gaps.push('Entry point has no line number. "somewhere in that file" is not a trace.');

  if (!t.sink || !t.sink.file) gaps.push('No sink recorded.');
  else if (t.sink.line === null) gaps.push('Sink has no line number.');

  if (!t.hops || t.hops.length === 0) {
    gaps.push(
      'No hops recorded. If the entry point IS the sink, record it as a single ' +
        'hop and say so. Otherwise the path between them is exactly what has ' +
        'not been read.'
    );
  } else {
    t.hops.forEach((h, i) => {
      if (h.line === null) gaps.push(`Hop ${i + 1} (${h.file}) has no line number.`);
      if (!h.note || h.note.trim() === '')
        gaps.push(
          `Hop ${i + 1} (${h.raw}) has no note. Say what happens to the input here.`
        );
    });
  }

  if (!t.framework)
    gaps.push(
      'No framework and version recorded. Framework defaults change between ' +
        'majors, and assuming them is where confident wrong findings come from.'
    );
  else if (!t.frameworkAt)
    gaps.push(
      `Framework recorded as "${t.framework}" but not where it was confirmed. ` +
        'Rule 3: cite the manifest, do not cite memory.'
    );

  if (!t.refutations || t.refutations.length === 0) {
    gaps.push(
      'No refutation attempted. Before a finding is allowed above Info you ' +
        'must genuinely try to kill it. See doctrine/06, the refutation step.'
    );
  } else {
    t.refutations.forEach((r, i) => {
      if (!r.result || r.result.trim() === '')
        gaps.push(`Refutation ${i + 1} ("${r.attempt}") has no recorded result.`);
    });
  }

  if (!t.controls || t.controls.length === 0) {
    gaps.push(
      'No controls recorded. If you found none on the path, say so explicitly ' +
        'with --control "none found=searched for auth, authz, and validation ' +
        'middleware on this route and read the registration order". Silence ' +
        'here is indistinguishable from not having looked.'
    );
  }

  return gaps;
}

function record(o) {
  if (!o.id) throw new Error('--id is required');
  if (!o.entry) throw new Error('--entry is required');
  if (!o.sink) throw new Error('--sink is required');

  const trace = {
    schemaVersion: '1.0.0',
    id: o.id,
    entry: parseLoc(o.entry),
    sink: parseLoc(o.sink),
    hops: o.hops.map((h) => {
      const [loc, note] = parsePair(h);
      return { ...parseLoc(loc), note };
    }),
    controls: o.controls.map((c) => {
      const [loc, why] = parsePair(c);
      return { ...parseLoc(loc), ruledOutBecause: why };
    }),
    framework: o.framework,
    frameworkAt: o.frameworkAt ? parseLoc(o.frameworkAt) : null,
    frameworkDefault: o.frameworkDefault,
    refutations: o.refutations.map((r) => {
      const [attempt, result] = parsePair(r);
      return { attempt, result };
    }),
    recordedBy: `reachability.js ${VERSION}`,
  };

  const gaps = check(trace);
  trace.meetsVerificationBar = gaps.length === 0;
  trace.gaps = gaps;

  const outDir = resolve(o.out);
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${o.id}.json`);
  writeFileSync(path, JSON.stringify(trace, null, 2) + '\n', 'utf8');

  report(trace, path);
  return gaps.length === 0 ? 0 : 1;
}

function report(t, path) {
  console.log(`Trace ${t.id}`);
  console.log(`  ${t.entry.raw}`);
  for (const h of t.hops) console.log(`    -> ${h.raw}  ${h.note || ''}`);
  console.log(`  -> ${t.sink.raw}  [SINK]`);
  console.log('');

  if (t.meetsVerificationBar) {
    console.log('Meets the verification bar. This trace supports a severity');
    console.log('above Info, if the matrix in rubrics/scoring.md puts it there.');
    console.log('');
    console.log('That is a statement about the paperwork, not about the truth.');
    console.log('The trace is only as good as your reading of each hop.');
  } else {
    console.log('Does NOT meet the verification bar. Gaps:');
    for (const g of t.gaps) console.log(`  - ${g}`);
    console.log('');
    console.log('Mark this finding unverified and hold it at Info until the');
    console.log('gaps are closed. That is the correct outcome, not a failure.');
  }
  if (path) console.log(`\nWrote ${path}`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    console.log(HELP);
    process.exit(0);
  }

  let o;
  try {
    o = parseArgs(argv);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }

  try {
    if (o.cmd === 'record') {
      process.exit(record(o));
    }

    if (o.cmd === 'check') {
      const p = o.rest[0];
      if (!p) throw new Error('check needs a path to a trace.json');
      const t = JSON.parse(readFileSync(resolve(p), 'utf8'));
      const gaps = check(t);
      t.meetsVerificationBar = gaps.length === 0;
      t.gaps = gaps;
      report(t, null);
      process.exit(gaps.length === 0 ? 0 : 1);
    }

    if (o.cmd === 'check-all') {
      const dir = resolve(o.rest[0] || 'traces');
      if (!existsSync(dir)) throw new Error(`Not found: ${dir}`);
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      if (files.length === 0) {
        console.log(`No traces in ${dir}.`);
        process.exit(0);
      }
      let failed = 0;
      for (const f of files) {
        const t = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        const gaps = check(t);
        if (gaps.length === 0) {
          console.log(`PASS  ${t.id}`);
        } else {
          failed++;
          console.log(`GAPS  ${t.id}`);
          for (const g of gaps) console.log(`        ${g}`);
        }
      }
      console.log('');
      console.log(`${files.length - failed} of ${files.length} meet the bar.`);
      if (failed > 0) {
        console.log(`${failed} must be held at Info until their gaps close.`);
      }
      process.exit(failed > 0 ? 1 : 0);
    }

    console.error(`Unknown command: ${o.cmd}`);
    console.error('Expected: record, check, or check-all. Try --help.');
    process.exit(2);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

main();
