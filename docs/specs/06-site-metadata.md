# Spec 06 — Site metadata, icons, manifest and share card

## Goal

Decide what a browser tab, a search result, a home-screen install and a link preview say about the dashboard, from one validated config. Today the root layout carries a bare title and description, the favicon is the create-next-app default, and a shared link previews as an empty card. After this spec every page has a titled tab, every shared link previews as a 1200×630 card in the dashboard's flame accent, and a bad config fails the build instead of shipping into every preview.

## Inputs

- `src/lib/site/config.ts` — the one `SITE` definition: name `slowquery`, the default title, the description, the production origin `https://slowquery-dashboard-frontend.vercel.app`, the accent `#f97316` (`--accent-flame`), keywords, the share card's copy (`// live dashboard for slowquery-detective`, headline `catch slow queries.` with `slow` highlighted — the home page's own h1) and the public routes (`/` and `/timeline` in the sitemap; nothing disallowed).
- The nav's brand tile from `<AppNav>`: the up-arrow-over-a-bar glyph (`M8 2v12M4 6l4-4 4 4M3 10h10`) in the flame accent on the surface colour.
- Geist Mono Regular and Bold, vendored as subset TTFs with their OFL licence under `src/lib/site/fonts/` (`next/og` cannot read the fonts `next/font` loads).

## Outputs

- `defineSite(input)` — parses the config when `config.ts` loads; returns a frozen `Site` with a derived `origin: URL`; throws `SiteConfigError` naming the reason.
- `rootMetadata(SITE)` and `ROOT_VIEWPORT` — exported as `metadata` and `viewport` from the root layout.
- `webManifest`, `robotsFile`, `sitemapEntries` — served by `src/app/manifest.ts`, `robots.ts` and `sitemap.ts` as `/manifest.webmanifest`, `/robots.txt` and `/sitemap.xml`.
- `src/app/opengraph-image.tsx` — the share card, rendered at build time with `next/og` from `<ShareCard>`.
- Icons: `src/app/icon.svg` (the source), `src/app/favicon.ico` (16, 32 and 48 px, replacing the stock one), `src/app/apple-icon.png` (180 px, full-bleed — iOS rounds the corners), and `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` (glyph inside the maskable safe zone) for the manifest.
- Page titles, each rendered as `<title> — slowquery` by the template:

  | Route | Title | Source |
  |---|---|---|
  | `/` | the default title, plus `alternates.canonical: "/"` | — |
  | `/timeline` | `live p95 timeline` | the page's h1 |
  | `/demo` | `demo` (was `slowquery dashboard demo`) | the nav label |
  | `/queries/[id]` | `query <first 8 chars of the id>` via `generateMetadata` | the route param, no fetch |

## Invariants

