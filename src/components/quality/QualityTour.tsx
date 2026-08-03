import { useCallback, useEffect, useState } from "react";
import GuidedTour from "@/components/tour/TourEngine";
import { qualityTour } from "@/components/tour/quality-tour";

const TOUR_KEY = "osm-quality-tour-v2";

/** Opens the quality tour automatically on a user's first visit. */
export function useFirstVisitTour() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) setOpen(true);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);
  return { open, setOpen, close };
}

export default function QualityTour({
  open,
  onClose,
  onOpenChange,
}: {
  open: boolean;
  onClose: () => void;
  onOpenChange?: (v: boolean) => void;
}) {
  return (
    <GuidedTour
      tour={qualityTour}
      open={open}
      onOpenChange={(v) => (onOpenChange ? onOpenChange(v) : v ? undefined : onClose())}
    />
  );
}
