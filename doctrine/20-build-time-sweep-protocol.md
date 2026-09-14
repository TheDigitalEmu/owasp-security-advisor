# 20. Build-Time Sweep Protocol

**Doctrine ID:** `20-build-time-sweep-protocol`
**Mode:** build only
**Source standards:** OWASP Proactive Controls 2024, ASVS 5.0 chapter 1
(architecture, design, threat modelling), OWASP Code Review Guide

---

## When this applies

Only in build mode, and build mode requires explicit user instruction to fix,
remediate, harden, or sweep. Review mode is read-only, always. Discovering
something broken is not authorisation to fix it.

If you are here because a review turned up findings and fixing them "seems
obvious", go back and ask. The user decides when the mode changes.

---

## The governing idea

Security work that writes code has a failure mode that review mode does not:
**the reviewer and the author are the same agent.** Nobody is checking you. The
protocol below is a substitute for that missing reviewer, and it works by
forcing evidence into the record at the moment of the change, when it is cheap
and true, rather than at the end, when it is expensive and reconstructed.

Reconstructed evidence is not evidence. If the self-review is written after the
fact, it is a story about what you would have thought.

---

## Sweep folder convention

Every sweep gets its own folder:

```
<findings-root>/sweeps/<YYYYMMDD>-<HHMM>-<short-name>/
```

- `<YYYYMMDD>-<HHMM>` is the sweep start, local time, zero-padded.
- `<short-name>` is kebab-case, and names the sweep's **objective**, not its
  method. `authz-gaps`, not `code-cleanup`.
- One sweep, one folder. Do not reopen a closed sweep; start a new one and
  reference the old.

Confirm the findings root is git-ignored for application artifacts, but note
the exception below: **the journal is committed.** It has to be, because the
whole protocol turns on the self-review travelling in the same commit as the
change it describes. Decide with the user where the journal lives such that it
can be committed alongside the code. If the findings root is ignored, the
journal goes somewhere that is not.

---

## Journal layout

Inside the sweep folder:

| File | Written | Contents |
|---|---|---|
| `00_run_metadata.md` | At open | Who, when, what tree, what commit, what mode, what the user actually asked for, in their words |
| `01_plan.md` | At open | The item list. One row per intended change. Tiers assigned |
| `02_threat_model.md` | At open | What this sweep is defending against, and what it is not |
| `04_changes.md` | Per commit | The running log. One entry per commit, appended, never rewritten |
| `99_handoff.md` | At close | What landed, what did not, what the next person needs |

Slot `03` is reserved and intentionally unused. Do not invent a file to fill it.

### `00_run_metadata.md`

Record the user's request verbatim. Not your summary of it. Scope creep is the
most common failure of a sweep, and the only defence is a fixed record of the
original ask that you can be held to.

Also record: base commit SHA, branch name, the tree path, the test command, and
the test count at open. That last one is the baseline for the regression gate.

### `01_plan.md`

One row per item. Assign every item a tier before you touch anything.

| Item | Description | Tier | Rationale | Status |
|---|---|---|---|---|
| *(id)* | *(what changes)* | *(A/B/C)* | *(why it is in scope)* | *(pending/landed/dropped)* |

The plan is written before the first commit and is not silently edited. If an
item is added mid-sweep, append it with a note saying when and why. If an item
is dropped, mark it dropped with a reason. A plan that matches the outcome
perfectly because it was edited to match is worthless.

### `02_threat_model.md`

Short. What the sweep is defending against, what it is explicitly not
addressing, and what a successful sweep changes about the attack surface. If
you cannot say what improves, you are doing cleanup and should say that
instead.

### `04_changes.md`

Appended per commit, never rewritten. Entry shape in the next section.

---

## Tiers

Every item gets a tier. The tier decides the evidence gate.

| Tier | Meaning | Gate |
|---|---|---|
| **A** | Additive or corrective change to live code. A control added, a bug fixed, a check tightened | Test suite green, test count not regressed, self-review in commit |
| **B** | Deletion of code believed dead | Tier A gate **plus** the grep gate below. No exceptions |
| **C** | Behavioural or structural change with a blast radius beyond the file. Signature changes, control flow rework, dependency changes | Tier A gate **plus** explicit user sign-off before the commit |

When in doubt about a tier, go up, not down. The gates get more expensive in a
straight line; being wrong about a tier does not.

### The Tier B grep gate

**Suspected dead code is not deleted on suspicion.** Before any Tier B commit:

1. Grep for the symbol across the **whole tree**, not the module. Case
   insensitive.
2. Grep for it as a **string**. Dynamic dispatch, reflection, template lookup,
   config-driven routing, and serialised references do not appear as call sites.
3. Check whether it is exported from a public surface. If it is, an external
   caller you cannot see may exist, and it is not dead, it is public API.
4. Check test files separately. A symbol used only by its own test is dead; a
   symbol used by other tests may not be.
5. Check the build config, the container definitions, and any manifest that can
   name a symbol.

**Record the transcript of every one of those searches in `04_changes.md`, in
the same commit as the deletion.** The actual commands and the actual output,
not a summary saying you checked. The whole point is that a reviewer can
re-run them and get the same answer.

If any search returns a hit you cannot explain, the item is not Tier B. Promote
it to Tier C and get sign-off, or drop it.

Deleting code that turns out to be live is how a security sweep causes an
outage, and an outage caused by the security sweep is how the next security
sweep does not get approved.

---

## Commit discipline

### One commit per item

Each item in `01_plan.md` becomes exactly one commit. Not two, not a batch.

