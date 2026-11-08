# Purely — how real is your food?

Scan a food barcode and get a **purity score out of 100**: how close the product is to the pure,
whole ingredient it's meant to be. Apple = 100, butter ≈ 99, tinned tomatoes ≈ 94, battered fish ≈ 45,
nitrite-cured sausage = 0.

Product data comes from [Open Food Facts](https://world.openfoodfacts.org) (free, open, no API key).
The score is calculated on the phone by `index.html` — no server, no account.

## Put it on your phone (GitHub Pages, ~3 minutes)

1. Create a new GitHub repo (e.g. `purely`) and upload **every file in this folder** to the root.
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / root → Save.
3. Open `https://<your-username>.github.io/purely/` on your phone.
4. **iPhone (Safari):** Share → *Add to Home Screen*. **Android (Chrome):** ⋮ → *Install app*.

It now opens full-screen from its own icon, uses the camera to scan, and keeps your scan history.
(The camera needs HTTPS, which GitHub Pages gives you.)

## Files
- `index.html` — the whole app (UI + scanner + scoring engine)
- `manifest.webmanifest`, `sw.js`, `icon*.png`, `icon.svg` — make it installable and open offline

## Tuning the score
The rules live in the `RULES` table near the top of the scoring script in `index.html`
(search for `const RULES`). Each rule is a pattern, a category and a points penalty — change a number,
re-upload, done.

## Developing
- Edit `src/scoring.js` (the rules) or `src/index.html` (the UI), then run `python3 build.py` to rebuild the root `index.html`.
- `node test.js` prints scores for a set of reference foods so you can check calibration after tweaking.
