// Speler-avatar: foto indien aanwezig, anders initialen op een kleur die
// stabiel uit de naam volgt (dezelfde speler krijgt overal dezelfde tint).

export type AvatarSource = {
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

function initials(name: string, short: boolean): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (short || parts.length === 1)
    return parts[0].slice(0, short ? 1 : 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hueIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 8;
}

export function Avatar({
  profile,
  name,
  size = 32,
  short = false,
}: {
  profile?: AvatarSource | null;
  /** Expliciete naam; wint van profile. */
  name?: string;
  size?: number;
  /** Eén letter i.p.v. twee — voor overlappende avatar-paren. */
  short?: boolean;
}) {
  const label =
    name ?? profile?.full_name?.trim() ?? profile?.username ?? "?";
  const url = profile?.avatar_url ?? null;

  return (
    <span
      className={`avatar avatar--h${hueIndex(label)}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" loading="lazy" /> : initials(label, short)}
    </span>
  );
}

export default Avatar;
