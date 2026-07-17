# 14. File Upload and File Handling

**Doctrine ID:** `14-file-upload`
**Mode:** review and build
**Source standards:** ASVS 5.0 file handling chapter, OWASP File Upload Cheat
Sheet, OWASP Unrestricted File Upload guidance

---

## Purpose

This doctrine covers any path that accepts bytes from a client and puts them
somewhere: an avatar, a document, an import job, a webhook payload written to
disk, a base64 blob in a JSON body. It fires whenever `<target-repo>` has such
a path, and it covers the retrieval side as well, because upload and download
are one control surface pretending to be two.

## Principles

1. **Upload is the one entry point that places attacker-controlled bytes on
   your infrastructure under a name the attacker influences.** Every other
   input class gets parsed, validated, and discarded. This one persists. A
   review that treats upload as "just another form field" has already missed
   the point.
2. **Everything the client tells you about the file is attacker data.** The
   filename, the `Content-Type`, the extension, the declared size. None of it
   is a fact about the bytes; all of it is a claim by the sender.
3. **Content sniffing is better than the client's claim, and it is still not a
   decision procedure.** Sniffing tells you the bytes are consistent with a
   type, not that they are only that type. Polyglots exist: a file can be a
   valid image and a valid archive and a valid script at once. Sniff to reject,
   never to bless.
4. **Allowlist the types you accept. Never denylist the types you fear.** A
   denylist loses to the extension nobody had heard of, to the handler mapping
   nobody knew was enabled, and to the next runtime version that adds one. An
   allowlist fails closed on the unknown case, which is the case you did not
   think about.
5. **Stored content must never be interpreted.** If uploaded bytes can be
   requested back, the only safe posture is that the server treats them as
   opaque and the browser is told, explicitly, not to be clever about them.
6. **A random filename is an obscurity measure, not an access control.** It
   fails the moment one URL leaks into a referrer header, a support ticket, a
   log aggregator, or a shared link. Authorization on retrieval is a separate
   control and it is routinely absent.

---

## Review procedure

### Step 1: Enumerate every path that accepts bytes

Do not search for the word "upload". Search for the idioms:

- Multipart form parsing in the framework's request layer.
- The framework's file or uploaded-file abstraction, wherever it is bound.
- Handlers that read a raw request body and write it anywhere.
- Base64 decode followed by a write.
- Direct-to-object-store flows: the app signs an upload URL and never sees the
  bytes. These are the most commonly missed, because there is no upload handler
  in the application at all. The control questions still apply, and the answers
  now live in the storage policy.
- Import, restore, and bulk-load features. An import is an upload with a parser
  bolted on.
- Any third-party widget or SDK that uploads on the client's behalf.

Record the set. It is the denominator for everything below.

### Step 2: For each path, read the validation, do not read the name of the validation

Rule 2 applies with force here. A call to a helper named `validateUpload()` is
not evidence of validation. Open it. Then ask, of the actual code:

- What is checked: the client's `Content-Type` header, the extension, the magic
  bytes, or the parsed structure?
- Is the check an allowlist or a denylist? Read the collection, do not trust
  the variable name. A variable named `allowedTypes` that is used in a
  "not in" test is a denylist.
- Does the check run before or after the file is written? A validation that
  runs after the write has already lost if the write path is servable.
- Is the extension derived from the client's filename or from the validated
  type? These are different, and only one of them is safe.
- Is the check consistent across every path from step 1? A hardened primary
  upload and an unhardened import endpoint is one unhardened upload.

### Step 3: Read the filename handling

The correct answer is that the server generates the stored name and the
client's name is never used to address the file. Anything else, read closely
for:

- **Path traversal.** Separator sequences, both separators: a name inert on one
  filesystem is traversal on another.
- **Absolute paths.** Some clients will send one.
- **Null bytes.** A null truncates in some native paths and not in the layer
  that validated it. The validator sees one string, the filesystem sees another.
- **Double extensions.** Interpreted by whichever layer is most eager. Some
  server configurations dispatch on any extension in the name, not the last one.
- **Trailing dots and spaces.** Some filesystems strip them on write. The
  validator checked a name that does not exist on disk.
- **Case sensitivity.** A denylist compared case-sensitively against a
  case-insensitive filesystem is not a denylist.
