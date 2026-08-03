import { useEffect, useState } from "react";

/** Returns true after the first client render. Use to gate window-only components. */
export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}
