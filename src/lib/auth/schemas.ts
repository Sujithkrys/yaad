import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "./password";

export const username = z
  .string({ error: "Choose a username." })
  .trim()
  .min(2, "Usernames need at least 2 characters.")
  .max(40, "Usernames can be up to 40 characters.")
  .regex(/^[\p{L}\p{M}\p{N} .'-]+$/u, "Use letters, numbers, spaces, dots or dashes.");

export const password = z
  .string({ error: "Choose a password." })
  .min(PASSWORD_MIN, `Passwords need at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Passwords can be up to ${PASSWORD_MAX} characters.`);

export const credentials = z.object({ name: username, password });
export const loginInput = z.object({ name: z.string({ error: "Enter your username." }).trim().min(1, "Enter your username."), password: z.string({ error: "Enter your password." }).min(1, "Enter your password.") });
export const passwordChange = z.object({ current: z.string().optional(), password });
