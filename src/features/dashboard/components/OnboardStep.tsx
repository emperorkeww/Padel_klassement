import { Link } from "react-router-dom";

export function OnboardStep({
  done,
  to,
  label,
  hint,
}: {
  done: boolean;
  to: string;
  label: string;
  hint: string;
}) {
  return (
    <li className={`onboard__item ${done ? "is-done" : ""}`}>
      <span className="onboard__check" aria-hidden="true">
        {done ? "✓" : ""}
      </span>
      <span className="onboard__text">
        <span className="onboard__label">{label}</span>
        <span className="onboard__hint">{hint}</span>
      </span>
      {!done && (
        <Link className="btn btn--sm" to={to}>
          Start
        </Link>
      )}
    </li>
  );
}