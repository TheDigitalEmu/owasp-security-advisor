# 09. Dependencies and Supply Chain

**Doctrine ID:** `09-dependency-supply-chain`
**Mode:** review and build
**Source standards:** OWASP Top 10 2021 A06 (Vulnerable and Outdated Components) and A08 (Software and Data Integrity Failures), OWASP API Security Top 10 2023 API10 (Unsafe Consumption of APIs), OWASP Dependency-Check and CycloneDX project guidance, OWASP ASVS 5.0 configuration chapter, OWASP Software Component Verification Standard (SCVS)

---

## Purpose

This doctrine covers everything `<target-repo>` executes that its authors did
not write: direct dependencies, the transitive closure beneath them, the base
images and build tooling nobody lists in a manifest, and the third-party
services whose responses the application parses. It fires on every review, and
it fires hardest in build mode, where adding one line to a manifest can pull in
four hundred packages and a post-install script.

It also covers the discipline of not converting a scanner's output into
findings. That is most of the work.

## Principles

1. **The transitive closure is the dependency set.** The direct list is a
   convenience for humans. The real set is one to two orders of magnitude
   larger, and every package in it runs with the same privileges as the code
   you reviewed. Inventory the closure or admit you did not inventory.

2. **A CVE in a dependency is a candidate, not a finding.** Reachability
   decides. Rule 2 applies here with full force and it is the rule most often
   abandoned in this category, because the scanner already printed a severity
   and it is tempting to copy it across. Do not copy it across.

3. **A dependency with no CVE is not safe, it is unexamined.** Absence of a
   report is absence of a report. Nobody has looked at most of the closure.
   The clean scan tells you what has been found and disclosed, which is a
   strictly smaller set than what exists.

4. **An unpinned dependency means the thing you reviewed is not the thing that
   ships.** Every claim in the review is scoped to a resolved version. Without
   a lockfile, the review has an expiry date measured in hours and nobody knows
   when it passed.

5. **Installing is executing.** Package installation runs code in most
   ecosystems. The trust decision is made at `install`, not at `import`, and it
   is made by the CI system as often as by a human.

6. **Maintenance state is a security property.** A single-maintainer package in
   the critical path is a supply chain finding with a clean scan and no CVEs.
   No scanner will ever emit it. That is precisely why a human is doing this.

## Review procedure

### Step 1: Inventory, including the parts nobody lists

Find every manifest and lockfile. Then find the dependencies that live outside
them, because those are the ones that get skipped:

- **Manifests and lockfiles** per language runtime. Note whether a lockfile
  exists, is committed, and is current with the manifest.
- **Vendored code.** Third-party source copied into the tree: no manifest, no
  version, no update path. Grep for licence headers and for directory names
  that idiomatically hold vendored trees.
- **Base container images.** A base image is a dependency with an operating
  system inside it. Note whether it is pinned by digest or by a moving tag.
- **Build-time tooling.** Compilers, bundlers, transpilers, generators.
  Anything that reads your source and writes an artifact can put something in
  the artifact.
- **CI actions, plugins, and steps.** Third-party CI steps run inside the
  release pipeline with pipeline credentials. Pinned by tag is not pinned.
- **IDE and editor tooling committed to the repo.** Configured plugins, format
  hooks, and pre-commit hooks execute on a developer machine that holds
  production credentials.

Record the counts, direct versus transitive, per ecosystem. The ratio is itself
worth reporting.

### Step 2: Establish resolution and pinning

For each ecosystem, determine what actually gets installed:

1. Is there a lockfile, and is it committed?
2. Does the install command in CI honour the lockfile, or does it re-resolve?
   Many ecosystems have two install verbs, one of which quietly ignores the
   lock. Read the CI definition, not the README (Rule 3).
3. Are integrity hashes present for each resolved package, where the ecosystem
   supports them?
4. Are container base images pinned by digest?
5. Are CI actions pinned by commit, or by a tag that the publisher can move?

An unpinned build is not reproducible, and a non-reproducible build cannot be
audited after the fact. If a malicious version was installed on Tuesday and
yanked on Wednesday, a re-resolve on Thursday shows you nothing.

### Step 3: Known vulnerabilities, and the reachability discipline

This is the subsection that decides whether your report is believed.

