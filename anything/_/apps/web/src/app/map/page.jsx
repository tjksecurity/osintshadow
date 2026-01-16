"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
// Avoid name clash between the Google Maps <Map> component and JS Map
import {
  APIProvider,
  Map as GoogleMap,
  Marker,
} from "@vis.gl/react-google-maps";
import {
  Shield,
  Filter,
  RefreshCw,
  MapPin,
  Globe,
  Calendar,
  Flag,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function GlobalMapPage() {
  const { data: user, loading } = useUser();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [riskLevel, setRiskLevel] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState(null);
  const [clusterSize, setClusterSize] = useState(0.5); // degrees

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["geo-markers", { riskLevel, startDate, endDate }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (riskLevel) params.set("risk_level", riskLevel);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const res = await fetch(`/api/geo-markers?${params.toString()}`);
      if (!res.ok)
        throw new Error(
          `When fetching /api/geo-markers, the response was [${res.status}] ${res.statusText}`,
        );
      return res.json();
    },
  });

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/account/signin";
    }
  }, [user, loading]);

  const markers = useMemo(() => {
    const all = data?.markers || [];
    return typeFilter ? all.filter((m) => m.target_type === typeFilter) : all;
  }, [data, typeFilter]);

  const clusters = useMemo(() => {
    // Explicitly use the built-in Map to prevent conflicts
    const bucketMap = new globalThis.Map();
    markers.forEach((m) => {
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      const keyLat = Math.round(lat / clusterSize) * clusterSize;
      const keyLng = Math.round(lng / clusterSize) * clusterSize;
      const key = `${keyLat.toFixed(3)}_${keyLng.toFixed(3)}`;
      if (!bucketMap.has(key)) bucketMap.set(key, []);
      bucketMap.get(key).push(m);
    });
    const out = [];
    for (const [, arr] of bucketMap.entries()) {
      if (arr.length === 1) {
        const m = arr[0];
        out.push({
          type: "marker",
          lat: Number(m.lat),
          lng: Number(m.lng),
          items: arr,
        });
      } else {
        const avgLat = arr.reduce((s, m) => s + Number(m.lat), 0) / arr.length;
        const avgLng = arr.reduce((s, m) => s + Number(m.lng), 0) / arr.length;
        out.push({ type: "cluster", lat: avgLat, lng: avgLng, items: arr });
      }
    }
    return out;
  }, [markers, clusterSize]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#263043] text-white flex items-center justify-center">
        Loading map...
      </div>
    );
  }

  if (!user) return null;

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-[#263043] text-white">
        <header className="border-b border-[#37425B]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-6 w-auto" variant="onDark" />
              <span className="font-semibold">Global Map</span>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-6">
          <div className="bg-[#2D384E] border border-[#37425B] rounded-lg p-6">
            <div className="text-lg font-semibold">Map not configured</div>
            <div className="text-slate-300 mt-2">
              Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
            </div>
          </div>
        </main>
      </div>
    );
  }

  const center = markers.length
    ? { lat: Number(markers[0].lat), lng: Number(markers[0].lng) }
    : { lat: 20, lng: 0 };

  return (
    <div className="min-h-screen bg-[#263043] text-white">
      <header className="border-b border-[#37425B]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-6 w-auto" variant="onDark" />
            <span className="font-semibold">Global Map</span>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 border border-[#37425B] rounded hover:bg-[#37425B] flex items-center gap-2"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-4 space-y-4">
        {/* Filters */}
        <div className="bg-[#2D384E] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={16} /> <span className="font-semibold">Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                <Flag size={12} /> Risk
              </label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
                className="w-full bg-[#37425B] border border-[#37425B] rounded px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Globe size={12} /> Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-[#37425B] border border-[#37425B] rounded px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="email">Email</option>
                <option value="domain">Domain</option>
                <option value="username">Username</option>
                <option value="phone">Phone</option>
                <option value="ip">IP</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Calendar size={12} /> Start
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#37425B] border border-[#37425B] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Calendar size={12} /> End
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#37425B] border border-[#37425B] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <MapPin size={12} /> Cluster Size
              </label>
              <select
                value={String(clusterSize)}
                onChange={(e) => setClusterSize(Number(e.target.value))}
                className="w-full bg-[#37425B] border border-[#37425B] rounded px-3 py-2 text-sm"
              >
                <option value="1">Large</option>
                <option value="0.5">Medium</option>
                <option value="0.2">Small</option>
              </select>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-[#2D384E] rounded-lg p-2">
          <APIProvider apiKey={apiKey}>
            <div className="w-full h-[520px] rounded overflow-hidden">
              <GoogleMap
                style={{ width: "100%", height: "100%" }}
                defaultCenter={center}
                defaultZoom={markers.length ? 3 : 2}
                gestureHandling={"greedy"}
                disableDefaultUI={true}
              >
                {clusters.map((c, idx) => (
                  <Marker
                    key={`${c.type}-${idx}`}
                    position={{ lat: c.lat, lng: c.lng }}
                    label={
                      c.type === "cluster" ? String(c.items.length) : undefined
                    }
                    onClick={() =>
                      setSelected({
                        type: c.type,
                        items: c.items,
                        lat: c.lat,
                        lng: c.lng,
                      })
                    }
                  />
                ))}
              </GoogleMap>
            </div>
          </APIProvider>
        </div>

        {/* Selection panel */}
        {selected && (
          <div className="bg-[#2D384E] rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-2">Selection</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {selected.items.map((m) => (
                <a
                  key={m.id}
                  href={`/investigations/${m.investigation_id}`}
                  className="block border border-[#37425B] rounded p-3 hover:bg-[#303B52]"
                >
                  <div className="text-xs text-slate-400">
                    {m.risk_level?.toUpperCase() || "NA"} • {m.target_type}
                  </div>
                  <div className="font-semibold truncate">
                    {m.label || m.target_value}
                  </div>
                  <div className="text-xs text-slate-400">
                    {Number(m.lat).toFixed(4)}, {Number(m.lng).toFixed(4)}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
