import {
  createContext,
  useContext,
  useEffect,
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

  useEffect(() => {
    // Bestaande sessie ophalen bij het laden van de app.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Meeluisteren op login/logout/token-refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Querycache legen bij een sessiewissel: RLS-gefilterde data van de
      // vorige gebruiker mag nooit doorschemeren naar de volgende.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") invalidateAll();
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
