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

// ── Edge Function Calls ───────────────────────────────────────────

export async function getDirections(origLat, origLng, destLat, destLng) {
  const { data, error } = await supabase.functions.invoke('yatra-api', {
    body: {
      action: 'directions',
      payload: { orig_lat: origLat, orig_lng: origLng, dest_lat: destLat, dest_lng: destLng }
    }
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function sendSos(lat, lng, chatIds, customMessage, updateNumber) {
  const { data, error } = await supabase.functions.invoke('yatra-api', {
    body: {
      action: 'sos/send',
      payload: { lat, lng, chat_ids: chatIds, custom_message: customMessage, update_number: updateNumber }
    }
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