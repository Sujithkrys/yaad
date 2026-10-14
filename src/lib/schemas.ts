import { z } from "zod";

// Request validation for the API routes. Rules match the database checks.

const LANGS = ["hi-IN", "te-IN", "ta-IN", "kn-IN", "en-IN"] as const;
const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const lang = z.enum(LANGS, { error: "Choose a supported language." });

export const personInput = z.object({
  name: z.string({ error: "Add the name they answer to." }).trim().min(1, "Add the name they answer to.").max(30, "Names can be up to 30 characters."),
  relation: z.string().trim().min(1).max(30).default("Other"),
  phone: z
    .string({ error: "Enter a 10 digit mobile number." })
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10 digit mobile number.")),
  lang,
});
export const personPatch = personInput.partial();

export const consentInput = z.object({ status: z.literal("granted", { error: "Only granted is supported for now." }) });

export const reminderInput = z.object({
  personId: z.uuid({ error: "Choose who we should call." }),
  text: z.string({ error: "Say what the reminder is for." }).trim().min(1, "Say what the reminder is for.").max(60, "Reminders can be up to 60 characters."),
  kind: z.enum(["tablet", "walk", "visit", "other"]).default("tablet"),
  time: z.string({ error: "Pick a time for the call." }).regex(HHMM, "Pick a time for the call."),
  repeat: z.enum(["daily", "weekdays", "once"]).default("daily"),
  onceDay: z.iso.date().nullable().optional(),
  lang: lang.nullable().optional(),
});
export const reminderPatch = reminderInput.partial().extend({ active: z.boolean().optional() });

export const settingsInput = z
  .object({
    alert: z.boolean(),
    alertChannel: z.enum(["WhatsApp", "SMS"]),
    alertNumber: z
      .string()
      .transform((s) => s.replace(/\D/g, ""))
      .pipe(z.string().regex(/^$|^[6-9]\d{9}$/, "Enter a 10 digit number for alerts, or leave it empty.")),
    retryMin: z.union([z.literal(5), z.literal(10), z.literal(15)], { error: "Retry after 5, 10 or 15 minutes." }),
    maxAttempts: z.number().int().min(1).max(3),
    quietOn: z.boolean(),
    quietFrom: z.string().regex(HHMM, "Quiet hours need a start time."),
    quietTo: z.string().regex(HHMM, "Quiet hours need an end time."),
    defaultLang: lang,
    demoOutcome: z.enum(["random", "taken", "noanswer"]),
  })
  .partial();

export const callsQuery = z.object({
  person: z.uuid().optional().catch(undefined),
  status: z.enum(["calling", "retry", "confirmed", "missed"]).optional().catch(undefined),
  q: z.string().trim().max(60).optional(),
});
