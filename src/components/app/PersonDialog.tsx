"use client";

import { useState, type FormEvent } from "react";
import { useToast } from "@/components/shell/Toast";
import { Button, CloseIcon, Modal } from "@/components/ui";
import { api } from "@/lib/client/api";
import { useFamily, useSettings } from "@/lib/client/hooks";
import { mobileDigits } from "@/lib/phone";
import type { Lang, Person } from "@/lib/types";
import { LANGUAGES } from "@/lib/voices";

export const RELATIONS = ["Mother", "Father", "Grandmother", "Grandfather", "Spouse", "Other"];

/** Indian mobile number as 10 digits; +91, 91 or 0 in front and spaces are fine. */
export const cleanPhone = mobileDigits;

type Props = { open: boolean; personId?: string; onClose: () => void };

export function PersonDialog(props: Props) {
  const family = useFamily();
  const settings = useSettings();
  return (
    <Modal open={props.open && Boolean(family.data)} onClose={props.onClose} labelledBy="per-title">
      {family.data ? <PersonForm {...props} family={family.data} defaultLang={settings.data?.defaultLang ?? "hi-IN"} /> : null}
    </Modal>
  );
}

function PersonForm({ family, defaultLang, personId, onClose }: Props & { family: Person[]; defaultLang: Lang }) {
  const say = useToast();
  const existing = family.find((p) => p.id === personId);
  const [name, setName] = useState(existing?.name ?? "");
  const [relation, setRelation] = useState(existing?.relation ?? "Mother");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [lang, setLang] = useState<Lang>(existing?.lang ?? defaultLang);
  const [error, setError] = useState<{ field: "name" | "phone" | "server"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError({ field: "name", text: "Add the name they answer to, like Amma." });
    const digits = cleanPhone(phone);
    if (!digits) return setError({ field: "phone", text: "Enter a 10 digit mobile number." });
    const data = { name: name.trim(), relation, phone: digits, lang };
    setSaving(true);
    try {
      if (existing) {
        await api.updatePerson(existing.id, data);
        say(`${data.name} updated.`);
      } else {
        await api.addPerson(data);
        say(`${data.name} added. Ask them if calls are okay, then press Mark as agreed.`);
      }
      onClose();
    } catch (err) {
      const text = (err as Error).message;
      setError({ field: /mobile/i.test(text) ? "phone" : "server", text });
      setSaving(false);
    }
  }

  return (
    <form className="dlg" noValidate onSubmit={submit}>
      <div className="dlg-head">
        <h2 id="per-title">{existing ? `Edit ${existing.name}` : "Add family member"}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="dlg-body">
        <div className="two">
          <div className="field">
            <label htmlFor="per-name">Name they answer to</label>
            <input
              id="per-name"
              className="input"
              maxLength={30}
              placeholder="Amma"
              autoComplete="off"
              value={name}
              aria-invalid={error?.field === "name"}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="per-rel">Relation</label>
            <select id="per-rel" className="input" value={relation} onChange={(e) => setRelation(e.target.value)}>
              {RELATIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="per-phone">Mobile number</label>
            <input
              id="per-phone"
              className="input"
              inputMode="tel"
              maxLength={17}
              placeholder="98765 43210"
              autoComplete="off"
              value={phone}
              aria-invalid={error?.field === "phone"}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="per-lang">Language</label>
            <select id="per-lang" className="input" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {existing ? null : (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)" }}>
            We will send them a message asking if it&apos;s okay to call. Calls start after they agree.
          </p>
        )}
        {error ? (
          <p className="err" role="alert">
            {error.text}
          </p>
        ) : null}
      </div>
      <div className="dlg-foot">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : existing ? "Save changes" : "Add person"}
        </Button>
      </div>
    </form>
  );
}
