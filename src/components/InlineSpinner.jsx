import "./inline-spinner.css";

export function InlineSpinner({ label = null, size = "md" }) {
  return (
    <span
      className={`inline-spinner inline-spinner--${size}`}
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      aria-hidden={label ? undefined : true}
    >
      <span className="inline-spinner__ring" aria-hidden="true" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
