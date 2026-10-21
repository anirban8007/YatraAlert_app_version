import { checkRailways, getDirections } from './api.js';
import { distanceM } from './haversine.js';

export function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return '-- min';
  const min = Math.max(0, Math.round(minutes));
  if (min >= 60) {
    const hrs = Math.floor(min / 60);
    const remMin = min % 60;
    return `${hrs}h ${remMin}min`;
  }
  return `${min} min`;
}

/**
 * Finds the nearest railway station to given coordinates within a 30-40+ km radius.
 * Priority: 1. Komoot Photon API -> 2. Nominatim Bounded Search -> 3. Supabase RPC checkRailways
 */
export async function findNearestStation(lat, lng, radiusKm = 10) {
  if (!lat || !lng) return null;

  const maxMeters = radiusKm * 1000;
  // 1 degree latitude ~ 111 km. boxDelta matches the radius in degrees
  const boxDelta = Math.max(0.2, parseFloat((radiusKm / 111).toFixed(3)));

  // 1. Komoot Photon API
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=railway+station&limit=15&lat=${lat}&lon=${lng}`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const candidates = data.features
          .filter(f => {
            const p = f.properties || {};
            const name = (p.name || '').toLowerCase();
            // Exclude flyovers, highways, roads
            if (p.osm_key === 'highway' || name.includes('flyover') || (name.includes('bridge') && !name.includes('station'))) {
              return false;
            }
            // Require station indicators
            return (
              p.osm_key === 'railway' ||
              p.osm_value === 'station' ||
              p.osm_value === 'halt' ||
              (p.osm_key === 'landuse' && p.osm_value === 'railway') ||
              name.includes('railway station') ||
              name.includes('terminus') ||
              name.includes('junction') ||
              name.includes('station')
            );
          })
          .map(f => {
            const coords = f.geometry?.coordinates;
            if (!coords || coords.length < 2) return null;
            const cLng = coords[0];
            const cLat = coords[1];
            const dist = distanceM(lat, lng, cLat, cLng);
            const rawName = f.properties.name || 'Railway Station';
            return {
              name: rawName,
              lat: cLat,
              lng: cLng,
              distanceMeters: Math.round(dist),
              distanceKm: (dist / 1000).toFixed(1),
            };
          })
          .filter(Boolean);

        if (candidates.length > 0) {
          candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
          if (candidates[0].distanceMeters <= maxMeters) {
            return candidates[0];
          }
        }
      }
    }
  } catch (e) {
    console.warn('Photon nearest station lookup failed, trying fallback:', e);
  }

  // 2. Nominatim Bounded Search Fallback (~30-40 km bounding box)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=railway+station&format=json&limit=10&countrycodes=in&viewbox=${lng - boxDelta},${lat + boxDelta},${lng + boxDelta},${lat - boxDelta}&bounded=1`;
    const res = await fetch(nomUrl, { headers: { 'User-Agent': 'YatraAlertApp/1.0' } });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const candidates = list
          .map(item => {
            const cLat = parseFloat(item.lat);
            const cLng = parseFloat(item.lon);
            if (isNaN(cLat) || isNaN(cLng)) return null;
            const dist = distanceM(lat, lng, cLat, cLng);
            const name = item.name || item.display_name?.split(',')?.[0] || 'Railway Station';
            return {
              name,
              lat: cLat,
              lng: cLng,
              distanceMeters: Math.round(dist),
              distanceKm: (dist / 1000).toFixed(1),
            };
          })
          .filter(Boolean);

        if (candidates.length > 0) {
          candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
          return candidates[0];
        }
      }
    }
  } catch (e) {
    console.warn('Nominatim nearest station lookup failed:', e);
  }

  // 3. Supabase Database RPC Fallback (scans up to maxMeters = 40 km)
  try {
    const dbResult = await checkRailways(lat, lng, maxMeters);
    if (dbResult && dbResult.stations && dbResult.stations.length > 0) {
      const closest = dbResult.stations[0];
      return {
        name: closest.name || 'Railway Station',
        lat: closest.lat,
        lng: closest.lng,
        distanceMeters: Math.round(closest.distance || 0),
        distanceKm: ((closest.distance || 0) / 1000).toFixed(1),
      };
    }
  } catch (e) {
    console.warn('Supabase railway check failed:', e);
  }

  // 4. Expanded Search Fallback (auto-expand to 60 km if needed)
  if (radiusKm < 60) {
    return findNearestStation(lat, lng, 60);
  }

  return null;
}

/**
 * Creates evenly spaced points between two coordinates for smooth polyline visualization.
 */
function interpolatePoints(start, end, count = 15) {
  const points = [];
  for (let i = 0; i <= count; i++) {
    const fraction = i / count;
    points.push({
      latitude: start.lat + (end.lat - start.lat) * fraction,
      longitude: start.lng + (end.lng - start.lng) * fraction,
    });
  }
  return points;
}

/**
 * Builds a 3-leg multi-modal Train+Road route:
 * 1. Road: Current Location -> Origin Railway Station
 * 2. Train: Origin Railway Station -> Destination Railway Station
 * 3. Road: Destination Railway Station -> Final Destination
 */