Run whatever advisory data you have against the resolved closure. You now have
a list. **That list is not findings.** For each entry above Low, do this:

1. Identify the specific vulnerable function, class, or code path named in the
   advisory. If the advisory does not name one, you cannot assess reachability
   from advisory data alone; say so.
2. Grep `<target-repo>` for calls into that package. If the package is
   transitive, find which direct dependency pulls it in, and read how that
   dependency calls it.
3. Trace from an entry point to the vulnerable path. Every hop. Rule 2.
4. Check whether the vulnerable path requires a configuration or input the
   application never produces.

Then assign:

| What you established | Severity treatment |
|---|---|
| Traced from an entry point to the vulnerable function | Matrix result, per `rubrics/scoring.md` |
| Package present, vulnerable function provably never called | Info, with the trace recorded |
| Package present, could not determine reachability | **Info, marked unverified.** Say what would settle it |

A scanner reporting Critical in a transitive package whose vulnerable function
is never called is not a Critical. It is a candidate. Trace it, or mark it
unverified and hold it at Info. There is no third option, and "the scanner said
so" is not verification.

This is the single most common way security reports lose credibility. A
developer who can refute your top finding in ninety seconds will not read the
rest of the report, and they will be right not to.

The converse costs you nothing and buys accuracy: when you downgrade, record
the trace. A downgrade with evidence is a stronger statement than the original
alarm, and it is the thing that makes the surviving findings credible.

### Step 4: The maintenance signal

For each dependency in the critical path (auth, crypto, serialisation, data
access, request parsing), assess what no scanner will tell you:

- Date of last release and last commit.
- Number of maintainers with publish rights. One is a finding.
- Age of the open issue and pull request backlog.
- Whether the project has a security policy and a disclosure route
  (cross-reference `doctrine/19-vulnerability-disclosure.md`).
- Whether ownership was transferred recently. Transfer of a widely-installed
  package is a known attack path.

A single-maintainer package in the critical path is a supply chain finding even
with a clean scan. The impact is not "this package has a bug". It is "one
person's credentials are a release channel into this application, with no
second pair of eyes on any publish".

### Step 5: Name confusion attacks

Three distinct classes, all of which look like a normal dependency:

- **Typosquatting.** A package whose name is a plausible misspelling or an
  alternate punctuation of a popular one. Read the manifest names character by
  character against the packages you believe are intended. This is one of the
  few review tasks where reading slowly beats grepping.
- **Dependency confusion.** An internal package name that also exists, or could
  be registered, on a public registry. If the resolver consults the public
  registry and prefers a higher version, an attacker publishes version 99.0.0
  of your internal name and owns the build. Check: are internal scopes or
  namespaces reserved on the public registry? Is the private registry
  configured as an exclusive source for those names, or merely as an additional
  one? "Additional" is the vulnerable configuration.
- **Starjacking.** A package claiming a repository URL it does not own, to
  inherit that repository's popularity signals. Verify that the manifest's
  declared source repository actually contains the published package.

### Step 6: Malicious updates and install-time execution

Determine what runs at install:

1. Do any packages in the closure declare install-time or post-install scripts?
2. Is install-script execution disabled in CI, or permitted?
3. Does the install run as a privileged user, in a container with credentials
   mounted, or on a machine with a token in the environment?

A dependency install executes code. If that code runs in CI with a release
token in scope, then every package in the closure has, transitively, a path to
signing a release.

### Step 7: Build integrity

A06 gets the attention; A08 is where the worse outcomes are.

- **Reproducibility.** Can the same source and lockfile rebuild to the same
  artifact? If not, nobody can detect a tampered build.
- **Provenance.** Is there an attestation binding the artifact to the source
  commit and the builder?
- **Signing.** Are artifacts signed, and does anything verify the signature
  before deploy? An unverified signature is decoration.
- **The CI trust boundary.** Enumerate what holds credentials in the pipeline:
  the runner, each third-party step, each cached directory, each environment
  with secrets attached. Then check whether pipelines triggered from untrusted
  sources (forks, external contributions) can reach the secret scope. That
  check has a bad answer more often than not.

A compromised CI is a compromised release, and no amount of code review catches
it. This is why build integrity is in scope for a code review at all: the
pipeline definition is code, it is in the repo, and you can read it.

