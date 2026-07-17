# HUMAN_GUIDE

The same protocol, for a person with a text editor and no AI.

Nothing here depends on an agent. The doctrine, the rubric, and the finding
template are all readable by a human, and the discipline they enforce was
originally a human discipline. If anything, the rules matter more when you run
it yourself, because an agent at least never gets bored at hour four.

If you are an AI agent, you want [`BOOTSTRAP.md`](BOOTSTRAP.md), not this.

---

## What you are signing up for

A first review of a medium application is one to three days of actual reading.
Not skimming. Reading.

If you have four hours, do not attempt a full review and hand over a grade.
Do one thing properly instead: pick `doctrine/13-auth-and-session.md`, run the
inverted search for missing object-level authorization checks, and report on
that alone with the scope stated honestly. A narrow review that is true is
worth more than a broad one that is decorative, and it is the one that gets
acted on.

## Set up

You need: the code, a grep tool you trust (ripgrep is worth the install), a
place to write, and a way to look at dependency manifests. That is all.

Make a findings root:

```
mkdir <target-repo>/security-findings
```

**Add it to `.gitignore` before you write a single word into it.** A findings
tree committed to the repo publishes the vulnerability list next to the
vulnerability. This is not hypothetical; it happens.

Optional: Node >= 18 gets you `bin/`. `render-report.js` turns a `summary.json`
into a graded report so you do not compute the arithmetic by hand.
`reachability.js` is a workbook for traces and will tell you, unsentimentally,
when a trace you thought was finished is not.

## The rules, for you specifically

The seven hard rules are in [`SKILL.md`](SKILL.md) section 2. Four of them bite
differently when a human is doing it:

**Read-only.** Do not fix things as you go. It feels efficient and it is not:
you lose your place, you contaminate the diff the developers have to review,
and you stop being an auditor the moment you become an author. Write it down,
move on.

**Verify before you assert.** You will be tired. Around hour six you will start
accepting `sanitize()` as evidence that something is sanitised, because opening
it is one more file and you have opened ninety. That is precisely the hour your
report starts being wrong. When you notice it happening, stop for the day. The
finding will still be there tomorrow, and so will the truth.

**Code is truth, docs drift.** The developer who tells you "oh, the middleware
handles that" believes it. They are not lying. They are describing the system
as designed, and you are auditing the system as built. Thank them, then go read
the registration order.

**No em dashes.** Yes, in a security protocol. Consistent output across humans
and agents matters more than your preferred punctuation. Two hyphens, a comma,
or a colon.

## The procedure

Follow [`SKILL.md`](SKILL.md) section 3. The human-specific notes:

### Step 0: Scope

Write the scope down and get the owner to agree to it **before** you start.
Not because of process theatre: because at the end, the argument you will have
is about what you did not look at, and a scope agreed in advance is the only
thing that settles it.

Confirm you are authorised. Reading a repo you were given is fine. If anyone
suggests you "just try it against staging to see", that is a different
engagement with a different authorisation, and this protocol does not cover it.

### Step 1: Inventory

Resist judging. You will find something in the first twenty minutes and want to
chase it. Write the ID down in a scratch list and keep going. The inventory is
what tells you whether that first finding matters, and you cannot know yet.

Get the framework and its **exact major version** from the manifest before
anything else. Half your later conclusions depend on it.

### Step 2: Threat model

Twenty minutes, one page. Who is attacking, what do they want, where do they
touch the system. A threat model that lists every threat prioritises none, and
the one you write in a week will not be better, it will just be later.

### Step 3: Doctrine passes

Order is in `SKILL.md`. Two human notes:

Take `doctrine/06-investigation-playbook.md` seriously. It is the method. The
checklists are the coverage guarantee. Ticking every box in `02` is not a
review, it is a record that you visited each area.

Do the passes in sittings, one doctrine file per sitting where you can. Context
switching between auth and upload and dependencies inside one hour is how you
half-read three things.

### Step 4: Verification

This is where humans and agents fail identically, so it gets the same
treatment. For every candidate, try to kill it. Out loud, if it helps:

- Is the route actually registered, or is it dead code?
- Did I *read* the auth, or assume it?
- Does the framework do this by default in *this* version?
- Is the input actually attacker-controlled?
- Would my proof-of-concept really work?

If you cannot answer all of those from code you read, the finding is
unverified, it goes to Info, and you write down what would settle it. That is
a result. It tells the owner where to point somebody with more access than you
had.

`node bin/reachability.js check-all traces/` will tell you which of your traces
do not meet the bar. It is worth running before you believe your own report.

### Step 5: Score

[`rubrics/scoring.md`](rubrics/scoring.md). Impact times reachability, then the
verification ceiling. Score the axes independently and read the severity off
the matrix. Do not pick a severity and reason backwards to the axes; you will
do this without noticing, which is why the axes are separate fields.

### Step 6: Hand back

Grade and coverage in the same breath, every time. Then counts, then the one
thing to fix first, then what you could not verify.

## Writing it up

[`doctrine/07-findings-template.md`](doctrine/07-findings-template.md) is the
shape. The parts people skip and should not:

**The trace.** Every hop, file and line. This is the section that makes your
report checkable by someone who does not trust you, which is the only kind of
report worth writing.

**The failure scenario.** Concrete. Named actor, specific input, specific
outcome. If you cannot write it without the word "potentially", you do not have
a finding yet.

**The trade-off in the remediation.** A fix with no cost named reads as though
you did not look for one, and the developer who knows the cost will conclude
you do not understand their system. They will be right.

## The politics

The bit no protocol document usually admits to.

You are going to hand somebody a document that says their work is unsafe. How
you write it decides whether it gets acted on or filed.

- **Attack the code, never the coder.** "The handler does not check ownership",
  not "the developer forgot".
- **Do not pad.** Forty findings of which six are real gets all six ignored, and
  gets you a reputation as the person who cries wolf. Six real ones get fixed.
- **Lead with the worst thing.** Not with a summary of your methodology. They
  will read the first paragraph and possibly nothing else. Spend it.
- **Say what is good.** If the auth is genuinely well built, write that down. It
  is true, it is useful, and it buys you the credibility you need for the
  paragraph where you say the upload path is not.
- **Own your uncertainty out loud.** "I could not verify this" costs you nothing
  and is worth everything the first time you are wrong about something else. A
  reviewer who has never said it is a reviewer nobody can calibrate.

## When to stop

Stop when a full sweep produces nothing new twice in a row. Not when the
checklist is full, and not when you hit a number of findings.

Then write down what you did not cover. Every skipped file, every untraced
path, every question you left open. That list is not an admission of failure,
it is the boundary of the review, and the boundary is part of the result. A
report without one implies you looked at everything. You did not.
