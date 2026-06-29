/* =========================================================================
   PERSISTENCE
   Best-effort localStorage wrapper. Every call is guarded so the app keeps
   working in sandboxes / private modes where storage may throw.
   ========================================================================= */

const STORE_KEY = 'padel-tournament-v1';

const storage = {
  save(obj){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(obj)); }catch(_){ /* ignore */ } },
  load(){ try{ const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : null; }catch(_){ return null; } },
  clear(){ try{ localStorage.removeItem(STORE_KEY); }catch(_){ } },
};