### Step 8: SBOM

Determine whether an SBOM is produced, at what point in the build, and whether
anyone can retrieve the one matching a given deployed artifact.

What it gives you: when the next widely-exploited component lands, you can
answer "are we affected, and where" in minutes instead of days. That window is
the whole value, and it is worth a great deal on the day it matters.

What it does not give you: it is not a control, and it prevents nothing. An
SBOM generated from the lockfile inherits every gap the lockfile has, and one
generated from a running container will disagree with one generated from the
source tree. Note which kind exists. An SBOM nobody can find during an incident
is a build artifact, not a capability. Cross-reference
`doctrine/11-incident-response.md`.

### Step 9: Update strategy, and the trade-off nobody wins

Establish the policy, then assess it honestly rather than against an imaginary
ideal.

Update fast and you pull a malicious release the day it lands, before anyone
has noticed, with automated merging making the window shorter still. Update
slowly and you sit on a known-exploited bug while the exploit is public and
your patch queues behind a version bump nobody wants to test.

Both are real. The mitigations are partial: a cooldown before adopting a new
release trades a few days of exposure to known bugs for most of the protection
against fresh malicious publishes, since malicious versions are typically
caught within hours to days. Pinning plus a fast, rehearsed patch path beats
either extreme, and costs engineering time a review cannot conjure.

Name the trade-off in the report. Do not pretend one side is obviously right.
The reader has usually already been told by someone that it is, and they were
wrong.

### Step 10: API10, consuming a third party's response

The forgotten half of supply chain. The application calls an integration and
parses what comes back.

Check every outbound integration for:

1. **Response validation.** Is the response schema-checked, or deserialised
   into whatever shape arrived?
2. **Deserialisation safety.** Does the parse path allow type instantiation or
   object construction driven by the payload?
3. **Injection sinks.** Does a field from the response reach a query, a
   template, a command, a file path, or a log that something parses?
4. **Redirects.** Does the client follow redirects from the third party to
   arbitrary hosts, and does it re-send credentials when it does?
5. **Certificate validation.** Is it ever disabled? Grep for the idioms that
   turn it off. They are usually accompanied by a comment explaining that it is
   temporary.
6. **Resource limits.** Timeouts, response size caps, and what happens if the
   third party is slow rather than down. Slow is worse than down.

Data from an integration is untrusted input and routinely is not treated as
such, because it arrived over TLS from a named partner and that feels like
trust. TLS authenticates the channel, not the content. The partner can be
compromised, the partner can be buggy, and the partner's response can be
attacker-controlled at the source, all without breaking a single certificate.

