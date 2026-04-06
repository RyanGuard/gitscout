import { site } from "@/lib/site";

const highlights = [
  "Insured installs",
  "Seattle-based crew",
  "Color-managed workflow",
  "Lift & access planning",
] as const;

export function TrustRow() {
  return (
    <section className="border-y border-mist/80 bg-white py-7">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-muted sm:text-left">
            On-site in the Puget Sound
          </p>
          <ul className="flex flex-wrap justify-center gap-2 sm:justify-end">
            {highlights.map((label) => (
              <li key={label}>
                <span className="inline-block rounded-full border border-mist bg-cream px-3.5 py-1.5 text-[13px] font-medium text-ink-muted transition hover:border-accent/30">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-center text-[12px] text-muted sm:text-left">
          {site.serviceAreas.join(" · ")}
        </p>
      </div>
    </section>
  );
}
