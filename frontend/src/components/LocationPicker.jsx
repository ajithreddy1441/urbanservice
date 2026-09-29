import { useEffect, useRef, useState } from 'react';
import { Navigation } from 'lucide-react';
import Field, { inputClass } from './Field';
import Button from './Button';
import { loadGoogleMaps } from '../utils/maps';

const empty = {
  houseNo: '', street: '', area: '', city: '', state: '', pincode: '', landmark: '',
  latitude: '', longitude: '', label: 'Home',
};

export default function LocationPicker({ value, onChange }) {
  const data = { ...empty, ...value };
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [geoError, setGeoError] = useState('');
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const patch = (next) => onChange({ ...data, ...next });

  const useCurrent = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('This browser cannot read your location.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => patch({ latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }),
      () => setGeoError('Allow location access, or drop the pin by entering coordinates.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    if (!key || !mapRef.current) return undefined;
    let active = true;
    loadGoogleMaps(key).then((google) => {
      if (!active || !google) return;
      const lat = Number(data.latitude) || 16.3067;
      const lng = Number(data.longitude) || 80.4365;
      const map = new google.maps.Map(mapRef.current, { center: { lat, lng }, zoom: 15, disableDefaultUI: true, zoomControl: true });
      const marker = new google.maps.Marker({ position: { lat, lng }, map, draggable: true });
      markerRef.current = marker;
      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        patch({ latitude: pos.lat().toFixed(6), longitude: pos.lng().toFixed(6) });
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [key]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !data.latitude || !data.longitude) return;
    marker.setPosition({ lat: Number(data.latitude), lng: Number(data.longitude) });
  }, [data.latitude, data.longitude]);

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" className="w-full" onClick={useCurrent}>
        <Navigation size={18} /> Use my current location
      </Button>
      {geoError && <p className="text-sm text-rose-600">{geoError}</p>}
      <div ref={mapRef} className={key ? 'h-64 w-full overflow-hidden rounded-3xl bg-slate-100' : 'hidden'} />
      {!key && (
        <div className="rounded-3xl bg-slate-100 px-4 py-6 text-sm text-slate-600">
          Add a Google Maps browser key to drag the pin. Your latitude and longitude are still saved and used for navigation.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude"><input className={inputClass} value={data.latitude} onChange={(e) => patch({ latitude: e.target.value })} /></Field>
        <Field label="Longitude"><input className={inputClass} value={data.longitude} onChange={(e) => patch({ longitude: e.target.value })} /></Field>
        <Field label="House / flat"><input className={inputClass} value={data.houseNo} onChange={(e) => patch({ houseNo: e.target.value })} /></Field>
        <Field label="Street"><input className={inputClass} value={data.street} onChange={(e) => patch({ street: e.target.value })} /></Field>
        <Field label="Area"><input className={inputClass} value={data.area} onChange={(e) => patch({ area: e.target.value })} /></Field>
        <Field label="Landmark"><input className={inputClass} value={data.landmark} onChange={(e) => patch({ landmark: e.target.value })} /></Field>
        <Field label="City"><input className={inputClass} value={data.city} onChange={(e) => patch({ city: e.target.value })} /></Field>
        <Field label="State"><input className={inputClass} value={data.state} onChange={(e) => patch({ state: e.target.value })} /></Field>
        <Field label="Pincode"><input className={inputClass} value={data.pincode} onChange={(e) => patch({ pincode: e.target.value })} /></Field>
      </div>
    </div>
  );
}
