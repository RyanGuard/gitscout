/**
 * On-wall examples via Unsplash — every thumbnail shows ink/print/paint on a real substrate.
 * Not Seattle Wall Co. client work; replace with your install photography when available.
 */
export type GalleryCategory = "Office" | "Retail" | "Event" | "Hospitality" | "Mural";

export type GalleryItem = {
  id: string;
  title: string;
  category: GalleryCategory;
  outcome: string;
  src: string;
  width: number;
  height: number;
  photoCredit: string;
  secondarySrc?: string;
  secondaryWidth?: number;
  secondaryHeight?: number;
  secondaryAlt?: string;
  sliceLabels?: { primary: string; secondary: string };
};

export const galleryItems: GalleryItem[] = [
  {
    id: "wall-chalk-collab",
    title: "Seattle-area HQ — illustrated team wall",
    category: "Office",
    outcome:
      "Example of a full wall turned into a working surface: oversized illustrations and notes that read from the tables—common for SLU and Bellevue product teams who want culture on the drywall.",
    src: "https://images.unsplash.com/photo-1758873268877-3cd8ed329ed8?auto=format&fit=crop&w=1400&q=80",
    width: 1400,
    height: 933,
    photoCredit: "Unsplash — on-wall example (not our install)",
  },
  {
    id: "wall-mural-lounge",
    title: "Eastside lounge — printed scenic wrap",
    category: "Hospitality",
    outcome:
      "Floor-to-ceiling printed mural behind lounge seating shows how we think about sightlines from the entry—matte laminate optional for camera glare near glass walls.",
    src: "https://images.unsplash.com/photo-1765366417031-60bc8543189c?auto=format&fit=crop&w=1400&q=80",
    width: 1400,
    height: 933,
    photoCredit: "Unsplash — on-wall example (not our install)",
  },
  {
    id: "wall-immersive-landscape",
    title: "Reception immersion — landscape on gypsum",
    category: "Mural",
    outcome:
      "Wide landscape mural bonded flush to painted gypsum—useful reference when a Tacoma or Seattle client wants ‘Rainier room’ drama without a framed poster look.",
    src: "https://images.unsplash.com/photo-1735633740994-2d28026fe32e?auto=format&fit=crop&w=1400&q=80",
    width: 1400,
    height: 933,
    photoCredit: "Ingmar / Unsplash — on-wall example (not our install)",
  },
  {
    id: "wall-type-brick",
    title: "Brick loft — typographic wall program",
    category: "Mural",
    outcome:
      "Painted brick with large-scale lettering: substrate prep matters here—illustrative of Pioneer Square–style lofts and sublease creative floors.",
    src: "https://images.unsplash.com/photo-1722491713967-388b8aee8066?auto=format&fit=crop&w=1200&q=80",
    width: 1200,
    height: 800,
    photoCredit: "Unsplash — painted brick example (not our install)",
  },
  {
    id: "wall-graphic-brick",
    title: "Retail shell — high-contrast graphic masonry",
    category: "Retail",
    outcome:
      "Bold graphic on interior masonry—shows how we talk about alignment to mortar lines and expansion when briefing your GC.",
    src: "https://images.unsplash.com/photo-1722491714046-64ee4143d6cf?auto=format&fit=crop&w=1200&q=80",
    width: 1200,
    height: 800,
    photoCredit: "Unsplash — on-wall example (not our install)",
  },
  {
    id: "wall-monochrome-brick",
    title: "Wayfinding lane — monochrome lettering",
    category: "Mural",
    outcome:
      "Single-color lettering tight to corners—helpful reference for Ballard and Fremont hospitality clients who want signage baked into the architecture.",
    src: "https://images.unsplash.com/photo-1722491713991-7ff1fb2e203c?auto=format&fit=crop&w=1200&q=80",
    width: 1200,
    height: 800,
    photoCredit: "Unsplash — on-wall example (not our install)",
  },
  {
    id: "wall-restaurant-feature",
    title: "Bellevue-row dining — vertical feature finish",
    category: "Hospitality",
    outcome:
      "Warm dining room with wall treatments tying to banquettes—shows how vertical graphics meet wainscot and HVAC so nothing looks like an afterthought.",
    src: "https://images.unsplash.com/photo-1747737548299-888965e5ce77?auto=format&fit=crop&w=1400&q=80",
    width: 1400,
    height: 933,
    photoCredit: "Unsplash — on-wall example (not our install)",
  },
  {
    id: "wall-restaurant-ambient",
    title: "Night-service wall palette",
    category: "Hospitality",
    outcome:
      "Darker trade finish with art-forward walls—useful when discussing Tacoma–Seattle restaurant groups who need washes, murals, and durable topcoats in one scope.",
    src: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80",
    width: 1400,
    height: 933,
    photoCredit: "Unsplash — on-wall example (not our install)",
  },
];
