import { useState } from "react";
import {
  ArrowRight,
  Backspace,
  Barbell,
  Fingerprint,
  LockKey,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { InlineSpinner } from "./InlineSpinner.jsx";
import "./owner-gate.css";

const PIN_LENGTH = 4;
const PIN_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function OwnerGate({ busy, error, onUnlock }) {
  const [pin, setPin] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (pin.length !== PIN_LENGTH || busy) return;
    const unlocked = await onUnlock(pin);
    if (!unlocked) setPin("");
  }

  function appendDigit(digit) {
    if (busy) return;
    setPin((current) => current.length >= PIN_LENGTH ? current : `${current}${digit}`);
  }

  function removeDigit() {
    if (busy) return;
    setPin((current) => current.slice(0, -1));
  }

  function handleKeyDown(event) {
    if (busy) return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      appendDigit(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      removeDigit();
    } else if (event.key === "Delete" || event.key === "Escape") {
      event.preventDefault();
      setPin("");
    }
  }

  return (
    <main className="owner-gate">
      <section className="owner-gate__card">
        <div className="owner-gate__mark"><Barbell size={30} weight="fill" /></div>
        <span className="owner-gate__kicker">Single-owner training journal</span>
        <h1>UNLOCK YOUR<br />WORKOUT RUNWAY.</h1>
        <p>The PIN protects your active session, history and weight entries. Unlock once each workout day; access resets at 4:00 AM Chennai time.</p>

        <form onSubmit={submit} onKeyDown={handleKeyDown} aria-busy={busy}>
          <div className="owner-gate__unlock-head">
            <label id="owner-pin-label">Enter your four-digit PIN</label>
            <span>Daily access · expires at 04:00</span>
          </div>

          <div
            className={`owner-gate__pin-display ${error ? "has-error" : ""}`}
            role="status"
            aria-labelledby="owner-pin-label"
            aria-describedby={error ? "unlock-error" : undefined}
            aria-label={`${pin.length} of ${PIN_LENGTH} PIN digits entered`}
          >
            <LockKey size={21} weight="fill" />
            <div className="owner-gate__pin-slots" aria-hidden="true">
              {Array.from({ length: PIN_LENGTH }, (_, index) => (
                <span className={index < pin.length ? "is-filled" : ""} key={index}>
                  {index < pin.length ? "•" : ""}
                </span>
              ))}
            </div>
            <small>{pin.length}/{PIN_LENGTH}</small>
          </div>

          <div className="owner-gate__keypad" role="group" aria-label="On-screen PIN keypad">
            {PIN_DIGITS.map((digit) => (
              <button
                autoFocus={digit === 1}
                type="button"
                className="owner-gate__key"
                onClick={() => appendDigit(digit)}
                disabled={busy || pin.length >= PIN_LENGTH}
                aria-label={`PIN digit ${digit}`}
                key={digit}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="owner-gate__key owner-gate__key--utility"
              onClick={() => setPin("")}
              disabled={busy || pin.length === 0}
            >
              Clear
            </button>
            <button
              type="button"
              className="owner-gate__key"
              onClick={() => appendDigit(0)}
              disabled={busy || pin.length >= PIN_LENGTH}
              aria-label="PIN digit 0"
            >
              0
            </button>
            <button
              type="button"
              className="owner-gate__key owner-gate__key--utility"
              onClick={removeDigit}
              disabled={busy || pin.length === 0}
              aria-label="Delete last PIN digit"
            >
              <Backspace size={23} weight="bold" />
            </button>
          </div>

          {error && (
            <div id="unlock-error" className="owner-gate__error" role="alert">
              <WarningCircle size={19} weight="fill" /> {error}
            </div>
          )}

          <button
            type="submit"
            className="owner-gate__submit"
            disabled={busy || pin.length !== PIN_LENGTH}
            aria-disabled={busy || pin.length !== PIN_LENGTH}
            aria-busy={busy}
          >
            {busy ? <InlineSpinner /> : null}
            {busy ? "Unlocking journal" : "Unlock journal"}
            {busy ? null : <ArrowRight size={20} weight="bold" />}
          </button>
        </form>

        <div className="owner-gate__trust">
          <div><Fingerprint size={22} weight="fill" /><span>No email or account setup</span></div>
          <div><ShieldCheck size={22} weight="fill" /><span>Private database writes</span></div>
        </div>
      </section>
      <aside className="owner-gate__aside" aria-label="Protected data preview">
        <div className="owner-gate__aside-head">
          <span>FORM / SHIFT</span>
          <div><LockKey size={18} weight="fill" /> owner only</div>
        </div>
        <div className="owner-gate__mosaic">
          <article className="owner-gate__mosaic-main">
            <span>Resume across devices</span>
            <strong>ONE ACTIVE<br />SESSION.</strong>
            <p>Every completed set receives its own timestamp.</p>
          </article>
          <article className="owner-gate__mosaic-small owner-gate__mosaic-small--butter">
            <span>04:00</span><strong>Workout-day boundary</strong>
          </article>
          <article className="owner-gate__mosaic-small owner-gate__mosaic-small--aqua">
            <span>KG</span><strong>Weight trend</strong>
          </article>
        </div>
      </aside>
    </main>
  );
}
