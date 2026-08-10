import { useState } from "react";
import {
  CalendarDots,
  Info,
  StackSimple,
  Target,
} from "@phosphor-icons/react";
import "./MuscleExposurePanel.css";

const REGION_META = [
  { key: "chest", label: "Chest" },
  { key: "upperBack", label: "Upper back" },
  { key: "lats", label: "Lats" },
  { key: "shoulders", label: "Shoulders" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "quads", label: "Quads" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "glutes", label: "Glutes" },
  { key: "hipFlexors", label: "Hip flexors" },
  { key: "lowerLegs", label: "Lower legs" },
  { key: "core", label: "Core" },
];

const TIER_LABELS = {
  none: "No exposure",
  low: "Light",
  moderate: "Moderate",
  high: "High",
};

const TIER_LEGEND_LABELS = {
  none: "None · 0",
  low: "Light · under 3",
  moderate: "Moderate · 3–5.5",
  high: "High · 6+",
};

function finiteCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function tierFromScore(score) {
  if (score >= 6) return "high";
  if (score >= 3) return "moderate";
  if (score > 0) return "low";
  return "none";
}

function normalizeTier(tier, score) {
  const normalized = String(tier ?? "").toLowerCase();
  if (normalized === "medium") return "moderate";
  if (Object.hasOwn(TIER_LABELS, normalized)) return normalized;
  return tierFromScore(score);
}

function normalizeRegion(value) {
  if (typeof value === "number") {
    const score = finiteCount(value);
    return {
      score,
      directSets: score,
      secondarySets: 0,
      trainingDays: 0,
      tier: tierFromScore(score),
      hasBreakdown: false,
    };
  }

  const directSets = finiteCount(value?.directSets);
  const secondarySets = finiteCount(value?.secondarySets);
  const trainingDays = finiteCount(value?.trainingDays);
  const inferredScore = directSets + secondarySets * 0.5;
  const score = Number.isFinite(Number(value?.score))
    ? finiteCount(value.score)
    : inferredScore;

  return {
    score,
    directSets,
    secondarySets,
    trainingDays,
    tier: normalizeTier(value?.tier, score),
    hasBreakdown: Boolean(value && typeof value === "object"),
  };
}

