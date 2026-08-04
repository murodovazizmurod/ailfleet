"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";

export type MapVehicle = {
  id: string;
  name: string;
  title: string;
  status: string;
  lat: number;
  lng: number;
  speedMph: number | null;
  heading: number | null;
  address: string | null;
  updatedAt: string;
  engineState: string | null;
  fuelPercent: number | null;
  driver: string | null;
};

// Marker color by engine state (fallback: vehicle status).
function markerColor(v: MapVehicle): string {
  if (v.engineState === "On") return "#a3e635"; // moving/running — lime
  if (v.engineState === "Idle") return "#fbbf24"; // idling — amber
  if (v.status === "out_of_service" || v.status === "in_shop") return "#f87171";
  return "#7e8ca0"; // off / unknown — gray
}

function popupHtml(v: MapVehicle): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows: string[] = [];
  if (v.driver) rows.push(`<div><span style="color:#98a5b8">Driver:</span> ${esc(v.driver)}</div>`);
  if (v.speedMph != null)
    rows.push(`<div><span style="color:#98a5b8">Speed:</span> ${Math.round(v.speedMph)} mph</div>`);
  if (v.engineState)
    rows.push(`<div><span style="color:#98a5b8">Engine:</span> ${esc(v.engineState)}</div>`);
  if (v.fuelPercent != null)
    rows.push(`<div><span style="color:#98a5b8">Fuel:</span> ${v.fuelPercent}%</div>`);
  if (v.address)
    rows.push(`<div style="margin-top:4px;color:#98a5b8">${esc(v.address)}</div>`);
  rows.push(
    `<div style="margin-top:4px;color:#5d6b80;font-size:11px">Updated ${esc(new Date(v.updatedAt).toLocaleString())}</div>`
  );
  return `
    <div style="font-family:inherit;min-width:200px">
      <div style="font-weight:600;font-size:14px;margin-bottom:2px">${esc(v.name)}</div>
      <div style="color:#98a5b8;font-size:12px;margin-bottom:6px">${esc(v.title)}</div>
      <div style="font-size:12px;line-height:1.6">${rows.join("")}</div>
      <a href="/vehicles/${v.id}" style="display:inline-block;margin-top:8px;color:#a3e635;font-size:12px;font-weight:500">Open vehicle →</a>
    </div>`;
}

export function MapView({ vehicles }: { vehicles: MapVehicle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");

  // Refresh server data every 60s so a background "Sync now" shows up.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60000);
    return () => clearInterval(t);
  }, [router]);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !containerRef.current) return;

      map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];
      for (const v of vehicles) {
        const icon = L.divIcon({
          className: "",
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);width:max-content">
              <span style="background:#111827;color:#e5ecf5;border:1px solid #232d3d;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:600;white-space:nowrap">${v.name}</span>
              <span style="width:12px;height:12px;border-radius:9999px;background:${markerColor(v)};border:2px solid #0b0f14;margin-top:2px;box-shadow:0 0 6px ${markerColor(v)}"></span>
            </div>`,
          iconSize: [0, 0],
        });
        const marker = L.marker([v.lat, v.lng], { icon }).addTo(map);
        marker.bindPopup(popupHtml(v), { className: "ailfleet-popup" });
        bounds.push([v.lat, v.lng]);
        if (focusId === v.id) {
          map.setView([v.lat, v.lng], 12);
          marker.openPopup();
        }
      }

      if (!focusId) {
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
        else map.setView([39.5, -98.35], 4); // continental US fallback
      }
    })();

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [vehicles, focusId]);

  return (
    <>
      <style>{`
        .ailfleet-popup .leaflet-popup-content-wrapper {
          background: #111827; color: #e5ecf5; border: 1px solid #232d3d;
          border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.5);
        }
        .ailfleet-popup .leaflet-popup-tip { background: #111827; border: 1px solid #232d3d; }
        .leaflet-container { background: #0b0f14; font: inherit; }
      `}</style>
      <div
        ref={containerRef}
        className="h-[calc(100vh-11rem)] min-h-[420px] w-full overflow-hidden rounded-xl border border-slate-200"
      />
    </>
  );
}
