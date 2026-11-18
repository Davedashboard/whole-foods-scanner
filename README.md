# Whole Food Scanner

Scan a food barcode and get a **purity score out of 100**: how close the product is to the pure,
whole ingredient it's meant to be. Apple = 100, butter ≈ 99, tinned tomatoes ≈ 94, battered fish ≈ 45,
nitrite-cured sausage = 0.

Product data comes from [Open Food Facts](https://world.openfoodfacts.org) (free, open, no API key).
The score is calculated on the phone by `index.html` — no server, no account.

## Put it on your phone

1. Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
2. After a minute, open **https://davedashboard.github.io/whole-foods-scanner/** on your phone.
3. **iPhone (Safari):** Share → *Add to Home Screen*. **Android (Chrome):** ⋮ → *Install app*.

## Files
- `index.html` — the whole app (UI + scanner + scoring engine)
- `manifest.webmanifest`, `sw.js`, `icon*.png`, `icon.svg` — make it installable and open offline

## Tuning the score
The rules live in the `RULES` table near the top of the scoring script in `index.html`
(search for `const RULES`). Each rule is a pattern, a category and a points penalty — change a number,
re-upload, done.

## Offline food database
To make lookups instant, the app downloads a UK slice of Open Food Facts onto the phone (IndexedDB) and
checks it before going online. A GitHub Action (`.github/workflows/build-db.yml`) rebuilds it every Monday
from the Open Food Facts export using `tools/build-db.js`, and publishes `uk.ndjson.gz` + `meta.json` to the
`db` branch (force-pushed, so history doesn't grow). Run it any time from **Actions → Build UK food database
→ Run workflow**. The phone scores ingredients itself, so changing the scoring rules never needs a rebuild.

Lookup order: products you've scanned before → phone database → Open Food Facts API (v3 and v2 in parallel,
7 s limit).

## Developing
- Edit `src/scoring.js` (the rules) or `src/index.html` (the UI), then run `python3 build.py` to rebuild the root `index.html`.
- `node test.js` prints scores for a set of reference foods so you can check calibration after tweaking.
