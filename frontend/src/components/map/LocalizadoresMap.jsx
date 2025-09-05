import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Notification from './Notification';

const API_BASE = 'http://127.0.0.1:8000';
const OSRM_BASE = 'https://router.project-osrm.org'; // cámbialo si tienes OSRM propio
const POLL_MS = 3000;           // frecuencia de actualización de posiciones
const ROUTE_RECALC_M = 10;      // umbral (m) para recalcular ruta cuando un localizador se mueve
const DEVIATION_THRESHOLD_M = 15; // umbral (m) para alerta de desvío de ruta

// Marcadores
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41],
});
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41],
});
const yellowIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41],
});

// Lugares fijos (tu lista)
const locations = {
  escalones: [-2.1445672, -79.9661444],
  arbol: [-2.1447294, -79.9659862],
  frutangas: [-2.1447917, -79.9660814],
  //fiec11A: [-2.1446265, -79.9679971],
  //V7_36: [-2.0535586, -79.9307966],
  //V7_37: [-2.0535161, -79.9307292],
  //V7_38: [-2.0534695, -79.9306900],
  //V7_39: [-2.0533975, -79.9307017],
  //V7_40: [-2.0533321, -79.9306574],
  //AreaSocial: [-2.0541122, -79.9355414],
  //Garita: [-2.0528875, -79.9351418],
  //V4_20: [-2.0550554, -79.9354408],

};

// Utils
function toLatLngArray(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const lat = Number(obj.lat), lng = Number(obj.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return null;
}
function haversineMeters(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return Infinity;
  const R = 6371000;
  const [lat1, lon1] = a, [lat2, lon2] = b;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLon / 2);
  const q = s1 * s1 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(q)));
}

// Distancia mínima (en metros) de un punto [lat,lng] a una polilínea [[lat,lng],...]
// Sin dependencias externas ni "mapas fantasma".
function pointToPolylineDistance(point, polyline) {
  if (!point || !Array.isArray(point) || !polyline || polyline.length < 2) return Infinity;

  const [plat, plng] = point;
  const R = 6371000; // radio terrestre en metros
  const toXY = ([lat, lng]) => {
    // Proyección equirectangular local alrededor del punto
    const rad = Math.PI / 180;
    const x = R * (lng - plng) * rad * Math.cos((plat * rad));
    const y = R * (lat - plat) * rad;
    return [x, y];
  };

  // Distancia de un punto P a un segmento AB en 2D
  const distPointToSeg = (P, A, B) => {
    const [px, py] = P;
    const [ax, ay] = A;
    const [bx, by] = B;
    const ABx = bx - ax, ABy = by - ay;
    const APx = px - ax, APy = py - ay;
    const ab2 = ABx * ABx + ABy * ABy;
    if (ab2 === 0) {
      // A y B coinciden
      const dx = px - ax, dy = py - ay;
      return Math.hypot(dx, dy);
    }
    // proyección escalar de AP sobre AB acotada a [0,1]
    const t = Math.max(0, Math.min(1, (APx * ABx + APy * ABy) / ab2));
    const cx = ax + t * ABx, cy = ay + t * ABy;
    return Math.hypot(px - cx, py - cy);
  };

  const Pxy = toXY(point);
  let minD = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const Axy = toXY(polyline[i]);
    const Bxy = toXY(polyline[i + 1]);
    const d = distPointToSeg(Pxy, Axy, Bxy);
    if (d < minD) minD = d;
  }
  return minD; // en metros
}


function colorForId(id) {
  // colores distintos por id (simple hash)
  const colors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999'];
  const n = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colors[n % colors.length];
}

