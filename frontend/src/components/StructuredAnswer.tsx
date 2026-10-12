import { useState } from "react";
import type { Message, StructuredExplanation } from "../lib/types";
import { api } from "../api/client";
import { useToast } from "../store/toast";
import { ConfidenceBadge, SourceTypeBadge } from "./ui";
import { Bookmark, Calendar, Check, External, Thumb } from "../lib/icons";

function Section({
  title,
  children,
  accent = "slate",
}: {
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  const border: Record<string, string> = {
    slate: "border-slate-200",
    brand: "border-brand-200",
    emerald: "border-emerald-200",
    amber: "border-amber-200",
    rose: "border-rose-200",
  };
  return (
    <section className={`rounded-xl border ${border[accent] || border.slate} bg-white p-4`}>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  if (!items?.length) return <p className="text-ink-muted">None identified.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <Check width={16} height={16} className="mt-0.5 shrink-0 text-accent-600" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function StructuredAnswer({
  message,
  jurisdiction,
}: {
  message: Message;
  jurisdiction?: string;
}) {
  const s = message.structured as StructuredExplanation | null;
  const { push } = useToast();
  const [voted, setVoted] = useState<null | boolean>(null);
  const [saved, setSaved] = useState(false);

  if (!s) return <p className="text-sm text-ink-soft">{message.content}</p>;
  const data = s; // non-null, stable reference for closures

  const citations = message.citations?.length ? message.citations : s.citations || [];

  async function vote(helpful: boolean) {
    setVoted(helpful);
    try {
      await api.feedback(message.id, helpful);
      push("Thanks for your feedback.", "success");
    } catch {
      push("Could not record feedback.", "error");
    }
  }

  async function save() {
    try {
      await api.createBookmark({
        item_type: "message",
        title: data.short_answer.slice(0, 120) || "Saved explanation",
        folder: "General",
        ref_id: message.id,
        payload: { structured: data },
      });
      setSaved(true);
      push("Saved to your items.", "success");
    } catch {
      push("Could not save.", "error");
    }
  }

  return (
    <div className="animate-fade-in space-y-3">
      {/* Trust bar */}
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceBadge level={s.confidence} />
        {jurisdiction && (
          <span className="chip bg-slate-100 text-slate-600">Jurisdiction: {jurisdiction}</span>
        )}
        <span className="chip bg-slate-100 text-slate-600">
          Checked: {new Date(message.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Short answer */}
      <div className="rounded-xl bg-brand-600 p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-100">Short answer</p>
        <p className="mt-1 text-[15px] font-medium leading-relaxed">{s.short_answer}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Section title="What the law / policy says" accent="brand">
          <p>{s.what_the_law_says || "—"}</p>
        </Section>
        <Section title="How it applies to you">
          <p>{s.how_it_applies || "—"}</p>
        </Section>
        <Section title="Your rights" accent="emerald">
          <List items={s.your_rights} />
        </Section>
        <Section title="Your obligations" accent="amber">
          <List items={s.your_obligations} />
        </Section>
      </div>

      {s.if_you_dont_comply && (
        <Section title="If you don't comply" accent="rose">
          <p>{s.if_you_dont_comply}</p>
        </Section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Section title="What to do next" accent="brand">
          <List items={s.what_to_do_next} />
        </Section>
        <Section title="Documents to collect">
          <List items={s.documents_to_collect} />
        </Section>
      </div>

      {s.important_dates?.length > 0 && (
        <Section title="Important dates" accent="amber">
          <ul className="space-y-2">
            {s.important_dates.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <Calendar width={16} height={16} className="mt-0.5 shrink-0 text-amber-600" />
                <span>
                  <strong className="text-ink">{d.date || "TBD"}</strong> — {d.label}
                  {d.note ? <span className="text-ink-muted"> ({d.note})</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(s.exceptions?.length > 0 || s.risks?.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {s.exceptions?.length > 0 && (
            <Section title="Exceptions">
              <List items={s.exceptions} />
            </Section>
          )}
          {s.risks?.length > 0 && (
            <Section title="Potential risks" accent="rose">
              <List items={s.risks} />
            </Section>
          )}
        </div>
      )}

      {/* Sources */}
      <Section title={`Sources & citations (${citations.length})`} accent="brand">
        {citations.length === 0 ? (
          <p className="text-ink-muted">
            No source could be grounded for this answer — treat it with extra caution and verify
            independently.
          </p>
        ) : (
          <ul className="space-y-3">
            {citations.map((c, i) => (
              <li key={c.id || i} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SourceTypeBadge type={c.source_type} />
                  <ConfidenceBadge level={c.confidence} />
                </div>
                <p className="mt-2 font-semibold text-ink">{c.title}</p>
                <p className="text-xs text-ink-muted">
                  {[c.authority, c.section, c.jurisdiction].filter(Boolean).join(" · ")}
                </p>
                {(c.published_date || c.effective_date) && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {c.published_date && `Published ${c.published_date}`}
                    {c.effective_date && ` · Effective ${c.effective_date}`}
                  </p>
                )}
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    View official source <External width={13} height={13} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Escalation / disclaimer */}
      {s.verify_with_professional && (
        <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm text-ink-soft">
          <p className="font-semibold text-ink">Verify with a professional</p>
          <p className="mt-1">{s.verify_with_professional}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-medium text-ink-muted">Was this helpful?</span>
        <button
          onClick={() => vote(true)}
          aria-pressed={voted === true}
          className={`btn-ghost !px-2.5 !py-1.5 ${voted === true ? "!bg-emerald-50 !text-emerald-700 !ring-emerald-200" : ""}`}
        >
          <Thumb width={15} height={15} /> Yes
        </button>
        <button
          onClick={() => vote(false)}
          aria-pressed={voted === false}
          className={`btn-ghost !px-2.5 !py-1.5 ${voted === false ? "!bg-rose-50 !text-rose-700 !ring-rose-200" : ""}`}
        >
          <Thumb width={15} height={15} className="rotate-180" /> No
        </button>
        <button onClick={save} disabled={saved} className="btn-subtle !px-2.5 !py-1.5">
          <Bookmark width={15} height={15} /> {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
