# 06. Investigation Playbook

**Doctrine ID:** `06-investigation-playbook`
**Mode:** review (build mode inherits the verification standard)
**Source standards:** OWASP Code Review Guide, OWASP Testing Guide (WSTG),
ASVS 5.0 chapter 1 (architecture and threat modelling)

---

## What this file is

A **procedure** for investigating an unfamiliar codebase. It describes how to
look, not where to look.

It contains no map of any particular system, and it must never acquire one. If
you are tempted to add "in this project, handlers live in X", stop. That belongs
in the engagement's own notes under the findings root, not here. A playbook that
encodes one codebase's layout is worse than useless on the next codebase: it
tells you to look in the wrong place with confidence.

---

## The governing idea

You are trying to answer one question repeatedly:

> **Can untrusted input reach a dangerous operation without passing a control
> that actually stops it?**

Everything below is a way of answering that without fooling yourself. The whole
discipline is: find the entry, find the sink, and then genuinely read the path
between them rather than assuming what is on it.

---

## Phase 1: Orient

Goal: know what kind of thing you are looking at. Do not judge anything yet.

1. **Read the manifests.** Dependency manifests and lockfiles tell you the
   language, the framework, the versions, and the age. Versions matter: a
   control that is default-on in one major version is absent in the one before.
2. **Find the build and run entry.** How is `<target-repo>` started? Container
   definitions, process managers, task runners, CI config. This tells you what
   is actually deployed, which is often not what the README says.
3. **Map the top-level tree, one level deep only.** You want the shape, not the
   contents. Resist reading files here.
4. **Find the test suite.** Its existence, size, and what it covers. Tests are
   the cheapest available statement of intended behaviour, and gaps in them
   often sit exactly where the bugs are.
5. **Read the config surface.** What is configurable, and what changes between
   environments? Anything that differs between development and production is a
   place where production is running code nobody tested.

Record all of this in `<findings-root>/inventory.md`. Rule 3: every line of it
comes from a file you read this turn.

**Do not proceed until you can name the framework and its major version.** Half
the findings in a typical review depend on that answer.

## Phase 2: Enumerate entry points

An entry point is anywhere data crosses from outside your trust boundary to
inside it. Sweep for all of these classes; each is a different search:

| Class | What you are looking for |
|---|---|
| HTTP routes | Route tables, decorators, annotations, controller registration |
| Middleware | What runs before a handler, and in what order |
| CLI | Argument parsing, subcommands |
| Scheduled jobs | Cron definitions, timers, task schedulers |
| Queue consumers | Message handlers, subscribers |
| Webhooks | Inbound callbacks from third parties, and how they are authenticated |
| Deserialisation | Anywhere a byte stream becomes an object |
| File ingest | Uploads, imports, watched directories |
| Templates | Anywhere user data meets a rendering engine |
| Third-party callbacks | Identity provider redirects, payment notifications |

Multi-modal sweep matters here. Searching only by route decorator misses the
queue consumers entirely. Search by framework idiom, by file naming convention,
**and** by the shape of the data (who reads a request object, who reads an
environment variable, who reads standard input).

**The entry point you did not find is where the bug is.** Before leaving this
phase, ask explicitly: which of the classes above did I not search for, and is
its absence a fact I verified or an assumption I made?

## Phase 3: Enumerate sinks

A sink is an operation that is dangerous if it receives attacker-controlled
input. By class, not by vendor:

| Sink class | Example operations |
|---|---|
| Query execution | Anything that sends a string to the primary datastore |
| Command execution | Process spawn, shell invocation |
| File system | Path construction, read, write, delete, archive extraction |
| Network egress | Outbound requests where the URL is influenced by input (SSRF) |
| Rendering | Template interpolation, HTML construction, response headers |
| Deserialisation | Object construction from untrusted bytes |
| Authorisation decisions | Anywhere a permission is computed |
| Cryptography | Signing, verification, encryption, random generation |
| Redirects | Anywhere a location is computed from input |
| Logging | Where untrusted data lands in a log that something else parses |

## Phase 4: Trace the path (the part that counts)

For each (entry point, sink) pair that plausibly connects, trace it. **This is
Rule 2 and it is the whole job.**

The trace is only complete when you have personally read:

- The handler itself.
- **Every middleware that runs before it**, and confirmed the registration
  order, not just that the middleware exists somewhere in the repo.
- **Every helper the handler calls** on the path to the sink. Recursively. A
  function called `validate`, `sanitize`, `escape`, `clean`, or `safe_` proves
  nothing at all. Open it.
- The framework behaviour for that version, where the framework is doing
  something implicitly.
- Any decorator, annotation, or attribute on the handler, and what it actually
  does.

Write the trace down. `bin/reachability.js` gives you a structured place to put
it. A trace nobody can check is not evidence.

### The refutation step

Before a finding is allowed above Info, try to kill it. Genuinely try:

- Is the route actually registered and reachable in the deployed config, or is
  it dead?
- Is there authentication in front of it that I read, or that I assumed?
- Does the framework parameterise, escape, or encode this by default in **this**
  version?
- Is the input actually attacker-controlled, or does it come from a trusted
  internal caller?
- Is my proof-of-concept real, or does it merely look plausible?
- Does a type system, schema, or allowlist upstream already constrain this?

