import { BallIcon } from "@/ui/BallIcon";
import courtImage from "../assets/auth-court.webp";

export type AuthBrandMode = "signin" | "signup";

const COPY: Record<
  AuthBrandMode,
  { lines: string[]; accent: string; description: string }
> = {
  signin: {
    lines: ["Play.", "Compete.", "Climb."],
    accent: "Vamos!",
    description: "Dé competitieve padel-app voor jou en je vrienden.",
  },
  signup: {
    lines: ["Join the court."],
    accent: "Join Vamos!",
    description: "Maak een account en klim in het klassement.",
  },
};

export function AuthBrandPanel({ mode }: { mode: AuthBrandMode }) {
  const copy = COPY[mode];

  return (
    <aside className="login-visual" aria-hidden="true">
      <img
        className="login-visual__image"
        src={courtImage}
        alt=""
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
      <div className="login-visual__shade" />
      <div className="login-visual__copy">
        <p className="login-visual__headline">
          {copy.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
          <span className="login-visual__accent">{copy.accent}</span>
        </p>
        <p className="login-visual__description">{copy.description}</p>
      </div>
      <div className="login-visual__brand">
        <BallIcon size={21} />
        <span>Vamos!</span>
      </div>
    </aside>
  );
}

export default AuthBrandPanel;
