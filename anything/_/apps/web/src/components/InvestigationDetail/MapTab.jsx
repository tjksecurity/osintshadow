import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";

export function MapTab({ investigation, center }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <section className="bg-[#2D384E] border border-[#37425B] rounded-lg p-6">
        <div className="text-slate-300">
          Map is not configured.
          <div className="text-slate-400 text-sm mt-1">
            Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#2D384E] rounded-lg p-2">
      <APIProvider apiKey={apiKey}>
        <div className="w-full h-[420px] rounded overflow-hidden">
          <Map
            style={{ width: "100%", height: "100%" }}
            defaultCenter={center}
            defaultZoom={investigation.geo_markers?.length ? 6 : 2}
            gestureHandling={"greedy"}
            disableDefaultUI={true}
          >
            {(investigation.geo_markers || []).map((m) => (
              <Marker
                key={m.id}
                position={{ lat: Number(m.lat), lng: Number(m.lng) }}
                title={m.label || `${m.lat}, ${m.lng}`}
              />
            ))}
          </Map>
        </div>
      </APIProvider>
    </section>
  );
}
