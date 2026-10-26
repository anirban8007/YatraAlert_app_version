import { distanceM } from './haversine.js';

/**
 * Calculates perpendicular distance (in meters) from a point to a line segment,
 * and the projection fraction t in [0, 1].
 */
export function pointToSegmentDistance(point, segStart, segEnd) {
  const pLat = point.latitude;
  const pLng = point.longitude;
  const aLat = segStart.latitude;
  const aLng = segStart.longitude;
  const bLat = segEnd.latitude;
  const bLng = segEnd.longitude;

  // Planar approximation scaled by latitude
  const midLatRad = ((aLat + bLat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(midLatRad);
  const kLat = 111139; // meters per degree latitude
  const kLng = 111139 * cosLat; // meters per degree longitude

  const ax = aLng * kLng;
  const ay = aLat * kLat;
  const bx = bLng * kLng;
  const by = bLat * kLat;
  const px = pLng * kLng;
  const py = pLat * kLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return {
      distanceM: Math.hypot(px - ax, py - ay),
      fraction: 0,
      closestPoint: { latitude: aLat, longitude: aLng },
    };
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return {
    distanceM: Math.hypot(px - projX, py - projY),
    fraction: t,
    closestPoint: {
      latitude: aLat + t * (bLat - aLat),
      longitude: aLng + t * (bLng - aLng),
    },
  };
}

/**
 * Evaluates current GPS location against the route polyline.
 * Prevents premature forward-skipping (e.g. Loops/flyovers) by searching
 * within a forward progression window around lastSegmentIndex.
 * Returns:
 * - isOffRoute: boolean (true if min distance > thresholdMeters)
 * - minDistanceM: perpendicular distance to closest segment
 * - segmentIndex: index of the closest segment
 * - trimmedCoords: polyline sliced to start from current location forward
 * - remainingDistanceKm: estimated remaining distance in km along trimmed coords
 */
export function getRouteProgress(currentLoc, routeCoords, thresholdMeters = 55, lastSegmentIndex = 0) {
  if (!currentLoc || !routeCoords || routeCoords.length < 2) {
    return {
      isOffRoute: false,
      minDistanceM: 0,
      segmentIndex: 0,
      trimmedCoords: routeCoords || [],
      remainingDistanceKm: 0,
    };
  }

  let minDistanceM = Infinity;
  let bestSegmentIndex = lastSegmentIndex || 0;
  let bestClosestPoint = null;

  // 1. Constrained forward window search around last known position
  // Look from 1 segment behind up to 15 segments ahead
  const startIdx = Math.max(0, (lastSegmentIndex || 0) - 1);
  const endIdx = Math.min(routeCoords.length - 1, (lastSegmentIndex || 0) + 15);

  for (let i = startIdx; i < endIdx; i++) {
    const segStart = routeCoords[i];
    const segEnd = routeCoords[i + 1];
    const res = pointToSegmentDistance(currentLoc, segStart, segEnd);

    if (res.distanceM < minDistanceM) {
      minDistanceM = res.distanceM;
      bestSegmentIndex = i;
      bestClosestPoint = res.closestPoint;
    }
  }

  // 2. If not found within threshold in the local window, scan the full route
  // to detect if user made a major jump or is genuinely off-route
  if (minDistanceM > thresholdMeters) {
    let globalMinDist = Infinity;
    let globalBestIdx = bestSegmentIndex;
    let globalClosestPoint = bestClosestPoint;

    for (let i = 0; i < routeCoords.length - 1; i++) {
      const segStart = routeCoords[i];
      const segEnd = routeCoords[i + 1];
      const res = pointToSegmentDistance(currentLoc, segStart, segEnd);

      if (res.distanceM < globalMinDist) {
        globalMinDist = res.distanceM;
        globalBestIdx = i;
        globalClosestPoint = res.closestPoint;
      }
    }

    // Only accept global jump if it is significantly closer and on the road
    if (globalMinDist <= thresholdMeters) {
      minDistanceM = globalMinDist;
      bestSegmentIndex = globalBestIdx;
      bestClosestPoint = globalClosestPoint;
    }
  }

  const isOffRoute = minDistanceM > thresholdMeters;

  // Trim polyline so it starts at the user's current GPS position,
  // connecting to the remaining ahead waypoints
  const remainingAhead = routeCoords.slice(bestSegmentIndex + 1);
  const trimmedCoords = [
    { latitude: currentLoc.latitude, longitude: currentLoc.longitude },
    ...(bestClosestPoint && remainingAhead.length > 0 ? [bestClosestPoint] : []),
    ...remainingAhead,
  ];

  // Calculate remaining distance in km along trimmed path
  let remainingM = 0;
  for (let i = 0; i < trimmedCoords.length - 1; i++) {
    remainingM += distanceM(
      trimmedCoords[i].latitude,
      trimmedCoords[i].longitude,
      trimmedCoords[i + 1].latitude,
      trimmedCoords[i + 1].longitude
    );
  }

  return {
    isOffRoute,
    minDistanceM: Math.round(minDistanceM),
    segmentIndex: bestSegmentIndex,
    trimmedCoords,
    remainingDistanceKm: (remainingM / 1000).toFixed(1),
  };
}