- **Unicode normalisation and homoglyphs.** Normalisation applied after
  validation can turn a rejected-looking name into a dangerous one. Homoglyphs
  defeat human review of a directory listing and naive string equality.
- **Length.** An overlong name truncates somewhere, and truncation drops the
  extension you were relying on.

Retaining the client's name for display or for the download filename is
acceptable, and it is a separate control: it must be encoded on output and must
not be the name on disk. Cross-reference the output encoding rules in
`doctrine/04-web-top10-checklist.md`.

### Step 4: Read the storage location

Establish where the bytes land, by reading the write, not the config comment
(Rule 3).

- Outside the web root, served only through a handler you control, or
- In an object store with no execute semantics and no public read.

If the write target is inside the document root, the finding is that uploaded
content is reachable as a URL, and the severity depends entirely on whether the
server will interpret it. Read the server configuration if it is in the repo.
If it is not, you cannot verify it: mark it unverified and hold at Info per the
ceiling in `rubrics/scoring.md`, and say plainly that reading the server config
would settle it.

Check the permissions on the write. Uploaded files must not be written
executable. Check the directory: a world-writable upload directory is its own
finding.

### Step 5: Read the retrieval path

This is the step reviewers skip. Find the handler that serves uploaded content
back and answer:

- Is there an authorization check, and is it an ownership check or merely an
  authentication check? "Any logged-in user can fetch any file" is an
  authorization failure, not an upload failure, and it is scored as one.
- Is `Content-Type` set from a server-side allowlist keyed on the validated
  type, or echoed from what was stored at upload time? Echoing the upload's
  claimed type hands the attacker the interpretation decision.
- Is `X-Content-Type-Options: nosniff` set? Without it the browser may sniff
  past a correct `Content-Type` and interpret anyway.
- Is `Content-Disposition: attachment` set where the content does not need to
  render inline? For anything that is not a thumbnail on your own page, it
  usually does.
- **Is the content served from a separate origin?** This is the control that
  actually contains stored HTML and SVG. On the application's own origin, stored
  markup executes with the application's cookies, storage, and same-origin
  reach. On a distinct origin it executes against nothing. A separate path is
  not a separate origin, and a subdomain shares cookies scoped to the parent
  domain: check the cookie `Domain` attribute before calling a subdomain an
  isolation boundary.
- **SVG is an XSS vector and it is routinely allowlisted as "an image".** It is
  a markup document with script. Every check that says "images are safe" quietly
  excludes SVG, or it is wrong. If SVG is accepted it must be parser-sanitised
  or served from an isolated origin with `attachment` disposition. "We set the
  `Content-Type` to `image/svg+xml`" is not a mitigation, it is the
  vulnerability.

### Step 6: Read the limits

- Is there a size limit, and **is it enforced before the bytes are buffered?**
  A limit checked after the framework has read the whole body into memory is
  not a limit, it is a memory exhaustion primitive with a validation error at
  the end. The check must live in the server or the streaming layer, ahead of
  the buffer. Read where it fires.
- Is there a count limit per request and per actor per unit time? Cross-
  reference `doctrine/17-rate-limit-abuse.md`: upload is a resource-consumption
  vector on bandwidth, storage, and any processing the upload triggers, and
  storage is the one that does not reset when the request ends.
- Is there a total-quota limit per account? Without one, a legitimate user can
  fill the disk.

### Step 7: Read the archive handling, if archives are accepted

Every one of these is a real, routine finding:

- **Zip bombs.** A small archive expanding to unbounded size. The control is a
  cap on total extracted bytes, enforced during extraction, not computed from
  the archive's own declared sizes, which are attacker data.
- **Path traversal in entry names.** The classic. The entry name is a filename
  that gets none of the scrutiny the upload's own filename got, because it
  arrived inside a file that already passed validation. Every entry name needs
  the full step 3 treatment, and extraction must confirm the destination is
  inside the target directory after resolution, not before.
- **Symlink and hardlink entries.** An archive can contain a link pointing
  outside the extraction root; a later entry writes through it. Reject link
  entries absent a stated reason to support them.
- **Entry count.** Unbounded entries exhausts inodes and CPU regardless of total
  size.
- **Nested archives.** Depth limits, or the recursion is the bomb.

