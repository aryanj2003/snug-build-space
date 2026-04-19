import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface TraceCtx {
  hovered: string | null;
  setHovered: (k: string | null) => void;
}

const Ctx = createContext<TraceCtx>({ hovered: null, setHovered: () => {} });

export function TraceProvider({ children }: { children: ReactNode }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const value = useMemo(() => ({ hovered, setHovered }), [hovered]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrace() {
  return useContext(Ctx);
}
