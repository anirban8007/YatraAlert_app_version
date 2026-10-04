import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace these with your actual Supabase project keys
const SUPABASE_URL = 'https://yiuyqrmnvifjlqwbylrb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpdXlxcm1udmlmamxxd2J5bHJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODcyNjMxOSwiZXhwIjoyMDk0MzAyMzE5fQ.1h-6egdeQHoLtub1E_o8Il1zi8-aDrxoYcqJ-nOsWJE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const OLA_API_KEY = 'TaF8ZPfiZp2Z1UQbX5XEnWCBqDu3EbzBQaMWzBoR';

function decodePolyline(encoded) {
  const points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

export async function getDirections(origLat, origLng, destLat, destLng) {
  // 1. Direct Ola Maps Directions API Call
  try {
    const olaUrl = `https://api.olamaps.io/routing/v1/directions?origin=${origLat},${origLng}&destination=${destLat},${destLng}&api_key=${OLA_API_KEY}`;
    const res = await fetch(olaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs?.[0] || route;
        const distance_meters = leg.distance || route.distance || 0;
        const duration_seconds = leg.duration || route.duration || 0;

        const distance_km = (distance_meters / 1000).toFixed(1);
        const duration_min = Math.round(duration_seconds / 60);
        const time_str = duration_min >= 60 
          ? `${Math.floor(duration_min / 60)}h ${duration_min % 60}min` 
          : `${duration_min} min`;

        let geometry = route.geometry;
        if (!geometry && route.overview_polyline) {
          const coords = typeof route.overview_polyline === 'string'
            ? decodePolyline(route.overview_polyline)
            : route.overview_polyline;
          geometry = { type: "LineString", coordinates: coords };
        } else if (typeof geometry === 'string') {
          const coords = decodePolyline(geometry);
          geometry = { type: "LineString", coordinates: coords };
        }

        return {
          distance_km,
          time_str: time_str,
          duration_min,
          geometry,
          source: "olamaps"
        };
      }
    } else {
      // Try GET request if POST is rejected
      const getRes = await fetch(olaUrl);
      if (getRes.ok) {
        const data = await getRes.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs?.[0] || route;
          const distance_meters = leg.distance || route.distance || 0;
          const duration_seconds = leg.duration || route.duration || 0;

          const distance_km = (distance_meters / 1000).toFixed(1);
          const duration_min = Math.round(duration_seconds / 60);
          const time_str = duration_min >= 60 
            ? `${Math.floor(duration_min / 60)}h ${duration_min % 60}min` 
            : `${duration_min} min`;

          let geometry = route.geometry;
          if (!geometry && route.overview_polyline) {
            const coords = typeof route.overview_polyline === 'string'
              ? decodePolyline(route.overview_polyline)
              : route.overview_polyline;
            geometry = { type: "LineString", coordinates: coords };
          } else if (typeof geometry === 'string') {
            const coords = decodePolyline(geometry);
            geometry = { type: "LineString", coordinates: coords };
          }

          return {
            distance_km,
            time_str: time_str,
            duration_min,
            geometry,
            source: "olamaps"
          };
        }
      }
    }
  } catch (e) {
    console.warn("Direct Ola Maps directions failed, trying OSRM fallback:", e);
  }

  // 2. Fallback: OSRM Routing Engine
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origLng},${origLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl);
    const data = await res.json();
    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distance_km = (route.distance / 1000).toFixed(1);
      const duration_min = Math.round(route.duration / 60);
      const time_str = duration_min >= 60 
        ? `${Math.floor(duration_min / 60)}h ${duration_min % 60}min` 
        : `${duration_min} min`;

      return {
        distance_km,
        time_str: time_str,
        duration_min,
        geometry: route.geometry,
        source: "osrm"
      };
    }
  } catch (e) {
    console.error("OSRM fallback failed:", e);
  }

  throw new Error("Could not fetch route from Ola Maps or fallback.");
}

export async function sendSos(lat, lng, travelerId) {
  const { data, error } = await supabase.functions.invoke('sos-dispatch', {
    body: { latitude: lat, longitude: lng, traveler_id: travelerId }
  });
  if (error) throw new Error(error.message);
  return data;
}

// ── Direct Database Calls (Railway Detection) ──────────────────────

export async function checkRailways(lat, lng, radiusMeters = 400) {
  // Calls a PostGIS function directly inside your Supabase database
  // You will need to create this Postgres function in your Supabase SQL editor later
  const { data, error } = await supabase.rpc('find_nearby_railways', {
    user_lat: lat,
    user_lng: lng,
    radius_m: radiusMeters
  });
  
  if (error) {
    // Suppressed error to prevent React Native LogBox red screen
    // console.warn("Railway Check Error:", error.message);
    return { found: false, tracks: [], stations: [] };
  }

  const tracks = data.filter(r => r.geometry_type === 'LineString');
  const stations = data.filter(r => r.geometry_type === 'Point');

  return {
    found: data.length > 0,
    total: data.length,
    tracks: tracks.slice(0, 5),
    stations: stations.slice(0, 5),
    closest: data.length > 0 ? data.reduce((prev, curr) => prev.distance < curr.distance ? prev : curr) : null
  };
}
// ── Search & Geocoding (Direct API Calls) ──────────────────────

