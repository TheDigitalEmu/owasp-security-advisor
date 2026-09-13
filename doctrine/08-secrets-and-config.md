# 08. Secrets and Configuration

**Doctrine ID:** `08-secrets-and-config`
**Mode:** review and build
**Source standards:** ASVS 5.0 chapter 14 (configuration), ASVS chapter 6
(stored cryptography), OWASP Top 10 2025 A02 (Security Misconfiguration),
OWASP Secrets Management Cheat Sheet

---

## Read this before you fill anything in

**The inventory tables in this file ship empty, and in this repository they
stay empty.**

This repo is public and generic. A completed secret inventory is a map of a
live system: which secrets exist, where each one lives, and how long each one
stays valid before rotation. That is exactly the document an attacker would
write first. It does not belong in a shared skill, in a public repo, or in
version control alongside the code it describes.

**Copy the templates into the engagement's findings root and fill them in
there:**

```
<findings-root>/config-inventory.md
```

Confirm that path is git-ignored before you write to it. Then treat the filled
copy as sensitive: it inherits the classification of the most sensitive secret
it names.

If you are an agent and you are about to write a real environment variable
name, a real file path, a real hostname, or a real rotation window into **this**
file, stop. That is the failure mode this doctrine exists to prevent.

---

## Principles

1. **A secret in the repository is a compromised secret.** Not "a risk". It is
   in the clone on every machine that ever pulled, and in the history forever.
   Rotation is the remediation; deletion from the tip is not.
2. **Configuration is code that nobody reviews.** Most misconfiguration is not
   a wrong value, it is a value nobody knew was settable.
3. **The dangerous config is the config that differs by environment.** If
   production differs from development, production is running a path nobody
   tested.
4. **Secrets should be injected, not stored.** Environment or a secret manager
   at runtime, not baked into an image, a build artifact, or a config file.
5. **Every secret needs an owner and a rotation story.** A secret nobody can
   rotate is an incident with a delay on it.
6. **Absence of a value is not safety.** An unset secret that silently disables
   a control is worse than a wrong one, because nothing fails loudly.

---

## Review procedure

### Step 1: Find the configuration surface

Enumerate, do not assume. Sweep for every class:

- Environment variable reads anywhere in `<target-repo>`.
- Configuration files, by extension and by convention.
- Default values compiled into source.
- Build-time substitution and bundler-injected values.
- Container and orchestration definitions.
- CI and deployment pipeline variables.
- Infrastructure-as-code.
- Anything read from a secret manager or vault at runtime.

Note that a bundler-injected value in a client-side bundle is **public**,
whatever it is named. Frontend build tooling will happily inline a secret if
someone gives it the right prefix.

### Step 2: Classify each value

For every configuration value found, decide: is it a secret, or is it merely
configuration? A secret is anything whose disclosure lets someone do something
they otherwise could not.

Record each in the inventory below, in the engagement copy.

### Step 3: Hunt for leaked secrets

- **Scan history, not just the tip.** `git log -p`, or a dedicated secret
  scanner across all refs. The tip being clean means nothing.
- Check build artifacts and client-side bundles for inlined values.
- Check log output and error handlers for secrets in messages.
- Check any diagnostic, debug, health, or status endpoint that echoes config.
- Check container images: layers keep deleted files.
- Check test fixtures and example config. A real credential in a fixture is a
  real credential.

Every hit here is a finding, and severity follows blast radius, not intent.
"It was only in a test file" does not reduce the exposure.

### Step 4: Check the handling of secrets in use

- Are secrets held in memory longer than needed?
- Are they compared with a constant-time comparison where the comparison is
  itself a control?
- Are they logged, even at debug level, even on the error path?
- Are they passed as command-line arguments? Process listings are readable.
- Are they in exception messages, stack traces, or crash reports sent to a
  third party?

### Step 5: Check the misconfiguration classics

- Debug or development mode reachable in production.
- Verbose errors or stack traces returned to a client.
- Default credentials still present, anywhere.
- Directory listing enabled.
- Administrative interfaces reachable from untrusted networks.
- Permissive cross-origin policy where credentials are also allowed.
- Missing security headers where the app serves HTML.
- Cloud storage or bucket policies granting public read or write.
- Overly broad service account or role permissions.
- Cross-origin policy that reflects the request origin without an allowlist.

