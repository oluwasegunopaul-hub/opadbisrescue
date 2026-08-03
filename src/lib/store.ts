import { create } from "zustand";
import type { BBox, OverpassElement } from "./oyo";
import type { StudyArea } from "./study-area";

export type UserLocation = { lat: number; lng: number; accuracy: number };
export type NearestCategory = "hospital" | "clinic" | "pharmacy" | "ambulance";
export type NearestHit = {
  category: NearestCategory;
  element: OverpassElement;
  coords: [number, number];
  distanceKm: number;
};
export type NearestResults = Partial<Record<NearestCategory, NearestHit>>;
export type RouteStepLite = {
  instruction: string;
  distanceM: number;
  durationS: number;
  name: string;
  type: string;
  modifier?: string;
  location: [number, number];
};
export type ActiveRoute = {
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
  destination: NearestHit;
  steps?: RouteStepLite[];
};

export type BasemapKey = "osm" | "hot" | "esri-imagery" | "carto-light" | "carto-dark";
export type NavKey =
  | "dashboard"
  | "healthcare"
  | "accessibility"
  | "emergency"
  | "statistics"
  | "settings";

export type LayerToggles = {
  hospitals: boolean;
  clinics: boolean;
  pharmacies: boolean;
  healthCentres: boolean;
  doctors: boolean;
  emergency: boolean;
  settlements: boolean;
  transport: boolean;
  roads: boolean;
  boundary: boolean;
};

type State = {
  nav: NavKey;
  setNav: (n: NavKey) => void;
  basemap: BasemapKey;
  setBasemap: (b: BasemapKey) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  layers: LayerToggles;
  toggleLayer: (k: keyof LayerToggles) => void;
  selected: OverpassElement | null;
  setSelected: (e: OverpassElement | null) => void;
  emergencyPoint: [number, number] | null;
  setEmergencyPoint: (p: [number, number] | null) => void;
  search: string;
  setSearch: (s: string) => void;
  facilityFilter: string; // "all" | "hospital" | "clinic" | "pharmacy" | ...
  setFacilityFilter: (s: string) => void;
  viewport: { bounds: BBox; zoom: number } | null;
  setViewport: (v: { bounds: BBox; zoom: number } | null) => void;
  userLocation: UserLocation | null;
  setUserLocation: (u: UserLocation | null) => void;
  nearest: NearestResults | null;
  setNearest: (n: NearestResults | null) => void;
  nearestLoading: boolean;
  setNearestLoading: (b: boolean) => void;
  nearestError: string | null;
  setNearestError: (s: string | null) => void;
  activeRoute: ActiveRoute | null;
  setActiveRoute: (r: ActiveRoute | null) => void;
  panelOpen: boolean;
  setPanelOpen: (b: boolean) => void;
  navGuideOpen: boolean;
  setNavGuideOpen: (b: boolean) => void;
  studyArea: StudyArea | null;
  setStudyArea: (a: StudyArea | null) => void;
  selectedState: string | null;
  selectedLga: string | null;
  setAdminSelection: (state: string | null, lga: string | null) => void;
};

export const useStore = create<State>((set) => ({
  nav: "dashboard",
  setNav: (nav) => set({ nav }),
  basemap: "carto-light",
  setBasemap: (basemap) => set({ basemap }),
  theme: "light",
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "light" ? "dark" : "light";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next === "dark");
      }
      return { theme: next };
    }),
  layers: {
    hospitals: true,
    clinics: true,
    pharmacies: true,
    healthCentres: true,
    doctors: true,
    emergency: true,
    settlements: false,
    transport: false,
    roads: true,
    boundary: true,
  },
  toggleLayer: (k) =>
    set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  selected: null,
  setSelected: (selected) => set({ selected }),
  emergencyPoint: null,
  setEmergencyPoint: (emergencyPoint) => set({ emergencyPoint }),
  search: "",
  setSearch: (search) => set({ search }),
  facilityFilter: "all",
  setFacilityFilter: (facilityFilter) => set({ facilityFilter }),
  viewport: null,
  setViewport: (viewport) => set({ viewport }),
  userLocation: null,
  setUserLocation: (userLocation) => set({ userLocation }),
  nearest: null,
  setNearest: (nearest) => set({ nearest }),
  nearestLoading: false,
  setNearestLoading: (nearestLoading) => set({ nearestLoading }),
  nearestError: null,
  setNearestError: (nearestError) => set({ nearestError }),
  activeRoute: null,
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  panelOpen: false,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  navGuideOpen: false,
  setNavGuideOpen: (navGuideOpen) => set({ navGuideOpen }),
  studyArea: null,
  setStudyArea: (studyArea) => set({ studyArea }),
  selectedState: null,
  selectedLga: null,
  setAdminSelection: (selectedState, selectedLga) =>
    set({ selectedState, selectedLga, selected: null, activeRoute: null }),
}));
