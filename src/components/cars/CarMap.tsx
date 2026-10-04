"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useRouter } from "next/navigation";
import { formatMAD } from "@/lib/currency";
import { useI18n } from "@/lib/i18n/client";
import { MAPBOX_ATTRIBUTION, MAPBOX_TILES } from "@/lib/mapbox";

type Pin = { id: string; lat: number; lng: number; price?: number; label?: string };

const MOROCCO_CENTER: [number, number] = [31.8, -7.1];

// Airbnb-style price pills: white with dark text; hovered/active flips to dark.
function priceIcon(text: string, active: boolean) {
  return L.divIcon({
    className: "price-pin",
    html: `<div style="transform:translate(-50%,-50%) scale(${active ? 1.08 : 1});display:inline-block;white-space:nowrap;padding:6px 11px;border-radius:999px;font:700 13px/1 var(--font-sans);letter-spacing:.01em;color:${active ? "#fff" : "#151a3d"};background:${active ? "#151a3d" : "#fff"};box-shadow:0 0 0 1px rgba(0,0,0,.06),0 2px 6px rgba(0,0,0,.18),0 6px 16px rgba(0,0,0,.12);transition:transform .2s cubic-bezier(.22,1,.36,1),background .2s,color .2s">${text}</div>`,
    iconSize: [0, 0],
  });
}

const dotIcon = L.divIcon({
  className: "price-pin",
  html: `<div style="transform:translate(-50%,-50%);width:44px;height:44px;border-radius:999px;background:rgba(96,80,220,.18);display:grid;place-items:center"><div style="width:18px;height:18px;border-radius:999px;background:#6050dc;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div></div>`,
  iconSize: [0, 0],
});

function FitBounds({ pins }: { pins: Pin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) map.setView(MOROCCO_CENTER, 5);
    else if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 13);
    else map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 13 });
  }, [map, pins]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function CarMap({
  pins,
  activeId,
  onHover,
  linkQuery,
  picker,
  onPick,
  zoom,
}: {
  pins: Pin[];
  activeId?: string | null;
  onHover?: (id: string | null) => void;
  linkQuery?: string;
  /** Picker mode: single draggable-by-click marker (listing wizard). */
  picker?: boolean;
  onPick?: (lat: number, lng: number) => void;
  zoom?: number;
}) {
  const router = useRouter();
  const { locale } = useI18n();
  const stable = useMemo(() => pins, [pins]);

  return (
    <MapContainer
      center={stable[0] ? [stable[0].lat, stable[0].lng] : MOROCCO_CENTER}
      zoom={zoom ?? 6}
      scrollWheelZoom
      className="h-full w-full"
      attributionControl
    >
      <TileLayer attribution={MAPBOX_ATTRIBUTION} url={MAPBOX_TILES} tileSize={512} zoomOffset={-1} maxZoom={19} />
      {!picker && <FitBounds pins={stable} />}
      {picker && onPick && <ClickToPick onPick={onPick} />}
      {stable.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={p.price != null ? priceIcon(formatMAD(p.price, locale), p.id === activeId) : dotIcon}
          zIndexOffset={p.id === activeId ? 1000 : 0}
          eventHandlers={
            picker || p.price == null
              ? {}
              : {
                  mouseover: () => onHover?.(p.id),
                  mouseout: () => onHover?.(null),
                  click: () => router.push(`/cars/${p.id}${linkQuery ? `?${linkQuery}` : ""}`),
                }
          }
        />
      ))}
    </MapContainer>
  );
}
