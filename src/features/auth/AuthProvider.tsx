import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { invalidateAll } from "../../lib/queryCache";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Laatst bekende gebruiker-id: om een échte accountwissel te onderscheiden van
  // een her-authenticatie van dezelfde gebruiker (bv. het bevestigen van het
  // huidige wachtwoord bij het wijzigen ervan). Alleen bij een wissel mag de
  // querycache geleegd worden; anders knippert de hele app onnodig.
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    // Bestaande sessie ophalen bij het laden van de app.
    supabase.auth.getSession().then(({ data }) => {
      prevUserId.current = data.session?.user?.id ?? null;
      setSession(data.session);
      setLoading(false);
    });

    // Meeluisteren op login/logout/token-refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      const nextId = next?.user?.id ?? null;
      // Querycache alleen legen bij een echte sessiewissel (uitloggen of een
      // andere gebruiker die inlogt): RLS-gefilterde data van de vorige
      // gebruiker mag nooit doorschemeren naar de volgende. Een SIGNED_IN met
      // dezelfde gebruiker (reauth) laat de cache met rust.
      if (
        event === "SIGNED_OUT" ||
        (event === "SIGNED_IN" && nextId !== prevUserId.current)
      ) {
        invalidateAll();
      }
      prevUserId.current = nextId;
      setSession(next);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth moet binnen <AuthProvider> gebruikt worden");
  return ctx;
}
