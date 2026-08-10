import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import {
  FOOD_CATEGORIES,
  FOOD_FAMILY_GUIDES,
  FOOD_ITEMS,
  FOOD_REFERENCE,
} from "../foodData.js";
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
    description: "Short beginner recipes for the electric stove. Measured oil keeps the portion estimate more useful.",
    icon: CookingPot,
    tone: "coral",
  },
  produce: {
    label: "Fruit + veg",
    short: "Fresh sides and snacks",
    description: "Common Chennai produce with little prep. These add fibre and volume, but most are not complete meals or protein servings.",
    icon: Carrot,
    tone: "sage",
  },
  protein: {
    label: "Protein add-ons",
    short: "Strengthen a weak meal",
    description: "Practical portions that add protein to PG food, rotis, fruit or oats. Choose by access; none is mandatory every day.",
    icon: ForkKnife,
    tone: "violet",
  },
  limit: {
    label: "Limit / avoid",
    short: "Know the high-impact order",
    description: "Restaurant food, desserts, shakes and packaged snacks live here—not among the choose-often ideas. Shop portions vary, so ranges stay broad.",
    icon: WarningCircle,
    tone: "butter",
  },
};

const lanes = [
  { id: "choose", label: "Choose often", description: "PG-friendly basics, produce and protein" },
  { id: "limit", label: "Limit / avoid", description: "Delivery, desserts, drinks and bulk snacks" },
  { id: "all", label: "All entries", description: "Search the complete reference" },
];

const quickFilters = [
  { id: "all", label: "Any access" },
  { id: "no-fridge", label: "No-fridge" },
  { id: "quick", label: "10 min or less" },
  { id: "protein", label: "15 g+ protein" },
  { id: "budget", label: "Budget basics" },
];

const chooseCategories = FOOD_CATEGORIES.filter(({ id }) => id !== "all" && id !== "limit");

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

function searchableFoodText(food) {
  return [food.name, food.strap, food.portion, food.prep, ...food.tags, ...food.ingredients]
    .join(" ")
    .toLowerCase();
}

function matchesQuickFilter(food, filter) {
  if (filter === "all") return true;
  const text = searchableFoodText(food);

  if (filter === "no-fridge") {
    return /no fridge|shelf-stable|sealed|portable|whole fruit|dry cupboard/.test(text);
  }
  if (filter === "quick") {
    const minutes = Number.parseInt(food.prep.match(/\d+/)?.[0] ?? "", 10);
    return (Number.isFinite(minutes) && minutes <= 10)
      || /ready|open \+|peel|wash|drink now/.test(food.prep.toLowerCase());
  }
  if (filter === "protein") return food.protein[0] >= 15;
  if (filter === "budget") {
    return /budget|pg friendly|sattu|chana|soy|egg|poha|dal|banana|besan/.test(text);
  }
  return true;
}