**Each commit must be individually revertable.** That is the actual
requirement, and it is stronger than "small". A commit that reverts cleanly on
its own but breaks the build without its neighbour is not individually
revertable. If two changes cannot be separated, they are one item, and the plan
was wrong; fix the plan and say so.

Revertability is what makes the sweep safe to accept. A reviewer who can undo
any single change without archaeology can approve the whole sweep. A reviewer
facing one large commit has to trust you, and Rule 2 exists because you should
not be trusted on your own work.

### Test the suite after every commit

Run the full suite after each commit, not at the end.

**The test count must not regress.** Not the pass rate, the count. A suite that
goes from 400 passing to 399 passing has lost a test, and the usual way that
happens during a security sweep is that a test was deleted or silently skipped
because it was inconvenient. Record the count in every `04_changes.md` entry.

If the count drops, stop. Do not proceed to the next item. Find the test, and
either restore it or record explicitly, with the user's agreement, why it is
gone. A deleted test is a removed control.

If a test fails, the commit does not land. Do not commit a red suite with a
note promising to fix it next.

### Never create branches

Rule 4. Work on the branch you were given. If a push is blocked, stop and ask.
Do not branch around the block.

### Never `git checkout` against a shared tree

Rule 5. Use `git worktree add <throwaway-path> <existing-branch>`, pointed only
at a branch that already exists.

---

## The self-review, in the commit

**This is the rule the whole protocol exists to enforce.**

Every commit lands with its OWASP self-review already written into
`04_changes.md`, in that same commit. Not the next commit. Not a follow-up.
Not a message in chat. In the commit, or it did not happen.

The reason is not bureaucracy. A self-review written before the commit changes
the commit. A self-review written after it is a justification, and it will
justify whatever you already did.

### The honest limit, and what to do about it

In build mode the author and the reviewer are the same model. A self-review is
you grading your own homework, and no procedure fully removes that. Two things
reduce it, and both are required:

1. **An adversarial second pass on the diff.** After the constructive
   self-review, re-read the diff alone with the opposite framing: you are an
   attacker who wants this commit to ship a bug. Find the one it ships. Record it
   as its own entry, separate from the self-review, so the two are not blurred.
   Different framing catches what the author's framing does not.

2. **A sign-off field the close cannot skip.** Each item carries
   `signOff: { by, role, at }` where `role` is `human` or `second-model`. Until a
   human or a genuinely different model fills it, the item is
   "remediated, self-reviewed, NOT independently signed off." The tool cannot
   provide independence, but it must refuse to claim it. Do not report a sweep as
   independently reviewed while any item's `signOff.role` is `author` or absent.

### Entry shape

Append one of these to `04_changes.md` per commit, and stage it with the change:

```markdown
### <item-id>: <one line, what changed>

- **Tier:** A | B | C
- **Commit:** <sha, filled after; the entry is written before>
- **Files:** <list>
- **Revertable alone:** yes, and why
- **Tests:** <count before> -> <count after>, suite green
- **Tier B grep transcript:** <the commands and their raw output, or "N/A">
- **User sign-off (Tier C):** <who, when, or "N/A">

**OWASP categories touched:**
<the categories this change bears on, from Top 10 / API Top 10 / ASVS>

**Controls present after this change:**
<what now stops the thing this was about, and where it lives>

**Trade-offs:**
<what got worse, or harder, or slower. If nothing, say why nothing did,
and be suspicious of that answer>

**Verdict:**
<does this change improve posture, hold it, or trade it for something?
Say which. "Improves" with no trade-off named is usually an unfinished
sentence>
```

The `Trade-offs` and `Verdict` fields are the ones that get skipped, and they
are the ones with the value. A change with no trade-off is rare. Usually the
trade-off is real and you have not looked for it yet.

---

## Closing a sweep

Write `99_handoff.md`. It is for a person who was not here:

- What landed. Item, tier, commit, one line each.
- What did not land, and why. Dropped items are results.
- Test count at open and at close. They should not have gone down.
- What the sweep did **not** address, and what is still open.
- Anything the next person must not do, and why. This is the highest-value
  section and it is always the shortest.

Then, in chat, give the user the honest version: what improved, what did not,
what you were unsure about, and what you would look at next. Do not close a
sweep with a clean summary that the journal does not support. The journal is
the record; chat is the courtesy.

---

## Checklist

| # | Gate | Applies | Evidence |
|---|---|---|---|
| 20.1 | User explicitly asked for build mode | Every sweep | |
| 20.2 | Sweep folder created with the naming convention | Every sweep | |
| 20.3 | `00_run_metadata.md` records the request verbatim | At open | |
| 20.4 | Baseline test count recorded | At open | |
| 20.5 | `01_plan.md` written with tiers before first commit | At open | |
| 20.6 | `02_threat_model.md` states what improves | At open | |
| 20.7 | One commit per plan item | Every commit | |
| 20.8 | Each commit individually revertable | Every commit | |
| 20.9 | Suite green after every commit | Every commit | |
| 20.10 | Test count not regressed | Every commit | |
| 20.11 | Self-review in `04_changes.md` in the same commit | Every commit | |
| 20.12 | Trade-offs named, not left blank | Every commit | |
| 20.13 | Tier B grep transcript recorded raw | Every Tier B | |
| 20.14 | Tier C sign-off obtained before the commit | Every Tier C | |
| 20.15 | No branch created | Every sweep | |
| 20.16 | No `git checkout` against a shared tree | Every sweep | |
| 20.17 | `99_handoff.md` written at close | At close | |
| 20.18 | No em dashes or dash look-alikes in any file written | Every commit | |
