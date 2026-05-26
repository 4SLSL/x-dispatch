import maplibregl from 'maplibre-gl';
import {
  ensureAircraftIcons,
  ensureFallbackIcon,
  normalizeIcao,
} from '@/components/Map/layers/dynamic/aircraftIcons';
import { safeAddGeoJSONSource } from '@/components/Map/layers/types';
import type { JoAircraft } from '@/modules/jo/lib/types';

const PILOT_LAYER_ID = 'jfs4xd-traffic';
const PILOT_SOURCE_ID = 'jfs4xd-traffic-source';
const TRAIL_LAYER_ID = 'jfs4xd-trails';
const TRAIL_SOURCE_ID = 'jfs4xd-trails-source';
const LABEL_LAYER_ID = 'jfs4xd-labels';

const COLOR = '#f97316';
const COLOR_GLOW = '#ea580c';

function calculateTrail(
  lat: number,
  lon: number,
  heading: number,
  speed: number
): [number, number][] {
  if (speed < 30) return [];
  const len = Math.min(0.12, Math.max(0.02, speed / 4000));
  const rad = ((heading + 180) % 360) * (Math.PI / 180);
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const points: [number, number][] = [[lon, lat]];
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    const segLen = len * t;
    const curve = Math.max(0, 1 - speed / 600) * 0.02 * Math.sin(t * Math.PI);
    points.push([lon + (segLen * Math.sin(rad) + curve) / cosLat, lat + segLen * Math.cos(rad)]);
  }
  return points;
}

function createPilotGeoJSON(aircraft: JoAircraft[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: aircraft.map((a) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [a.longitude, a.latitude] },
      properties: {
        id: a.id,
        callsign: a.callsign,
        altitude: a.altitude,
        groundspeed: a.groundspeed,
        heading: a.heading,
        aircraft: a.aircraftType ?? '',
        acIcon: a.aircraftType ? normalizeIcao(a.aircraftType) : '',
        owner: a.owner ?? '',
        flightLevel: Math.round(a.altitude / 100),
        isUser: a.isUser ? 1 : 0,
      },
    })),
  };
}

function createTrailGeoJSON(aircraft: JoAircraft[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: aircraft
      .filter((a) => a.groundspeed > 30)
      .map((a) => {
        const trail = calculateTrail(a.latitude, a.longitude, a.heading, a.groundspeed);
        if (trail.length < 2) return null;
        return {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: trail },
          properties: { callsign: a.callsign, groundspeed: a.groundspeed },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null),
  };
}

export async function addJoTrafficLayer(
  map: maplibregl.Map,
  aircraft: JoAircraft[]
): Promise<void> {
  if (!map.getStyle()) return;

  removeJoTrafficLayer(map);
  if (aircraft.length === 0) return;

  const pilotGeoJSON = createPilotGeoJSON(aircraft);
  const trailGeoJSON = createTrailGeoJSON(aircraft);

  const uniqueIcaos = [
    ...new Set(
      aircraft.map((a) => (a.aircraftType ? normalizeIcao(a.aircraftType) : '')).filter(Boolean)
    ),
  ];
  await ensureFallbackIcon(map);
  await ensureAircraftIcons(map, uniqueIcaos);
  if (!map.getStyle()) return;

  if (map.getSource(PILOT_SOURCE_ID)) {
    safeAddGeoJSONSource(map, TRAIL_SOURCE_ID, trailGeoJSON);
    safeAddGeoJSONSource(map, PILOT_SOURCE_ID, pilotGeoJSON);
    return;
  }

  safeAddGeoJSONSource(map, TRAIL_SOURCE_ID, trailGeoJSON);
  map.addLayer({
    id: TRAIL_LAYER_ID,
    type: 'line',
    source: TRAIL_SOURCE_ID,
    paint: {
      'line-color': COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 8, 2.5, 12, 3],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.35, 8, 0.5, 12, 0.6],
      'line-blur': 1,
    },
  });

  safeAddGeoJSONSource(map, PILOT_SOURCE_ID, pilotGeoJSON);
  map.addLayer({
    id: `${PILOT_LAYER_ID}-glow`,
    type: 'circle',
    source: PILOT_SOURCE_ID,
    paint: {
      'circle-color': COLOR_GLOW,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 8, 6, 12, 8],
      'circle-blur': 0.8,
      'circle-opacity': 0.45,
    },
  });

  map.addLayer({
    id: PILOT_LAYER_ID,
    type: 'symbol',
    source: PILOT_SOURCE_ID,
    layout: {
      'icon-image': [
        'coalesce',
        ['image', ['concat', 'ac-', ['get', 'acIcon']]],
        ['image', 'ac-fallback'],
      ],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 6, 0.8, 10, 1, 14, 1.2],
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-color': COLOR },
  });

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: PILOT_SOURCE_ID,
    minzoom: 5,
    layout: {
      'text-field': [
        'format',
        ['get', 'callsign'],
        { 'font-scale': 1 },
        '\n',
        {},
        ['concat', 'FL', ['to-string', ['get', 'flightLevel']]],
        { 'font-scale': 0.8 },
      ],
      'text-font': ['Open Sans Semibold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 8, 10, 12, 11],
      'text-offset': [1.5, 0],
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: {
      'text-color': COLOR,
      'text-halo-color': 'rgba(0, 0, 0, 0.9)',
      'text-halo-width': 1.5,
    },
  });
}