export async function getSuggestions(query, lat, lng) {
  const encQuery = encodeURIComponent(query);

  // Tier 0: Ola Maps Autocomplete
  try {
    let olaUrl = `https://api.olamaps.io/places/v1/autocomplete?input=${encQuery}&api_key=${OLA_API_KEY}`;
    if (lat && lng) olaUrl += `&location=${lat},${lng}`;
    
    const res = await fetch(olaUrl);
    const data = await res.json();
    
    const predictions = data?.predictions || data?.features || data?.result;
    if (predictions && predictions.length > 0) {
      const results = predictions.map(p => {
        const label = p.description || p.structured_formatting?.main_text || p.name || p.terms?.map(t => t.value).join(', ');
        const location = p.geometry?.location || p.location;
        const latVal = location?.lat || p.lat;
        const lngVal = location?.lng || p.lng;
        const isTrain = (p.types || []).some(t => String(t).includes('station') || String(t).includes('railway') || String(t).includes('transit'));

        if (label && latVal && lngVal) {
          return {
            label,
            lat: parseFloat(latVal),
            lng: parseFloat(lngVal),
            icon: isTrain ? 'train' : 'place'
          };
        }
        return null;
      }).filter(Boolean);

      if (results.length > 0) return results;
    }
  } catch (e) {
    console.warn("Tier 0 (Ola Maps) failed, falling back:", e);
  }
  
  // Tier 1: Photon
  try {
    let photonUrl = `https://photon.komoot.io/api/?q=${encQuery}&limit=8&lang=en`;
    if (lat && lng) photonUrl += `&lat=${lat}&lon=${lng}`;
    
    const res = await fetch(photonUrl);
    const data = await res.json();
    
    if (data && data.features && data.features.length > 0) {
      return data.features.map(f => {
        const props = f.properties;
        const coords = f.geometry.coordinates; // Photon returns [lng, lat]
        const parts = [props.name, props.district, props.state, props.country].filter(Boolean);
        const isTrain = props.osm_key === 'railway' || ['station', 'halt', 'stop'].includes(props.osm_value);
        
        return {
          label: parts.join(', '),
          lat: coords[1],
          lng: coords[0],
          icon: isTrain ? 'train' : 'place'
        };
      });
    }
  } catch (e) {
    console.warn("Tier 1 (Photon) failed:", e);
  }

  // Tier 2: Nominatim Global
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encQuery}&format=json&limit=8&countrycodes=in`;
    const res = await fetch(nomUrl, { headers: { 'User-Agent': 'YatraAlertApp/1.0' } });
    const data = await res.json();
    
    if (data && data.length > 0) {
      return data.map(d => {
        const isTrain = d.type === 'station' || d.type === 'halt';
        return {
          label: d.display_name,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          icon: isTrain ? 'train' : 'place'
        };
      });
    }
  } catch (e) {
    console.warn("Tier 2 (Nominatim) failed:", e);
  }

  // Tier 3: Nominatim FR (French Mirror)
  try {
    const frUrl = `https://nominatim.openstreetmap.fr/search?q=${encQuery}&format=json&limit=8&countrycodes=in`;
    const res = await fetch(frUrl, { headers: { 'User-Agent': 'YatraAlertApp/1.0' } });
    const data = await res.json();
    
    if (data && data.length > 0) {
      return data.map(d => {
        const isTrain = d.type === 'station' || d.type === 'halt';
        return {
          label: d.display_name,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          icon: isTrain ? 'train' : 'place'
        };
      });
    }
  } catch (e) {
    console.warn("Tier 3 (Nominatim FR) failed:", e);
  }

  return [];
}

export async function geocode(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ", India")}&format=json&limit=1&countrycodes=in`;
    const res = await fetch(url, { headers: { 'User-Agent': 'YatraAlertApp/1.0' } });
    const data = await res.json();
    
    if (data && data.length > 0) {
      return { 
        label: data[0].display_name, 
        lat: parseFloat(data[0].lat), 
        lng: parseFloat(data[0].lon) 
      };
    }
    throw new Error("Location not found");
  } catch (e) {
    throw new Error("Geocoding failed");
  }
}

// ── SOS Verification ───────────────────────────────────────────

export async function verifySosCode(code) {
  const { data, error } = await supabase.functions.invoke('yatra-api', {
    body: {
      action: 'sos/verify',
      payload: { code }
    }
  });
  if (error) return { error: error.message };
  return data;
}