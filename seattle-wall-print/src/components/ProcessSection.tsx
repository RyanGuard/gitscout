const steps = [
  {
    title: "Discovery",
    body: "We review your wall, timeline, and creative direction—photos, plans, or an on-site walkthrough in Seattle or the Eastside.",
  },
  {
    title: "Design & approval",
    body: "Color-managed proofs, substrate checks, and a clear install plan so facilities and marketing stay aligned.",
  },
  {
    title: "Print day",
    body: "Protected floors, controlled curing, and quiet coordination with building managers—most installs finish without drama.",
  },
  {
    title: "Walkthrough & care",
    body: "Punch list, care notes, and optional maintenance schedule. We want the wall to look intentional on day 300, not just day one.",
  },
];

export function ProcessSection() {
  return (
    <section id="process" className="scroll-mt-28 bg-white px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow">Process</p>
        <h2 className="mt-6 max-w-2xl font-display text-3xl font-medium tracking-tight text-ink text-balance sm:text-4xl">
          From first email to final photo—with zero ambiguity
        </h2>
        <ol className="mt-16 grid gap-5 md:grid-cols-2 md:gap-6">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-mist/90 bg-gradient-to-br from-cream/50 to-white p-7 shadow-[0_1px_3px_rgba(10,12,15,0.04)] transition hover:border-accent/25 md:pt-8"
            >
              <div className="flex items-start gap-4">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-mist bg-white font-display text-lg font-semibold text-accent shadow-sm"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold text-ink">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