### Step 8: Read the parsers

Image processing, document parsing, and media transcoding are native-code
attack surfaces reached with attacker bytes. That is the entire threat: a
memory-safety bug in a decoder, reached remotely, by design.

- Is the processing library current? Cross-reference
  `doctrine/09-dependency-supply-chain.md`. Decoders are among the
  highest-churn CVE surfaces in any dependency tree.
- Does processing run in the request path with the application's privileges, or
  is it isolated (separate process, container, or worker with reduced privilege
  and no network)? Isolation is the control that survives the next decoder CVE.
- **Is the content re-encoded?** A decode and encode cycle is a strong
  normalisation control: it strips trailing appended data, defeats most
  polyglots, drops metadata, and produces bytes the server authored. It costs
  fidelity and CPU. Where fidelity does not matter it is the best single control
  available on an image upload.
- The same argument applies in full to document and media parsers. A document
  parser is larger and more complex than an image decoder, and document formats
  routinely carry active content and external entity references by design.
  Cross-reference the XML external entity notes in
  `doctrine/04-web-top10-checklist.md`.

### Step 9: Metadata and scanning

- **Metadata stripping on the way in.** Uploaded photographs carry precise
  location, device identifiers, and timestamps. Publishing a user's photo
  publishes where they took it. Cross-reference
  `doctrine/18-privacy-and-data-protection.md`: this is a personal data finding
  as much as an upload finding, and the sensitive-category rules there raise its
  ceiling. Re-encoding (step 8) strips metadata as a side effect, which is one
  more reason to prefer it.
- **Antivirus and content scanning is defence in depth, not the control.** It
  is a denylist with a vendor attached, it is blind to anything targeted, and it
  is a parser reached with attacker bytes in its own right. It is worth having.
  It is not worth relying on. An upload path whose only defence is a scanner is
  an unvalidated upload path with a scanner in front of it, and it should be
  reported that way.

---

## Checklist

Evidence column stays blank until you have read the code. Rule 3.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 14.1 | Every path accepting client bytes is enumerated, including direct-to-store and import flows | 12.1 | | |
| 14.2 | Accepted types are an allowlist, verified by reading the collection and its use | 12.1 | | |
| 14.3 | Type is determined server-side from content, not from the client's declared type | 12.1 | | |
| 14.4 | The client's declared filename is never used as the stored name | 12.3 | | |
| 14.5 | Stored names are generated server-side and are unpredictable | 12.3 | | |
| 14.6 | Filename handling rejects traversal sequences, absolute paths, and null bytes | 12.3 | | |
| 14.7 | Filename handling accounts for double extensions, trailing dots and spaces, and case folding | 12.3 | | |
| 14.8 | Unicode normalisation happens before validation, not after | 12.3 | | |
| 14.9 | The stored extension is derived from the validated type, not the client's name | 12.3 | | |
| 14.10 | Uploaded content is stored outside the web root or in a store with no execute semantics | 12.4 | | |
| 14.11 | Uploaded files are not written with execute permission | 12.4 | | |
| 14.12 | The upload directory is not writable beyond the process that needs it | 12.4 | | |
| 14.13 | Size limits are enforced before the bytes are buffered | 12.1 | | |
| 14.14 | Per-request file count and per-account storage quotas exist | 12.1 | | |
| 14.15 | Upload endpoints are rate limited per actor, in a shared store | 12.1 | | |
| 14.16 | The upload endpoint enforces authorization | 4.1 | | |
| 14.17 | The retrieval endpoint enforces authorization, including ownership, not just authentication | 4.1 | | |
| 14.18 | Retrieval sets `Content-Type` from a server-side allowlist, not from stored client data | 12.5 | | |
| 14.19 | Retrieval sets `X-Content-Type-Options: nosniff` | 12.5 | | |
| 14.20 | Retrieval sets `Content-Disposition: attachment` where inline rendering is not required | 12.5 | | |
| 14.21 | Uploaded content is served from an origin distinct from the application's | 12.5 | | |
| 14.22 | SVG is either rejected, parser-sanitised, or isolated by origin and disposition | 12.5 | | |
| 14.23 | Archive extraction caps total extracted bytes, measured during extraction | 12.1 | | |
| 14.24 | Archive entry names are validated after path resolution against the extraction root | 12.3 | | |
| 14.25 | Archive link entries are rejected or explicitly justified | 12.3 | | |
| 14.26 | Archive entry count and nesting depth are bounded | 12.1 | | |
| 14.27 | Processing libraries are current and tracked for advisories | 12.2 | | |
| 14.28 | Parsing and processing run with reduced privilege and no unnecessary network access | 12.2 | | |
| 14.29 | Image content is re-encoded server-side where fidelity permits | 12.2 | | |
| 14.30 | Document parsers have external entity and active content resolution disabled | 12.2 | | |
| 14.31 | Metadata is stripped from uploaded media before storage or publication | 12.5 | | |
| 14.32 | Content scanning, where present, is additive and is not the only control | 12.2 | | |
| 14.33 | Upload and retrieval events are logged with actor, stored name, and type | 7.2 | | |

