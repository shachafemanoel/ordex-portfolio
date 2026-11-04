import mapboxgl from 'mapbox-gl';

export type DeliveryMapVariant = 'dashboard' | 'field';

type CartographyPalette = {
  background: string;
  land: string;
  water: string;
  park: string;
  building: string;
  buildingOpacity: number;
  extrusionOpacity: number;
  majorRoad: string;
  road: string;
  roadOpacity: number;
  boundary: string;
  placeLabel: string;
  placeLabelOpacity: number;
  roadLabel: string;
  roadLabelOpacity: number;
  waterLabel: string;
  poiOpacity: number;
  transitOpacity: number;
  hidePoi: boolean;
  hideTransit: boolean;
  fogColor: string;
  highFogColor: string;
};

const CARTOGRAPHY: Record<DeliveryMapVariant, CartographyPalette> = {
  dashboard: {
    background: '#f7fafc',
    land: '#fbfdff',
    water: '#9ccdf0',
    park: '#dce9cf',
    building: '#dbe4ec',
    buildingOpacity: 0.22,
    extrusionOpacity: 0.08,
    majorRoad: '#ffffff',
    road: '#e7eef5',
    roadOpacity: 0.82,
    boundary: '#c4d2de',
    placeLabel: '#0f172a',
    placeLabelOpacity: 0.92,
    roadLabel: '#6c8297',
    roadLabelOpacity: 0.58,
    waterLabel: '#356f9c',
    poiOpacity: 0,
    transitOpacity: 0,
    hidePoi: true,
    hideTransit: true,
    fogColor: '#f8fbff',
    highFogColor: '#edf5ff',
  },
  field: {
    background: '#eef4f8',
    land: '#f7fafc',
    water: '#8ec7ee',
    park: '#d7e6ca',
    building: '#d5dee7',
    buildingOpacity: 0.34,
    extrusionOpacity: 0.18,
    majorRoad: '#ffffff',
    road: '#e3ebf3',
    roadOpacity: 0.9,
    boundary: '#bcc9d5',
    placeLabel: '#0b1324',
    placeLabelOpacity: 0.98,
    roadLabel: '#52677c',
    roadLabelOpacity: 0.84,
    waterLabel: '#2f6a97',
    poiOpacity: 0.16,
    transitOpacity: 0.1,
    hidePoi: false,
    hideTransit: false,
    fogColor: '#f2f8fc',
    highFogColor: '#e8f1f8',
  },
};

function setLayerPaintPropertySafely(
  map: mapboxgl.Map,
  layerId: string,
  property: string,
  value: unknown
) {
  try {
    map.setPaintProperty(layerId, property as never, value as never);
  } catch {
    // Layer/property mismatch on custom styles is acceptable.
  }
}

function setLayerLayoutPropertySafely(
  map: mapboxgl.Map,
  layerId: string,
  property: string,
  value: unknown
) {
  try {
    map.setLayoutProperty(layerId, property as never, value as never);
  } catch {
    // Layer/property mismatch on custom styles is acceptable.
  }
}

