// Runs one scheduler tick against the local dev server.
// Usage: pnpm tick [baseUrl]   (default http://localhost:3000)
const base = (process.argv[2] ?? process.env.TICK_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_DEV_SECRET;
if (!secret) {
  console.error("CRON_DEV_SECRET is not set in .env.local.");
  process.exit(1);
}
const res = await fetch(`${base}/api/cron/tick`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
const body = await res.text();
console.log(`status: ${res.status}`);
try {
  console.log(JSON.stringify(JSON.parse(body), null, 2));
} catch {
  console.log(body.slice(0, 300));
}
if (!res.ok) process.exit(1);
