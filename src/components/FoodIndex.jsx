import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Basket,
  BowlFood,
  Carrot,
  CheckCircle,
  CookingPot,
  ForkKnife,
  MagnifyingGlass,
  Minus,
  Plus,
  ShieldCheck,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { FOOD_CATEGORIES, FOOD_ITEMS, FOOD_REFERENCE } from "../foodData.js";
import "./FoodIndex.css";

const COMPARE_LIMIT = 4;

const categoryDetails = {
  "no-cook": {
    label: "Mix + eat",
    short: "No-cook combinations",
    description: "Shelf-stable basics and fresh single portions you can mix in minutes. Open perishables only when you are ready to finish them.",
    icon: BowlFood,
    tone: "aqua",
  },
  pan: {
    label: "Pan recipes",
    short: "Simple one-pan food",
    description: "Short beginner recipes for the electric stove. The oil is measured because pouring freely can change the estimate more than the spices do.",
    icon: CookingPot,
    tone: "coral",
  },
  produce: {
    label: "Fruit + veg",
    short: "Fresh sides and snacks",
    description: "Easy produce you can buy in Chennai without special prep. These add fibre and volume, but most are not complete meals or protein servings.",
    icon: Carrot,
    tone: "sage",
  },
  protein: {
    label: "Protein add-ons",
    short: "Strengthen a weak meal",
    description: "Practical portions that add meaningful protein to PG food, rotis, fruit or oats. Choose based on access; none is mandatory every day.",
    icon: ForkKnife,
    tone: "violet",
  },
  limit: {
    label: "Limit / avoid",
    short: "Know the high-impact order",
    description: "Restaurant food, desserts, shakes and packaged snacks live here—not among the recommendations. The ranges are broad because shops and serving sizes vary sharply.",
    icon: WarningCircle,
    tone: "butter",
  },
};

function sumRanges(rows) {
  return rows.reduce(
    (total, { food, count }) => ({
      kcal: [total.kcal[0] + food.kcal[0] * count, total.kcal[1] + food.kcal[1] * count],
      protein: [total.protein[0] + food.protein[0] * count, total.protein[1] + food.protein[1] * count],
    }),
    { kcal: [0, 0], protein: [0, 0] },
  );
}

function numberRange(range, suffix = "") {
  if (range[0] === range[1]) return `${range[0].toLocaleString()}${suffix}`;
  return `${range[0].toLocaleString()}–${range[1].toLocaleString()}${suffix}`;
}

function percentRange(range, target) {
  const values = range.map((value) => Math.max(0, Math.round((value / target) * 100)));
  return values[0] === values[1] ? `${values[0]}%` : `${values[0]}–${values[1]}%`;
}

function FoodMetric({ label, range, unit, reference }) {
  return (
    <div className="fi-metric">
      <span>{label}</span>
      <strong>{numberRange(range, unit)}</strong>
      <small>{percentRange(range, reference)} of reference</small>
    </div>
  );
}