export function applyDeliveryMapCartography(map: mapboxgl.Map, mapVariant: DeliveryMapVariant) {
  const style = map.getStyle();
  if (!style?.layers?.length) {
    return;
  }

  const palette = CARTOGRAPHY[mapVariant];

  try {
    map.setFog({
      color: palette.fogColor,
      'high-color': palette.highFogColor,
      'horizon-blend': 0.03,
      'space-color': '#f8fbff',
      range: [0.5, 8],
    });
  } catch {
    // Some style types do not support fog.
  }

  try {
    map.setLight({
      anchor: 'viewport',
      color: '#ffffff',
      intensity: mapVariant === 'dashboard' ? 0.26 : 0.34,
      position: [1.2, 210, 36],
    });
  } catch {
    // Some styles do not expose light controls.
  }

  style.layers.forEach((layer) => {
    if (layer.id.startsWith('ordex-')) {
      return;
    }

    const id = layer.id.toLowerCase();
    const isWater = id.includes('water');
    const isPark = id.includes('park') || id.includes('green') || id.includes('nature');
    const isBuilding = id.includes('building');
    const isRoad = id.includes('road') || id.includes('street') || id.includes('motorway');
    const isBoundary = id.includes('boundary') || id.includes('admin');
    const isPoi = id.includes('poi');
    const isTransit = id.includes('transit') || id.includes('rail');
    const isRoadLabel = id.includes('road') || id.includes('street');
    const isPlaceLabel =
      id.includes('place') ||
      id.includes('settlement') ||
      id.includes('city') ||
      id.includes('country');

    if (layer.type === 'background') {
      setLayerPaintPropertySafely(map, layer.id, 'background-color', palette.background);
      return;
    }

    if (layer.type === 'fill') {
      if (isWater) {
        setLayerPaintPropertySafely(map, layer.id, 'fill-color', palette.water);
        setLayerPaintPropertySafely(map, layer.id, 'fill-opacity', 0.9);
      } else if (isPark) {
        setLayerPaintPropertySafely(map, layer.id, 'fill-color', palette.park);
        setLayerPaintPropertySafely(map, layer.id, 'fill-opacity', 0.72);
      } else if (isBuilding) {
        setLayerPaintPropertySafely(map, layer.id, 'fill-color', palette.building);
        setLayerPaintPropertySafely(map, layer.id, 'fill-opacity', palette.buildingOpacity);
      } else {
        setLayerPaintPropertySafely(map, layer.id, 'fill-color', palette.land);
      }
      return;
    }

    if (layer.type === 'fill-extrusion') {
      if (isBuilding) {
        setLayerPaintPropertySafely(map, layer.id, 'fill-extrusion-color', palette.building);
        setLayerPaintPropertySafely(
          map,
          layer.id,
          'fill-extrusion-opacity',
          palette.extrusionOpacity
        );
      }
      return;
    }

    if (layer.type === 'line') {
      if (isRoad) {
        if (id.includes('motorway') || id.includes('trunk') || id.includes('primary')) {
          setLayerPaintPropertySafely(map, layer.id, 'line-color', palette.majorRoad);
          setLayerPaintPropertySafely(map, layer.id, 'line-opacity', 0.96);
        } else {
          setLayerPaintPropertySafely(map, layer.id, 'line-color', palette.road);
          setLayerPaintPropertySafely(map, layer.id, 'line-opacity', palette.roadOpacity);
        }
      } else if (isWater) {
        setLayerPaintPropertySafely(map, layer.id, 'line-color', '#7fb9e8');
        setLayerPaintPropertySafely(map, layer.id, 'line-opacity', 0.66);
      } else if (isBoundary) {
        setLayerPaintPropertySafely(map, layer.id, 'line-color', palette.boundary);
        setLayerPaintPropertySafely(map, layer.id, 'line-opacity', 0.42);
      }
      return;
    }

    if (layer.type === 'symbol') {
      if (isPoi) {
        setLayerLayoutPropertySafely(
          map,
          layer.id,
          'visibility',
          palette.hidePoi ? 'none' : 'visible'
        );
        setLayerPaintPropertySafely(map, layer.id, 'text-opacity', palette.poiOpacity);
        setLayerPaintPropertySafely(map, layer.id, 'icon-opacity', palette.poiOpacity);
      } else if (isTransit) {
        setLayerLayoutPropertySafely(
          map,
          layer.id,
          'visibility',
          palette.hideTransit ? 'none' : 'visible'
        );
        setLayerPaintPropertySafely(map, layer.id, 'text-opacity', palette.transitOpacity);
        setLayerPaintPropertySafely(map, layer.id, 'icon-opacity', palette.transitOpacity);
      } else if (isPlaceLabel) {
        setLayerLayoutPropertySafely(map, layer.id, 'visibility', 'visible');
        setLayerPaintPropertySafely(map, layer.id, 'text-color', palette.placeLabel);
        setLayerPaintPropertySafely(map, layer.id, 'text-halo-color', 'rgba(255,255,255,0.96)');
        setLayerPaintPropertySafely(
          map,
          layer.id,
          'text-halo-width',
          mapVariant === 'dashboard' ? 1.25 : 1.45
        );
        setLayerPaintPropertySafely(map, layer.id, 'text-opacity', palette.placeLabelOpacity);
        setLayerLayoutPropertySafely(map, layer.id, 'text-font', [
          'Open Sans Semibold',
          'Arial Unicode MS Regular',
        ]);
      } else if (isRoadLabel) {
        setLayerLayoutPropertySafely(map, layer.id, 'visibility', 'visible');
        setLayerPaintPropertySafely(map, layer.id, 'text-color', palette.roadLabel);
        setLayerPaintPropertySafely(map, layer.id, 'text-halo-color', 'rgba(255,255,255,0.95)');
        setLayerPaintPropertySafely(
          map,
          layer.id,
          'text-halo-width',
          mapVariant === 'dashboard' ? 1.05 : 1.2
        );
        setLayerPaintPropertySafely(map, layer.id, 'text-opacity', palette.roadLabelOpacity);
        setLayerLayoutPropertySafely(map, layer.id, 'text-font', [
          'Open Sans Regular',
          'Arial Unicode MS Regular',
        ]);
      } else if (isWater) {
        setLayerPaintPropertySafely(map, layer.id, 'text-color', palette.waterLabel);
        setLayerPaintPropertySafely(map, layer.id, 'text-opacity', 0.78);
      }
    }
  });
}
