export function mapsDirectionUrl(latitude, longitude) {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null || latitude === '') return '';
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

let loading;
export function loadGoogleMaps(key) {
  if (!key) return Promise.resolve(null);
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
  return loading;
}