function isComparable(food) {
  return Boolean(food && food.comparable !== false && Array.isArray(food.kcal) && Array.isArray(food.protein));
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

function FoodFamilyCard({ guide }) {
  const isChoose = guide.lane === "choose";
  return (
    <article className={`fi-family-card ${isChoose ? "is-choose" : "is-limit"}`}>
      <div className="fi-family-card__top">
        {isChoose ? <CheckCircle size={21} weight="fill" /> : <WarningCircle size={21} weight="fill" />}
        <span>{isChoose ? "Choose often" : "Limit pattern"}</span>
      </div>
      <h3>{guide.title}</h3>
      <strong>{guide.examples}</strong>
      <p>{guide.guidance}</p>
    </article>
  );
}

export function FoodIndex() {
  const [lane, setLane] = useState("choose");
  const [category, setCategory] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareSelection, setCompareSelection] = useState({});
  const modalOriginRef = useRef(null);

  useEffect(() => {
    if (!selectedFood && !showCompare) return undefined;

    const appShell = document.querySelector(".app-shell");
    const shellWasInert = appShell?.hasAttribute("inert") ?? false;
    const dialog = document.querySelector(".fi-overlay [role='dialog']");

    if (appShell && !shellWasInert) appShell.setAttribute("inert", "");

    const focusableSelector = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const handleDialogKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialogs();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)]
        .filter((element) => !element.hasAttribute("hidden") && element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeydown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeydown);
      if (appShell && !shellWasInert) appShell.removeAttribute("inert");
    };
  }, [selectedFood, showCompare]);

  const categoryCounts = useMemo(
    () => FOOD_ITEMS.reduce((counts, food) => ({ ...counts, [food.category]: (counts[food.category] ?? 0) + 1 }), {}),
    [],
  );

  const laneCounts = useMemo(() => ({
    choose: FOOD_ITEMS.filter((food) => food.category !== "limit").length,
    limit: FOOD_ITEMS.filter((food) => food.category === "limit").length,
    all: FOOD_ITEMS.length,
  }), []);

  const filteredFoods = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return FOOD_ITEMS.filter((food) => {
      const inLane = lane === "all"
        || (lane === "limit" ? food.category === "limit" : food.category !== "limit");
      const inCategory = category === "all" || food.category === category;
      const inQuickFilter = lane === "limit" || matchesQuickFilter(food, quickFilter);
      const inSearch = !normalized || searchableFoodText(food).includes(normalized);
      return inLane && inCategory && inQuickFilter && inSearch;
    });
  }, [category, lane, query, quickFilter]);

  const visibleGuides = useMemo(() => {
    if (category !== "all" || quickFilter !== "all") return [];
    const normalized = query.trim().toLowerCase();
    return FOOD_FAMILY_GUIDES.filter((guide) => {
      const inLane = lane === "all" || guide.lane === lane;
      const text = `${guide.title} ${guide.examples} ${guide.guidance}`.toLowerCase();
      return inLane && (!normalized || text.includes(normalized));
    });
  }, [category, lane, query, quickFilter]);

  const compareRows = useMemo(
    () => Object.entries(compareSelection)
      .map(([id, count]) => ({ food: FOOD_ITEMS.find((food) => food.id === id), count }))
      .filter((row) => isComparable(row.food)),
    [compareSelection],
  );

  const compareCount = compareRows.reduce((sum, row) => sum + row.count, 0);
  const compareTotals = sumRanges(compareRows);
  const compareIsFull = compareCount >= COMPARE_LIMIT;
  const activeDetails = category === "all" ? null : categoryDetails[category];
  const hasActiveFilters = category !== "all" || quickFilter !== "all" || query.trim() !== "";

  function selectLane(nextLane) {
    setLane(nextLane);
    setCategory("all");
    setQuickFilter("all");
  }

  function addToCompare(foodId) {
    const food = FOOD_ITEMS.find((item) => item.id === foodId);
    if (!isComparable(food)) return;
    if (compareIsFull) {
      openCompare();
      return;
    }
    setCompareSelection((current) => {
      const currentCount = Object.values(current).reduce((sum, count) => sum + count, 0);
      if (currentCount >= COMPARE_LIMIT) return current;
      return { ...current, [foodId]: (current[foodId] ?? 0) + 1 };
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
    setQuickFilter("all");
    setQuery("");
  }

  function rememberModalOrigin() {
    if (document.activeElement instanceof HTMLElement) modalOriginRef.current = document.activeElement;
  }

  function openFoodDetails(food) {
    rememberModalOrigin();
    setSelectedFood(food);
  }

  function openCompare() {
    rememberModalOrigin();
    setShowCompare(true);
  }

  function closeDialogs() {
    setSelectedFood(null);
    setShowCompare(false);
    const origin = modalOriginRef.current;
    modalOriginRef.current = null;
    window.requestAnimationFrame(() => origin?.focus());
  }

  return (
    <div className="fi-page page-enter">
      <section className="fi-hero" aria-labelledby="food-index-hero-title">
        <div className="fi-hero__copy">
          <div className="eyebrow light-kicker">
            <ForkKnife size={18} weight="fill" />
            Chennai PG food reference
          </div>
          <h1 id="food-index-hero-title">EAT WELL.<br />NO KITCHEN REQUIRED.</h1>
          <p>
            Find realistic mix-and-eat food, one-pan recipes, produce and protein add-ons. Delivery food stays in a separate limit reference—never disguised as a recommendation.
          </p>
          <div className="fi-hero__actions">
            <button className="fi-button fi-button--paper" onClick={() => document.getElementById("food-library")?.scrollIntoView({ behavior: "smooth" })}>
              Browse {FOOD_ITEMS.length} entries <ArrowRight size={19} weight="bold" />
            </button>
            <button className="fi-compare-link" onClick={openCompare}>
              <Basket size={19} weight="fill" />
              Compare {compareCount > 0 ? `${compareCount}/${COMPARE_LIMIT}` : "portions"}
            </button>
          </div>
          <div className="fi-hero__facts" aria-label="Food index facts">
            <span><strong>{laneCounts.choose}</strong> choose-often entries</span>
            <span><strong>{FOOD_FAMILY_GUIDES.length}</strong> family rules</span>
            <span><strong>0</strong> meal schedules</span>
          </div>
        </div>
        <div className="fi-hero__art">
          <img src="/assets/food-board.webp" alt="Illustrated board of fruit, vegetables, rotis, dal, chicken, oats and simple cooking ingredients" />
          <span>Buy fresh · make simple · eat promptly</span>
        </div>
      </section>

      <section className="fi-reference" aria-label="How to read the estimates">
        <div className="fi-reference__lead">
          <span className="section-kicker">Starting reference, not a prescription</span>
          <h2>ONE PORTION. HONEST RANGE.</h2>
          <p>
            Energy and protein percentages compare only the stated portion with roughly {FOOD_REFERENCE.energyKcal.toLocaleString()} kcal and {FOOD_REFERENCE.proteinGrams} g protein. They do not calculate a personal remaining allowance.
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
        <button className="fi-reference__compare" onClick={openCompare}>
          <Basket size={25} weight="fill" />
          <span><strong>Quick compare</strong><small>Up to four stated portions · reload clears</small></span>
          <ArrowRight size={19} />
        </button>
      </section>

      <section className="fi-safety" aria-labelledby="food-safety-title">
        <div className="fi-safety__title">
          <div className="fi-safety__icon"><ShieldCheck size={28} weight="fill" /></div>
          <div>
            <span className="section-kicker light-kicker">No-fridge rule</span>
            <h2 id="food-safety-title">BUY SMALL. EAT NOW.</h2>
          </div>
        </div>
        <div className="fi-safety__rules">
          <span><CheckCircle size={18} weight="fill" /> Buy chicken, paneer, curd and cut fruit immediately before use.</span>
          <span><CheckCircle size={18} weight="fill" /> Finish opened UHT milk, cooked food and prepared shakes promptly.</span>
          <span><CheckCircle size={18} weight="fill" /> Keep oats, sattu, chana, soy and whey dry, sealed and away from heat or insects.</span>
        </div>
        <p>Without cold storage, discard perishable food left at room temperature beyond two hours—or one hour when it is above 32°C. When timing is uncertain, do not keep it for later.</p>
      </section>

      <section className="fi-library" id="food-library" aria-labelledby="food-library-title">
        <header className="fi-library__header">
          <div>
            <span className="section-kicker light-kicker">Index, not a diary</span>
            <h2 id="food-library-title">FOOD INDEX</h2>
            <p>Start with a lane, then narrow by access. Every estimate belongs to one stated portion.</p>
          </div>
          <label className="fi-search">
            <MagnifyingGlass size={20} />
            <span className="sr-only">Search food, ingredients and family guidance</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chicken, banana, oats…"
            />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
          </label>
        </header>

        <div className="fi-lanes" role="group" aria-label="Food guidance lane">
          {lanes.map((item) => (
            <button
              type="button"
              key={item.id}
              className={lane === item.id ? "is-active" : ""}
              onClick={() => selectLane(item.id)}
              aria-pressed={lane === item.id}
            >
              <span>{item.label}<strong>{laneCounts[item.id]}</strong></span>
              <small>{item.description}</small>
            </button>
          ))}
        </div>

        {lane !== "limit" && (
          <div className="fi-filter-stack">
            <div className="fi-filter-row">
              <span>Food type</span>
              <div className="fi-tabs" role="group" aria-label="Choose-often food categories">
                <button type="button" className={category === "all" ? "is-active" : ""} onClick={() => setCategory("all")} aria-pressed={category === "all"}>
                  All types <span>{lane === "all" ? laneCounts.all : laneCounts.choose}</span>
                </button>
                {chooseCategories.map((item) => (
                  <button type="button" key={item.id} className={category === item.id ? "is-active" : ""} onClick={() => setCategory(item.id)} aria-pressed={category === item.id}>
                    {item.label}<span>{categoryCounts[item.id]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="fi-filter-row">
              <span>Quick access</span>
              <div className="fi-tabs fi-tabs--quiet" role="group" aria-label="Quick food filters">
                {quickFilters.map((item) => (
                  <button type="button" key={item.id} className={quickFilter === item.id ? "is-active" : ""} onClick={() => setQuickFilter(item.id)} aria-pressed={quickFilter === item.id}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeDetails && (
          <div className={`fi-category-note fi-tone-${activeDetails.tone}`}>
            <activeDetails.icon size={25} weight="fill" />
            <div><strong>{activeDetails.short}</strong><span>{activeDetails.description}</span></div>
          </div>
        )}

        {visibleGuides.length > 0 && (
          <section className="fi-families" aria-labelledby="food-families-title">
            <div className="fi-families__header">
              <div>
                <span className="section-kicker light-kicker">Generic guidance</span>
                <h3 id="food-families-title">CHOOSE THE FAMILY FIRST.</h3>
              </div>
              <p>These are decision rules, not portion estimates, so they never enter the comparison tray.</p>
            </div>
            <div className="fi-family-strip">
              {visibleGuides.map((guide) => <FoodFamilyCard guide={guide} key={guide.id} />)}
            </div>
          </section>
        )}

        <div className="fi-results-bar" aria-live="polite">
          <span><strong>{filteredFoods.length}</strong> {filteredFoods.length === 1 ? "entry" : "entries"} shown</span>
          <small>{lane === "limit" ? "Boundary references" : lane === "choose" ? "Choose-often ideas" : "Complete index"}</small>
          {hasActiveFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}
        </div>

        {filteredFoods.length > 0 ? (
          <div className="fi-grid">
            {filteredFoods.map((food, index) => {
              const details = categoryDetails[food.category];
              const Icon = details.icon;
              const amountInCompare = compareSelection[food.id] ?? 0;
              const comparable = isComparable(food);
              const tone = food.category === "limit" && index % 2 ? "coral" : details.tone;

              return (
                <article className={`fi-card fi-tone-${tone}`} key={food.id}>
                  <button type="button" className="fi-card__main" onClick={() => openFoodDetails(food)} aria-label={`View ${food.name} details`}>
                    <div className="fi-card__top">
                      <span className="fi-card__icon"><Icon size={21} weight="fill" /></span>
                      <span className="fi-card__kind">{details.label}</span>
                      <ArrowRight size={18} weight="bold" />
                    </div>
                    <h3>{food.name}</h3>
                    <p className="fi-card__strap">{food.strap}</p>
                    <div className="fi-card__portion">
                      <span>One practical portion</span>
                      <strong>{food.portion}</strong>
                    </div>
                    <div className="fi-card__metrics">
                      <FoodMetric label="Energy" range={food.kcal} unit=" kcal" reference={FOOD_REFERENCE.energyKcal} />
                      <FoodMetric label="Protein" range={food.protein} unit=" g" reference={FOOD_REFERENCE.proteinGrams} />
                    </div>
                    <div className="fi-card__tags">
                      {food.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                      <span>{food.prep}</span>
                    </div>
                  </button>
                  {comparable ? (
                    <button
                      type="button"
                      className="fi-card__compare"
                      onClick={() => addToCompare(food.id)}
                      disabled={compareIsFull}
                    >
                      {amountInCompare > 0 ? <CheckCircle size={18} weight="fill" /> : <Plus size={18} weight="bold" />}
                      {compareIsFull ? "Four-portion tray full" : amountInCompare > 0 ? `Add another · ${amountInCompare} selected` : "Add stated portion to compare"}
                    </button>
                  ) : (
                    <div className="fi-card__reference-only"><WarningCircle size={17} weight="fill" /> Reference only · portion too variable for tray</div>
                  )}
                </article>
              );
            })}
          </div>
        ) : visibleGuides.length === 0 ? (
          <div className="fi-empty">
            <MagnifyingGlass size={32} />
            <h3>No matching entry</h3>
            <p>Try a broader ingredient or clear the access filters.</p>
            <button type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : null}
      </section>

      <section className="fi-boundary">
        <div className="fi-boundary__copy">
          <WarningCircle size={29} weight="fill" />
          <span className="section-kicker">One main, not a combo</span>
          <h2>THE LIMIT LIST IS INFORMATION, NOT A MENU.</h2>
          <p>For biryani, shawarma, burgers, pizza or fried chicken, choose one main for the occasion—without a second main, fried side, cake jar and milkshake in the same order.</p>
        </div>
        <button type="button" onClick={() => { selectLane("limit"); setQuery(""); document.getElementById("food-library")?.scrollIntoView({ behavior: "smooth" }); }}>
          Open {laneCounts.limit} limit references <ArrowRight size={19} />
        </button>
      </section>

      {selectedFood && typeof document !== "undefined" && createPortal((
        <div className="fi-overlay" role="presentation" onMouseDown={closeDialogs}>
          <section
            className={`fi-dialog fi-tone-${categoryDetails[selectedFood.category].tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="food-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button autoFocus type="button" className="fi-dialog__close" onClick={closeDialogs} aria-label="Close food details"><X size={20} /></button>
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
              {isComparable(selectedFood) ? (
                <button
                  type="button"
                  className="fi-button fi-button--dark"
                  onClick={() => { addToCompare(selectedFood.id); closeDialogs(); }}
                  disabled={compareIsFull}
                >
                  <Plus size={18} weight="bold" /> {compareIsFull ? "Compare tray is full" : "Add stated portion to compare"}
                </button>
              ) : (
                <span className="fi-dialog__reference-only"><WarningCircle size={18} weight="fill" /> This broad reference is intentionally excluded from quick compare.</span>
              )}
              <button type="button" className="fi-text-button" onClick={closeDialogs}>Back to index</button>
            </div>
          </section>
        </div>
      ), document.body)}

      {showCompare && typeof document !== "undefined" && createPortal((
        <div className="fi-overlay fi-overlay--drawer" role="presentation" onMouseDown={closeDialogs}>
          <aside className="fi-compare" role="dialog" aria-modal="true" aria-labelledby="compare-title" onMouseDown={(event) => event.stopPropagation()}>
            <button autoFocus type="button" className="fi-dialog__close fi-dialog__close--dark" onClick={closeDialogs} aria-label="Close quick compare"><X size={20} /></button>
            <span className="section-kicker light-kicker">Temporary reference · {compareCount}/{COMPARE_LIMIT} portions</span>
            <h2 id="compare-title">QUICK COMPARE</h2>
            <p className="fi-compare__intro">Combine up to four clearly stated portions to understand rough scale. This is not a food diary, complete-day total or remaining-food prescription. Reload clears it.</p>

            <div className="fi-compare__summary">
              <FoodMetric label="Combined energy" range={compareTotals.kcal} unit=" kcal" reference={FOOD_REFERENCE.energyKcal} />
              <FoodMetric label="Combined protein" range={compareTotals.protein} unit=" g" reference={FOOD_REFERENCE.proteinGrams} />
            </div>

            <div className="fi-compare__list">
              {compareRows.length === 0 ? (
                <div className="fi-compare__empty">
                  <Basket size={32} />
                  <strong>No portions selected</strong>
                  <span>Add a stated portion from the index to compare its range with up to three others.</span>
                </div>
              ) : compareRows.map(({ food, count }) => (
                <div className="fi-compare__row" key={food.id}>
                  <div>
                    <strong>{food.name}</strong>
                    <span>{count} × {food.portion}</span>
                    <small>{numberRange(food.kcal.map((value) => value * count), " kcal")} · {numberRange(food.protein.map((value) => value * count), " g protein")}</small>
                  </div>
                  <div className="fi-quantity" aria-label={`${food.name} comparison quantity`}>
                    <button type="button" onClick={() => removeFromCompare(food.id)} aria-label={`Remove one ${food.name}`}><Minus size={16} /></button>
                    <span>{count}</span>
                    <button type="button" onClick={() => addToCompare(food.id)} disabled={compareIsFull} aria-label={`Add one ${food.name}`}><Plus size={16} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="fi-compare__notice">
              <WarningCircle size={21} weight="fill" />
              <span>Do not subtract these estimates from a target and then force, skip or punish a later meal. Use the tray only to compare portion scale.</span>
            </div>

            {compareRows.length > 0 && (
              <button type="button" className="fi-clear" onClick={() => setCompareSelection({})}><Trash size={18} /> Clear comparison</button>
            )}
          </aside>
        </div>
      ), document.body)}

      {compareCount > 0 && !showCompare && (
        <button type="button" className="fi-compare-dock" onClick={openCompare} aria-label={`Open quick compare with ${compareCount} of ${COMPARE_LIMIT} portions`}>
          <Basket size={21} weight="fill" />
          <span><strong>{compareCount}/{COMPARE_LIMIT} portions</strong><small>Temporary compare</small></span>
          <ArrowRight size={18} weight="bold" />
        </button>
      )}
    </div>
  );
}
