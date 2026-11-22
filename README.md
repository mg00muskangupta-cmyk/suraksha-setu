# Suraksha Setu — Round 3

Suraksha Setu is a React + Vite brand-governance workspace. It checks written content against brand guidelines, supports human review, extracts text from selectable-text PDFs, performs approximate visual consistency checks, and can sync a team's data through Cloudflare D1.

## Features

- Brand profile, approved facts, tone, rules, restricted phrases and preferred wording.
- Content analysis for pasted text and TXT, MD, CSV and PDF uploads.
- PDF text extraction with page count, file-size validation and clear errors. Scanned/image-only PDFs require OCR and are not supported yet.
- Rule-based checks always work; optional server-side OpenAI analysis is available when `OPENAI_API_KEY` is configured.
- Suggested corrections, re-analysis, review submission, approve/reject decisions and review history.
- Visual creative review: dominant colour sampling, comparison with configured HEX brand colours, and an approximate logo-reference similarity check.
- Team accounts backed by Cloudflare D1, workspace invite codes, hashed passwords, secure session cookies, and admin/creator/reviewer roles.
- Local demo mode works without signing in and uses sample EcoGlow brand data. Local demo data is stored only in the current browser.

## Tech stack

- React 18, Vite 6, JavaScript and lucide-react.
- PDF.js for PDF text extraction.
- Cloudflare Workers with static assets and Worker API routing.
- Cloudflare D1 (SQLite) for shared workspace records and account data.
- Web Crypto PBKDF2 password hashing and SHA-256 session-token storage.
- Optional OpenAI Chat Completions API, called only from the server-side Worker.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

To make a production build:

```bash
npm run build
npm run preview
```

## Configure shared team workspace (Cloudflare D1)

The app remains usable in local demo mode without D1. Shared accounts and cross-device data sync require a D1 database binding named `DB`.

1. Install dependencies and authenticate Wrangler:

   ```bash
   npm install
   npx wrangler login
   ```

2. Create the database:

   ```bash
   npx wrangler d1 create suraksha-setu-db
   ```

3. Copy the returned database ID into `wrangler.toml` by uncommenting and completing:

   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "suraksha-setu-db"
   database_id = "YOUR_REAL_DATABASE_ID"
   ```

4. Apply the schema:

   ```bash
   npx wrangler d1 execute suraksha-setu-db --remote --file=migrations/0001_workspace.sql
   ```

5. Deploy the Worker. The first account created without an invite code becomes workspace admin. It can share the invite code shown under **Team workspace**. Teammates join with that code and select Content creator or Reviewer.

   ```bash
   npm run deploy
   ```

The Worker uses the D1 binding named `DB`. Do not commit real database IDs, API keys, passwords, or other secrets to the repository. If deploying from the Cloudflare dashboard instead of Wrangler, add a D1 binding named `DB` under the Worker’s Settings → Bindings and point it at the same database.

## Optional AI analysis

Set the key as a Worker secret (never in frontend code):

```bash
npx wrangler secret put OPENAI_API_KEY
```

Optional model override:

```bash
npx wrangler secret put OPENAI_MODEL
```

The default model is `gpt-4o-mini`. Without a configured key, the app falls back to its built-in rule-based checker and labels the mode accordingly.

## Visual checking setup

Open **Visual checks**:
1. Add the brand's approved HEX colours in Brand knowledge / Visual checks.
2. Upload a clean logo reference image.
3. Upload a creative (PNG, JPG or WebP) and run the check.

The colour comparison uses sampled dominant colours. The logo comparison uses a lightweight image-similarity heuristic. These are screening signals, not a computer-vision guarantee; the app does not certify logo placement, ownership, exact design geometry or legal compliance. A human reviewer must confirm every result.

## PDF support

PDFs up to 15 MB with selectable text are supported. Password-protected, corrupted, or scanned image-only PDFs may fail; OCR is not included. Users receive an explanatory message rather than a silent failure.

## Roles

- **Admin:** manages the workspace, brand profile, submissions and decisions.
- **Content creator:** edits brand knowledge and submits new items as Pending; cannot change reviewer decisions.
- **Reviewer:** reviews existing submissions and records approve/reject decisions; cannot edit brand knowledge or create/delete submissions.

Passwords are stored as PBKDF2-derived hashes with per-user salts. Session tokens are random, stored as SHA-256 hashes in D1, and sent in HttpOnly, Secure, SameSite=Lax cookies. Use HTTPS in production.

## Testing checklist

Before a judging submission, test the deployed URL after configuring D1:

- [ ] Build completes with `npm run build`.
- [ ] Empty content cannot be analyzed.
- [ ] A TXT, MD and CSV upload loads text.
- [ ] A selectable-text PDF loads extracted text; a scanned PDF shows a clear unsupported/OCR message.
- [ ] Rule-based analysis returns findings for the sample EcoGlow claim phrases.
- [ ] Suggested correction changes the editor; re-analysis runs again.
- [ ] A review can be submitted once, opened from history, edited and approved/rejected by a reviewer.
- [ ] Invalid image type and oversized files show clear errors.
- [ ] Visual analysis reports palette status and clearly labels logo matching as approximate.
- [ ] Create a workspace, copy its invite code, join as a creator and reviewer in separate browser sessions.
- [ ] Refresh each session and verify shared brand data and review history persist.
- [ ] Verify creators cannot approve/reject and reviewers cannot edit brand guidelines.
- [ ] Sign out and verify local demo mode remains available.

Do not report tests as passed until they have been run against the deployed build and configured D1 database.

## Known limitations

- OCR for scanned PDFs is not implemented.
- Visual checking is approximate and may produce false positives/negatives.
- The app does not verify legal claims or certify regulatory compliance.
- The optional AI endpoint needs an OpenAI API key; no key is bundled.
- Local demo mode uses browser localStorage and is not shared. Shared persistence requires D1 to be configured and the user to sign in.
- The app is a review aid; a human remains responsible for publication decisions.

## Deployment architecture

Browser (React/Vite) → Cloudflare Worker router → static assets + `/api/analyze` + `/api/workspace` → D1 database. Optional AI requests are sent from the Worker to the OpenAI API; the API key stays server-side.
