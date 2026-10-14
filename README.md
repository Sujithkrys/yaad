# Yaad

Phone-call reminders for parents. Family members schedule reminders ("7 PM BP tablet for Amma"); an AI voice agent calls the parent in their own language, asks if they did it, and the family sees the answer on a dashboard.

Next.js (App Router) · TypeScript · Supabase Postgres · Sarvam Bulbul (voice) and Sarvam Voice Agents (calls).

## Run it

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm dev
```

Then open `/dashboard`. On first visit you pick a name; it must be unique and creates your own space. The browser remembers it with an httpOnly cookie.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm test` | Unit tests (vitest) |
| `pnpm lint` | ESLint |
| `pnpm tts:test` | Checks `SARVAM_API_KEY` with one text-to-speech request |
| `pnpm call:test +91XXXXXXXXXX [hi\|te\|ta\|kn\|en]` | Places one real call; only to numbers in `CALL_ALLOWLIST` |

## Database

Run the files in `supabase/migrations/` in order in the Supabase SQL editor. Row level security is on with no policies, so the public anon key reads nothing; only the server, with `SUPABASE_SECRET_KEY`, can reach the data. All access goes through the API routes in `src/app/api/`.

## Connect Sarvam

### Where each value comes from

In the Sarvam dashboard, open your agent and go to **Deploy with code → Instant outbound**. The sample request shows everything:

| Env var | In the sample request |
| --- | --- |
| `SARVAM_ORG_ID` | `orgs/<this>/` in the URL |
| `SARVAM_WORKSPACE_ID` | `workspaces/<this>/` in the URL |
| `SARVAM_APP_ID` | `app_config.app_id` |
| `SARVAM_APP_VERSION` | `app_config.app_version` (the published version, a number) |
| `SARVAM_CONNECTION_ID` | `connection_config.connection_id` |
| `SARVAM_AGENT_PHONE` | `connection_config.agent_phone_number`, in E.164 (`+91...`) |
| `SARVAM_API_KEY` | API keys page in the dashboard |

The agent gets these variables on every call: `person_name`, `reminder_text`, `requester_name`, `user_name`. It fills in `response`, `later_minutes`, `unwell` and `call_summary`; Yaad reads them from the webhook.

### Webhook

Sarvam posts the result of each call to:

```
${APP_BASE_URL}/api/webhooks/sarvam?token=${SARVAM_WEBHOOK_SECRET}
```

Sarvam does not sign webhooks, so the secret token in the URL is the authentication; a wrong or missing token gets `401`. Duplicate deliveries are ignored.

### Simulate or live

- `CALL_MODE=simulate` (default): nothing is sent to Sarvam. "Call now" creates an attempt and a believable result arrives after 6 to 10 seconds, following the "demo outcome" setting. Good for demos and development.
- `CALL_MODE=live`: real calls. Only numbers listed in `CALL_ALLOWLIST` can be called; anything else is refused and the call is marked failed. `MAX_CALLS_PER_DAY` caps attempts across all workspaces, and each person has a two-minute cooldown.

Settings shows a Live or Simulated chip; `/api/health/sarvam` reports which values are set (booleans only).

### Local development with real calls

Sarvam cannot reach `localhost`. Either test against your deployed Vercel URL, or open a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
# or: ngrok http 3000
```

Set `APP_BASE_URL` to the https URL it prints, set `CALL_MODE=live`, add your own number to `CALL_ALLOWLIST`, restart `pnpm dev`, then run `pnpm call:test +91<your number>`.

### On Vercel

Add the same variables in Project Settings → Environment Variables (with `APP_BASE_URL` set to the production URL) and redeploy. If results do not arrive, check the function logs for `/api/webhooks/sarvam`.
