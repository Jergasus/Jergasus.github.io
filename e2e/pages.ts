// Every page the static export ships: three home pages and three case pages
// per locale. Spanish lives at the root, Catalan and English under a prefix.
const PREFIXES = ['', '/ca', '/en'] as const;
const CASE_SLUGS = ['questday', 'sakurai', 'rally-voley'] as const;

export const HOME_PAGES = PREFIXES.map((prefix) => `${prefix}/`);

export const CASE_PAGES = PREFIXES.flatMap((prefix) =>
  CASE_SLUGS.map((slug) => `${prefix}/work/${slug}/`),
);

export const ALL_PAGES = [...HOME_PAGES, ...CASE_PAGES];
