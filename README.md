# Jesús García — Portfolio

Personal portfolio site for Jesús García ([@Jergasus](https://github.com/Jergasus)), built with Next.js 16 static export, Tailwind CSS v4, and next-intl. Spanish at `/`, Catalan at `/ca/`, English at `/en/`.

## Commands

```bash
npm run dev        # development server
npm run build      # static export → out/
npm run test       # unit tests (vitest)
npm run test:e2e   # end-to-end tests (playwright, on a production build)
npm run activity   # refresh data/activity.json (needs ACTIVITY_TOKEN)
```

## Maintaining the site

### Where things live

| To change | Edit |
|---|---|
| Availability and "currently building" | `content/status.json`: `available` (true/false) picks the hero's default wording; the optional `availabilityLabel` (es, ca, en) replaces it and must change whenever `available` does; `currentlyBuilding` is one line per language (empty: the most recently committed project) |
| Any copy | `messages/es.json`, `messages/ca.json`, `messages/en.json`; the three keep the same keys (a unit test checks) |
| Projects (order, status, links, stack) | `src/content/projects.ts` |
| Email, WhatsApp, LinkedIn, GitHub | `src/content/contact.ts` |
| Which repo and branch each project's activity comes from | `src/lib/activity-sources.ts` (build-only; never imported by pages or components) |
| Colours, type scale, geometry | `src/design/os-tokens.css` (day and night); window and layout styles in `src/os/os.css` |
| Animation timing | `src/design/motion.ts`, the only place motion timing lives |

Pushing to `main` deploys the change.

### Deploy and daily refresh

`.github/workflows/deploy.yml` runs on every push to `main`, every day at 05:17 UTC, and on demand from the Actions tab. It refreshes the activity numbers from the GitHub API, runs the unit tests, builds, and deploys to GitHub Pages. If the activity fetch fails, the site still deploys with the last known numbers and the run is marked failed, so GitHub emails about it. GitHub pauses the daily run after 60 days without commits. [docs/activity-token.md](docs/activity-token.md) covers both, and how to create and rotate the `ACTIVITY_TOKEN` secret.

### Custom domain

1. Add `public/CNAME` with the bare hostname (for example `jesusgarcia.dev`). Every absolute URL (canonical, hreflang, Open Graph, sitemap, robots) follows it.
2. Set the same domain in the repository's **Settings → Pages** and point its DNS at GitHub Pages.
3. Re-run `npx tsx scripts/generate-og.ts` so the share images show the new host, and commit them.

### Images

- `npm run images` optimises the project previews in `assets/raw-previews/` (capture them with `npx tsx scripts/capture-previews.ts`).
- `npm run images -- /path/to/portrait.jpg` (or `ABOUT_SRC=/path/to/portrait.jpg`) also rebuilds the about photo.

## License

[MIT](LICENSE)
