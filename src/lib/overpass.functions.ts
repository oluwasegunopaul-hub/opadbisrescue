import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const runOverpass = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ query: z.string().min(1).max(20000) }).parse(data))
  .handler(async ({ data }) => {
    const endpoints = [
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ];
    const body = "data=" + encodeURIComponent(data.query);
    let lastErr = "unknown";
    for (const url of endpoints) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 60000);
        const res = await fetch(url, {
          method: "POST",
          body,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "Oyo opadbisrescue GIS Dashboard/1.0 (OpenStreetMap data viewer)",
          },
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!res.ok) {
          lastErr = `${url} → ${res.status}`;
          continue;
        }
        const text = await res.text();
        // Overpass returns HTML on rate-limit / timeout with 200 sometimes
        if (text.trim().startsWith("<")) {
          lastErr = `${url} → non-json response`;
          continue;
        }
        const json = JSON.parse(text);
        return { elements: json.elements ?? [], source: url };
      } catch (e) {
        lastErr = `${url} → ${(e as Error).message}`;
      }
    }
    throw new Error("All Overpass endpoints failed: " + lastErr);
  });
