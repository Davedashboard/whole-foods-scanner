/* Whole Food Scanner — purity scoring engine.
 * Scores how close a food is to its pure, whole-ingredient form (0–100).
 * 100 = a whole food as nature made it (apple, milk, coffee beans, sea salt).
 * 0   = ultra-processed (nitrite-cured meats, sweetener/colour-laden products).
 *
 * Works from an ingredients list (text, or Open Food Facts structured data).
 */
(function (root) {
  'use strict';

  // ---------- Rule tables ----------
  // kind: whole | minimal | refined | marker | additive | cosmetic | severe
  // pts: base penalty. cap: hard ceiling on final score when present.
  // Order matters: first match wins, so specific patterns come before general ones.

  const RULES = [
    // ---- Severe: processed-meat curing agents ----
    { re: /\b(sodium|potassium) nitrite|\bnitrite|\be ?25[01]\b/, kind: 'severe', pts: 45, cap: 5, label: 'Nitrite (curing agent)', why: 'Nitrites are used to cure processed meat and are linked to cancer risk. Automatic near-zero score.' },
    { re: /\b(sodium|potassium) nitrate|\bnitrate|\be ?25[23]\b/, kind: 'severe', pts: 40, cap: 10, label: 'Nitrate (curing agent)', why: 'Nitrates convert to nitrites in cured meats.' },

    // ---- Artificial sweeteners ----
    { re: /aspartame|sucralose|acesulfame|saccharin|cyclamate|neotame|advantame|\be ?95[0-9]\b|\be ?96[0-9]\b/, kind: 'cosmetic', pts: 25, cap: 30, label: 'Artificial sweetener', why: 'Lab-made sweetener with no place in a whole-food kitchen.' },
    { re: /steviol|stevia|\be ?960\b|sorbitol|maltitol|xylitol|erythritol|isomalt|\be ?420\b|\be ?421\b|\be ?953\b|\be ?965\b|\be ?967\b|\be ?968\b/, kind: 'cosmetic', pts: 15, label: 'Sweetener / polyol', why: 'Industrial sweetener used to replace sugar.' },

    // ---- Colours ----
    { re: /caramel colou?r|\be ?150[a-d]\b|plain caramel|ammonia caramel|sulphite ammonia caramel/, kind: 'cosmetic', pts: 20, label: 'Caramel colour', why: 'Added purely to change appearance.' },
    { re: /tartrazine|sunset yellow|quinoline|carmoisine|azorubine|ponceau|allura|brilliant blue|indigo carmine|patent blue|erythrosine|titanium dioxide|\be ?1(0[24]|1[0-2]|2[0-9]|3[0-3]|4[23]|5[1-5])\b|\be ?171\b|\be ?18[0-2]\b/, kind: 'cosmetic', pts: 22, label: 'Artificial colour', why: 'Synthetic colouring, some linked to hyperactivity in children.' },
    { re: /paprika extract|beta.?carotene|carotene|annatto|curcumin|turmeric extract|beetroot red|anthocyanin|chlorophyll|lutein|lycopene|riboflavin|spirulina|\be ?1(00|01|40|41|60[a-f]?|61[a-z]?|62|63)\b/, kind: 'additive', pts: 2, label: 'Natural colour', why: 'Colour from a natural source — mild, but still added for looks.' },
    { re: /\bcolou?rs?\b|\bcolou?ring\b/, kind: 'cosmetic', pts: 12, label: 'Colouring', why: 'Added to change appearance.' },

    // ---- Flavourings & enhancers ----
    { re: /monosodium glutamate|\bmsg\b|\be ?62[0-5]\b|\be ?6(2[6-9]|3[0-5])\b|disodium (inosinate|guanylate|ribonucleotides)|flavou?r enhancer/, kind: 'cosmetic', pts: 18, label: 'Flavour enhancer', why: 'Engineered to make food more moreish than it naturally is.' },
    { re: /yeast extract|hydroly[sz]ed (vegetable |soy|soya|wheat |corn |maize )?protein|autolysed yeast/, kind: 'marker', pts: 8, label: 'Yeast extract / hydrolysed protein', why: 'Hidden glutamate flavour booster — a classic ultra-processed marker.' },
    { re: /smoke flavou?r|liquid smoke/, kind: 'marker', pts: 8, label: 'Smoke flavouring', why: 'Flavour added industrially rather than by smoking.' },
    { re: /natural .{0,15}flavou?r|flavou?rings?|aromas?\b|\bflavou?rs?\b/, kind: 'marker', pts: 10, label: 'Flavouring', why: 'Flavour made in a lab or factory to imitate or boost real food.' },

    // ---- Sugars / syrups (UPF markers) ----
    { re: /glucose.?fructose|fructose.?glucose|high fructose|corn syrup|glucose syrup|invert(ed)? sugar|golden syrup|rice syrup|isoglucose|sugar syrup|caramelised sugar syrup/, kind: 'marker', pts: 12, label: 'Industrial syrup', why: 'Refined syrup — a hallmark of ultra-processed food.' },
    { re: /\bdextrose\b|maltodextrin|\bglucose\b|\bfructose\b|\bmaltose\b|polydextrose|oligofructose|dextrin/, kind: 'marker', pts: 8, label: 'Refined sugar derivative', why: 'Industrially extracted sugar, rarely used at home.' },
    { re: /cane sugar|beet sugar|brown sugar|caster sugar|icing sugar|demerara|muscovado|\bsugars?\b/, kind: 'refined', pts: 8, label: 'Sugar', why: 'Refined sugar.' },
    { re: /\bhoney\b|maple syrup|date syrup|agave|molasses|treacle|coconut sugar/, kind: 'minimal', pts: 3, label: 'Natural sweetener', why: 'Less refined, but still added sweetness.' },

    // ---- Fats ----
    { re: /hydrogenated|interesterified|shortening|margarine/, kind: 'marker', pts: 15, label: 'Hydrogenated / industrial fat', why: 'Chemically altered fat — strongly ultra-processed.' },
    { re: /palm (fat|oil|kernel|stearin|olein)|\bpalm\b|vegetable fats?\b/, kind: 'refined', pts: 6, label: 'Palm / vegetable fat', why: 'Industrially refined fat.' },
    { re: /extra.?virgin|cold.?pressed|virgin olive|olive oil/, kind: 'minimal', pts: 1, label: 'Olive oil', why: 'Minimally pressed oil.' },
    { re: /rapeseed|canola|sunflower( seed)? oil|soya ?bean oil|soybean oil|soya oil|corn oil|maize oil|cottonseed|vegetable oils?|\boils?\b|coconut oil|groundnut oil|peanut oil|safflower|rice bran oil/, kind: 'refined', pts: 3, label: 'Refined seed oil', why: 'Refined, solvent-extracted seed oil.' },

    // ---- Proteins, powders, isolates ----
    { re: /protein isolate|protein concentrate|isolated (soy|soya|pea|whey)|soy(a)? protein|pea protein|wheat protein|textured|mycoprotein|collagen|gelatine?/, kind: 'marker', pts: 10, label: 'Protein isolate', why: 'Industrially extracted protein — a common ultra-processed building block.' },
    { re: /mechanically (separated|recovered)/, kind: 'marker', pts: 15, label: 'Mechanically separated meat', why: 'Meat paste stripped from bones by machine.' },
    { re: /whey|milk powder|skimmed milk powder|dried milk|milk solids|lactose|caseinate|milk protein|buttermilk powder|cream powder|cheese powder|egg powder|dried egg|dried whole egg/, kind: 'refined', pts: 4, label: 'Dried / fractioned dairy', why: 'Dairy broken into parts or powdered for industrial use.' },

    // ---- Starches & flours ----
    { re: /modified (maize |corn |potato |tapioca |wheat )?starch|\be ?14\d\d\b/, kind: 'marker', pts: 10, label: 'Modified starch', why: 'Chemically modified starch used for texture.' },
    { re: /wholemeal|whole ?grain|whole ?wheat|wholewheat|spelt|rye|oat|buckwheat|whole ?meal|stoneground/, kind: 'minimal', pts: 1, label: 'Whole grain', why: 'Whole grain — minimally processed.' },
    { re: /flour|semolina|rusk|breadcrumb|crumb|couscous|pasta|noodles|bulgur/, kind: 'refined', pts: 3, label: 'Refined flour / grain', why: 'Milled and refined grain.' },
    { re: /starch|cornflour/, kind: 'refined', pts: 4, label: 'Starch', why: 'Extracted starch.' },
    { re: /\bfibre\b|\bfiber\b|inulin|chicory root|psyllium|oat fibre|wheat fibre|bamboo fibre|citrus fibre|pea fibre/, kind: 'marker', pts: 6, label: 'Added fibre', why: 'Isolated fibre added back to processed food.' },

    // ---- Emulsifiers, stabilisers, thickeners, gums ----
    { re: /carrageenan|\be ?407a?\b|carboxymethyl|cellulose gum|\be ?466\b|polysorbate|\be ?43[2-6]\b|\be ?47[1-9]\b|\be ?48[1-2]\b|mono.? ?and di.?glycerides|monoglyceride|diglyceride|sucrose esters|polyglycerol|stearoyl lactylate|\be ?49[1-5]\b/, kind: 'cosmetic', pts: 14, label: 'Industrial emulsifier', why: 'Synthetic emulsifier — linked to gut-lining disruption in studies.' },
    { re: /lecithin|\be ?322\b/, kind: 'additive', pts: 4, label: 'Lecithin', why: 'Mild emulsifier, usually from soy or sunflower.' },
    { re: /xanthan|guar|locust bean|carob gum|gum arabic|acacia gum|gellan|tara gum|konjac|agar|alginate|methylcellulose|cellulose|\be ?4(0[0-6]|1[0-8]|2[0-5]|6[0-9])\b/, kind: 'additive', pts: 7, label: 'Gum / thickener', why: 'Thickener or gelling agent used to fake texture.' },
    { re: /pectin|\be ?440\b/, kind: 'additive', pts: 2, label: 'Pectin', why: 'Natural fruit-derived setting agent.' },

    // ---- Preservatives ----
    { re: /sulphite|sulfite|metabisulphite|metabisulfite|sulphur dioxide|sulfur dioxide|\be ?22[0-8]\b/, kind: 'additive', pts: 12, label: 'Sulphite preservative', why: 'Chemical preservative; can trigger sensitivities.' },
    { re: /benzoate|benzoic|\be ?21[0-3]\b|sorbate|sorbic acid|\be ?20[0-3]\b|propionate|\be ?28[0-3]\b|\bbha\b|\bbht\b|butylated|\be ?3(19|2[0-1])\b|\bedta\b|\be ?385\b|natamycin|nisin|\be ?23[45]\b/, kind: 'additive', pts: 12, label: 'Chemical preservative', why: 'Added to extend shelf life far beyond real food.' },
    { re: /phosphoric acid|\be ?338\b|polyphosphate|triphosphate|\be ?45[12]\b|\be ?34[0-3]\b|\be ?339\b/, kind: 'additive', pts: 9, label: 'Phosphate additive', why: 'Industrial phosphate — used for texture, water retention or acidity.' },
    { re: /diphosphate|pyrophosphate|\be ?450\b/, kind: 'additive', pts: 4, label: 'Diphosphate', why: 'Raising agent / stabiliser.' },

    // ---- Mild / benign additives ----
    { re: /ascorbic acid|ascorbate|vitamin c|\be ?30[0-2]\b|tocopherol|vitamin e|\be ?30[6-9]\b|rosemary extract|\be ?392\b/, kind: 'additive', pts: 2, label: 'Antioxidant (vitamin)', why: 'Vitamin C/E used as an antioxidant — fairly benign.' },
    { re: /citric acid|\be ?330\b|lactic acid|\be ?270\b|malic acid|\be ?296\b|tartaric|\be ?334\b|acetic acid|\be ?260\b|citrate|\be ?33[1-3]\b|lactate|\be ?32[5-7]\b|acetate|\be ?26[1-3]\b|fumaric|\be ?297\b/, kind: 'additive', pts: 2, label: 'Food acid', why: 'Acid used for tartness or preservation — mild.' },
    { re: /sodium bicarbonate|bicarbonate of soda|baking soda|sodium carbonate|ammonium (bi)?carbonate|potassium carbonate|calcium carbonate|\be ?50[0-4]\b|\be ?170\b|cream of tartar/, kind: 'additive', pts: 1, label: 'Raising agent', why: 'Simple mineral raising agent.' },
    { re: /calcium chloride|\be ?509\b|calcium sulphate|\be ?516\b|magnesium chloride|\be ?511\b|nitrogen|\be ?941\b|carbon dioxide|\be ?290\b|argon|\be ?938\b|oxygen|\be ?948\b|\bhelium\b/, kind: 'additive', pts: 1, label: 'Mineral / packaging gas', why: 'Very mild processing aid.' },
    { re: /caffeine/, kind: 'additive', pts: 5, label: 'Added caffeine', why: 'Caffeine added rather than naturally present.' },
    { re: /vitamin|thiamin|niacin|folic|iron\b|calcium\b|zinc|iodine|\bb12\b|\bd2\b|\bd3\b|fortified|mineral/, kind: 'additive', pts: 1, label: 'Added vitamin / mineral', why: 'Fortification — not harmful, but a sign of processing.' },
    { re: /\bacidity regulator|\bemulsifiers?\b|\bstabili[sz]ers?\b|\bthickeners?\b|\bpreservatives?\b|\bantioxidants?\b|\bgelling agent|\bhumectant|\banti.?caking|\bglazing agent|\bfirming agent|\bbulking agent|\bcarrier\b|\bsequestrant|\bfoaming agent/, kind: 'additive', pts: 8, label: 'Industrial additive', why: 'Functional additive with no home-kitchen equivalent.' },
    { re: /raising agents?|leavening/, kind: 'additive', pts: 1, label: 'Raising agent', why: 'Raising agent.' },
    { re: /\be ?\d{3,4}[a-z]?\b/, kind: 'additive', pts: 8, label: 'E-number additive', why: 'Food additive.' },

    // ---- Minimally processed / traditional ----
    { re: /vinegar|cultures?|rennet|enzymes?|\byeast\b|sourdough|starter|ferment/, kind: 'minimal', pts: 1, label: 'Traditional ingredient', why: 'Traditional processing aid.' },
    { re: /cheese|yogh?urt|kefir|cr[eè]me fra[iî]che|soured cream|quark|ricotta|mozzarella|cheddar|parmesan|feta|halloumi/, kind: 'minimal', pts: 1, label: 'Fermented dairy', why: 'Traditional fermented dairy.' },
    { re: /chocolate|cocoa|cacao/, kind: 'minimal', pts: 2, label: 'Cocoa / chocolate', why: 'Processed from cocoa beans.' },
    { re: /\bjuice\b|pur[eé]e|paste|concentrate|dried|powder|extract|stock|bouillon|broth|sauce/, kind: 'minimal', pts: 2, label: 'Processed form', why: 'A processed version of a whole food.' },
    { re: /\bbacon\b|\bham\b|salami|chorizo|pepperoni|sausage|frankfurter|hot dog|luncheon|corned/, kind: 'refined', pts: 10, label: 'Processed meat', why: 'Processed meat ingredient.' },

    // ---- Whole foods (zero penalty) ----
    { re: /\bwater\b|sea salt|rock salt|\bsalt\b|himalayan|mineral water|spring water|\bice\b/, kind: 'whole', pts: 0, label: 'Water / salt', why: 'Pure.' },
    { re: /\bmilk\b|\bcream\b|\bbutter\b|\beggs?\b|\bghee\b/, kind: 'whole', pts: 0, label: 'Dairy / egg', why: 'Whole food.' },
    { re: /\b(beef|pork|lamb|mutton|chicken|turkey|duck|goose|venison|veal|rabbit|goat|meat|liver|kidney|mince|steak|fillet|pancetta|offal|casing)s?\b/, kind: 'whole', pts: 0, label: 'Meat', why: 'Whole food.' },
    { re: /\b(fish|cod|haddock|salmon|tuna|mackerel|sardines?|anchov(y|ies)|pollock|plaice|hake|trout|herring|sole|seabass|sea bass|bream|prawns?|shrimps?|crab|lobster|mussels?|clams?|oysters?|scallops?|squid|octopus|kipper)\b/, kind: 'whole', pts: 0, label: 'Fish / seafood', why: 'Whole food.' },
    { re: /\b(apples?|bananas?|oranges?|lemons?|limes?|grapes?|pears?|peach(es)?|plums?|cherr(y|ies)|berr(y|ies)|strawberr(y|ies)|raspberr(y|ies)|blueberr(y|ies)|blackcurrants?|mango(es)?|pineapples?|apricots?|figs?|dates?|raisins?|sultanas?|currants?|melons?|kiwi|coconut|pomegranate|rhubarb|cranberr(y|ies)|fruit)\b/, kind: 'whole', pts: 0, label: 'Fruit', why: 'Whole food.' },
    { re: /\b(tomato(es)?|potato(es)?|onions?|garlic|carrots?|peppers?|chill?i(es)?|celery|leeks?|cabbage|kale|spinach|lettuce|broccoli|cauliflower|peas|beans?|lentils?|chickpeas?|sweetcorn|corn|maize|mushrooms?|courgettes?|aubergines?|cucumbers?|beetroot|parsnips?|swede|squash|pumpkin|shallots?|spring onions?|olives?|capers?|gherkins?|vegetables?|herbs?|basil|oregano|thyme|rosemary|parsley|coriander|mint|dill|sage|bay|chives|ginger|spices?|pepper|paprika|cumin|cinnamon|nutmeg|cloves?|cardamom|turmeric|mustard|seeds?|vanilla|saffron|fennel)\b/, kind: 'whole', pts: 0, label: 'Vegetable / herb / spice', why: 'Whole food.' },
    { re: /\b(rice|oats?|barley|quinoa|millet|wheat|nuts?|almonds?|hazelnuts?|walnuts?|cashews?|pistachios?|peanuts?|pecans?|macadamia|brazil|sesame|linseed|flaxseed|chia|sunflower seeds?|pumpkin seeds?|tofu|soya ?beans?|soybeans?|edamame|tempeh)\b/, kind: 'whole', pts: 0, label: 'Grain / nut / legume', why: 'Whole food.' },
    { re: /\b(coffee|tea|green tea|black tea|rooibos|matcha|hops|malted barley|cocoa beans)\b/, kind: 'whole', pts: 0, label: 'Coffee / tea', why: 'Whole food.' },
  ];

  // Ingredient names that are just category headers when they have sub-ingredients
  const PARENT_ONLY = /seasoning|spice mix|batter|coating|crumb|rusk|filling|topping|sauce|dressing|marinade|glaze|raising agents?|emulsifiers?|stabili[sz]ers?|preservatives?|antioxidants?|acidity regulators?|thickeners?|colou?rs?|flavou?r enhancers?|sweeteners?|gelling agents?|chocolate|pastry|dough|pasta|stock|crumb|base|mix/;

  const KIND_INFO = {
    whole:    { name: 'Whole food',        tone: 'good' },
    minimal:  { name: 'Minimally processed', tone: 'ok' },
    refined:  { name: 'Refined',            tone: 'meh' },
    additive: { name: 'Additive',           tone: 'meh' },
    marker:   { name: 'Ultra-processed marker', tone: 'bad' },
    cosmetic: { name: 'Cosmetic additive',  tone: 'bad' },
    severe:   { name: 'Severe',             tone: 'worst' },
    unknown:  { name: 'Unclassified',       tone: 'meh' },
  };

  // ---------- Parsing ----------
  function cleanName(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\*+/g, '')
      .replace(/\d+([.,]\d+)?\s*%/g, '')        // percentages
      .replace(/\b(organic|british|irish|scottish|uk|eu|fresh|freshly|from concentrate|contains|ingredients?|may contain.*$|in varying proportions|min\.?|minimum)\b/g, ' ')
      .replace(/^[\s:;.\-–]+|[\s:;.\-–]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Split on top-level commas/semicolons and capture (...) / [...] as children.
  function parseIngredientsText(text) {
    if (!text) return [];
    let t = String(text)
      .replace(/^\s*ingredients?\s*[:\-]/i, '')
      .replace(/allergy advice.*$/is, '')
      .replace(/for allergens.*$/is, '')
      .replace(/\.\s*(may contain|contains|made in a factory).*$/is, '')
      .replace(/[{\[]/g, '(').replace(/[}\]]/g, ')')
      .replace(/\(\s*(min\.?\s*)?\d+([.,]\d+)?\s*%\s*\)/gi, '')
      .replace(/\band\b(?=[^()]*$)/gi, ',');

    // Separate text outside brackets from every top-level (...) group inside
    function splitGroups(str) {
      let depth = 0, outside = '', cur = '', groups = [];
      for (const c of str) {
        if (c === '(') { if (depth === 0) { cur = ''; depth++; continue; } depth++; }
        else if (c === ')') { depth--; if (depth === 0) { groups.push(cur); continue; } if (depth < 0) depth = 0; }
        if (depth > 0) cur += c; else outside += c;
      }
      if (depth > 0) groups.push(cur);
      groups = groups.filter(function (g) { return g.trim(); });
      return groups.length ? { outside: outside, groups: groups } : null;
    }

    function parseList(str) {
      const out = [];
      let depth = 0, buf = '', i = 0;
      const items = [];
      for (; i < str.length; i++) {
        const c = str[i];
        if (c === '(') depth++;
        if (c === ')') depth = Math.max(0, depth - 1);
        if ((c === ',' || c === ';' || (c === '.' && depth === 0 && /\s|$/.test(str[i + 1] || ''))) && depth === 0) {
          items.push(buf); buf = '';
        } else buf += c;
      }
      items.push(buf);
      for (const raw of items) {
        const m = splitGroups(raw);
        if (m) {
          const name = cleanName(m.outside);
          const children = [].concat.apply([], m.groups.map(parseList));
          // "Raising agent: E500" style handled below; "(milk)" allergen-only children kept as children
          if (name) out.push({ name, raw: raw.trim(), children });
          else out.push(...children);
        } else {
          let r = raw;
          // "Emulsifier: Soya Lecithin" -> parent with child
          const colon = r.match(/^([^:]{2,40}):\s*(.+)$/);
          if (colon) {
            const kids = parseList(colon[2]);
            out.push({ name: cleanName(colon[1]), raw: r.trim(), children: kids });
            continue;
          }
          const name = cleanName(r);
          if (name && name.length > 1) out.push({ name, raw: r.trim(), children: [] });
        }
      }
      return out;
    }
    return parseList(t);
  }

  // Open Food Facts structured ingredients -> same tree shape
  function fromOFFIngredients(list) {
    return (list || []).map(function (ing) {
      const label = ing.text || (ing.id || '').replace(/^[a-z]{2}:/, '').replace(/-/g, ' ');
      return { name: cleanName(label), raw: label, children: fromOFFIngredients(ing.ingredients) };
    }).filter(function (x) { return x.name; });
  }

  // ---------- Classification ----------
  function classify(name) {
    for (const rule of RULES) {
      if (rule.re.test(name)) return rule;
    }
    return null;
  }

  // Flatten tree into scored leaves, keeping parents only when they mean something on their own.
  function flatten(tree, depth, out, parentName) {
    tree.forEach(function (node) {
      const kids = node.children || [];
      // Allergen-only children like "Butter (Milk)" or "Wheat Flour (Wheat)" — treat as leaf
      const allergenOnly = kids.length > 0 && kids.every(function (k) {
        return /^(milk|wheat|egg|eggs|soya|soy|fish|mustard|celery|sesame|barley|oats?|gluten|nuts?|crustaceans?|molluscs?|lupin|peanuts?|cows'? milk|from milk|contains milk)$/.test(k.name);
      });
      if (kids.length && !allergenOnly) {
        const rule = classify(node.name);
        // Keep parent if it's a meaningful ingredient itself (e.g. "milk chocolate" adds cocoa) — but avoid double counting
        if (!PARENT_ONLY.test(node.name) && rule && rule.kind !== 'whole' && rule.kind !== 'minimal') {
          out.push({ name: node.name, depth: depth, rule: rule, parent: parentName, isGroup: true });
        }
        out.push({ name: node.name, depth: depth, header: true, parent: parentName });
        flatten(kids, depth + 1, out, node.name);
      } else {
        out.push({ name: node.name, depth: depth, rule: classify(node.name), parent: parentName });
      }
    });
    return out;
  }

  // ---------- Scoring ----------
  function band(score) {
    if (score >= 90) return { key: 'pure', label: 'Pure', blurb: 'As close to the real thing as it gets.' };
    if (score >= 70) return { key: 'light', label: 'Lightly processed', blurb: 'Mostly real food with a little help.' };
    if (score >= 45) return { key: 'processed', label: 'Processed', blurb: 'Real food in there, but plenty has been done to it.' };
    if (score >= 20) return { key: 'upf', label: 'Ultra-processed', blurb: 'More factory than kitchen.' };
    return { key: 'avoid', label: 'Avoid', blurb: 'Heavily ultra-processed.' };
  }

  /**
   * score({ ingredientsText, ingredientsTree, additives, nova, categories, name })
   */
  function score(input) {
    input = input || {};
    let tree = input.ingredientsTree && input.ingredientsTree.length ? input.ingredientsTree : parseIngredientsText(input.ingredientsText);
    const notes = [];

    // No ingredients: is it a whole food with nothing to declare?
    if (!tree.length) {
      const cats = (input.categories || []).join(' ');
      const nm = cleanName(input.name || '');
      const singleRule = nm ? classify(nm) : null;
      if (input.nova === 1 || /fresh|fruits?|vegetables?|plant-based-foods-and-beverages.*fruit/.test(cats) || (singleRule && singleRule.kind === 'whole' && nm.split(' ').length <= 3)) {
        return { score: 100, band: band(100), items: [], flags: [], notes: ['No ingredients list — treated as a single whole food.'], confidence: 'medium', leafCount: 1 };
      }
      return { score: null, band: null, items: [], flags: [], notes: ['No ingredients list available for this product.'], confidence: 'none', leafCount: 0 };
    }

    const flat = flatten(tree, 0, [], null);
    const leaves = flat.filter(function (x) { return !x.header; });
    const scoredLeaves = leaves.filter(function (x) { return !x.isGroup; });

    // Pick up additives OFF detected that the text didn't spell out (e.g. foreign-language labels)
    const seen = leaves.map(function (l) { return l.name; }).join(' | ');
    (input.additives || []).forEach(function (tag) {
      const code = String(tag).replace(/^[a-z]{2}:/, '').toLowerCase(); // e.g. e450i
      const num = code.replace(/^e/, '').replace(/[a-z]+$/, '');
      if (!new RegExp('\\be ?' + num).test(seen)) {
        const nm = 'e' + num;
        const r = classify(nm);
        if (r && r.kind !== 'whole') {
          // Only add if no named equivalent is obviously present
          const dup = leaves.some(function (l) { return l.rule && l.rule.label === r.label; });
          if (!dup) leaves.push({ name: code.toUpperCase(), depth: 0, rule: r, fromTags: true });
        }
      }
    });

    let penalty = 0;
    let cap = 100;
    let markerCount = 0;
    const items = [];
    let pos = 0;

    leaves.forEach(function (leaf) {
      const r = leaf.rule;
      let pts, kind, label, why;
      if (r) { pts = r.pts; kind = r.kind; label = r.label; why = r.why; if (r.cap != null) cap = Math.min(cap, r.cap); }
      else { pts = 3; kind = 'unknown'; label = 'Unclassified'; why = 'Not in the ingredient library — scored as mildly processed.'; }

      // Earlier (top-level) ingredients make up more of the product
      let weight = 1;
      if (leaf.depth === 0 && !leaf.fromTags) {
        weight = pos === 0 ? 1.5 : pos === 1 ? 1.3 : pos === 2 ? 1.15 : 1;
        pos++;
      } else if (leaf.depth > 0) {
        weight = 0.9;
      }
      // A product that is mostly sugar/syrup is a sweet, not a food
      if (leaf.depth === 0 && pos <= 2 && r && /Sugar|syrup|Refined sugar/i.test(r.label)) weight *= 1.5;
      if (kind === 'severe' || kind === 'cosmetic') weight = Math.max(weight, 1); // never discount these
      if (leaf.isGroup) weight *= 0.5;

      const p = Math.round(pts * weight * 10) / 10;
      penalty += p;
      if (kind === 'marker' || kind === 'cosmetic' || kind === 'severe') markerCount++;
      items.push({ name: leaf.name, depth: leaf.depth, parent: leaf.parent || null, kind: kind, kindName: KIND_INFO[kind].name, tone: KIND_INFO[kind].tone, label: label, why: why, penalty: p, fromTags: !!leaf.fromTags, isGroup: !!leaf.isGroup });
    });

    // Complexity: every extra ingredient moves it further from "the pure thing"
    const n = Math.max(1, scoredLeaves.length);
    const complexity = Math.min(12, Math.round((n - 1) * 0.75));
    penalty += complexity;
    if (complexity > 0) notes.push(n + ' ingredients (−' + complexity + ' for complexity)');

    // Stacking: several UPF markers together signal a formulated product
    if (markerCount >= 2) {
      const stack = Math.min(24, (markerCount - 1) * 6);
      penalty += stack;
      notes.push(markerCount + ' ultra-processed markers together (−' + stack + ')');
    }

    let s = Math.round(100 - penalty);
    if (s > cap) { s = cap; notes.push('Capped at ' + cap + ' because of ' + items.filter(function (i) { return i.kind === 'severe' || (i.label === 'Artificial sweetener'); }).map(function (i) { return i.label.toLowerCase(); })[0]); }
    s = Math.max(0, Math.min(100, s));

    const flags = items.filter(function (i) { return i.tone === 'bad' || i.tone === 'worst'; });
    return { score: s, band: band(s), items: items, flags: flags, notes: notes, confidence: 'high', leafCount: n, nova: input.nova || null };
  }

  const api = { score: score, parseIngredientsText: parseIngredientsText, fromOFFIngredients: fromOFFIngredients, band: band, classify: classify };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Purity = api;
})(typeof window !== 'undefined' ? window : globalThis);
