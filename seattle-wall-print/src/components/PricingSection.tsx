import Link from "next/link";

const tiers = [
  {
    name: "Focused accent",
    range: "$3.5k – $7k",
    detail:
      "Single wall, modest height, artwork ready to print. Best for startups refreshing one hero surface.",
    featured: false,
  },
  {
    name: "Signature program",
    range: "$8k – $18k",
    detail:
      "Multi-panel narratives, color proofing, and lift access. Common for HQ refreshes and flagship retail.",
    featured: true,
  },
  {
    name: "Campus + rollout",
    range: "Custom",
    detail:
      "Phased installs, documentation packs for facilities teams, and optional retainer for new sites.",
    featured: false,
  },
];

const drivers = [
  "Wall height and lift requirements",
  "Surface prep or priming",
  "Design creation vs. print-ready files",
  "After-hours or weekend access",
  "Rush timelines",
  "Travel outside core Puget Sound service area",
];

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-28 bg-deep-elevated px-5 py-24 text-cloud sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow text-accent-soft">Pricing guide</p>
        <h2 className="mt-6 max-w-2xl font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          Ranges you can plan against—not a bait-and-switch
        </h2>
        <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-cloud/65">
          Every wall is different. These bands help you budget; your final quote locks after photos or a site
          visit confirms measurements, access, and finishes.
        </p>

        <div className="mt-14 grid gap-5 lg:grid-cols-3 lg:items-stretch lg:gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border p-7 transition ${
                tier.featured
                  ? "border-accent/40 bg-white/[0.07] pt-9 shadow-[0_0_0_1px_rgba(184,148,31,0.2)] ring-1 ring-accent/30 lg:-translate-y-1 lg:py-10 lg:pt-12"
                  : "border-white/10 bg-white/[0.03] hover:border-white/15"
              }`}
            >
              {tier.featured ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
                  Most common
                </span>
              ) : null}
              <h3 className="font-display text-xl font-semibold text-cloud">{tier.name}</h3>
              <p className="mt-4 font-display text-3xl font-semibold tracking-tight text-accent-soft md:text-[2rem]">
                {tier.range}
              </p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-cloud/70">{tier.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-white/10 bg-slate-mid/40 p-7 sm:p-9">
          <h3 className="font-display text-lg font-semibold text-cloud">What moves the number</h3>
          <ul className="mt-5 grid gap-3 text-sm text-cloud/75 sm:grid-cols-2">
            {drivers.map((d) => (
              <li key={d} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>{d}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 border-t border-white/10 pt-6 text-xs leading-relaxed text-cloud/50">
            Ranges are estimates for planning—not a binding offer. Contracts and signed proposals govern scope.
          </p>
        </div>

        <div className="mt-12">
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-7 text-sm font-semibold text-ink transition hover:bg-accent-hover"
          >
            Tell us about your wall
          </Link>
        </div>
      </div>
    </section>
  );
}