export function removeJoTrafficLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(PILOT_LAYER_ID)) map.removeLayer(PILOT_LAYER_ID);
  if (map.getLayer(`${PILOT_LAYER_ID}-glow`)) map.removeLayer(`${PILOT_LAYER_ID}-glow`);
  if (map.getLayer(TRAIL_LAYER_ID)) map.removeLayer(TRAIL_LAYER_ID);
  if (map.getSource(PILOT_SOURCE_ID)) map.removeSource(PILOT_SOURCE_ID);
  if (map.getSource(TRAIL_SOURCE_ID)) map.removeSource(TRAIL_SOURCE_ID);
}

export async function updateJoTrafficLayer(
  map: maplibregl.Map,
  aircraft: JoAircraft[]
): Promise<void> {
  const pilotSource = map.getSource(PILOT_SOURCE_ID) as maplibregl.GeoJSONSource;
  const trailSource = map.getSource(TRAIL_SOURCE_ID) as maplibregl.GeoJSONSource;
  if (pilotSource && trailSource) {
    const uniqueIcaos = [
      ...new Set(
        aircraft.map((a) => (a.aircraftType ? normalizeIcao(a.aircraftType) : '')).filter(Boolean)
      ),
    ];
    await ensureAircraftIcons(map, uniqueIcaos);
    pilotSource.setData(createPilotGeoJSON(aircraft));
    trailSource.setData(createTrailGeoJSON(aircraft));
  } else {
    await addJoTrafficLayer(map, aircraft);
  }
}

const clickHandlerSetup = new WeakSet<maplibregl.Map>();

export function setupJoClickHandler(map: maplibregl.Map, popup: maplibregl.Popup): void {
  if (clickHandlerSetup.has(map)) return;
  clickHandlerSetup.add(map);

  map.on('click', PILOT_LAYER_ID, (e) => {
    const feature = e.features?.[0];
    if (!feature?.properties) return;
    const props = feature.properties;
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
    const owner = props.owner
      ? `<div class="text-xs text-muted-foreground">${props.owner}</div>`
      : '';
    popup
      .setLngLat(coords)
      .setHTML(
        `<div class="space-y-1 p-1 font-sans text-sm">
          <div class="font-mono font-semibold text-[#f97316]">${props.callsign}</div>
          ${owner}
          <div class="text-xs text-muted-foreground">FL${props.flightLevel} · ${Math.round(Number(props.groundspeed))} kt</div>
        </div>`
      )
      .addTo(map);
  });

  map.on('mouseenter', PILOT_LAYER_ID, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', PILOT_LAYER_ID, () => {
    map.getCanvas().style.cursor = '';
  });
}

export function toggleJoTrafficLayer(
  mapRef: { current: maplibregl.Map | null },
  enable: boolean
): void {
  const map = mapRef.current;
  if (!map || enable) return;
  removeJoTrafficLayer(map);
}
