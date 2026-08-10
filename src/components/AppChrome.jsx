import { useEffect, useId, useRef, useState } from "react";
import {
  Barbell,
  BowlFood,
  CalendarBlank,
  ChartBar,
  CheckCircle,
  Info,
  LockKeyOpen,
  Play,
  SpeakerHigh,
  SpeakerSlash,
  Waveform,
  WarningCircle,
} from "@phosphor-icons/react";
import { InlineSpinner } from "./InlineSpinner.jsx";
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
  mutationKey,
  soundEnabled,
  syncNotice,
  onLock,
  onNavigate,
  onToggleSound,
  onTestSound,
}) {
  const busy = Boolean(mutationKey);
  const lockBusy = mutationKey === "lock";
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const [soundTestStatus, setSoundTestStatus] = useState("idle");
  const soundMenuId = useId();
  const soundTriggerRef = useRef(null);
  const soundMenuRef = useRef(null);
  const testRequestRef = useRef(0);
  const syncDetail = syncNotice?.detail ?? (
    syncNotice?.status === "saving"
      ? "Waiting for server confirmation."
      : syncNotice?.status === "saved"
        ? "Your journal is up to date."
        : "Nothing else changed. Tap again to retry."
  );

  useEffect(() => {
    if (!soundMenuOpen) return undefined;

    const focusFrame = window.requestAnimationFrame(() => {
      soundMenuRef.current?.querySelector(".app-chrome-v2__sound-test")?.focus();
    });

    const closeFromOutside = (event) => {
      if (soundMenuRef.current?.contains(event.target) || soundTriggerRef.current?.contains(event.target)) return;
      testRequestRef.current += 1;
      setSoundTestStatus("idle");
      setSoundMenuOpen(false);
    };

    const closeFromKeyboard = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      testRequestRef.current += 1;
      setSoundTestStatus("idle");
      setSoundMenuOpen(false);
      soundTriggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeFromOutside, true);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", closeFromOutside, true);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [soundMenuOpen]);

  useEffect(() => {
    testRequestRef.current += 1;
    setSoundTestStatus("idle");
    setSoundMenuOpen(false);
  }, [activePage]);

  useEffect(() => () => {
    testRequestRef.current += 1;
  }, []);

  const toggleSoundMenu = () => {
    if (soundMenuOpen) {
      testRequestRef.current += 1;
      setSoundTestStatus("idle");
      setSoundMenuOpen(false);
      return;
    }
    setSoundTestStatus("idle");
    setSoundMenuOpen(true);
  };

  const playSoundTest = async () => {
    if (soundTestStatus === "testing") return;
    const requestId = testRequestRef.current + 1;
    testRequestRef.current = requestId;
    setSoundTestStatus("testing");
    let playbackStarted = false;
    try {
      playbackStarted = await onTestSound();
    } catch {
      playbackStarted = false;
    }
    if (testRequestRef.current !== requestId) return;
    setSoundTestStatus(playbackStarted ? "played" : "blocked");
  };

  const testRunning = soundTestStatus === "testing";
  const testAttempted = soundTestStatus === "played" || soundTestStatus === "blocked";

  return (
    <div className="site-stage">
      <div className="app-shell">
        <aside className="side-rail" aria-label="Primary navigation">
          <button className="brand-mark" data-sound="navigate" onClick={() => onNavigate("workouts")} aria-label="Go to workouts">
            F<span>/</span>S
          </button>

          <nav className="rail-nav">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`rail-button ${activePage === id ? "is-active" : ""}`}
                data-sound="navigate"
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
            <button data-sound="navigate" onClick={() => onNavigate("guide")} aria-label="Open workout guide"><Info size={19} /></button>
            <button
              onClick={onLock}
              disabled={busy}
              aria-disabled={busy}
              aria-busy={lockBusy}
              aria-label={lockBusy ? "Locking application" : "Lock application"}
            >
              {lockBusy
                ? <InlineSpinner label="Locking application" size="sm" />
                : <LockKeyOpen size={19} />}
            </button>
          </div>
        </aside>

        <div className="app-main">
          <header className="utility-header">
            <button className="wordmark" data-sound="navigate" onClick={() => onNavigate("workouts")}>FORM <span>/</span> SHIFT</button>
            <div className="breadcrumb" aria-label="Current page">
              <span>Training</span><span>/</span><strong>{pageTitles[activePage]}</strong>
            </div>
            <div className="header-context">
              <button className="app-chrome-v2__guide" data-sound="navigate" onClick={() => onNavigate("guide")}><Info size={18} /> Guide</button>
              <div className="target-pill">~2,000 kcal · 100–120 g protein</div>
              <div className="app-chrome-v2__sound-wrap">
                <button
                  ref={soundTriggerRef}
                  className={`app-chrome-v2__sound ${soundMenuOpen ? "is-open" : ""}`}
                  type="button"
                  data-sound="off"
                  onClick={toggleSoundMenu}
                  aria-label="Open sound controls"
                  aria-haspopup="dialog"
                  aria-expanded={soundMenuOpen}
                  aria-controls={soundMenuId}
                  title={soundEnabled ? "Sounds on" : "Sounds muted"}
                >
                  {soundEnabled ? <SpeakerHigh size={19} weight="fill" /> : <SpeakerSlash size={19} />}
                </button>

                {soundMenuOpen && (
                  <div
                    ref={soundMenuRef}
                    className="app-chrome-v2__sound-menu"
                    id={soundMenuId}
                    role="dialog"
                    aria-labelledby={`${soundMenuId}-title`}
                  >
                    <div className="app-chrome-v2__sound-heading">
                      <span className="app-chrome-v2__sound-mark"><Waveform size={18} weight="bold" /></span>
                      <span>
                        <strong id={`${soundMenuId}-title`}>Sound check</strong>
                        <small className={soundEnabled ? "is-on" : ""}>{soundEnabled ? "Sounds on" : "Sounds muted"}</small>
                      </span>
                    </div>
                    <p>Run a loud sample once before training. This test works even while interface sounds are muted.</p>
                    <button
                      className="app-chrome-v2__sound-test"
                      type="button"
                      data-sound="off"
                      data-haptic="saved"
                      onClick={playSoundTest}
                      disabled={testRunning}
                      aria-busy={testRunning}
                    >
                      {testRunning ? <Waveform size={19} weight="bold" /> : <SpeakerHigh size={19} weight="fill" />}
                      <span>{testRunning ? "Testing speaker…" : testAttempted ? "Retry loud test" : "Play loud test"}</span>
                    </button>
                    {soundTestStatus === "played" && (
                      <div className="app-chrome-v2__sound-result is-played" role="status" aria-live="polite">Playback started — did you hear it?</div>
                    )}
                    {soundTestStatus === "blocked" && (
                      <div className="app-chrome-v2__sound-result is-blocked" role="status" aria-live="polite">Playback blocked — tap to retry.</div>
                    )}
                    <small className="app-chrome-v2__sound-hint">No sound? Raise media volume and check the current Bluetooth output.</small>
                    <button
                      className="app-chrome-v2__sound-toggle"
                      type="button"
                      data-sound="off"
                      onClick={onToggleSound}
                    >
                      {soundEnabled ? <SpeakerSlash size={17} /> : <SpeakerHigh size={17} weight="fill" />}
                      {soundEnabled ? "Mute interface sounds" : "Turn interface sounds on"}
                    </button>
                  </div>
                )}
              </div>
              <button
                className="app-chrome-v2__lock"
                onClick={onLock}
                disabled={busy}
                aria-disabled={busy}
                aria-busy={lockBusy}
                aria-label={lockBusy ? "Locking application" : "Lock app"}
              >
                {lockBusy
                  ? <InlineSpinner label="Locking application" size="sm" />
                  : <LockKeyOpen size={19} />}
              </button>
            </div>
          </header>

          {activeSession && activePage !== "session" && (
            <button className={`app-chrome-v2__active tone-bg-${activeTemplate?.tone ?? "coral"}`} data-sound="navigate" onClick={() => onNavigate("session")}>
              <span className="app-chrome-v2__active-icon"><Play size={18} weight="fill" /></span>
              <span><small>Workout in progress</small><strong>Continue Session {activeSession.templateId}</strong></span>
              <span>Resume <Play size={15} weight="fill" /></span>
            </button>
          )}

          <main className="page-canvas">
            <div className="page-transition-layer" key={activePage}>{children}</div>
          </main>
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={activePage === id ? "is-active" : ""}
              data-sound="navigate"
              onClick={() => onNavigate(id)}
              aria-current={activePage === id ? "page" : undefined}
            >
              <span className="mobile-icon-wrap"><Icon size={21} weight={activePage === id ? "fill" : "regular"} /></span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {syncNotice && (
          <div
            className={`app-sync-notice is-${syncNotice.status}`}
            key={`${syncNotice.status}:${syncNotice.message}`}
            role={syncNotice.status === "error" ? "alert" : "status"}
            aria-live={syncNotice.status === "error" ? "assertive" : "polite"}
            aria-atomic="true"
          >
            <span className="app-sync-notice__icon">
              {syncNotice.status === "saving" && <InlineSpinner size="sm" />}
              {syncNotice.status === "saved" && <CheckCircle size={17} weight="fill" />}
              {syncNotice.status === "error" && <WarningCircle size={17} weight="fill" />}
            </span>
            <span className="app-sync-notice__copy">
              <strong>{syncNotice.message}</strong>
              <small>{syncDetail}</small>
            </span>
            <i className="app-sync-notice__track" aria-hidden="true"><b /></i>
          </div>
        )}
      </div>
    </div>
  );
}
