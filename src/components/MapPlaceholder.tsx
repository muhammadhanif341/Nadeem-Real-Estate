import { MapPin } from "lucide-react";

/**
 * Stand-in for a real Mapbox GL JS map. No API key is configured in this
 * environment (see .env.example: NEXT_PUBLIC_MAPBOX_TOKEN), so this
 * renders a static, on-brand placeholder instead of failing at build/
 * runtime. Swap this component's contents for a <Map> from `mapbox-gl` /
 * `react-map-gl` once a token is available — every call site passes the
 * same `location` prop already.
 */
export function MapPlaceholder({ location }: { location: string }) {
  return (
    <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-bg-alt text-text-muted">
      <MapPin size={28} aria-hidden="true" />
      <p className="text-sm">{location}</p>
      <p className="text-xs">
        Map preview — connect NEXT_PUBLIC_MAPBOX_TOKEN to enable
      </p>
    </div>
  );
}
