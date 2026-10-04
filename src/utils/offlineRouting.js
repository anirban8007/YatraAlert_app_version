import Mapbox from '@rnmapbox/maps';

export const downloadRouteTiles = async (routeId, bounds) => {
  await Mapbox.offlineManager.createPack({
    name: `route_${routeId}`,
    styleURL: Mapbox.StyleURL.Street,
    minZoom: 10,
    maxZoom: 16,
    bounds: [
      [bounds.maxLng, bounds.maxLat],
      [bounds.minLng, bounds.minLat]
    ]
  });
};
