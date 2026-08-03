import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  buildLayerQuery,
  buildBundleQuery,
  layerOfElement,
  quantizeBbox,
  bboxAreaDeg,
  LAYER_MIN_ZOOM,
  LAYER_MAX_AREA,
  type BBox,
  type LayerKey,
  elementCoords,
  type OverpassElement,
} from "@/lib/oyo";
import { pointInStudyArea, type StudyArea } from "@/lib/study-area";
import { runOverpass } from "@/lib/overpass.functions";
import { useStore } from "@/lib/store";

const STALE = 30 * 60 * 1000; // 30 min
const GC = 60 * 60 * 1000; // 1 hour

async function runLayer(layer: LayerKey, bbox: BBox): Promise<OverpassElement[]> {
  const body = `[out:json][timeout:45];\n${buildLayerQuery(layer, bbox)}`;
  const res = await runOverpass({ data: { query: body } });
  return (res.elements ?? []) as OverpassElement[];
}

/**
 * Single combined request for every layer inside the selected administrative area.
 * All datasets then land in one cache entry and render together, instantly.
 */
function useBundle() {
  const studyArea = useStore((s) => s.studyArea);
  const key = studyArea
    ? `sa:${studyArea.state}/${studyArea.name}:${quantizeBbox(studyArea.bbox, 3)}`
    : "none";

  const q = useQuery({
    queryKey: ["op-bundle", key],
    queryFn: async () => {
      const body = `[out:json][timeout:90];\n${buildBundleQuery(studyArea!.bbox)}`;
      const res = await runOverpass({ data: { query: body } });
      return (res.elements ?? []) as OverpassElement[];
    },
    enabled: !!studyArea,
    staleTime: STALE,
    gcTime: GC,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 20000),
  });

  const byLayer = useMemo(() => {
    const map = new Map<LayerKey, OverpassElement[]>();
    if (!q.data || !studyArea) return map;
    for (const el of clipToStudyArea(q.data, studyArea)) {
      const l = layerOfElement(el);
      if (!l) continue;
      const arr = map.get(l);
      if (arr) arr.push(el);
      else map.set(l, [el]);
    }
    return map;
  }, [q.data, studyArea]);

  return { active: !!studyArea, byLayer, query: q };
}


/**
 * Query scope: the selected State/LGA boundary when present (all analysis is clipped
 * to it), otherwise the current map viewport.
 */
function useScope(layer: LayerKey) {
  const viewport = useStore((s) => s.viewport);
  const studyArea = useStore((s) => s.studyArea);

  if (studyArea) {
    const areaOk = bboxAreaDeg(studyArea.bbox) <= LAYER_MAX_AREA[layer] * 8;
    return {
      bounds: studyArea.bbox,
      ready: areaOk,
      key: `sa:${studyArea.state}/${studyArea.name}:${quantizeBbox(studyArea.bbox, 3)}`,
      studyArea,
    };
  }
  const zoomOk = !!viewport && viewport.zoom >= LAYER_MIN_ZOOM[layer];
  const areaOk = !!viewport && bboxAreaDeg(viewport.bounds) <= LAYER_MAX_AREA[layer];
  return {
    bounds: viewport?.bounds ?? null,
    ready: !!viewport && zoomOk && areaOk,
    key: viewport ? quantizeBbox(viewport.bounds) : "none",
    studyArea: null,
  };
}

/** Drop elements falling outside the selected administrative boundary. */
export function clipToStudyArea(
  elements: OverpassElement[],
  studyArea: StudyArea | null,
): OverpassElement[] {
  if (!studyArea) return elements;
  return elements.filter((el) => {
    const c = elementCoords(el);
    if (c) return pointInStudyArea(studyArea, c[0], c[1]);
    if (el.geometry?.length)
      return el.geometry.some((g) => pointInStudyArea(studyArea, g.lat, g.lon));
    return false;
  });
}

/** Scope-aware single-layer query with zoom + area gates. */
export function useLayerQuery(layer: LayerKey) {
  const layerOn = useStore(
    (s) => s.layers[layer as keyof ReturnType<typeof useStore.getState>["layers"]],
  );
  const scope = useScope(layer);
  const bundle = useBundle();
  // Inside a study area every layer (except buildings) comes from the single bundle request.
  const fromBundle = bundle.active && layer !== "buildings";
  const enabled = !fromBundle && !!layerOn && !!scope.bounds && scope.ready;

  const q = useQuery({
    queryKey: ["op", layer, scope.key],
    queryFn: () => runLayer(layer, scope.bounds!),
    enabled,
    staleTime: STALE,
    gcTime: GC,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 20000),
  });

  const clipped = useMemo(
    () => clipToStudyArea((q.data as OverpassElement[] | undefined) ?? [], scope.studyArea),
    [q.data, scope.studyArea],
  );

  if (fromBundle) {
    const data = bundle.query.data
      ? layerOn
        ? (bundle.byLayer.get(layer) ?? [])
        : []
      : undefined;
    return { ...bundle.query, data } as unknown as ReturnType<typeof useQuery> & {
      data: OverpassElement[] | undefined;
    };
  }

  return { ...q, data: (q.data ? clipped : q.data) as OverpassElement[] | undefined };
}

