const P = require('./src/scoring.js');
const cases = [
 ['Apple (no ingredients)', {name:'Apple', ingredientsText:''}],
 ['Banana', {ingredientsText:'Banana'}],
 ['Whole milk', {ingredientsText:'Whole Milk'}],
 ['Butter (salted)', {ingredientsText:'Butter (Milk), Salt (1.6%)'}],
 ['Butter', {ingredientsText:'Cream (Milk)'}],
 ['Chopped tomatoes', {ingredientsText:'Tomatoes, Tomato Juice, Acidity Regulator: Citric Acid'}],
 ['Ground coffee', {ingredientsText:'100% Arabica Coffee'}],
 ['Sea salt', {ingredientsText:'Sea Salt'}],
 ['Tuna in spring water', {ingredientsText:'Skipjack Tuna (Fish), Spring Water, Salt'}],
 ['Battered fish', {ingredientsText:'Fish (Pollock) (56%), Wheat Flour, Rapeseed Oil, Maize Flour, Palm Fat, Raising Agents (Diphosphates, Sodium Carbonates, Ammonium Carbonates), Dextrose, Yeast Extract, Paprika Extract, Salt'}],
 ['Pork sausage (nitrite)', {ingredientsText:'Pork (60%), Water, Rusk (Wheat Flour (Wheat Flour, Calcium Carbonate, Iron, Niacin, Thiamin), Salt, Raising Agent: Ammonium Carbonate), Seasoning (Salt, Spices, Dextrose, Flavourings, Stabiliser: Diphosphates, Preservative: Sodium Nitrite, Sodium Metabisulphite), Pork Casing'}],
 ['Butcher sausage (no nitrite)', {ingredientsText:'Pork (85%), Water, Rice Flour, Salt, Black Pepper, Sage, Nutmeg, Preservative: Sodium Metabisulphite, Natural Casing'}],
 ['Cola', {ingredientsText:'Carbonated Water, Sugar, Colour (Caramel E150d), Phosphoric Acid, Natural Flavourings including Caffeine'}],
 ['Diet cola', {ingredientsText:'Carbonated Water, Colour (Caramel E150d), Sweeteners (Aspartame, Acesulfame K), Natural Flavourings including Caffeine, Phosphoric Acid, Citric Acid'}],
 ['Chocolate digestive', {ingredientsText:'Wheat Flour (with Calcium, Iron, Niacin, Thiamin), Milk Chocolate (30%) (Sugar, Cocoa Butter, Whole Milk Powder, Cocoa Mass, Whey Powder (Milk), Emulsifier (Soya Lecithin), Natural Flavouring), Vegetable Oil (Palm, Rapeseed), Wholemeal Wheat Flour (12%), Sugar, Glucose-Fructose Syrup, Raising Agents (Sodium Bicarbonate, Malic Acid, Ammonium Bicarbonate), Salt'}],
 ['Supermarket white bread', {ingredientsText:'Wheat Flour [Wheat Flour, Calcium Carbonate, Iron, Niacin (B3), Thiamin (B1)], Water, Yeast, Salt, Soya Flour, Preservative: Calcium Propionate, Emulsifiers: E471, E481, Rapeseed Oil, Flour Treatment Agent: Ascorbic Acid (Vitamin C)'}],
 ['Sourdough', {ingredientsText:'Wheat Flour, Water, Wholemeal Rye Flour, Salt'}],
 ['Greek yoghurt', {ingredientsText:'Yogurt (Milk)'}],
 ['Porridge oats', {ingredientsText:'Rolled Oats'}],
 ['Pesto', {ingredientsText:'Basil (40%), Sunflower Oil, Grana Padano Cheese (Milk, Salt, Rennet, Preservative: Egg Lysozyme), Cashew Nuts, Extra Virgin Olive Oil, Pine Nuts, Garlic, Salt, Acidity Regulator: Lactic Acid'}],
];
for (const [n,i] of cases){ const r=P.score(i); console.log(String(r.score).padStart(4), (r.band||{}).label||'-', ' ', n, r.notes.join('; ')); }
const r=P.score(cases[9][1]); r.items.forEach(i=>console.log('   ',i.penalty, i.kind, i.name));
