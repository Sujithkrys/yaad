// Pure: turns one finished call attempt into the next state of the call.

import type { Response } from "../types";

export type AttemptStatus = "connected" | "no_answer" | "busy" | "failed";

export type AttemptResult = {
  status: AttemptStatus;
  /** final_agent_variables.response, free text from the agent */
  response?: string | null;
  /** final_agent_variables.later_minutes */
  laterMinutes?: number | string | null;
  /** final_agent_variables.unwell */
  unwell?: boolean | string | null;
  failureReason?: string | null;
};

export type Outcome = {
  callStatus: "confirmed" | "retry" | "missed";
  response: Response;
  laterMin: number | null;
  /** epoch ms of the next attempt, for retries */
  nextAttemptAt: number | null;
  /** true when the call is finished (confirmed or missed) */
  done: boolean;
  alert: "unwell" | "missed" | null;
  failureReason: string | null;
};

const MAX_LATER_MIN = 180;

const YES = [/^yes\b/, /^y$/, /\btaken\b/, /^done\b/, /\bconfirmed?\b/, /\ble li(ya|yi|)\b/, /^haan?\b/, /^ha+\b/, /^ji haan?\b/, /^avunu\b/, /^aamaa?\b/, /^houdu\b/];
const NO = [/^no\b/, /\bnot yet\b/, /\bnot taken\b/, /^nahi?n?\b/, /\babhi nahi/, /^ledu\b/, /^illai\b/, /^illa\b/];

export function normaliseResponse(raw: string | null | undefined) {
  return (raw ?? "").toString().trim().toLowerCase().replace(/[.!?,]+$/g, "");
}

export function isYes(raw: string | null | undefined) {
  const r = normaliseResponse(raw);
  return r !== "" && !NO.some((re) => re.test(r)) && YES.some((re) => re.test(r));
}

export function isNo(raw: string | null | undefined) {
  return NO.some((re) => re.test(normaliseResponse(raw)));
}

export function isTruthy(v: unknown) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return ["true", "yes", "y", "1", "haan", "han"].includes(normaliseResponse(String(v ?? "")));
}

function laterMinutesOf(v: AttemptResult["laterMinutes"]) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), MAX_LATER_MIN) : null;
}

export function resolveOutcome(
  result: AttemptResult,
  ctx: { attemptNo: number; maxAttempts: number; retryMin: number; now: number },
): Outcome {
  const unwell = isTruthy(result.unwell);
  const base = { laterMin: null, nextAttemptAt: null, failureReason: null };

  const retryOrMiss = (response: Response, failureReason: string | null): Outcome => {
    if (ctx.attemptNo < ctx.maxAttempts) {
      return {
        ...base,
        callStatus: "retry",
        response,
        nextAttemptAt: ctx.now + ctx.retryMin * 60_000,
        done: false,
        alert: unwell ? "unwell" : null,
        failureReason,
      };
    }
    return { ...base, callStatus: "missed", response, done: true, alert: unwell ? "unwell" : "missed", failureReason };
  };

  if (result.status === "connected") {
    if (isYes(result.response)) {
      return { ...base, callStatus: "confirmed", response: "taken", done: true, alert: unwell ? "unwell" : null };
    }
    const later = laterMinutesOf(result.laterMinutes);
    if (later !== null) {
      return {
        ...base,
        callStatus: "retry",
        response: "later",
        laterMin: later,
        nextAttemptAt: ctx.now + later * 60_000,
        done: false,
        alert: unwell ? "unwell" : null,
      };
    }
    return retryOrMiss(isNo(result.response) ? "not_taken" : "unclear", null);
  }

  return retryOrMiss("no_answer", result.failureReason ?? result.status);
}