---

## Common false positives

| Looks like a finding | Why it may not be | How to tell |
|---|---|---|
| No extension validation in the handler | The framework or a middleware may enforce an allowlist ahead of it | Read the middleware registration and its order. Rule 2. Do not assume either way |
| The client's filename is passed to the storage call | It may be sanitised in the storage layer, or the storage layer may key on a generated identifier and keep the name only as an attribute | Open the storage call. Establish what actually addresses the object |
| Uploads land under the document root | The server may refuse to interpret anything in that directory | Read the server config. If it is not in the repo you cannot verify it: unverified, Info, and say what would settle it |
| SVG accepted | It may be re-serialised through a sanitiser, or served from an isolated origin with `attachment` | Read the sanitiser or read the response headers on the retrieval path. A regex-based tag stripper does not count |
| No antivirus | Scanning is defence in depth. Its absence alongside real validation is a hardening item | Judge the actual validation. Do not file "no antivirus" as a finding on its own |
| No size limit in application code | The reverse proxy or the framework may impose a default | Read the proxy config or confirm the framework default for the pinned version. A default you did not check is not a control you can cite |
| Random filenames with no authorization on retrieval | This is a real finding, not a false positive | Obscurity is not access control. Report it. It is listed here because it is routinely dismissed as acceptable |
| Direct-to-object-store upload with no server handler | The absence of a handler is not the absence of an upload | The controls moved to the signing logic and the bucket policy. Review those. If they are not in the repo, mark unverified |

---

## Notes on severity

Score against `rubrics/scoring.md`. Do not restate it; the notes below are the
mappings that this area gets wrong.

- Upload of executable content into a location the server will interpret, from
  an unauthenticated endpoint: Catastrophic impact, Open reachability.
  **Critical**, and the grade caps at F. But reachability requires that you
  confirmed the interpretation, not assumed it.
- The same defect where you could not read the server config: the impact
  argument is unchanged and the reachability is unconfirmed. That makes it
  `verified: false`, and the ceiling holds it at **Info** whatever the matrix
  says. This is the single most common place in this doctrine where a reviewer
  files a Critical they cannot support. Do not. Write down that reading the
  server configuration would settle it, and hand that to the user in step 6.
- Stored XSS via SVG or HTML served from the application's own origin: Severe
  impact (it takes over the session of every viewer), and reachability follows
  who can upload. Unauthenticated upload makes it **Critical**.
- The same content served from an isolated origin with `attachment`: the
  execution has nowhere to reach. This is a hardening item at most, and often
  not a finding at all.
- Missing authorization on retrieval, where the files contain personal data:
  Severe impact, Authenticated reachability if a login is needed to fetch,
  Open if it is not. Random names do not reduce either axis. They are not a
  control, so they do not appear in the scoring.
- Archive path traversal on extraction: impact is arbitrary file write, which
  is Catastrophic where the written path is reachable and executable, and
  Severe where it is not. Trace what the write can actually overwrite before
  you commit to the higher one.
- Zip bomb or unbounded upload with no quota: Moderate impact (denial of
  service), reachability per the endpoint. Do not inflate it. It is a real
  finding at **High** on an open endpoint and it does not need help.
- Missing metadata stripping on published user photographs: this is a privacy
  finding. Its ceiling is set by the sensitive-category rules in
  `doctrine/18-privacy-and-data-protection.md`, because precise location is one
  of them.