// Mantiene todos los puntos visibles (localizadores + destinos)
function FitToAll({ points }) {
  const map = useMap();
  const lastSigRef = useRef('');
  useEffect(() => {
    const pts = points.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (pts.length === 0) return;
    if (pts.length === 1) {
      const [lat, lng] = pts[0];
      const sig = `1:${lat.toFixed(6)},${lng.toFixed(6)}`;
      if (sig !== lastSigRef.current) {
        map.setView([lat, lng], Math.max(map.getZoom(), 16));
        lastSigRef.current = sig;
      }
      return;
    }
    const bounds = L.latLngBounds(pts.map(([lat, lng]) => L.latLng(lat, lng)));
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    const sig = `N:${pts.length}:${sw.lat.toFixed(6)},${sw.lng.toFixed(6)}|${ne.lat.toFixed(6)},${ne.lng.toFixed(6)}`;
    if (sig !== lastSigRef.current) {
      map.fitBounds(bounds, { padding: [40, 40] });
      lastSigRef.current = sig;
    }
  }, [points, map]);
  return null;
}

const LocalizadoresMap = () => {
  // [{id, nombre, coords:[lat,lng]|null, topic?:string|null, desbloquear?:boolean|null}]
  const [localizadores, setLocalizadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState('');

  // UI de asignación
  const [selLocId, setSelLocId] = useState('');
  const [selDestKey, setSelDestKey] = useState('');
  const [codigo, setCodigo] = useState('');

  // destinos asignados por localizador: { [id]: 'arbol' | ... }
  const [assigned, setAssigned] = useState({});

  // rutas por localizador: { [id]: { destKey, destCoords, line:[[lat,lng],...], distance, duration, service } }
  const [routes, setRoutes] = useState({});
  // Ruta original para la detección de desvío, no se recalcula
  const [originalRoutes, setOriginalRoutes] = useState({});

  // estado para notificaciones de desvío
  const [deviationAlerts, setDeviationAlerts] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [alertSoundEnabled, setAlertSoundEnabled] = useState(true);
  const [alertVolume, setAlertVolume] = useState(0.8);      // 0.0–1.0 (más alto por defecto)
  const [alertDurationMs, setAlertDurationMs] = useState(1200); // duración más larga por defecto
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const compressorRef = useRef(null);
  
  function ensureAudio() {
    if (audioCtxRef.current) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-24, ctx.currentTime);
    comp.knee.setValueAtTime(30, ctx.currentTime);
    comp.ratio.setValueAtTime(12, ctx.currentTime);
    comp.attack.setValueAtTime(0.003, ctx.currentTime);
    comp.release.setValueAtTime(0.25, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    comp.connect(gain);
    gain.connect(ctx.destination);
    audioCtxRef.current = ctx;
    masterGainRef.current = gain;
    compressorRef.current = comp;
  }

  function playAlert(durationMs, volume) {
    // fallbacks usan el estado actual (ya disponible en este scope)
    if (durationMs == null) durationMs = alertDurationMs;
    if (volume == null) volume = alertVolume;

    try {
      ensureAudio();
      const ctx = audioCtxRef.current;
      const gain = masterGainRef.current;
      const comp = compressorRef.current;
      const now = ctx.currentTime;

      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'square';
      o2.type = 'square';
      o1.frequency.setValueAtTime(1100, now);
      o2.frequency.setValueAtTime(1600, now);
      o1.connect(comp);
      o2.connect(comp);

      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, Math.min(volume, 1.0)), now + 0.03);

      const end = now + durationMs / 1000;
      o1.frequency.linearRampToValueAtTime(900, end);
      o2.frequency.linearRampToValueAtTime(1400, end);

      gain.gain.setValueAtTime(Math.max(0.001, Math.min(volume, 1.0)), end - 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      o1.start(now);
      o2.start(now);
      o1.stop(end + 0.05);
      o2.stop(end + 0.05);
    } catch (e) {
      // Navegador puede bloquear audio sin interacción previa
    }
  }
  
  // ---------- Carga inicial (IDs + mensajes) ----------
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const fetchLocalizadores = fetch(`${API_BASE}/localizadores`).then(r => r.json());
    const fetchMessages = fetch(`${API_BASE}/messages`).then(r => r.json()).catch(() => ({ messages: [] }));
    Promise.all([fetchLocalizadores, fetchMessages])
      .then(([locsJson, msgsJson]) => {
        if (!alive) return;
        const ids = Array.isArray(locsJson?.localizadores) ? locsJson.localizadores : [];
        const msgs = Array.isArray(msgsJson?.messages) ? msgsJson.messages : [];
        const metaById = new Map();
        msgs.forEach(m => {
          if (m?.id) metaById.set(String(m.id), { topic: m.topic ?? null, desbloquear: Boolean(m.desbloquear) });
        });
        const baseList = ids.map(id => {
          const meta = metaById.get(String(id));
          return {
            id: String(id),
            nombre: `Localizador ${id}`,
            coords: null,
            topic: meta?.topic ?? null,
            desbloquear: meta?.desbloquear ?? null,
          };
        });
        setLocalizadores(baseList);
        if (baseList.length > 0) setSelLocId(baseList[0].id);
      })
      .catch(() => setError('No se pudo cargar /localizadores'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // ---------- Polling de posiciones y mensajes ----------
  useEffect(() => {
    if (!live || localizadores.length === 0) return;
    let alive = true;
    const tick = async () => {
      try {
        const msgsJson = await fetch(`${API_BASE}/messages`).then(r => r.json()).catch(() => ({ messages: [] }));
        const msgs = Array.isArray(msgsJson?.messages) ? msgsJson.messages : [];
        const metaById = new Map();
        msgs.forEach(m => {
          if (m?.id) metaById.set(String(m.id), { topic: m.topic ?? null, desbloquear: Boolean(m.desbloquear) });
        });
        const coordsList = await Promise.all(
          localizadores.map(async (l) => {
            try {
              const res = await fetch(`${API_BASE}/coordenadas/${encodeURIComponent(l.id)}`);
              const data = await res.json();
              return { id: l.id, coords: toLatLngArray(data) };
            } catch {
              return { id: l.id, coords: null };
            }
          })
        );
        if (!alive) return;

        // Actualiza posiciones/metadatos
        setLocalizadores(prev => prev.map(l => {
          const c = coordsList.find(x => x.id === l.id)?.coords ?? l.coords;
          const meta = metaById.get(l.id);
          return {
            ...l,
            coords: c ?? l.coords,
            topic: meta?.topic ?? l.topic,
            desbloquear: (typeof meta?.desbloquear === 'boolean') ? meta.desbloquear : l.desbloquear,
          };
        }));
        setLastUpdate(new Date());
      } catch (e) {
        // Silencioso para no romper polling
        console.error('Polling error', e);
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [live, localizadores.length]);

  // ---------- Routing ----------
  async function getRouteOSRM(start, dest) {
    // OSRM espera lon,lat
    const url = `${OSRM_BASE}/route/v1/driving/${start[1]},${start[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM status ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates) throw new Error('Sin geometría en respuesta OSRM');
    const line = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    return { line, distance: route.distance, duration: route.duration, service: 'osrm' };
  }
  function straightRoute(start, dest) {
    return { line: [start, dest], distance: haversineMeters(start, dest), duration: null, service: 'straight' };
  }
  async function computeAndStoreRouteForId(id, destKey, isOriginal = false) {
    const loc = localizadores.find(l => l.id === id);
    if (!loc?.coords) return;
    const destCoords = locations[destKey];
    if (!destCoords) return;
    try {
      const r = await getRouteOSRM(loc.coords, destCoords);
      setRoutes(prev => ({ ...prev, [id]: { destKey, destCoords, ...r } }));
      if (isOriginal) {
        setOriginalRoutes(prev => ({ ...prev, [id]: { destKey, destCoords, ...r } }));
      }
    } catch (e) {
      console.warn(`OSRM falló para ${id} → ${destKey}. Uso línea recta.`, e);
      const r = straightRoute(loc.coords, destCoords);
      setRoutes(prev => ({ ...prev, [id]: { destKey, destCoords, ...r } }));
      if (isOriginal) {
        setOriginalRoutes(prev => ({ ...prev, [id]: { destKey, destCoords, ...r } }));
      }
    }
  }

  // Asignar destino (botón)
  const assignDestination = async () => {
    if (!selLocId || !selDestKey || !codigo) {
      alert('Por favor, selecciona un localizador, un destino e introduce un código.');
      return;
    }
    const destCoords = locations[selDestKey];
    if (!destCoords) return;

    try {
      const response = await fetch(`${API_BASE}/destino/${selLocId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destino: { lat: destCoords[0], lng: destCoords[1] },
          codigo: codigo,
        }),
      });
      if (!response.ok) {
        throw new Error('Error al enviar el destino al backend');
      }
      setAssigned(prev => ({ ...prev, [selLocId]: selDestKey }));
      // Calcula y guarda la ruta mostrada Y la original
      await computeAndStoreRouteForId(selLocId, selDestKey, true);
      setCodigo(''); // Limpiar código después de asignar

    } catch (error) {
      console.error("Error al asignar destino:", error);
      alert(`Error al asignar destino: ${error.message}`);
    }
  };

  // Recalcular rutas cuando cambian posiciones o asignaciones
  useEffect(() => {
    // para cada asignado, si no hay ruta o el start cambió > ROUTE_RECALC_M, recalcular
    Object.entries(assigned).forEach(async ([id, destKey]) => {
      const loc = localizadores.find(l => l.id === id);
      const hasStart = Array.isArray(loc?.coords);
      const r = routes[id];
      if (!hasStart) return;
      if (!r) {
        // aún no hay ruta, calcularla (pero no como original)
        computeAndStoreRouteForId(id, destKey, false);
        return;
      }
      const moved = haversineMeters(loc.coords, r.line?.[0]) > ROUTE_RECALC_M;
      const destChanged = r.destKey !== destKey;
      if (moved || destChanged) {
        // Recalcular solo la ruta mostrada, no la original
        computeAndStoreRouteForId(id, destKey, false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localizadores, assigned]);

  // ---------- Detección de desvío de ruta ----------
  useEffect(() => {
    const newDeviationAlerts = { ...deviationAlerts };
    let alertsChanged = false;

    // Usar la ruta original para la detección
    Object.entries(originalRoutes).forEach(([id, route]) => {
      const loc = localizadores.find(l => l.id === id);
      if (!loc?.coords || !route?.line || route.line.length < 2) return;

      // Usar nuestra nueva función de cálculo
      const distance = pointToPolylineDistance(loc.coords, route.line);
      const isDeviated = distance > DEVIATION_THRESHOLD_M;

      // Solo actuar si el estado de la alerta cambia
      if (isDeviated !== !!newDeviationAlerts[id]) {
        if (isDeviated) {
          const newNotif = {
            id: `dev-${id}-${Date.now()}`,
            message: `¡Alerta! El localizador ${id} se ha desviado de la ruta.`
          };
          setNotifications(prev => [...prev, newNotif]);
          if (alertSoundEnabled) playAlert();
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
          }, 5000); // La notificación desaparece después de 5 segundos
        }
        newDeviationAlerts[id] = isDeviated;
        alertsChanged = true;
      }
    });

    if (alertsChanged) {
      setDeviationAlerts(newDeviationAlerts);
    }
  }, [localizadores, originalRoutes]);

  // Quitar ruta/destino de un localizador
  const removeAssignment = (id) => {
    setAssigned(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setRoutes(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setOriginalRoutes(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setDeviationAlerts(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // Puntos a mantener visibles: localizadores + destinos asignados
  const fitPoints = useMemo(() => {
    const pts = [];
    localizadores.forEach(l => { if (Array.isArray(l.coords)) pts.push(l.coords); });
    Object.values(routes).forEach(r => { if (Array.isArray(r.destCoords)) pts.push(r.destCoords); });
    return pts;
  }, [localizadores, routes]);

  return (
    <div>
      <Notification notifications={notifications} />
      {/* Controles */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <label>
          Localizador:&nbsp;
          <select value={selLocId} onChange={e => setSelLocId(e.target.value)} disabled={loading || localizadores.length === 0}>
            {localizadores.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </label>

        <label>
          Destino:&nbsp;
          <select value={selDestKey} onChange={e => setSelDestKey(e.target.value)}>
            <option value="">— selecciona —</option>
            {Object.keys(locations).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>

        <label>
          Código:&nbsp;
          <input type="text" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Código de seguridad" />
        </label>

        <button type="button" onClick={assignDestination} disabled={!selLocId || !selDestKey || !codigo}>
          Asignar destino
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} />
          Live update
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={alertSoundEnabled} onChange={e => setAlertSoundEnabled(e.target.checked)} />
              Sonido alerta
            </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          +        Volumen:&nbsp;
          +        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={alertVolume}
          onChange={(e) => setAlertVolume(parseFloat(e.target.value))}
          style={{ width: 120 }}
        />
        <span>{Math.round(alertVolume * 100)}%</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Duración:&nbsp;
        <input
          type="range"
          min={300}
          max={3000}
          step={50}
          value={alertDurationMs}
          onChange={(e) => setAlertDurationMs(parseInt(e.target.value, 10))}
          style={{ width: 140 }}
        />
        <span>{alertDurationMs} ms</span>
      </label>

        {lastUpdate && <small style={{ opacity: 0.7 }}>Última actualización: {lastUpdate.toLocaleTimeString()}</small>}
        {error && <span style={{ color: 'crimson' }}>{error}</span>}
      </div>

      {/* Resumen de asignaciones */}
      <div style={{ marginBottom: 8 }}>
        {Object.entries(assigned).length === 0 ? (
          <small style={{ opacity: 0.7 }}>Sin destinos asignados.</small>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(assigned).map(([id, destKey]) => (
              <div key={id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px' }}>
                <strong>{id}</strong> → <em>{destKey}</em>{' '}
                <button onClick={() => removeAssignment(id)} style={{ marginLeft: 8 }}>Quitar</button>
                {routes[id]?.distance != null && (
                  <span style={{ marginLeft: 8, opacity: 0.8 }}>
                    {routes[id].service === 'osrm' ? 'Ruta OSRM' : 'Línea recta'} – {(routes[id].distance / 1000).toFixed(2)} km
                    {routes[id].duration ? ` · ${(routes[id].duration / 60).toFixed(0)} min` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mapa */}
      <MapContainer center={[-2.1445672, -79.9661444]} zoom={17} style={{ height: '440px', width: '100%' }}>
        <FitToAll points={fitPoints} />
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Marcadores de localizadores */}
        {localizadores.filter(l => Array.isArray(l.coords)).map(l => (
          <React.Fragment key={l.id}>
             {/* Halo pulsante si está desviado */}
             {deviationAlerts[l.id] && (
              <CircleMarker
                 center={l.coords}
                 radius={16}
                 pathOptions={{ color: '#ffcc00', weight: 3, fill: true }}
                 className="pulse"
            />
          )}
         <Marker position={l.coords} icon={deviationAlerts[l.id] ? yellowIcon : redIcon}>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong>{l.nombre}</strong><br />
                {l.coords ? `${l.coords[0].toFixed(6)}, ${l.coords[1].toFixed(6)}` : 'Sin coordenadas'}<br />
                {l.topic ? <>Topic: <code>{l.topic}</code><br /></> : null}
                {typeof l.desbloquear === 'boolean' ? <>Desbloquear: {l.desbloquear ? 'Sí' : 'No'}</> : null}
              </div>
            </Popup>
            </Marker>
            </React.Fragment>
            ))}


        {/* Marcadores de destinos asignados */}
        {Object.entries(assigned).map(([id, destKey]) => {
          const p = locations[destKey];
          if (!p) return null;
          return (
            <Marker key={`dest-${id}`} position={p} icon={blueIcon}>
              <Popup>
                <div><strong>Destino</strong>: {destKey}<br />{p[0].toFixed(6)}, {p[1].toFixed(6)}</div>
              </Popup>
            </Marker>
          );
        })}

        {/* Polilíneas de rutas */}
        {Object.entries(routes).map(([id, r]) => {
          if (!r?.line || r.line.length < 2) return null;
          return (
            <Polyline
              key={`route-${id}`}
              positions={r.line}
              pathOptions={{
                color: colorForId(id),
                weight: 5,
                opacity: 0.85,
                dashArray: r.service === 'straight' ? '6 8' : undefined
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
};

export default LocalizadoresMap;