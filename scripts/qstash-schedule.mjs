// Creates (or replaces) the QStash schedule that calls the scheduler every two minutes.
// Usage: pnpm qstash:schedule   Never prints the token.
import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN;
const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
if (!token) {
  console.error("QSTASH_TOKEN is not set in .env.local.");
  process.exit(1);
}
if (!/^https:\/\//.test(base)) {
  console.error("APP_BASE_URL must be the public https URL of the app, e.g. https://yaad-alpha.vercel.app");
  process.exit(1);
}

const destination = `${base}/api/cron/tick`;
const client = new Client({ token, ...(process.env.QSTASH_URL ? { baseUrl: process.env.QSTASH_URL } : {}) });
const existing = (await client.schedules.list()).filter((s) => s.destination === destination);

// Reusing the id updates the schedule in place.
const { scheduleId } = await client.schedules.create({
  destination,
  cron: "*/2 * * * *",
  method: "POST",
  retries: 2,
  ...(existing[0] ? { scheduleId: existing[0].scheduleId } : {}),
});
for (const extra of existing.slice(1)) await client.schedules.delete(extra.scheduleId);

console.log(`${existing.length ? "Updated" : "Created"} schedule ${scheduleId}`);
console.log(`POST ${destination} every 2 minutes`);