function formatCount(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function regionClass(regions, key, selectedKey) {
  return `muscle-map__region is-${regions[key].tier}${selectedKey === key ? " is-selected" : ""}`;
}

function regionTitle(regions, key, label) {
  const region = regions[key];
  const tierLabel = region.tier === "none"
    ? "no exposure"
    : `${TIER_LABELS[region.tier].toLowerCase()} exposure`;
  return `${label}: ${tierLabel}; ${formatCount(region.score)} weighted exposure from ${formatCount(region.directSets)} direct and ${formatCount(region.secondarySets)} supporting sets across ${formatCount(region.trainingDays)} training days.`;
}

function MuscleBodyMap({ regions, selectedKey }) {
  return (
    <div className="muscle-map">
      <div className="muscle-map__view-labels" aria-hidden="true">
        <span>Front</span>
        <span>Back</span>
      </div>
      <svg
        className="muscle-map__svg"
        viewBox="0 0 460 370"
        role="img"
        aria-labelledby="muscle-map-title muscle-map-description"
      >
        <title id="muscle-map-title">Front and back completed-set exposure map</title>
        <desc id="muscle-map-description">
          A front and back body diagram. Grey indicates no exposure, sage indicates weighted exposure below three, butter indicates three to five and a half, and coral indicates six or more. The outlined region is selected in the region ledger.
        </desc>

        <g className="muscle-map__figure muscle-map__figure--front">
          <g className="muscle-map__body" aria-hidden="true">
            <circle cx="115" cy="31" r="18" />
            <path d="M105 48 L104 61 C94 64 86 67 80 73 C75 86 78 104 84 119 L92 167 C94 176 91 184 88 194 L89 252 L84 334 C84 344 91 350 99 345 L110 262 L115 203 L120 262 L131 345 C139 350 146 344 146 334 L141 252 L142 194 C139 184 136 176 138 167 L146 119 C152 104 155 86 150 73 C144 67 136 64 126 61 L125 48 Z" />
            <path d="M82 72 C70 75 62 84 59 98 L48 151 C46 161 51 168 59 168 C65 167 68 161 70 153 L80 112 L91 88 Z" />
            <path d="M148 72 C160 75 168 84 171 98 L182 151 C184 161 179 168 171 168 C165 167 162 161 160 153 L150 112 L139 88 Z" />
          </g>

          <g className={regionClass(regions, "shoulders", selectedKey)}>
            <title>{regionTitle(regions, "shoulders", "Shoulders")}</title>
            <path d="M83 70 C73 72 67 80 67 90 C73 94 80 95 88 91 C92 83 91 76 88 70 Z" />
            <path d="M147 70 C157 72 163 80 163 90 C157 94 150 95 142 91 C138 83 139 76 142 70 Z" />
          </g>

          <g className={regionClass(regions, "chest", selectedKey)}>
            <title>{regionTitle(regions, "chest", "Chest")}</title>
            <path d="M91 82 C97 76 106 75 114 80 L114 108 C105 112 97 109 91 101 C89 94 89 88 91 82 Z" />
            <path d="M139 82 C133 76 124 75 116 80 L116 108 C125 112 133 109 139 101 C141 94 141 88 139 82 Z" />
          </g>

          <g className={regionClass(regions, "biceps", selectedKey)}>
            <title>{regionTitle(regions, "biceps", "Biceps")}</title>
            <path d="M68 91 C61 96 59 107 58 120 L55 139 C61 143 67 140 70 132 L76 106 C77 99 74 94 68 91 Z" />
            <path d="M162 91 C169 96 171 107 172 120 L175 139 C169 143 163 140 160 132 L154 106 C153 99 156 94 162 91 Z" />
          </g>

          <g className={regionClass(regions, "core", selectedKey)}>
            <title>{regionTitle(regions, "core", "Core")}</title>
            <path d="M96 111 C102 114 108 116 114 116 L114 164 C108 166 102 164 98 160 L94 127 Z" />
            <path d="M134 111 C128 114 122 116 116 116 L116 164 C122 166 128 164 132 160 L136 127 Z" />
            <path className="muscle-map__detail" d="M96 129 H134 M97 146 H133 M115 116 V164" />
          </g>

          <g className={regionClass(regions, "hipFlexors", selectedKey)}>
            <title>{regionTitle(regions, "hipFlexors", "Hip flexors")}</title>
            <path d="M95 164 C101 166 107 168 113 169 L111 188 C104 184 99 180 95 174 Z" />
            <path d="M135 164 C129 166 123 168 117 169 L119 188 C126 184 131 180 135 174 Z" />
          </g>

          <g className={regionClass(regions, "quads", selectedKey)}>
            <title>{regionTitle(regions, "quads", "Quads")}</title>
            <path d="M91 190 C96 184 105 183 112 188 L109 247 C105 256 97 258 91 252 L89 211 Z" />
            <path d="M139 190 C134 184 125 183 118 188 L121 247 C125 256 133 258 139 252 L141 211 Z" />
            <path className="muscle-map__detail" d="M101 190 L100 250 M129 190 L130 250" />
          </g>

          <g className={regionClass(regions, "lowerLegs", selectedKey)}>
            <title>{regionTitle(regions, "lowerLegs", "Lower legs")}</title>
            <path d="M91 263 C98 261 104 266 105 276 L100 326 C97 337 89 338 86 328 L88 281 Z" />
            <path d="M139 263 C132 261 126 266 125 276 L130 326 C133 337 141 338 144 328 L142 281 Z" />
          </g>
        </g>

        <g className="muscle-map__figure muscle-map__figure--back">
          <g className="muscle-map__body" aria-hidden="true">
            <circle cx="345" cy="31" r="18" />
            <path d="M335 48 L334 61 C324 64 316 67 310 73 C305 86 308 104 314 119 L322 167 C324 176 321 184 318 194 L319 252 L314 334 C314 344 321 350 329 345 L340 262 L345 203 L350 262 L361 345 C369 350 376 344 376 334 L371 252 L372 194 C369 184 366 176 368 167 L376 119 C382 104 385 86 380 73 C374 67 366 64 356 61 L355 48 Z" />
            <path d="M312 72 C300 75 292 84 289 98 L278 151 C276 161 281 168 289 168 C295 167 298 161 300 153 L310 112 L321 88 Z" />
            <path d="M378 72 C390 75 398 84 401 98 L412 151 C414 161 409 168 401 168 C395 167 392 161 390 153 L380 112 L369 88 Z" />
          </g>

          <g className={regionClass(regions, "shoulders", selectedKey)}>
            <title>{regionTitle(regions, "shoulders", "Shoulders")}</title>
            <path d="M313 70 C303 72 297 80 297 90 C303 94 310 95 318 91 C322 83 321 76 318 70 Z" />
            <path d="M377 70 C387 72 393 80 393 90 C387 94 380 95 372 91 C368 83 369 76 372 70 Z" />
          </g>

          <g className={regionClass(regions, "upperBack", selectedKey)}>
            <title>{regionTitle(regions, "upperBack", "Upper back")}</title>
            <path d="M320 78 C328 68 338 66 345 70 C352 66 362 68 370 78 L362 112 C352 116 338 116 328 112 Z" />
            <path className="muscle-map__detail" d="M322 84 L345 105 L368 84 M345 70 V111" />
          </g>

          <g className={regionClass(regions, "lats", selectedKey)}>
            <title>{regionTitle(regions, "lats", "Lats")}</title>
            <path d="M319 101 C326 108 334 114 343 116 L339 158 C330 157 323 151 319 141 L313 116 Z" />
            <path d="M371 101 C364 108 356 114 347 116 L351 158 C360 157 367 151 371 141 L377 116 Z" />
          </g>

          <g className={regionClass(regions, "triceps", selectedKey)}>
            <title>{regionTitle(regions, "triceps", "Triceps")}</title>
            <path d="M298 91 C291 98 289 111 288 124 L285 143 C291 147 297 143 300 135 L306 108 C307 100 304 94 298 91 Z" />
            <path d="M392 91 C399 98 401 111 402 124 L405 143 C399 147 393 143 390 135 L384 108 C383 100 386 94 392 91 Z" />
          </g>

          <g className={regionClass(regions, "glutes", selectedKey)}>
            <title>{regionTitle(regions, "glutes", "Glutes")}</title>
            <path d="M320 169 C327 164 337 165 344 171 L344 199 C335 205 325 202 320 195 Z" />
            <path d="M370 169 C363 164 353 165 346 171 L346 199 C355 205 365 202 370 195 Z" />
          </g>

          <g className={regionClass(regions, "hamstrings", selectedKey)}>
            <title>{regionTitle(regions, "hamstrings", "Hamstrings")}</title>
            <path d="M321 201 C327 198 336 199 340 205 L337 257 C333 264 325 263 321 255 L319 219 Z" />
            <path d="M369 201 C363 198 354 199 350 205 L353 257 C357 264 365 263 369 255 L371 219 Z" />
          </g>

          <g className={regionClass(regions, "lowerLegs", selectedKey)}>
            <title>{regionTitle(regions, "lowerLegs", "Lower legs")}</title>
            <path d="M321 263 C328 261 334 266 335 276 L330 326 C327 337 319 338 316 328 L318 281 Z" />
            <path d="M369 263 C362 261 356 266 355 276 L360 326 C363 337 371 338 374 328 L372 281 Z" />
          </g>
        </g>
      </svg>

      <div className="muscle-map__legend" aria-label="Exposure color scale">
        {Object.entries(TIER_LEGEND_LABELS).map(([tier, label]) => (
          <span key={tier}><i className={`is-${tier}`} aria-hidden="true" />{label}</span>
        ))}
      </div>
    </div>
  );
}

export function MuscleExposurePanel({ exposure }) {
  const regions = Object.fromEntries(REGION_META.map(({ key }) => [
    key,
    normalizeRegion(exposure?.regions?.[key]),
  ]));
  const totalCompletedSets = finiteCount(exposure?.totalCompletedSets);
  const trainingDays = finiteCount(exposure?.trainingDays);
  const unclassifiedCompletedSets = finiteCount(exposure?.unclassifiedCompletedSets);
  const isEmpty = totalCompletedSets === 0;
  const regionRows = REGION_META
    .map((meta) => ({ ...meta, ...regions[meta.key] }))
    .sort((left, right) => (
      right.score - left.score
      || right.directSets - left.directSets
      || left.label.localeCompare(right.label)
    ));
  const leadingRegion = regionRows.find((region) => region.score > 0) ?? null;
  const activeRegionCount = regionRows.filter((region) => region.score > 0).length;
  const maximumScore = Math.max(1, ...regionRows.map((region) => region.score));
  const [selectedKey, setSelectedKey] = useState(() => leadingRegion?.key ?? REGION_META[0].key);

  const selectedMeta = REGION_META.find((region) => region.key === selectedKey) ?? REGION_META[0];
  const selectedRegion = regions[selectedMeta.key];
  const selectedSupportingExposure = selectedRegion.secondarySets * 0.5;

  return (
    <section className={`muscle-exposure${isEmpty ? " is-empty" : ""}`} aria-labelledby="muscle-exposure-title">
      <header className="muscle-exposure__header">
        <div>
          <span className="muscle-exposure__kicker">Completed-set distribution</span>
          <h2 id="muscle-exposure-title">MUSCLE EXPOSURE</h2>
        </div>
        <div className="muscle-exposure__stats">
          <div className="muscle-exposure__total" aria-label={`${formatCount(totalCompletedSets)} completed mapped sets in the shown week`}>
            <strong>{formatCount(totalCompletedSets)}</strong>
            <span>mapped sets</span>
          </div>
          <div className="muscle-exposure__days" aria-label={`${formatCount(trainingDays)} training days in the shown week`}>
            <strong>{formatCount(trainingDays)}</strong>
            <span>{trainingDays === 1 ? "day" : "days"}</span>
          </div>
          <div className="muscle-exposure__regions" aria-label={`${activeRegionCount} of 12 regions have recorded exposure`}>
            <strong>{activeRegionCount}/12</strong>
            <span>regions</span>
          </div>
        </div>
      </header>

      <p className="muscle-exposure__intro">
        A weekly map of completed, mapped sets from finished or ended sessions. Direct work counts once; supporting involvement counts half. Select any region to inspect the recorded breakdown.
      </p>

      <div className="muscle-exposure__basis" aria-label="How this exposure view is calculated">
        <span><StackSimple size={17} weight="fill" /><strong>Direct</strong> × 1</span>
        <span><Target size={17} weight="fill" /><strong>Supporting</strong> × 0.5</span>
        <span><CalendarDots size={17} weight="fill" /><strong>Current logical week</strong> · ended sessions</span>
      </div>

      {isEmpty ? (
        <div className="muscle-exposure__empty" role="status">
          <strong>No completed mapped sets this week.</strong>
          <span>Finish or end a workout after completing at least one set, then this map will colour in.</span>
        </div>
      ) : null}

      <div className="muscle-exposure__content">
        <MuscleBodyMap regions={regions} selectedKey={selectedKey} />

        <div className="muscle-exposure__inspector">
          <section className={`muscle-exposure__focus is-${selectedRegion.tier}`} aria-live="polite" aria-label={`${selectedMeta.label} exposure details`}>
            <header>
              <div>
                <span>Selected region</span>
                <h3>{selectedMeta.label}</h3>
              </div>
              <span>{TIER_LABELS[selectedRegion.tier]}</span>
            </header>
            <div className="muscle-exposure__focus-value">
              <strong>{formatCount(selectedRegion.score)}</strong>
              <span>weighted exposure</span>
            </div>
            <dl>
              <div>
                <dt>Direct sets</dt>
                <dd>{formatCount(selectedRegion.directSets)}</dd>
              </div>
              <div>
                <dt>Supporting sets</dt>
                <dd>{formatCount(selectedRegion.secondarySets)}</dd>
              </div>
              <div>
                <dt>Training days</dt>
                <dd>{formatCount(selectedRegion.trainingDays)}</dd>
              </div>
            </dl>
            <p>
              {formatCount(selectedRegion.directSets)} direct + {formatCount(selectedRegion.secondarySets)} supporting × 0.5 = <strong>{formatCount(selectedRegion.directSets + selectedSupportingExposure)}</strong>
            </p>
          </section>

          <div className="muscle-exposure__ledger">
            <div className="muscle-exposure__ledger-heading">
              <span>All 12 regions</span>
              <small>Ordered by recorded exposure</small>
            </div>
            <ol>
              {regionRows.map((region) => {
                const directWidth = (region.directSets / maximumScore) * 100;
                const supportingWidth = ((region.secondarySets * 0.5) / maximumScore) * 100;
                const isSelected = selectedKey === region.key;
                const dayLabel = `${formatCount(region.trainingDays)} ${region.trainingDays === 1 ? "day" : "days"}`;
              return (
                  <li key={region.key}>
                    <button
                      type="button"
                      className={`is-${region.tier}${isSelected ? " is-selected" : ""}`}
                      onClick={() => setSelectedKey(region.key)}
                      aria-pressed={isSelected}
                      aria-label={`${region.label}: ${formatCount(region.score)} weighted exposure from ${formatCount(region.directSets)} direct and ${formatCount(region.secondarySets)} supporting sets across ${dayLabel}.`}
                    >
                      <span className="muscle-exposure__ledger-label">
                        <i aria-hidden="true" />
                        <span><strong>{region.label}</strong><small>{dayLabel}</small></span>
                      </span>
                      <span className="muscle-exposure__ledger-track" aria-hidden="true">
                        <i className="is-direct" style={{ "--region-width": `${directWidth}%` }} />
                        <i className="is-supporting" style={{ "--region-width": `${supportingWidth}%` }} />
                      </span>
                      <b>{formatCount(region.score)}</b>
                    </button>
                </li>
              );
            })}
            </ol>
          </div>
        </div>
      </div>

      <p className="muscle-exposure__method">
        <Info size={16} weight="fill" aria-hidden="true" />
        <span>Weighted exposure describes where recorded work was assigned; it is not a completed-set total. It does not measure load, repetitions, effort, technique, recovery, progressive overload, or muscle growth.</span>
      </p>
      {unclassifiedCompletedSets > 0 ? (
        <p className="muscle-exposure__warning" role="note">
          {formatCount(unclassifiedCompletedSets)} completed {unclassifiedCompletedSets === 1 ? "set was" : "sets were"} not matched to a known exercise and {unclassifiedCompletedSets === 1 ? "is" : "are"} excluded from the map.
        </p>
      ) : null}
    </section>
  );
}
