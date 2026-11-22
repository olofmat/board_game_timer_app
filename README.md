# Board Game Timer

Times a board game on a single phone so the group can see who plays slowly and which shared parts of the game (fights, buying phases) eat up the evening. A Progressive Web App served from GitHub Pages (see `docs/adr/0001-pwa-on-github-pages.md`). Domain terms are in `GLOSSARY.md`.

**App URL:** https://olofmat.github.io/board_game_timer_app/

## One-time setup: enable GitHub Pages

Deploys come from the GitHub Actions workflow in `.github/workflows/deploy.yml`, which needs Pages switched on once:

1. On GitHub, open the repo → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Re-run the latest "Deploy to GitHub Pages" workflow (Actions tab → the workflow → **Run workflow**), or push to `main`.

After that, every push to `main` runs typecheck → tests → build and deploys only if all pass. A failing step leaves the previously deployed app in place.

## Install the app on a phone

Open the app URL in the phone's browser, then:

- **Android (Chrome):** menu ⋮ → **Add to Home screen** / **Install app**.
- **iPhone (Safari):** Share button → **Add to Home Screen**. (It has to be Safari on iOS.)

The app then opens full screen from the home screen icon and works offline. Updates arrive automatically: after a deploy, the next time the app is opened with a connection it fetches the new version (reopen it once more if you still see the old one).

## Development

Needs Node 22.12 or newer. `.nvmrc` says Node 22: run `nvm install` to get the latest 22.x (an older 22.x such as 22.11 is too old for Vite).

```sh
npm install
npm run dev        # local dev server
npm run typecheck
npm test           # Vitest, single run (npm run test:watch to watch)
npm run build      # production build into dist/
npm run preview    # serve dist/ locally
```
