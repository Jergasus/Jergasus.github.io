# Jesús García — Portfolio

Personal portfolio site for Jesús García ([@Jergasus](https://github.com/Jergasus)), built with Next.js 16 static export, Tailwind CSS v4, next-intl and GSAP. Spanish at `/`, Catalan at `/ca/`, English at `/en/`.

The site is **JG-OS**, an original retro operating system: on a large screen (64 rem and up) a desktop with windows, a taskbar and a start menu; on a phone a home screen with apps. Without JavaScript, and in print, the same HTML reads as a plain document with every window stacked in order.

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
| Any copy | `messages/es.json`, `messages/ca.json`, `messages/en.json`; the three keep the same keys (a unit test checks). OS chrome lives under `os.*` (app titles and labels in `os.apps`, boot lines in `os.boot`, terminal in `os.terminal`, wizard in `os.wizard`, phone in `os.phone`); case studies under `caseStudies.*` |
| Projects (order, status, links, stack) | `src/content/projects.ts` |
| Email, WhatsApp, LinkedIn, GitHub | `src/content/contact.ts` |
| Which repo and branch each project's activity comes from | `src/lib/activity-sources.ts` (build-only; never imported by pages or components) |
| Colours, type scale, geometry | `src/design/os-tokens.css` (day and night); window and layout styles in `src/os/os.css` |
| Animation timing | `src/design/motion.ts`, the only place motion timing lives; the sequences themselves are in `src/os/shell/motion.ts`, the only module that calls GSAP |
| Terminal commands | `src/os/terminal/commands.ts` (pure, unit tested) |

Pushing to `main` deploys the change.

### The OS

- **Apps.** `src/os/apps.ts` is the registry: one `AppDef` per app with its id, message key, titlebar colour, default window rect (fractions of the desktop), minimum size, where it shows (`desktopIcon`, `phoneIcon`, `inStartMenu`) and `interactiveOnly` (left out of the document, like the terminal). `DESKTOP_ICON_ORDER` and `PHONE_ICON_ORDER` set the icon order. Each app's window content is a component in `src/os/apps/`; `src/os/OsWindows.tsx` puts them in their `WindowFrame`s, server-rendered with their full content.
- **Shell.** `src/os/OsRoot.tsx` owns the window state (`src/os/window-manager.ts`, a tested reducer); the taskbar, start menu, context menu, desktop icons, boot screen and toasts are in `src/os/shell/`; the phone home screen in `src/os/phone/`.
- **Case windows and URLs.** QuestDay, SakurAI and Rally Voley open at `/work/<slug>/` (with `/ca` or `/en` in front). Each URL is a static page whose own HTML holds that project's window (`src/os/CaseWindow.tsx`), so crawlers and visitors without JavaScript get the whole case study. Several project windows can be open at once: the URL names the one in front, closing it moves the URL to the next open project or to `/`, and back and forward follow it. Yokaido has no case page; its window is a card on the home page.
- **Wallpapers and theme.** The wallpapers are `--os-wp-*` tokens in `src/design/os-tokens.css` (the Barcelona one is `public/wallpapers/barcelona.svg`), listed in `WALLPAPERS` in `src/os/prepaint.ts`. Night mode follows `prefers-color-scheme`, and the tray toggle forces it with `html[data-theme="dark"]`. `--os-desk` must match `src/design/theme-color.ts` (a test checks).
- **Storage.** Choices live in `localStorage`: `jgos-wallpaper`, `jgos-theme` and `jgos-booted`; window positions and the once-per-visit toasts in `sessionStorage` (`jgos-windows`, `jgos-toasts`). Key names come from `PREF_KEYS` in `src/os/storage.ts`, every access is wrapped in try/catch, and the site works with storage blocked.
- **Before the first paint.** `src/os/prepaint.ts` is inlined in `<head>`: it sets `data-os` (desktop or phone), `data-wallpaper`, `data-theme` and, on a first visit without reduced motion, `data-boot`.
- **Boot screen.** `src/os/shell/BootScreen.tsx`: first visit only, about one second, skipped by any key, click or tap. It sits on top of the desktop, which renders underneath from the start, so it never delays content. The lines use real numbers from the activity snapshot.

### Adding an app

1. Add its id to `AppId` and an `AppDef` to `apps` in `src/os/apps.ts`; place it in `DESKTOP_ICON_ORDER` and `PHONE_ICON_ORDER` if it has icons.
2. Write its window content in `src/os/apps/<Name>App.tsx` and add it to the list in `src/os/OsWindows.tsx`.
3. Draw its icon in `src/os/icons/<Name>Icon.tsx` (40 × 40 viewBox, black outline, flat fill, `aria-hidden`) and register it in `APP_ICONS` (`src/os/icons/index.ts`).
4. Add `os.apps.<messageKey>.title` and `.label`, plus any copy it needs, to all three message files. A client component may only read namespaces in `CLIENT_NAMESPACES` (`src/i18n/client-messages.ts`).
5. Optionally, give it a terminal word in `APP_WORDS` (`src/os/terminal/commands.ts`).
6. Tests: `src/os/apps.test.ts` and `src/content/icons.test.ts` check the registry, messages and icon; add Playwright coverage for what it does, and run `e2e/a11y.spec.ts`, which scans every app window with axe by day and by night.

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
