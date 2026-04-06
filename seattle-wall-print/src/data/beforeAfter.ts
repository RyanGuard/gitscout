/**
 * Same-site before / after only: both frames must be the same wall/room on the same job.
 * Append objects here as you document installs (photo 1 = pre-print, photo 2 = finished).
 *
 * Example:
 * {
 *   id: "slu-2026-01",
 *   neighborhood: "South Lake Union",
 *   context: "Reception — primer to brand mural",
 *   beforeSrc: "/projects/slu-reception-before.jpg",
 *   afterSrc: "/projects/slu-reception-after.jpg",
 *   beforeAlt: "Seattle Wall Co. — SLU reception wall before install",
 *   afterAlt: "Seattle Wall Co. — same wall after graphics",
 * }
 */
export type BeforeAfterItem = {
  id: string;
  neighborhood: string;
  context: string;
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
};

/** Intentionally empty until verified same-location pairs exist. */
export const beforeAfterItems: BeforeAfterItem[] = [];