export function FoodIndex() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareSelection, setCompareSelection] = useState({});

  useEffect(() => {
    if (!selectedFood && !showCompare) return undefined;

    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setSelectedFood(null);
      setShowCompare(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedFood, showCompare]);

  const filteredFoods = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return FOOD_ITEMS.filter((food) => {
      const inCategory = category === "all" || food.category === category;
      const searchable = [food.name, food.strap, food.portion, ...food.tags, ...food.ingredients]
        .join(" ")
        .toLowerCase();
      return inCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, query]);

  const categoryCounts = useMemo(
    () => FOOD_ITEMS.reduce((counts, food) => ({ ...counts, [food.category]: (counts[food.category] ?? 0) + 1 }), {}),
    [],
  );

  const compareRows = useMemo(
    () => Object.entries(compareSelection)
      .map(([id, count]) => ({ food: FOOD_ITEMS.find((food) => food.id === id), count }))
      .filter((row) => row.food),
    [compareSelection],
  );

  const compareCount = compareRows.reduce((sum, row) => sum + row.count, 0);
  const compareTotals = sumRanges(compareRows);
  const compareIsFull = compareCount >= COMPARE_LIMIT;
  const activeDetails = category === "all" ? null : categoryDetails[category];

  function addToCompare(foodId) {
    if (compareIsFull) {
      setShowCompare(true);
      return;
    }
    setCompareSelection((current) => {
      const currentCount = Object.values(current).reduce((sum, count) => sum + count, 0);
      if (currentCount >= COMPARE_LIMIT) return current;
      return {
        ...current,
        [foodId]: (current[foodId] ?? 0) + 1,
      };
    });
  }

  function removeFromCompare(foodId) {
    setCompareSelection((current) => {
      const nextCount = (current[foodId] ?? 0) - 1;
      if (nextCount > 0) return { ...current, [foodId]: nextCount };
      const next = { ...current };
      delete next[foodId];
      return next;
    });
  }

  function clearFilters() {
    setCategory("all");
    setQuery("");
  }

  return (
    <div className="fi-page page-enter">
      <section className="fi-hero">
        <div className="fi-hero__copy">
          <div className="eyebrow light-kicker">
            <ForkKnife size={18} weight="fill" />
            Food reference · no meal schedule
          </div>
          <h1>MAKE THE EASY<br />CHOICE TASTE GOOD.</h1>
          <p>
            Browse mix-and-eat ideas, beginner pan recipes, produce and protein add-ons. Portions use practical pieces, bowls and handfuls—with grams where they help.
          </p>
          <div className="fi-hero__actions">
            <button className="fi-button fi-button--paper" onClick={() => document.getElementById("food-library")?.scrollIntoView({ behavior: "smooth" })}>
              Browse the index <ArrowRight size={19} weight="bold" />
            </button>
            <button className="fi-compare-link" onClick={() => setShowCompare(true)}>
              <Basket size={19} weight="fill" />
              Compare {compareCount > 0 ? `${compareCount}/${COMPARE_LIMIT}` : "portions"}
            </button>
          </div>
        </div>
        <div className="fi-hero__art">
          <img src="/assets/food-board.webp" alt="Illustrated board of fruit, vegetables, rotis, dal, chicken, oats and simple cooking ingredients" />
          <span>Buy fresh · make simple · eat promptly</span>
        </div>
      </section>

      <section className="fi-reference" aria-label="How to read the estimates">
        <div className="fi-reference__lead">
          <span className="section-kicker">Starting references</span>
          <h2>RANGES, NOT FALSE PRECISION.</h2>
          <p>
            Each card compares one stated portion with roughly {FOOD_REFERENCE.energyKcal.toLocaleString()} kcal and {FOOD_REFERENCE.proteinGrams} g protein. That percentage describes the item only—it does not calculate what you personally must eat afterward.
          </p>
        </div>
        <div className="fi-reference__number fi-tone-coral">
          <span>Energy orientation</span>
          <strong>~2,000</strong>
          <small>kcal reference</small>
        </div>
        <div className="fi-reference__number fi-tone-aqua">
          <span>Protein orientation</span>
          <strong>~110 g</strong>
          <small>daily reference</small>
        </div>
        <button className="fi-reference__compare" onClick={() => setShowCompare(true)}>
          <Basket size={25} weight="fill" />
          <span><strong>Quick compare</strong><small>Up to four known portions · reload clears</small></span>
          <ArrowRight size={19} />
        </button>
      </section>

      <section className="fi-safety" aria-labelledby="food-safety-title">
        <div className="fi-safety__icon"><ShieldCheck size={29} weight="fill" /></div>
        <div>
          <span className="section-kicker">No-fridge rule</span>
          <h2 id="food-safety-title">SEALED UNTIL NEEDED. FRESH FOOD EATEN NOW.</h2>
        </div>
        <div className="fi-safety__rules">
          <span><CheckCircle size={18} weight="fill" /> Buy chicken, paneer, curd and cut fruit immediately before use.</span>
          <span><CheckCircle size={18} weight="fill" /> Finish opened UHT milk, cooked food and prepared shakes promptly.</span>
          <span><CheckCircle size={18} weight="fill" /> Keep oats, sattu, chana, soy and whey dry, sealed and away from heat or insects.</span>
        </div>
        <p>When the room is warm, do not keep perishable food for later. As a conservative boundary, discard food left out beyond two hours—or one hour above 32°C.</p>
      </section>

      <section className="fi-library" id="food-library" aria-labelledby="food-library-title">
        <header className="fi-library__header">
          <div>
            <span className="section-kicker light-kicker">Choose by access, not by clock</span>
            <h2 id="food-library-title">FOOD INDEX</h2>
          </div>
          <label className="fi-search">
            <MagnifyingGlass size={20} />
            <span className="sr-only">Search food and ingredients</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chicken, banana, oats…"
            />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
          </label>
        </header>

        <div className="fi-tabs" aria-label="Food categories">
          {FOOD_CATEGORIES.map((item) => {
            const count = item.id === "all" ? FOOD_ITEMS.length : categoryCounts[item.id] ?? 0;
            return (
              <button
                key={item.id}
                className={category === item.id ? "is-active" : ""}
                onClick={() => setCategory(item.id)}
                aria-pressed={category === item.id}
              >
                {item.label}<span>{count}</span>
              </button>
            );
          })}
        </div>

        {activeDetails && (
          <div className={`fi-category-note fi-tone-${activeDetails.tone}`}>
            <activeDetails.icon size={25} weight="fill" />
            <div><strong>{activeDetails.short}</strong><span>{activeDetails.description}</span></div>
          </div>
        )}

        {filteredFoods.length > 0 ? (
          <div className="fi-grid">
            {filteredFoods.map((food) => {
              const details = categoryDetails[food.category];
              const Icon = details.icon;
              const amountInCompare = compareSelection[food.id] ?? 0;

              return (
                <article className={`fi-card fi-tone-${details.tone}`} key={food.id}>
                  <button className="fi-card__main" onClick={() => setSelectedFood(food)} aria-label={`View ${food.name} details`}>
                    <div className="fi-card__top">
                      <span className="fi-card__icon"><Icon size={22} weight="fill" /></span>
                      <span className="fi-card__kind">{details.label}</span>
                      <ArrowRight size={18} />
                    </div>
                    <h3>{food.name}</h3>
                    <p className="fi-card__strap">{food.strap}</p>
                    <div className="fi-card__portion">
                      <span>Practical portion</span>
                      <strong>{food.portion}</strong>
                    </div>
                    <div className="fi-card__metrics">
                      <FoodMetric label="Est. energy" range={food.kcal} unit=" kcal" reference={FOOD_REFERENCE.energyKcal} />
                      <FoodMetric label="Est. protein" range={food.protein} unit=" g" reference={FOOD_REFERENCE.proteinGrams} />
                    </div>
                    <div className="fi-card__tags">
                      {food.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      <span>{food.prep}</span>
                    </div>
                    <small className="fi-card__disclaimer">Item share of the starting reference—not a remaining-day instruction.</small>
                  </button>
                  <button
                    className="fi-card__compare"
                    onClick={() => addToCompare(food.id)}
                    disabled={compareIsFull}
                  >
                    {amountInCompare > 0 ? <CheckCircle size={18} weight="fill" /> : <Plus size={18} weight="bold" />}
                    {compareIsFull ? "Four-portion tray full" : amountInCompare > 0 ? `Compare another · ${amountInCompare} selected` : "Add to quick compare"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="fi-empty">
            <MagnifyingGlass size={32} />
            <h3>No matching item</h3>
            <p>Try a broader ingredient or clear the category filter.</p>
            <button onClick={clearFilters}>Clear filters</button>
          </div>
        )}
      </section>

      <section className="fi-boundary">
        <div className="fi-boundary__copy">
          <WarningCircle size={29} weight="fill" />
          <span className="section-kicker">One flex occasion total</span>
          <h2>THE LIMIT LIST IS INFORMATION, NOT A MENU.</h2>
          <p>For biryani, shawarma, burgers, pizza or fried chicken, use one single main as the occasional choice—no second main, fried side, cake jar or milkshake in the same order.</p>
        </div>
        <button onClick={() => { setCategory("limit"); setQuery(""); document.getElementById("food-library")?.scrollIntoView({ behavior: "smooth" }); }}>
          Open {categoryCounts.limit} limit references <ArrowRight size={19} />
        </button>
      </section>

      {selectedFood && (
        <div className="fi-overlay" role="presentation" onMouseDown={() => setSelectedFood(null)}>
          <section
            className={`fi-dialog fi-tone-${categoryDetails[selectedFood.category].tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="food-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="fi-dialog__close" onClick={() => setSelectedFood(null)} aria-label="Close food details"><X size={20} /></button>
            <span className="fi-dialog__kind">{categoryDetails[selectedFood.category].label}</span>
            <h2 id="food-detail-title">{selectedFood.name}</h2>
            <p className="fi-dialog__strap">{selectedFood.strap}</p>

            <div className="fi-dialog__portion">
              <span>One reference portion</span>
              <strong>{selectedFood.portion}</strong>
            </div>

            <div className="fi-dialog__metrics">
              <FoodMetric label="Estimated energy" range={selectedFood.kcal} unit=" kcal" reference={FOOD_REFERENCE.energyKcal} />
              <FoodMetric label="Estimated protein" range={selectedFood.protein} unit=" g" reference={FOOD_REFERENCE.proteinGrams} />
            </div>

            <p className="fi-dialog__orientation">
              These percentages compare this stated portion with the starting references only. They do not tell you exactly how much to eat later, and real values move with brand, oil and serving size.
            </p>

            <div className="fi-dialog__columns">
              <div>
                <span className="cue-label">{selectedFood.category === "limit" ? "Typical portion" : "What you need"}</span>
                <ul>{selectedFood.ingredients.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <span className="cue-label">{selectedFood.category === "limit" ? "Practical boundary" : "Simple method"}</span>
                <ol>{selectedFood.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              </div>
            </div>

            <div className="fi-dialog__note"><ShieldCheck size={22} weight="fill" /><span>{selectedFood.note}</span></div>
            <div className="fi-dialog__actions">
              <button
                className="fi-button fi-button--dark"
                onClick={() => { addToCompare(selectedFood.id); setSelectedFood(null); }}
                disabled={compareIsFull}
              >
                <Plus size={18} weight="bold" /> {compareIsFull ? "Compare tray is full" : "Add this portion to compare"}
              </button>
              <button className="fi-text-button" onClick={() => setSelectedFood(null)}>Back to index</button>
            </div>
          </section>
        </div>
      )}

      {showCompare && (
        <div className="fi-overlay fi-overlay--drawer" role="presentation" onMouseDown={() => setShowCompare(false)}>
          <aside className="fi-compare" role="dialog" aria-modal="true" aria-labelledby="compare-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="fi-dialog__close fi-dialog__close--dark" onClick={() => setShowCompare(false)} aria-label="Close quick compare"><X size={20} /></button>
            <span className="section-kicker light-kicker">Temporary reference · {compareCount}/{COMPARE_LIMIT} portions</span>
            <h2 id="compare-title">QUICK COMPARE</h2>
            <p className="fi-compare__intro">Combine up to four known portions to understand their rough scale. This is not a food diary, complete-day total or remaining-food prescription. Nothing is saved after reload.</p>

            <div className="fi-compare__summary">
              <FoodMetric label="Combined energy" range={compareTotals.kcal} unit=" kcal" reference={FOOD_REFERENCE.energyKcal} />
              <FoodMetric label="Combined protein" range={compareTotals.protein} unit=" g" reference={FOOD_REFERENCE.proteinGrams} />
            </div>

            <div className="fi-compare__list">
              {compareRows.length === 0 ? (
                <div className="fi-compare__empty">
                  <Basket size={32} />
                  <strong>No portions selected</strong>
                  <span>Add an item from the index to compare its range with up to three others.</span>
                </div>
              ) : compareRows.map(({ food, count }) => (
                <div className="fi-compare__row" key={food.id}>
                  <div>
                    <strong>{food.name}</strong>
                    <span>{count} × {food.portion}</span>
                    <small>{numberRange(food.kcal.map((value) => value * count), " kcal")} · {numberRange(food.protein.map((value) => value * count), " g protein")}</small>
                  </div>
                  <div className="fi-quantity" aria-label={`${food.name} comparison quantity`}>
                    <button onClick={() => removeFromCompare(food.id)} aria-label={`Remove one ${food.name}`}><Minus size={16} /></button>
                    <span>{count}</span>
                    <button onClick={() => addToCompare(food.id)} disabled={compareIsFull} aria-label={`Add one ${food.name}`}><Plus size={16} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="fi-compare__notice">
              <WarningCircle size={21} weight="fill" />
              <span>Do not subtract these estimates from a calorie target and then force, skip or punish a later meal. Use the tray only to compare portion scale.</span>
            </div>

            {compareRows.length > 0 && (
              <button className="fi-clear" onClick={() => setCompareSelection({})}><Trash size={18} /> Clear comparison</button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
