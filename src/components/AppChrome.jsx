import {
  Barbell,
  BowlFood,
  CalendarBlank,
  ChartBar,
  Info,
  LockKeyOpen,
  Play,
} from "@phosphor-icons/react";
import "./app-chrome-v2.css";

const navItems = [
  { id: "workouts", label: "Workouts", icon: Barbell },
  { id: "food", label: "Food", icon: BowlFood },
  { id: "calendar", label: "Calendar", icon: CalendarBlank },
  { id: "analytics", label: "Analytics", icon: ChartBar },
];

const pageTitles = {
  workouts: "Workout library",
  food: "Food index",
  calendar: "Training calendar",
  analytics: "Training analytics",
  session: "Active workout",
  guide: "Quick guide",
};

export function AppChrome({
  activePage,
  activeSession,
  activeTemplate,
  children,
  onLock,
  onNavigate,
}) {
  return (
    <div className="site-stage">
      <div className="app-shell">
        <aside className="side-rail" aria-label="Primary navigation">
          <button className="brand-mark" onClick={() => onNavigate("workouts")} aria-label="Go to workouts">
            F<span>/</span>S
          </button>

          <nav className="rail-nav">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`rail-button ${activePage === id ? "is-active" : ""}`}
                onClick={() => onNavigate(id)}
                aria-label={label}
                aria-current={activePage === id ? "page" : undefined}
              >
                <Icon size={23} weight={activePage === id ? "fill" : "regular"} />
                <span className="rail-tooltip">{label}</span>
              </button>
            ))}
          </nav>

          <div className="app-chrome-v2__rail-actions">
            <button onClick={() => onNavigate("guide")} aria-label="Open workout guide"><Info size={19} /></button>
            <button onClick={onLock} aria-label="Lock application"><LockKeyOpen size={19} /></button>
          </div>
        </aside>

        <div className="app-main">
          <header className="utility-header">
            <button className="wordmark" onClick={() => onNavigate("workouts")}>FORM <span>/</span> SHIFT</button>
            <div className="breadcrumb" aria-label="Current page">
              <span>Training</span><span>/</span><strong>{pageTitles[activePage]}</strong>
            </div>
            <div className="header-context">
              <button className="app-chrome-v2__guide" onClick={() => onNavigate("guide")}><Info size={18} /> Guide</button>
              <div className="target-pill">~2,000 kcal · 100–120 g protein</div>
              <button className="app-chrome-v2__lock" onClick={onLock} aria-label="Lock app"><LockKeyOpen size={19} /></button>
            </div>
          </header>

          {activeSession && activePage !== "session" && (
            <button className={`app-chrome-v2__active tone-bg-${activeTemplate?.tone ?? "coral"}`} onClick={() => onNavigate("session")}>
              <span className="app-chrome-v2__active-icon"><Play size={18} weight="fill" /></span>
              <span><small>Workout in progress</small><strong>Continue Session {activeSession.templateId}</strong></span>
              <span>Resume <Play size={15} weight="fill" /></span>
            </button>
          )}

          <main className="page-canvas">{children}</main>
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={activePage === id ? "is-active" : ""}
              onClick={() => onNavigate(id)}
              aria-current={activePage === id ? "page" : undefined}
            >
              <span className="mobile-icon-wrap"><Icon size={21} weight={activePage === id ? "fill" : "regular"} /></span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

