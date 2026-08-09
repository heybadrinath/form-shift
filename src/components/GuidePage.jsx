import {
  ArrowRight,
  Barbell,
  CheckCircle,
  Lightning,
  Play,
  ShieldCheck,
  Target,
  Timer,
  WarningCircle,
} from "@phosphor-icons/react";

export function GuidePage({ onStartSession }) {
  return (
    <div className="guide-page page-enter">
      <section className="guide-hero tone-bg-sage">
        <div>
          <span className="section-kicker">The operating rules</span>
          <h1>LEANER IS THE GOAL.<br />CONSISTENCY IS THE METHOD.</h1>
          <p>This app keeps the decisions small: follow the session order, stop for joint pain, control delivery portions and judge progress over weeks.</p>
          <button className="primary-action dark-action" onClick={onStartSession}>
            <Play size={20} weight="fill" /> Start foundation Session A
          </button>
        </div>
        <div className="reference-stack">
          <div><span>Starting reference</span><strong>173 cm · 73–74 kg</strong></div>
          <div><span>Food starting range</span><strong>~2,000 kcal · 100–120 g</strong></div>
          <div><span>Visual checkpoint</span><strong>Early December</strong></div>
        </div>
      </section>

      <section className="guide-grid">
        <article className="guide-card tone-bg-coral">
          <Target size={30} weight="fill" />
          <span className="section-kicker">Primary outcome</span>
          <h2>LOOK LEANER.<br />MOVE BETTER.</h2>
          <p>A flatter relaxed abdomen, better shape and returning push-up strength matter more than forcing a particular scale number.</p>
        </article>
        <article className="guide-card tone-bg-violet light-text">
          <Barbell size={30} weight="fill" />
          <span className="section-kicker light-kicker">Training order</span>
          <h2>A → B → C<br />BEFORE EXTRAS.</h2>
          <p>Missing a visit does not change the sequence. D and E are optional; they never replace the foundation.</p>
        </article>
        <article className="guide-card tone-bg-butter">
          <WarningCircle size={30} weight="fill" />
          <span className="section-kicker">Pain rule</span>
          <h2>JOINT PAIN<br />STOPS THE MOVE.</h2>
          <p>Sharp or deep joint pain, instability, numbness, sudden weakness, focal shin tenderness, swelling, limping, rest/night pain, dizziness or unusual breathlessness are not motivation problems.</p>
        </article>
        <article className="guide-card tone-bg-aqua">
          <ShieldCheck size={30} weight="fill" />
          <span className="section-kicker">Food rule</span>
          <h2>ONE MAIN.<br />NO REWARD ORDER.</h2>
          <p>Breakfast and lunch are optional. On no-lunch days, use an after-college protein anchor and an adequately sized dinner.</p>
        </article>
        <article className="guide-card tone-bg-sage">
          <Lightning size={30} weight="fill" />
          <span className="section-kicker">Whey rule</span>
          <h2>OPTIONAL.<br />NOT A MEAL.</h2>
          <p>Use one product-label serving on training or rest days only when normal food leaves protein short. Count the label; avoid mass gainers.</p>
        </article>
        <article className="guide-card tone-bg-coral">
          <Timer size={30} weight="fill" />
          <span className="section-kicker">Cardio progression</span>
          <h2>START SMALL.<br />BUILD THE WEEK.</h2>
          <p>The session blocks are a starter dose. As the shin permits, gradually build total moderate activity toward 150 minutes per week.</p>
        </article>
      </section>

      <section className="reset-banner">
        <div className="reset-icon"><Lightning size={27} weight="fill" /></div>
        <div>
          <span className="section-kicker light-kicker">Deliberately temporary</span>
          <h2>RELOAD = CLEAN SLATE</h2>
          <p>Workout checks, timers and the food calculator live only in this browser tab. There is no account, database, analytics or saved history.</p>
        </div>
        <CheckCircle size={36} weight="fill" />
      </section>

      <nav className="source-links" aria-label="Health and training references">
        <a className="source-note" href="https://acsm.org/resistance-training-guidelines-update-2026/" target="_blank" rel="noreferrer">
          ACSM resistance training guidance <ArrowRight size={18} />
        </a>
        <a className="source-note" href="https://www.who.int/publications/i/item/9789240014886" target="_blank" rel="noreferrer">
          WHO physical activity guidance <ArrowRight size={18} />
        </a>
        <a className="source-note" href="https://www.fda.gov/food/buy-store-serve-safe-food/safe-food-handling" target="_blank" rel="noreferrer">
          FDA safe food handling <ArrowRight size={18} />
        </a>
      </nav>
    </div>
  );
}
