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

function priceIcon(text: string, active: boolean) {
  return L.divIcon({
    className: "price-pin",
    html: `<div style="transform:translate(-50%,-100%);display:inline-block;white-space:nowrap;padding:5px 10px;border-radius:999px;font:700 12px/1 var(--font-sans);color:${active ? "#050816" : "#fff"};background:${active ? "linear-gradient(135deg,#ffe08a,#ec8b6f)" : "rgba(18,26,69,.88)"};border:1px solid rgba(255,255,255,.35);box-shadow:0 6px 18px rgba(0,0,0,.45);backdrop-filter:blur(8px);transition:all .2s">${text}</div>`,
    iconSize: [0, 0],
  });
}

const dotIcon = L.divIcon({
  className: "price-pin",
  html: `<div style="transform:translate(-50%,-50%);width:22px;height:22px;border-radius:999px;background:radial-gradient(circle,#f4c430 35%,rgba(244,196,48,.25) 36%);box-shadow:0 0 0 6px rgba(244,196,48,.15)"></div>`,
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
