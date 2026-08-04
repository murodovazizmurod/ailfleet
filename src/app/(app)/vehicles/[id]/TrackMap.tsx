"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export type TrackPoint = { lat: number; lng: number; date: string };

type Live = {
  latitude: number;
  longitude: number;
  speedMph: number | null;
  address: string | null;
  engineState: string | null;
  fuelPercent: number | null;
  updatedAt: string;
  live: boolean;
};

const POLL_MS = 20000;

function markerColor(engineState: string | null): string {
  if (engineState === "On") return "#a3e635";
  if (engineState === "Idle") return "#fbbf24";
  return "#7e8ca0";
}

export function TrackMap({
  vehicleId,
  vehicleName,
  initialTrail,
}: {
  vehicleId: string;
  vehicleName: string;
  initialTrail: TrackPoint[]; // oldest → newest, non-empty
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const trailRef = useRef<import("leaflet").Polyline | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [status, setStatus] = useState<Live | null>(null);

  // Map init
  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const last = initialTrail[initialTrail.length - 1];
      const map = L.map(containerRef.current, { zoomControl: true }).setView(
        [last.lat, last.lng],
        11
      );
      mapRef.current = map;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      trailRef.current = L.polyline(
        initialTrail.map((p) => [p.lat, p.lng]),
        { color: "#a3e635", weight: 2.5, opacity: 0.7, dashArray: "1 6" }
      ).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<span id="track-dot-${vehicleId}" style="display:block;width:14px;height:14px;border-radius:9999px;background:#7e8ca0;border:2px solid #0b0f14;box-shadow:0 0 8px #7e8ca0;transform:translate(-50%,-50%)"></span>`,
        iconSize: [0, 0],
      });
      markerRef.current = L.marker([last.lat, last.lng], { icon }).addTo(map);
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  // Poll live position
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/track/${vehicleId}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as Live;
        setStatus(data);

        const L = leafletRef.current;
        const map = mapRef.current;
        if (!L || !map || !markerRef.current || !trailRef.current) return;

        const pos: [number, number] = [data.latitude, data.longitude];
        markerRef.current.setLatLng(pos);
        const dot = document.getElementById(`track-dot-${vehicleId}`);
        if (dot) {
          const c = markerColor(data.engineState);
          dot.style.background = c;
          dot.style.boxShadow = `0 0 8px ${c}`;
        }
        const latlngs = trailRef.current.getLatLngs() as import("leaflet").LatLng[];
        const tail = latlngs[latlngs.length - 1];
        if (!tail || tail.lat !== pos[0] || tail.lng !== pos[1]) {
          trailRef.current.addLatLng(pos);
        }
        if (!map.getBounds().contains(pos)) map.panTo(pos);
      } catch {
        /* transient network error — next poll retries */
      }
    };
    void tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [vehicleId]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {status?.live ? (
            <span className="flex items-center gap-1.5 font-semibold text-[#a3e635]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#a3e635] opacity-60"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#a3e635]"></span>
              </span>
              LIVE · updates every {POLL_MS / 1000}s
            </span>
          ) : (
            <span className="text-slate-400">Last known position</span>
          )}
          {status?.speedMph != null ? (
            <span className="text-slate-500">{Math.round(status.speedMph)} mph</span>
          ) : null}
          {status?.engineState ? (
            <span className="text-slate-500">engine {status.engineState.toLowerCase()}</span>
          ) : null}
          {status?.fuelPercent != null ? (
            <span className="text-slate-500">fuel {status.fuelPercent}%</span>
          ) : null}
        </div>
        {status?.address ? (
          <span className="truncate text-slate-400" title={status.address}>
            {status.address}
          </span>
        ) : null}
      </div>
      <style>{`.leaflet-container { background: #0b0f14; font: inherit; }`}</style>
      <div
        ref={containerRef}
        aria-label={`Live tracking map for ${vehicleName}`}
        className="h-72 w-full overflow-hidden rounded-lg border border-slate-200"
      />
    </div>
  );
}
