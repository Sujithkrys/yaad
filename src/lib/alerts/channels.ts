import "server-only";

import { env } from "../env";
import { supabaseAdmin } from "../supabase-admin";
import type { Settings } from "../types";
import type { AlertKind } from "./trigger";

export type AlertWorkspace = { id: string; name: string; settings: Settings };
export type AlertMessage = { kind: AlertKind; text: string; callId: string; personId: string };

export interface AlertChannel {
  readonly name: string;
  send(workspace: AlertWorkspace, message: AlertMessage): Promise<void>;
}

/** Always on: the bell feed in the app. */
export const inAppChannel: AlertChannel = {
  name: "in-app",
  async send(ws, m) {
    const { error } = await supabaseAdmin().from("alerts").insert({
      workspace_id: ws.id,
      call_id: m.callId,
      person_id: m.personId,
      kind: m.kind,
      message: m.text,
      channel: ws.settings.alert ? ws.settings.alertChannel : "in-app",
      sent: true,
    });
    if (error) throw new Error(`in-app alert failed: ${error.code}`);
  },
};

/** Email through the Resend REST API. Only when RESEND_API_KEY and an address are set. */
export const emailChannel: AlertChannel = {
  name: "email",
  async send(ws, m) {
    const e = env();
    const to = ws.settings.alertEmail;
    if (!e.RESEND_API_KEY || !e.ALERT_FROM_EMAIL || !to) return;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: e.ALERT_FROM_EMAIL,
        to: [to],
        subject: m.kind === "unwell" ? "Please check in" : m.kind === "missed" ? "A reminder was missed" : "Reminder update",
        text: `${m.text}\n\nSent by Yaad for ${ws.name}.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`resend responded ${res.status}`);
  },
};

/** Not connected yet: logs only, without the phone number. */
export const whatsappChannel: AlertChannel = {
  name: "whatsapp",
  async send(ws, m) {
    console.info(`[alerts] whatsapp not connected yet; ${m.kind} alert for workspace ${ws.id.slice(0, 8)}`);
  },
};

export const smsChannel: AlertChannel = {
  name: "sms",
  async send(ws, m) {
    console.info(`[alerts] sms not connected yet; ${m.kind} alert for workspace ${ws.id.slice(0, 8)}`);
  },
};

/** In-app always; the chosen external channel only when alerts are on. */
export function channelsFor(settings: Settings): AlertChannel[] {
  if (!settings.alert) return [inAppChannel];
  const external = settings.alertChannel === "Email" ? emailChannel : settings.alertChannel === "SMS" ? smsChannel : whatsappChannel;
  return [inAppChannel, external];
}
