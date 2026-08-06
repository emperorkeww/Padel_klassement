import { BallIcon } from "@/ui/BallIcon";

export function AuthHeader({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
}) {
  return (
    <>
      <div className="login-brand" role="img" aria-label="Vamos!">
        <BallIcon />
        <span className="login-brand__name">Vamos!</span>
      </div>
      <header className="login-head">
        {eyebrow && <span className="login-eyebrow">{eyebrow}</span>}
        <h1 className="login-title">{title}</h1>
        <p className="login-subtitle">{subtitle}</p>
      </header>
    </>
  );
}

export default AuthHeader;
