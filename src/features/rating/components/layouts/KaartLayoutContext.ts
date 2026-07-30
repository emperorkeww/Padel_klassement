import { createContext, useContext } from "react";
import type { DivisieKaartLayout } from "./kaartLayout";

export const KaartLayoutContext = createContext<
  DivisieKaartLayout | undefined
>(undefined);

export const useKaartLayout = () => useContext(KaartLayoutContext);
