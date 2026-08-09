import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Barbell,
  Fingerprint,
  LockKey,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { InlineSpinner } from "./InlineSpinner.jsx";
import "./owner-gate.css";

export function OwnerGate({ busy, error, onUnlock }) {
  const [pin, setPin] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (pin.length < 4 || busy) return;
    await onUnlock(pin);
  }

  return (
    <main className="owner-gate">
      <section className="owner-gate__card">
        <div className="owner-gate__mark"><Barbell size={30} weight="fill" /></div>
        <span className="owner-gate__kicker">Single-owner training journal</span>
        <h1>UNLOCK YOUR<br />WORKOUT RUNWAY.</h1>
        <p>The PIN protects your active session, history and weight entries. Your phone stays unlocked for 30 days.</p>

        <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor="owner-pin">Four-digit PIN</label>
          <div className="owner-gate__pin-row">
            <div className="owner-gate__pin-input">
              <LockKey size={20} weight="fill" />
              <input
                ref={inputRef}
                id="owner-pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="[0-9]*"
                maxLength={12}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                aria-describedby={error ? "unlock-error" : undefined}
                aria-disabled={busy}
                disabled={busy}
                placeholder="••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy || pin.length < 4}
              aria-disabled={busy || pin.length < 4}
              aria-busy={busy}
            >
              {busy ? <InlineSpinner /> : null}
              {busy ? "Unlocking" : "Unlock"}
              {busy ? null : <ArrowRight size={20} />}
            </button>
          </div>
          {error && (
            <div id="unlock-error" className="owner-gate__error" role="alert">
              <WarningCircle size={19} weight="fill" /> {error}
            </div>
          )}
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
