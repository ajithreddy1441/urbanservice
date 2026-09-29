import { useEffect, useMemo, useRef } from 'react';
import { loadGoogleMaps, mapsDirectionUrl } from '../utils/maps';

function bounds(markers) {
  const points = markers.filter((m) => Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lng)));
  if (!points.length) return null;
  const lats = points.map((m) => Number(m.lat));
  const lngs = points.map((m) => Number(m.lng));
  return {
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
    minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
    points,
  };
}

export function RelativeMap({ markers = [], height = 320 }) {
  const box = bounds(markers);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_20%_20%,#dbeafe,transparent_40%),linear-gradient(160deg,#e2e8f0,#f8fafc)]" style={{ height }}>
      {!box && <div className="grid h-full place-items-center text-sm text-slate-500">No coordinates yet</div>}
      {box?.points.map((marker, index) => {
        const latSpan = Math.max(box.maxLat - box.minLat, 0.01);
        const lngSpan = Math.max(box.maxLng - box.minLng, 0.01);
        const top = 12 + ((box.maxLat - Number(marker.lat)) / latSpan) * 76;
        const left = 8 + ((Number(marker.lng) - box.minLng) / lngSpan) * 80;
        return (
          <a key={`${marker.title}-${index}`} href={mapsDirectionUrl(marker.lat, marker.lng)} target="_blank" rel="noreferrer" className="absolute max-w-[140px] -translate-x-1/2 -translate-y-full" style={{ top: `${top}%`, left: `${left}%` }}>
            <span className={`block rounded-full px-2 py-1 text-[11px] font-bold text-white shadow ${marker.tone === 'customer' ? 'bg-slate-900' : 'bg-[var(--brand)]'}`}>{marker.title}</span>
          </a>
        );
      })}
    </div>
  );
}

export default function MapView({ markers = [], height = 320 }) {
  const ref = useRef(null);
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const signature = useMemo(() => JSON.stringify(markers), [markers]);

  useEffect(() => {
    if (!key || !ref.current) return undefined;
    let active = true;
    loadGoogleMaps(key).then((google) => {
      if (!active || !google || !ref.current) return;
      const first = markers.find((m) => m.lat && m.lng);
      const map = new google.maps.Map(ref.current, {
        center: first ? { lat: Number(first.lat), lng: Number(first.lng) } : { lat: 16.3067, lng: 80.4365 },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
      });
      const info = new google.maps.InfoWindow();
      markers.forEach((marker) => {
        if (!marker.lat || !marker.lng) return;
        const pin = new google.maps.Marker({
          position: { lat: Number(marker.lat), lng: Number(marker.lng) },
          map,
          title: marker.title,
        });
        pin.addListener('click', () => {
          info.setContent(`<div style="font-family:sans-serif;min-width:140px"><strong>${marker.title || ''}</strong><div>${marker.info || ''}</div></div>`);
          info.open({ map, anchor: pin });
        });
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [key, signature]);

  if (!key) return <RelativeMap markers={markers} height={height} />;
  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-3xl bg-slate-100" />;
}