export async function buildTrainRoute(currentLat, currentLng, destLat, destLng, destName = '') {
  if (!currentLat || !currentLng || !destLat || !destLng) {
    throw new Error('Valid origin and destination coordinates are required.');
  }

  // 1. Find nearest station to origin
  const originStation = await findNearestStation(currentLat, currentLng);
  if (!originStation) {
    throw new Error('Could not locate a railway station near your current location.');
  }

  // 2. Determine destination station
  const lowerDestName = (destName || '').toLowerCase();
  const isDirectStation =
    lowerDestName.includes('railway station') ||
    lowerDestName.includes('train station') ||
    lowerDestName.includes('junction') ||
    lowerDestName.includes('terminus') ||
    lowerDestName.includes('central station');

  let destStation = null;
  if (isDirectStation) {
    destStation = {
      name: destName.split(',')?.[0]?.trim() || 'Destination Station',
      lat: destLat,
      lng: destLng,
      isDirect: true,
      distanceKm: '0.0',
    };
  } else {
    destStation = await findNearestStation(destLat, destLng);
  }

  if (!destStation) {
    throw new Error('Could not locate a railway station near your destination.');
  }

  // 3. Sanity check: Origin station and Dest station must be distinct
  const interStationDistM = distanceM(originStation.lat, originStation.lng, destStation.lat, destStation.lng);
  if (interStationDistM < 2500) {
    throw new Error('Origin and destination share the same nearest station. Direct road route recommended.');
  }

  // 4. Leg 1: Road from Current Location -> Origin Station
  const distToOriginM = distanceM(currentLat, currentLng, originStation.lat, originStation.lng);
  let leg1Data = null;
  let leg1Coords = [];

  if (distToOriginM <= 400) {
    // User is already at origin station!
    leg1Data = {
      distance_km: '0.0',
      duration_min: 0,
      time_str: '0 min',
    };
    leg1Coords = [
      { latitude: currentLat, longitude: currentLng },
      { latitude: originStation.lat, longitude: originStation.lng },
    ];
  } else {
    leg1Data = await getDirections(currentLat, currentLng, originStation.lat, originStation.lng);
    if (leg1Data.geometry?.coordinates) {
      leg1Coords = leg1Data.geometry.coordinates.map(([clng, clat]) => ({
        latitude: clat,
        longitude: clng,
      }));
    } else {
      leg1Coords = [
        { latitude: currentLat, longitude: currentLng },
        { latitude: originStation.lat, longitude: originStation.lng },
      ];
    }
  }

  // 5. Leg 2: Train from Origin Station -> Dest Station
  // Factor 1.20 accounts for track circuity across terrain
  const trainDistKm = ((interStationDistM / 1000) * 1.2).toFixed(1);
  // Average express train speed with stops = 60 km/h (1 km/min)
  const trainDurationMin = Math.max(5, Math.round((parseFloat(trainDistKm) / 60) * 60));
  const trainTimeStr = formatDuration(trainDurationMin);
  const trainCoords = interpolatePoints(
    { lat: originStation.lat, lng: originStation.lng },
    { lat: destStation.lat, lng: destStation.lng },
    25
  );

  // 6. Leg 3: Road from Dest Station -> Final Destination
  const distStationToDestM = distanceM(destStation.lat, destStation.lng, destLat, destLng);
  let leg3Data = null;
  let leg3Coords = [];

  if (distStationToDestM <= 400 || destStation.isDirect) {
    // Destination is the station itself!
    leg3Data = {
      distance_km: '0.0',
      duration_min: 0,
      time_str: '0 min',
    };
    leg3Coords = [
      { latitude: destStation.lat, longitude: destStation.lng },
      { latitude: destLat, longitude: destLng },
    ];
  } else {
    leg3Data = await getDirections(destStation.lat, destStation.lng, destLat, destLng);
    if (leg3Data.geometry?.coordinates) {
      leg3Coords = leg3Data.geometry.coordinates.map(([clng, clat]) => ({
        latitude: clat,
        longitude: clng,
      }));
    } else {
      leg3Coords = [
        { latitude: destStation.lat, longitude: destStation.lng },
        { latitude: destLat, longitude: destLng },
      ];
    }
  }

  // 7. Aggregate totals
  const totalDurationMin = (leg1Data.duration_min || 0) + trainDurationMin + (leg3Data.duration_min || 0);
  const totalDistanceKm = (
    parseFloat(leg1Data.distance_km || 0) +
    parseFloat(trainDistKm || 0) +
    parseFloat(leg3Data.distance_km || 0)
  ).toFixed(1);

  const legs = [
    {
      id: 'leg_1_road',
      type: 'road',
      title: `To ${originStation.name}`,
      originName: 'Current Location',
      destName: originStation.name,
      distanceKm: leg1Data.distance_km,
      durationMin: leg1Data.duration_min || 0,
      timeStr: leg1Data.time_str || formatDuration(leg1Data.duration_min),
      coords: leg1Coords,
      station: originStation,
    },
    {
      id: 'leg_2_train',
      type: 'train',
      title: `${originStation.name} → ${destStation.name}`,
      originName: originStation.name,
      destName: destStation.name,
      distanceKm: trainDistKm,
      durationMin: trainDurationMin,
      timeStr: trainTimeStr,
      coords: trainCoords,
      originStation,
      destStation,
    },
    {
      id: 'leg_3_road',
      type: 'road',
      title: `To ${destName?.split(',')?.[0] || 'Destination'}`,
      originName: destStation.name,
      destName: destName?.split(',')?.[0] || 'Destination',
      distanceKm: leg3Data.distance_km,
      durationMin: leg3Data.duration_min || 0,
      timeStr: leg3Data.time_str || formatDuration(leg3Data.duration_min),
      coords: leg3Coords,
      station: destStation,
    },
  ];

  return {
    mode: 'train_road',
    originStation,
    destStation,
    legs,
    totalDurationMin,
    totalDistanceKm,
    totalTimeStr: formatDuration(totalDurationMin),
    combinedCoords: [...leg1Coords, ...trainCoords, ...leg3Coords],
  };
}
