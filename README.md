# Suraksha Setu — Brand Governance MVP

A hackathon-ready React + Vite application for checking content against brand rules, suggesting corrections, and recording a human approval decision.

## Included workflow
1. Add/edit brand rules and approved facts in **Brand knowledge**.
2. Submit an advertisement, email, social post, campaign, or document in **Check content**.
3. Run guideline-based checks immediately, even without an AI key.
4. Review each finding, its matched rule, explanation, and suggested correction.
5. Apply a suggestion, edit the text, and re-analyze.
6. Send the check to **Human review**, then approve or reject it.
7. Inspect saved reviews in **Review history**.

## Run locally
Requires Node.js 18+.

```bash
npm install
npm run dev
```

## AI integration (optional)
The app includes a Cloudflare Pages Function at `functions/api/analyze.js`. It calls an OpenAI-compatible Chat Completions API server-side. The API key is never placed in browser code.

For Cloudflare Pages:
- Build command: `npm run build`
- Build output directory: `dist`
- Add environment variable `OPENAI_API_KEY` in Pages → Settings → Variables and Secrets.
- Optional: set `OPENAI_MODEL` (default `gpt-4o-mini`).

Without the key, the app automatically uses its built-in guideline-based demo checks. The UI labels this mode as **Guideline-based demo checks**, not AI.

## Important limitations
- Review data and brand knowledge are stored in the current browser's `localStorage`. They persist after refresh on that browser but are not shared between different users/devices. A hosted judging version that needs shared multi-user records should connect Supabase or Cloudflare D1.
- TXT/MD/CSV uploads are supported in the starter UI. PDF upload is not yet parsed; paste extracted text or add PDF parsing before claiming PDF support.
- Visual/logo identity checking is not implemented in this MVP.
- The local fallback is a transparent rule-based checker, not a language model.
- The compliance score is an internal estimate, not a certified measure.
- Human review remains required. Do not use the app as legal or regulatory approval.

## Deploy free with Cloudflare Pages
1. Create a GitHub repository and upload this folder's contents.
2. In Cloudflare Dashboard, open **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository.
4. Set build command `npm run build` and output directory `dist`.
5. Deploy. Your free project URL will be similar to `your-project.pages.dev`.
6. To enable AI, add `OPENAI_API_KEY` as a secret in Pages settings and redeploy.

The `functions` directory is included for Cloudflare Pages Functions and is deployed alongside the static site.