1. One config, parsed once at module load. `defineSite` rejects: a `url` that is not a URL, is not `https:`, or is not a bare origin (a path or a trailing slash); a host on the workspace's never-use list (`knowledge/infrastructure/infra-never-use-hosts.md` — strangers own those hosts); a name outside 1–12 characters (it doubles as the manifest's `short_name`); a title outside 1–70; a description outside 50–160 (search results cut longer ones; both bounds inclusive); an accent that is not `#rrggbb`; a highlight that is empty or not in the headline; a route that does not start with `/`; a sitemap route under a disallowed prefix.
2. `metadataBase` is the production origin, so every image URL in the head is absolute on it, whatever host serves the page.
3. The root sets no Open Graph `title`, `description` or `url` and no `alternates`: Next fills `og:title`/`og:description` from each page's own, and a root `og:url` or canonical would claim every page is the home page. Only the home page sets a canonical.
4. No page other than the root sets `openGraph` or `twitter` — a page-level `openGraph` replaces the root one and drops the share image. Next fills the Twitter title, description and image from Open Graph, so there is no `twitter-image`.
5. `theme-color` is the page background `#0a0a0a` and `color-scheme` is `dark`.
6. `robots.txt` allows `/`, disallows nothing (the dashboard has no machine endpoints of its own) and names the sitemap on the origin. Link-preview bots obey robots.txt, so a page that should stay out of search sets `robots: { index: false }` instead. `/demo` keeps spec 05's `noindex, nofollow` (invariant 6 there); `/`, `/timeline` and `/queries/[id]` are indexable — they show demo-backend data, not anyone's upload.
7. `generateMetadata` on `/queries/[id]` reads only the route param. It never calls the backend, so a slow or cold backend can never delay or break the head.
8. The share card's headline is set at the largest of 96/88/80/72/64/56/48 px at which it wraps, greedily, to at most two lines across the card's 1056 px content width. Every Geist Mono glyph advances 0.6 em, so the wrap is computed, not measured. `catch slow queries.` sets at 96 px (18 columns: `catch slow` / `queries.`).
9. Every metadata route is prerendered at build time (`○` in the build's route table).
10. The CSP in `next.config.ts` (`img-src 'self' data:`) is unchanged: every icon and the share card are same-origin.

## Enumerated test cases

### Happy

1. `defineSite` accepts the real config and derives its origin (`https://slowquery-dashboard-frontend.vercel.app/`).
2. `defineSite` accepts a valid example config.
3. Root metadata: `metadataBase` on the origin, title `{ default, template: "%s — slowquery" }`, description, application name, author, keywords, the iOS web-app title and status bar, `formatDetection` off.
4. Root Open Graph is exactly `{ type: "website", siteName: "slowquery", locale: "en_US" }`, Twitter is `{ card: "summary_large_image" }`, and there is no `alternates`.
5. The viewport is `{ themeColor: "#0a0a0a", colorScheme: "dark" }`.
6. The manifest names the site, opens at `/` standalone in the dark colours, lists 192 and 512 `any` icons and a 512 `maskable`, and each listed icon exists in `public/` at its declared size.
7. robots.txt allows `/` and names `https://slowquery-dashboard-frontend.vercel.app/sitemap.xml`; a site that declares machine endpoints gets them disallowed.
8. The sitemap lists `/` and `/timeline` as absolute URLs on the origin, once each. It never lists a noindex page, so `/demo` (noindex per spec 05) is left out.
9. `icon.svg` draws the glyph in the accent; `favicon.ico` holds 16, 32 and 48 px frames; `apple-icon.png` is 180×180.
10. The share card is 1200×630, its alt text is `slowquery — catch slow queries.`, it renders the name, the `//` comment, `slow` in the accent and the live host, and its assets load both Geist Mono weights and the icon as a data URI.
11. Page titles: `/` sets only `alternates.canonical: "/"`; `/timeline` is `live p95 timeline`; `/demo` is `demo`; `/queries/c168fc78a2e7d01c` resolves to `query c168fc78`.

### Edge

12. A description of exactly 160 characters is accepted (the real one is that long); 161 is rejected. A title of exactly 70 is accepted.
13. Headline layout: words are split with the highlight marked but not its punctuation; a highlight spanning words marks each; segments are keyed by offset; the greedy wrap breaks at the column; the size steps from 96 to 88 exactly at the two-line boundary; nothing fitting falls back to 48; the real headline sets at 96.
14. `rgba("#f97316", 0.25)` is `rgba(249, 115, 22, 0.25)`, and hex case does not matter.
15. No page sets `openGraph` or `twitter`, and only the home page sets `alternates`.

### Failure

16. `defineSite` rejects, with a `SiteConfigError` naming the reason: a non-URL, an `http:` origin, an origin with a path, a trailing slash, an empty name, a name over 12 characters, a title over 70, a description under 50 or over 160, an accent that is not `#rrggbb`, an empty highlight, a highlight missing from the headline, a route without a leading slash, a sitemap route that robots.txt disallows.
17. `headlineWords` throws on a highlight the headline does not contain.
18. `/queries/[id]`'s `generateMetadata` makes no request (MSW's `onUnhandledRequest: "error"` would fail it) and titles even an id the page will 404 on, without validating it.

### Security

19. Every never-use host is rejected as the site origin.
20. Only `/demo` is `noindex`; robots.txt disallows nothing, so a shared link to any page still previews.

### E2E (Playwright, `tests/e2e/metadata.spec.ts`)

21. The home page's head carries the default title, the description, `og:title`, `twitter:card` `summary_large_image`, `theme-color`, the SVG icon, the apple-touch icon and the manifest link; `og:image` and `twitter:image` are the same `/opengraph-image` URL and it serves a PNG. The image is on the production origin in a production build (checked by hand against `pnpm start`); under `next dev`, which the Playwright webServer runs, Next deliberately resolves file-convention images against the dev server's own origin, so the spec accepts either.
22. `/timeline`'s own title flows into `og:title` as `live p95 timeline — slowquery`.
23. The home page has no robots meta.
24. Every metadata route answers 200 with its content type: `/opengraph-image` and `/apple-icon.png` and `/icon-512.png` PNG, `/icon.svg` SVG, `/favicon.ico` an icon, `/manifest.webmanifest` `application/manifest+json`, `/robots.txt` `text/plain`, `/sitemap.xml` `application/xml`.

## Acceptance criteria

- [ ] `src/lib/site/{define,config,metadata,share-card,assets}.ts(x)` and the vendored fonts exist
- [ ] `src/app/{manifest,robots,sitemap}.ts` and `src/app/opengraph-image.tsx` exist and are prerendered (`○`) by `pnpm build`
- [ ] The root layout exports `metadata = rootMetadata(SITE)` and `viewport = ROOT_VIEWPORT`; fonts and body classes unchanged
- [ ] The stock `favicon.ico` and the create-next-app SVGs in `public/` are gone
- [ ] Cases 1–20 have Vitest cases under `tests/lib/site/*` and `tests/app/*`; cases 21–24 are in `tests/e2e/metadata.spec.ts`
- [ ] Biome clean, tsc strict clean, coverage thresholds green
