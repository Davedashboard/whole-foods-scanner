#!/usr/bin/env node
// Builds the on-phone food database from the Open Food Facts CSV export.
//   node tools/build-db.js en.openfoodfacts.org.products.csv.gz out/
// Keeps UK products that have an ingredients list (plus fresh single foods), and writes:
//   out/uk.ndjson.gz  one compact JSON record per line
//   out/meta.json     { version, built, count, bytes }
// The phone scores the ingredients itself, so changing the scoring rules never needs a rebuild.
'use strict';
const fs = require('fs'), zlib = require('zlib'), readline = require('readline'), path = require('path');

const [src, outDir] = process.argv.slice(2);
if (!src || !outDir) { console.error('usage: build-db.js <products.csv.gz> <outDir>'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const COUNTRY = /(^|,)en:united-kingdom(,|$)/;
const FRESH = /fresh|en:fruits|en:vegetables|en:plain-|en:eggs|en:milks/;
const clip = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

async function main() {
  const input = fs.createReadStream(src).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const gz = zlib.createGzip({ level: 9 });
  const outPath = path.join(outDir, 'uk.ndjson.gz');
  const out = gz.pipe(fs.createWriteStream(outPath));

  let cols = null, rows = 0, kept = 0;
  const seen = new Set();
  for await (const line of rl) {
    const f = line.split('\t');
    if (!cols) { cols = Object.fromEntries(f.map((h, i) => [h, i])); continue; }
    rows++;
    const get = k => (cols[k] != null ? f[cols[k]] || '' : '');
    if (!COUNTRY.test(get('countries_tags'))) continue;
    const code = get('code').replace(/\D/g, '');
    if (code.length < 8 || seen.has(code)) continue;
    const ingredients = clip(get('ingredients_text_en') || get('ingredients_text'), 2000);
    const nova = parseInt(get('nova_group'), 10) || 0;
    const cats = get('categories_tags');
    const fresh = FRESH.test(cats) ? 1 : 0;
    if (!ingredients && !(nova === 1 || fresh)) continue;
    const name = clip(get('product_name_en') || get('product_name') || get('generic_name'), 80);
    if (!name && !ingredients) continue;
    const rec = { c: code, n: name };
    const brand = clip((get('brands') || '').split(',')[0], 40); if (brand) rec.b = brand;
    const qty = clip(get('quantity'), 20); if (qty) rec.q = qty;
    if (ingredients) rec.i = ingredients;
    const add = get('additives_tags').split(',').filter(Boolean).map(t => t.replace(/^en:/, '')); if (add.length) rec.a = add;
    if (nova) rec.v = nova;
    if (fresh) rec.f = 1;
    seen.add(code);
    if (!gz.write(JSON.stringify(rec) + '\n')) await new Promise(r => gz.once('drain', r));
    kept++;
    if (rows % 500000 === 0) console.log(`${rows} rows read, ${kept} kept`);
  }
  if (!cols) throw new Error('empty export');
  for (const k of ['code', 'countries_tags', 'product_name', 'ingredients_text', 'additives_tags', 'nova_group']) {
    if (cols[k] == null) throw new Error('export is missing column ' + k);
  }
  gz.end();
  await new Promise(r => out.on('finish', r));
  const bytes = fs.statSync(outPath).size;
  const built = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ version: built, built, count: kept, bytes }) + '\n');
  console.log(`done: ${rows} rows, ${kept} UK products, ${(bytes / 1e6).toFixed(1)} MB`);
  if (kept < 1000) throw new Error('suspiciously few products — not publishing');
}
main().catch(e => { console.error(e); process.exit(1); });
