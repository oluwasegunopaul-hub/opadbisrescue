import { useEffect, useRef } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { useStore } from "@/lib/store";

/** Renders the selected administrative boundary and animates the map to it. */
export default function StudyAreaLayer() {
  const studyArea = useStore((s) => s.studyArea);
  const map = useMap();
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!studyArea) {
      lastRef.current = null;
      return;
    }
    const sig = `${studyArea.state}/${studyArea.name}`;
    if (lastRef.current === sig) return;
    lastRef.current = sig;
    const b = L.latLngBounds(
      [studyArea.bbox.south, studyArea.bbox.west],
      [studyArea.bbox.north, studyArea.bbox.east],
    );
    map.flyToBounds(b, { padding: [28, 28], duration: 0.9 });
  }, [studyArea, map]);

  if (!studyArea) return null;
  return (
    <GeoJSON
      key={`${studyArea.state}-${studyArea.name}-${studyArea.featureCount}`}
      data={studyArea.geojson}
      style={{
        color: "#0ea5e9",
        weight: 2.5,
        fillColor: "#0ea5e9",
        fillOpacity: 0.06,
        dashArray: "6 4",
      }}
      interactive={false}
    />
  );
}

/** Small badge showing the active LGA, its state and boundary area. */
export function StudyAreaBadge() {
  const studyArea = useStore((s) => s.studyArea);
  if (!studyArea) return null;
  return (
    <div className="pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300 rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="font-semibold">{studyArea.name}</div>
      <div className="text-muted-foreground">
        {studyArea.state} State · {studyArea.level}
      </div>
      <div className="text-muted-foreground">
        {studyArea.areaKm2.toLocaleString(undefined, { maximumFractionDigits: 0 })} km² boundary
      </div>
    </div>
  );
}