## Checklist

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 09.1 | Every dependency manifest in `<target-repo>` is identified, per ecosystem | V1.14 | | |
| 09.2 | A lockfile exists, is committed, and is current with the manifest | V1.14 | | |
| 09.3 | The transitive closure is enumerated, not just direct dependencies | V1.14 | | |
| 09.4 | Vendored third-party code is identified and its origin version recorded | V1.14 | | |
| 09.5 | Container base images are pinned by digest, not by a moving tag | V14.1 | | |
| 09.6 | Build-time tooling (bundlers, generators, compilers) is inventoried and pinned | V14.1 | | |
| 09.7 | Third-party CI actions and plugins are pinned to an immutable reference | V14.1 | | |
| 09.8 | The CI install command honours the lockfile rather than re-resolving | V14.1 | | |
| 09.9 | Integrity hashes are present for resolved packages where the ecosystem supports them | V14.2 | | |
| 09.10 | Advisory data has been run against the resolved closure, not the direct list | V14.2 | | |
| 09.11 | Every reported vulnerability above Low has a traced reachability determination or is marked unverified | V14.2 | | |
| 09.12 | Reachability downgrades record the trace that justified them | V14.2 | | |
| 09.13 | Critical-path dependencies are assessed for maintainer count and release recency | V1.14 | | |
| 09.14 | Single-maintainer packages in the critical path are identified | V1.14 | | |
| 09.15 | Manifest package names are checked against typosquatting of intended packages | V14.2 | | |
| 09.16 | Internal package namespaces are reserved on, or exclusively resolved away from, public registries | V14.2 | | |
| 09.17 | The private registry is configured as an exclusive source for internal names, not an additional one | V14.2 | | |
| 09.18 | Declared source repositories match the published package (starjacking check) | V14.2 | | |
| 09.19 | Install-time and post-install scripts in the closure are enumerated | V14.2 | | |
| 09.20 | Install-script execution in CI is disabled, or its risk is explicitly accepted | V14.2 | | |
| 09.21 | The install step does not run with release credentials in scope | V14.1 | | |
| 09.22 | Builds are reproducible from source plus lockfile | V14.1 | | |
| 09.23 | Build provenance binds the artifact to the source commit and builder | V14.1 | | |
| 09.24 | Artifacts are signed and the signature is verified before deploy | V14.1 | | |
| 09.25 | Everything holding a token in CI is enumerated as attack surface | V14.1 | | |
| 09.26 | Pipelines triggered from untrusted sources cannot reach the secret scope | V14.1 | | |
| 09.27 | An SBOM is generated per release and is retrievable for a deployed artifact | V1.14 | | |
| 09.28 | The SBOM's generation source (lockfile, image, tree) is recorded | V1.14 | | |
| 09.29 | An update policy exists and its fast/slow trade-off is a stated decision | V1.14 | | |
| 09.30 | Responses from third-party integrations are schema-validated before use | V13.2 | | |
| 09.31 | Third-party response fields reaching a query, template, command, or path are treated as untrusted | V5.3 | | |
| 09.32 | TLS certificate validation is never disabled on outbound integration clients | V9.2 | | |
| 09.33 | Outbound clients enforce timeouts and response size limits | V13.2 | | |
| 09.34 | Redirect following on outbound clients does not leak credentials to arbitrary hosts | V13.2 | | |

## Common false positives

| Looks like a finding | Why it often is not | How to tell |
|---|---|---|
| Scanner reports Critical in a transitive package | The vulnerable function may never be called from any entry point | Trace it. If you cannot, it is Info and unverified, not Critical |
| A dependency is several major versions behind | Age is not a vulnerability. Old and stable is a real thing | Look for an actual advisory or an actual reachable defect. "Outdated" alone is a hardening note |
| A CVE is disputed or withdrawn | Advisory databases carry entries the maintainer rejected, sometimes correctly | Read the advisory discussion before reporting |
| The advisory targets a different platform or feature flag | Many advisories apply only to a specific OS, build option, or optional feature | Check the affected-configuration field, then check the actual configuration |
| A dev-only dependency has a CVE | It never ships in the artifact | Confirm it is genuinely dev-only in the resolved closure, then note the CI exposure separately: it still executes on a machine holding credentials |
| No lockfile in a library, rather than an application | Libraries deliberately do not lock; their consumers do | Determine which this is before reporting. A library that locks is arguably the bug |
| Vendored code with an old version string | The version string may be stale while the code is patched, or the reverse | Diff against upstream at the claimed version. Do not trust the string (Rule 3) |
| A package with no releases in two years | A finished library is allowed to stop changing | Check whether issues are being triaged, not just whether releases ship |

## Notes on severity

Score against `rubrics/scoring.md`. Three things specific to this category.

**Reachability is the axis that does the work here, and the one you are most
likely to fake.** A vulnerable package with no traced path from an entry point
is Theoretical at best, and if you did not trace it at all the verification
ceiling puts it at Info, whatever the advisory's own score says. An advisory's
CVSS is a property of the package, computed by someone who has never seen
`<target-repo>`. It is not your reachability rating and it must not be pasted
into that column.

**Impact is the impact of the code executing, not of the bug in isolation.** A
malicious install script and a build tool compromise both land at Catastrophic:
the adversary executes with build privileges and the released artifact is
theirs. That holds even though neither produces a CVE in an application
dependency.

**Maintenance findings are real but rarely above Low.** A single-maintainer
package in the critical path is Minor impact and Theoretical reachability,
which lands at Info, and the matrix is right: nothing has happened. Report it
in the recommendations rather than inflating it, and name it for what it is, an
unmanaged risk with no current exploit and no owner. The exception is a
demonstrably weak publish path, such as an account with no MFA. That is a fact
rather than a worry, and it prices accordingly.
