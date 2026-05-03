/** Open-Meteo Geocoding (CORS-friendly, no API key). */

export type GeocodeHit = {
  lat: number;
  lng: number;
  label: string;
};

function formatOpenMeteoLabel(r: {
  name?: string;
  admin1?: string;
  country?: string;
}): string {
  const city = (r.name || '').trim();
  const country = (r.country || '').trim();
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  return country || 'Unknown';
}

export async function searchCities(query: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('City search failed');
  const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
  const rows = data.results ?? [];
  return rows
    .map((row) => {
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const label = formatOpenMeteoLabel({
        name: row.name as string | undefined,
        admin1: row.admin1 as string | undefined,
        country: row.country as string | undefined,
      });
      return { lat, lng, label };
    })
    .filter((x): x is GeocodeHit => x != null);
}

type NominatimReverse = {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
};

/** Reverse geocode for GPS; falls back to a short coordinate hint if the request fails. */
export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('reverse failed');
    const data = (await res.json()) as NominatimReverse;
    const a = data.address;
    const place =
      a?.city?.trim() ||
      a?.town?.trim() ||
      a?.village?.trim() ||
      a?.municipality?.trim() ||
      a?.state?.trim();
    const country = a?.country?.trim();
    if (place && country) return `${place}, ${country}`;
    if (place) return place;
    if (country) return country;
    if (data.display_name) {
      const parts = data.display_name.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}, ${parts[parts.length - 1]}`;
      return parts[0] ?? data.display_name;
    }
  } catch {
    /* fall through */
  }
  return 'Current location';
}
