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
| `pnpm tick [baseUrl]` | Runs one scheduler tick locally (uses `CRON_DEV_SECRET`) |
| `pnpm qstash:schedule` | Creates or updates the QStash schedule for `/api/cron/tick` |

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
- `CALL_MODE=live`: real calls through Sarvam. `CALL_MODE` is the kill switch: set it back to `simulate` to stop all real calls at once.

Settings shows a Live or Simulated chip; `/api/health/sarvam` reports which values are set (booleans only).

### Safety

Every call, manual or scheduled, passes the same gate (`src/lib/calls/gate.ts`):

- **Consent.** Only people marked as agreed are called, and only numbers someone added themselves.
- **Allowlist (optional).** Empty `CALL_ALLOWLIST` is open mode: any valid Indian mobile can be called. Set it to a comma separated list of E.164 numbers to allow only those.
- **Daily caps, counted per IST day.** `MAX_CALLS_PER_DAY` (default 40) across all visitors, and `MAX_CALLS_PER_WORKSPACE_PER_DAY` (default 8). A call that hits a cap is marked missed with reason `daily_limit`, is not retried, and the app shows "Demo limit reached for today."
- **Cooldown.** Two minutes between calls to the same number.
- **Quiet hours.** Scheduled calls wait until quiet hours end. A manual "Call now" is not held back.
- **People cap.** `MAX_PEOPLE_PER_WORKSPACE` (default 5) family members per workspace.
- **Sample data is never dialled.** People added by "Load sample data" have made-up numbers and are skipped in live mode.

### Local development with real calls

Sarvam cannot reach `localhost`. Either test against your deployed Vercel URL, or open a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
# or: ngrok http 3000
```

Set `APP_BASE_URL` to the https URL it prints, set `CALL_MODE=live` (optionally put your own number in `CALL_ALLOWLIST` while testing), restart `pnpm dev`, then run `pnpm call:test +91<your number>`.

### On Vercel

Add the same variables in Project Settings → Environment Variables (with `APP_BASE_URL` set to the production URL) and redeploy. If results do not arrive, check the function logs for `/api/webhooks/sarvam`.

## Scheduling with QStash

Reminder calls are placed by a scheduler tick at `POST /api/cron/tick`, called every two minutes by Upstash QStash. Each tick:

1. **Recovers** attempts stuck in dialing for 10 minutes (the webhook never came) and treats them as failed, so the call retries or is marked missed.
2. **Materialises** reminders due between 60 minutes ago and 2 minutes from now (IST) into `scheduled` call rows. The unique `(reminder_id, scheduled_at)` index makes repeated ticks harmless.
3. **Dispatches** up to 5 due calls (`scheduled`, or `retry` whose next attempt time has come). Each row is claimed atomically, so overlapping ticks never dial twice.
4. **Sends family alerts** once per call: missed after the last attempt, "not feeling well" on any call, and an info note when someone confirmed after more than two retries. Alerts always appear in the bell in the app; with alerts on, they also go to the chosen channel (email through Resend; WhatsApp and SMS are logged until connected).

The tick returns `{ materialised, dialed, recovered, alerted }`. Settings shows "Scheduler: last tick Nm ago"; `/api/health/scheduler` returns the last tick time and how many calls are scheduled, waiting to retry or ringing.

### The four QStash values

In the Upstash console, open **QStash**:

| Env var | Where |
| --- | --- |
| `QSTASH_URL` | Request builder or the env snippet at the top (e.g. `https://qstash.upstash.io`) |
| `QSTASH_TOKEN` | Same snippet, `QSTASH_TOKEN` |
| `QSTASH_CURRENT_SIGNING_KEY` | Signing keys panel, current key |
| `QSTASH_NEXT_SIGNING_KEY` | Signing keys panel, next key |

In production the tick only accepts requests with a valid QStash signature (checked with both keys, so key rotation is safe); anything else gets `401`.

### Create the schedule

Either run (with `QSTASH_TOKEN` and `APP_BASE_URL` set):

```bash
pnpm qstash:schedule
```

which creates or updates the schedule and prints its id, or create it in the console: **QStash → Schedules → Create**, destination `https://<your-app>/api/cron/tick`, method `POST`, cron `*/2 * * * *`.

### Locally

QStash cannot reach `localhost`, so in development run a tick by hand:

```bash
pnpm tick                       # http://localhost:3000
pnpm tick http://localhost:3002 # another port
```

It uses `CRON_DEV_SECRET` as a bearer token. That token is accepted only when `NODE_ENV` is not `production`.

### Free tier

A tick every two minutes is 720 messages a day (about 21,600 a month), plus any retries. The QStash free tier allows 1,000 messages a day at the time of writing, so it fits; check the current limits on the Upstash pricing page if you change the cron.