---

## Inventory templates

**Copy to `<findings-root>/config-inventory.md` before filling in. Leave the
copies in this file blank.**

### Table A: Secret classes

| Secret class | Purpose | Injection method | Storage at rest | Owner | Rotation cadence | Last rotated | Notes |
|---|---|---|---|---|---|---|---|
| *(class of secret, not its name)* | *(what it authorises)* | *(env, secret manager, mounted file)* | *(encrypted at rest? by what?)* | *(role, not person)* | *(interval)* | *(date)* | *(constraints)* |

### Table B: Configuration values that differ by environment

| Value class | Dev behaviour | Production behaviour | Security relevant? | Verified how |
|---|---|---|---|---|
| *(what the value controls)* | *(dev setting)* | *(prod setting)* | *(yes/no, and why)* | *(file read, or unverified)* |

### Table C: Secret exposure findings

| Location class | Secret class | In history? | Rotated? | Finding ID |
|---|---|---|---|---|
| *(repo, bundle, log, image layer, fixture)* | *(class)* | *(yes/no)* | *(yes/no/NA)* | *(link)* |

### Table D: Third-party integrations holding credentials

| Integration class | Credential class | Scope granted | Least privilege? | Revocation path |
|---|---|---|---|---|
| *(the identity provider, the primary datastore, the external record system, the LMS, the mail transport)* | *(token, key, certificate)* | *(what it can do)* | *(assessed, with evidence)* | *(how to kill it fast)* |

Name the **class** of integration, never the vendor. "The identity provider",
not the product name. The class is what makes the finding portable; the vendor
name is what makes the document sensitive.

---

## Checklist

Evidence column stays blank until you have read the code. Rule 3.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 08.1 | No secret is committed to the repository, at tip or in history | 14.2 | | |
| 08.2 | Secrets are injected at runtime, not baked into artifacts | 14.1 | | |
| 08.3 | Secrets are not inlined into client-side bundles | 14.2 | | |
| 08.4 | Secrets are not written to logs at any level | 7.1 | | |
| 08.5 | Secrets are not passed as command-line arguments | 14.1 | | |
| 08.6 | Secrets are not present in error messages or traces sent to clients | 7.4 | | |
| 08.7 | Every secret class has a named owner and a rotation cadence | 14.1 | | |
| 08.8 | Every secret class has a tested revocation path | 14.1 | | |
| 08.9 | Debug and development modes are unreachable in production | 14.3 | | |
| 08.10 | Verbose errors and stack traces are not returned to clients | 7.4 | | |
| 08.11 | No default credentials remain anywhere | 14.3 | | |
| 08.12 | Security headers are set where the app serves HTML | 14.4 | | |
| 08.13 | Cross-origin policy uses an allowlist, not origin reflection | 14.5 | | |
| 08.14 | Cross-origin credentials are not allowed with a wildcard origin | 14.5 | | |
| 08.15 | Administrative interfaces are network-restricted | 14.3 | | |
| 08.16 | Object storage policies deny public access unless deliberate | 14.1 | | |
| 08.17 | Service accounts and roles are scoped to least privilege | 14.1 | | |
| 08.18 | Secrets at rest are encrypted, with the key held elsewhere | 6.4 | | |
| 08.19 | Configuration that disables a control fails closed when unset | 14.1 | | |
| 08.20 | Dependency and build config is pinned and reproducible | 14.2 | | |

---

## Notes on severity

- A live credential in git history: **Critical** if it grants access to
  production data, regardless of whether the repo is private. Private repos get
  cloned, forked, and made public.
- A secret in a client-side bundle: **Critical**. It is published.
- Debug mode reachable in production: **High**, higher if it exposes an
  evaluation or introspection surface.
- A missing rotation story: **Medium**, and it is a process finding, not a code
  finding. Report it as such.
- An unset config that silently disables a control: severity of the control it
  disabled, not Low because it is "just config".
