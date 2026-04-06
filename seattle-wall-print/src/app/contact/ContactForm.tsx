"use client";

import { submitContact, type ContactState } from "@/app/actions/contact";
import { useActionState } from "react";

const initialState: ContactState = { status: "idle" };

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, initialState);

  return (
    <form action={formAction} className="mt-10 space-y-6">
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        className="sr-only"
        aria-hidden
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-semibold text-ink">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            className="mt-2 w-full rounded-xl border border-mist bg-white px-4 py-3 text-sm outline-none ring-accent/30 transition focus:ring-2"
            autoComplete="name"
          />
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-ink">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-2 w-full rounded-xl border border-mist bg-white px-4 py-3 text-sm outline-none ring-accent/30 transition focus:ring-2"
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <label htmlFor="organization" className="text-sm font-semibold text-ink">
          Organization <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="organization"
          name="organization"
          className="mt-2 w-full rounded-xl border border-mist bg-white px-4 py-3 text-sm outline-none ring-accent/30 transition focus:ring-2"
        />
      </div>

      <div>
        <label htmlFor="location" className="text-sm font-semibold text-ink">
          Wall location / neighborhood
        </label>
        <input
          id="location"
          name="location"
          required
          placeholder="e.g. Downtown Seattle — 8th & Pike"
          className="mt-2 w-full rounded-xl border border-mist bg-white px-4 py-3 text-sm outline-none ring-accent/30 transition focus:ring-2"
        />
      </div>

      <div>
        <label htmlFor="wallDetails" className="text-sm font-semibold text-ink">
          Wall size or photos
        </label>
        <textarea
          id="wallDetails"
          name="wallDetails"
          rows={3}
          placeholder="Approximate width × height, surface type, link to Dropbox, etc."
          className="mt-2 w-full rounded-xl border border-mist bg-white px-4 py-3 text-sm outline-none ring-accent/30 transition focus:ring-2"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="timeline" className="text-sm font-semibold text-ink">
            Ideal install timeline
          </label>
          <input
            id="timeline"
            name="timeline"
            placeholder="e.g. Before March 15"
            className="mt-2 w-full rounded-xl border border-mist bg-white px-4 py-3 text-sm outline-none ring-accent/30 transition focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="budget" className="text-sm font-semibold text-ink">
            Budget comfort zone
          </label>
          <select
            id="budget"
            name="budget"
            className="mt-2 w-full rounded-xl border border-mist bg-white px-4 py-3 text-sm outline-none ring-accent/30 transition focus:ring-2"
            defaultValue=""
          >
            <option value="" disabled>
              Select a range
            </option>
            <option value="Under $5k">Under $5k</option>
            <option value="$5k – $10k">$5k – $10k</option>
            <option value="$10k – $20k">$10k – $20k</option>
            <option value="$20k+">$20k+</option>
            <option value="Not sure yet">Not sure yet</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="message" className="text-sm font-semibold text-ink">
          Project notes
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          placeholder="Creative direction, stakeholders, building constraints…"
          className="mt-2 w-full rounded-xl border border-mist bg-white px-4 py-3 text-sm outline-none ring-accent/30 transition focus:ring-2"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cloud transition hover:bg-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Sending…" : "Send project details"}
      </button>

      {state.status === "success" ? (
        <p className="text-sm font-medium text-emerald-700" role="status">
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