const HEALTH_CATS: LayerKey[] = [
  "hospitals",
  "clinics",
  "pharmacies",
  "healthCentres",
  "doctors",
];

/** Aggregate healthcare across categories, clipped to the selected administrative area. */
export function useHealthcare() {
  const layers = useStore((s) => s.layers);
  const studyArea = useStore((s) => s.studyArea);
  const bundle = useBundle();

  const cats = HEALTH_CATS;
  const viewport = useStore((s) => s.viewport);
  const results = useQueries({
    queries: cats.map((cat) => {
      const bounds = viewport?.bounds ?? null;
      const key = viewport ? quantizeBbox(viewport.bounds) : "none";
      const zoomOk = !!viewport && viewport.zoom >= LAYER_MIN_ZOOM[cat];
      const areaOk = !!bounds && bboxAreaDeg(bounds) <= LAYER_MAX_AREA[cat];
      const on = layers[cat as keyof typeof layers];
      return {
        queryKey: ["op", cat, key],
        queryFn: () => runLayer(cat, bounds!),
        enabled: !bundle.active && !!on && !!bounds && zoomOk && areaOk,
        staleTime: STALE,
        gcTime: GC,
        retry: 3,
        retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 20000),
      };
    }),
  });

  const raw = results.flatMap((r) => (r.data as OverpassElement[] | undefined) ?? []);
  const rawKey = results
    .map((r) => (r.data as OverpassElement[] | undefined)?.length ?? -1)
    .join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const viewportData = useMemo(() => clipToStudyArea(raw, studyArea), [rawKey, studyArea]);

  const bundleData = useMemo(
    () =>
      cats
        .filter((c) => layers[c as keyof typeof layers])
        .flatMap((c) => bundle.byLayer.get(c) ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle.byLayer, layers],
  );

  if (bundle.active) {
    return {
      data: bundleData,
      isLoading: bundle.query.isLoading,
      isFetching: bundle.query.isFetching,
      error: bundle.query.error ?? null,
    };
  }

  return {
    data: viewportData,
    isLoading: results.some((r) => r.isLoading),
    isFetching: results.some((r) => r.isFetching),
    error: results.find((r) => r.error)?.error ?? null,
  };
}

export function useEmergency() {
  return useLayerQuery("emergency");
}
export function useSettlements() {
  return useLayerQuery("settlements");
}
export function useTransport() {
  return useLayerQuery("transport");
}
export function useRoads() {
  return useLayerQuery("roads");
}
export function useBuildings() {
  return useLayerQuery("buildings");
}

/** Nigeria administrative boundary — one-shot fetch from Nominatim. */
export function useBoundary() {
  return useQuery({
    queryKey: ["boundary", "nigeria"],
    queryFn: async () => {
      const r = await fetch(
        "https://nominatim.openstreetmap.org/search?country=Nigeria&polygon_geojson=1&format=json&limit=1",
        { headers: { Accept: "application/json" } },
      );
      if (!r.ok) throw new Error("Nominatim failed");
      const j = (await r.json()) as Array<{ geojson: GeoJSON.Geometry }>;
      return j[0]?.geojson ?? null;
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });
}

export function classifyFacility(el: OverpassElement): string {
  const t = el.tags || {};
  if (t.amenity === "hospital" || t.healthcare === "hospital") return "hospital";
  if (t.amenity === "clinic" || t.healthcare === "clinic") return "clinic";
  if (t.amenity === "pharmacy" || t.healthcare === "pharmacy") return "pharmacy";
  if (t.healthcare === "centre" || t.healthcare === "center") return "health_centre";
  if (t.amenity === "doctors" || t.healthcare === "doctor") return "doctors";
  return t.healthcare || t.amenity || "other";
}

export function classifyEmergency(el: OverpassElement): string {
  const t = el.tags || {};
  if (t.emergency === "ambulance_station") return "ambulance";
  return "other";
}
