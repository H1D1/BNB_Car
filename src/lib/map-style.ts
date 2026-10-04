import type { Map as MapboxMap, FilterSpecification } from "mapbox-gl";
import type { Locale } from "./types";

/**
 * Converts the style's worldview filters to Morocco's ("MA"): the southern provinces are drawn
 * as part of Morocco with no disputed boundary line or separate label. Labels are deduplicated
 * per `match` branch so the expression stays valid.
 */
export function toMoroccoWorldview(expr: unknown): unknown {
  if (!Array.isArray(expr)) return expr;
  if (expr[0] === "match" && JSON.stringify(expr[1]) === '["get","worldview"]') {
    const out: unknown[] = [expr[0], expr[1]];
    const seen = new Set<string>();
    for (let i = 2; i < expr.length - 1; i += 2) {
      const raw = Array.isArray(expr[i]) ? (expr[i] as string[]) : [expr[i] as string];
      const labels = raw.map((l) => (l === "US" ? "MA" : l)).filter((l) => !seen.has(l));
      labels.forEach((l) => seen.add(l));
      if (labels.length) out.push(labels.length === 1 ? labels[0] : labels, expr[i + 1]);
    }
    out.push(expr[expr.length - 1]);
    return out;
  }
  return expr.map(toMoroccoWorldview);
}

// Layers that add noise (and tile/label work) at country-scale storytelling zooms.
const NOISE = /poi|building|transit|aeroway|airport|ferry|road-label|road-number|road-exit|golf|pitch|path|bridge-pedestrian|tunnel-path/;

/** Moroccan worldview, labels in the visitor's language, and a decluttered basemap. */
export function prepareStoryStyle(map: MapboxMap, locale: Locale) {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (NOISE.test(layer.id)) {
      map.removeLayer(layer.id);
      continue;
    }
    if ("filter" in layer && layer.filter && JSON.stringify(layer.filter).includes("worldview")) {
      map.setFilter(layer.id, toMoroccoWorldview(layer.filter) as FilterSpecification);
    }
    if (layer.type === "symbol") {
      const tf = map.getLayoutProperty(layer.id, "text-field");
      if (tf && JSON.stringify(tf).includes('"name')) {
        map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", `name_${locale}`], ["get", "name"]]);
      }
    }
  }
}