If you cannot answer all of those from code you read, the finding is
**unverified**. Mark it, hold it at Info, and say what you would need in order
to settle it. That is a useful result. A confident wrong finding is not.

## Phase 5: Look for the absence

The hardest findings are missing things, and no grep finds them directly. Ask
these as explicit questions, because they will not announce themselves:

- Which entry points have **no** authorisation check at all?
- Which sinks have **no** upstream validation?
- Which errors are caught and swallowed?
- Which security-relevant events are **not** logged?
- Which dependency is doing something security-critical with no pin?
- Where does the code trust a client-supplied identifier to name the object it
  then operates on?

For each, the search is inverted: enumerate the full set, enumerate the set
that has the control, and diff them. Do not eyeball it.

## Phase 6: Converge

Stop when a full sweep round produces nothing new, twice in a row. Not when you
hit a finding count. Not when the checklist has ticks in every row. A checklist
completes; an investigation converges. Those are different events, and the
checklist is the cheaper one.

Then record what you did **not** cover: files skipped, paths not traced,
questions left open. Put it in `<findings-root>/unverified.md`. The boundary of
the review is part of the review.

### Record a verdict on every enumerated element

This is what stops two runs from silently finding different things, and it is
the fix for the failure where a shallow run reports full coverage.

**The denominator is not yours to invent.** Run `bin/enumerate.js --root
<target-repo>` first. It derives the entry points from the code (route files,
server actions, middleware, config, scheduled jobs) and adds the fixed ten sink
classes, and writes `enumeration.json`. This list is identical on every run of
the same commit, so you cannot enumerate eleven elements one run and thirteen the
next and call both complete.

Copy every element into `summary.json` under `enumeration`, and give each one a
verdict. There is no blank state:

| Verdict | Meaning | Where it goes |
|---|---|---|
| clear | Traced, no defect on the path (cite the control that stops it in `evidence`) | one line |
| finding | Defect found, written up per `doctrine/07-findings-template.md` (put the F-NNN in `evidence`) | `findings/` |
| gap | Not traced, or could not be settled from the code | `unverified.md`, and it debits coverage |

An element you leave without a verdict is counted as a **gap** by
`bin/render-report.js`, which lowers coverage. So a run that looked at less
produces a lower coverage figure next to its grade, not a smaller,
cleaner-looking finding set at a false 100%. `render-report.js --strict` refuses
to render clean while any enumerated element is unaccounted for. This is the
enforcement the old prose grid never had. See `rubrics/scoring.md` section 4.

If `enumerate.js` reports it could not profile the framework, its entry-point
list is best-effort: say so in the report, because coverage for the parts it
could not enumerate is only as honest as you are.

### Multi-pass sampling, to stop the finding set drifting

Even with a fixed denominator, two runs can land different verdicts on the same
element: one traces a path to a finding, another calls it clear. To reduce that,
Sweep runs the verdict pass N times (default 3) over the **same**
`enumeration.json`, and `bin/consensus.js` combines them.

The passes must be genuinely independent re-traversals. Copying pass one into
pass two defeats the entire mechanism and is a Rule 2 violation: the value is in
the disagreement it surfaces. Record each pass as its own sample file
(`{pass, sampler, elements:[{id, verdict, evidence, finding}]}`), then:

```
node bin/consensus.js --enumeration enumeration.json --samples p1.json p2.json p3.json --out summary.json
```

Consensus combines by rule: any pass says finding means finding (a real defect
one pass found is a miss by the others), any remaining gap means gap, else clear.
For a finding's rating it takes the highest cited impact and reachability and the
most cautious verified and confidence, so an unverified guess in one pass cannot
ride to a high severity. It writes a `disagreementRate` and a per-finding
`ratingDivergence`.

The honest limit, which the report states: `disagreementRate` is a stability
measure, not completeness or correctness. N passes by one model share the same
blind spots, agree with each other, and can be identically wrong. Only different
models or a human on the passes make agreement mean more than consistency.
Review mode runs a single pass by default; Sweep runs three.

---

## Search technique

- Search by **idiom**, not by name. Names vary between codebases; the shape of
  a dangerous call does not.
- Search for the **dangerous operation**, then walk backwards to the entry.
  Backwards is usually cheaper than forwards, because sinks are fewer.
- When a wrapper hides the sink, search for the wrapper, then re-run the sweep
  for the wrapper's own name. Repeat until you reach the bottom.
- Case-insensitive first, then case-sensitive to cut noise.
- Read whole files when a file is small. Excerpt-reading a 60-line module to
  save tokens is a false economy that costs you the one line that mattered.

## Anti-patterns

| Anti-pattern | Why it burns you |
|---|---|
| Trusting a function name | `sanitize()` may do nothing, or the wrong thing |
| Trusting a comment | Comments describe intent at time of writing, at best |
| Trusting the README | Documentation drifts. Rule 3 |
| Assuming middleware order | Registration order decides. Read the registration |
| Assuming framework defaults | They change between major versions |
| Stopping at the first hit | The interesting bug is rarely the first one |
| Reporting a pattern as a bug | "This pattern is often vulnerable" is not a finding |
| Reading only the diff | The diff is safe; the thing it calls is not |
| Filling the checklist | Coverage is not investigation |
