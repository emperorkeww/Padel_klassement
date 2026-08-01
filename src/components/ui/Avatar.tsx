// Speler-avatar: foto indien aanwezig, anders initialen op een kleur die
// stabiel uit de naam volgt (dezelfde speler krijgt overal dezelfde tint).
// De initialen zelf komen uit lib/utils/initialen — gedeeld met de plekken die
// hun eigen avatarvorm tekenen (#949).

import { initialen } from "@/lib/utils/initialen";

export type AvatarSource = {
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

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
      {url ? <img src={url} alt="" loading="lazy" /> : initialen(label, short)}
    </span>
  );
}

export default Avatar;
