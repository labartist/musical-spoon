// ── Dropdown transitions ─────────────────────────────
// Animate <details> open/close with CSS grid transition
document.querySelectorAll('.dropdown').forEach(details => {
    const content = details.querySelector('.dropdown-content');
    const summary = details.querySelector('.dropdown-toggle');
    let isAnimating = false;

    // If already open on load, set inline styles to match
    if (details.open) {
        content.style.gridTemplateRows = '1fr';
        content.style.opacity = '1';
    }

    summary.addEventListener('click', e => {
        e.preventDefault();
        if (isAnimating) return;

        if (details.open) {
            // Closing: animate first, then remove open
            isAnimating = true;
            content.style.gridTemplateRows = '0fr';
            content.style.opacity = '0';
            content.addEventListener('transitionend', function handler(ev) {
                if (ev.propertyName === 'grid-template-rows') {
                    details.open = false;
                    isAnimating = false;
                    content.removeEventListener('transitionend', handler);
                }
            });
        } else {
            // Opening: set collapsed state, open element, then animate
            isAnimating = true;
            content.style.gridTemplateRows = '0fr';
            content.style.opacity = '0';
            details.open = true;
            // Force layout recalc so browser registers the 0fr state
            content.offsetHeight;
            content.style.gridTemplateRows = '1fr';
            content.style.opacity = '1';
            content.addEventListener('transitionend', function handler(ev) {
                if (ev.propertyName === 'grid-template-rows') {
                    isAnimating = false;
                    content.removeEventListener('transitionend', handler);
                }
            });
        }
    });
});

// ── Carousel drag-to-scroll ──────────────────────────
// Click-drag the showcase track to scroll it; a real drag suppresses the
// card link click so dragging never opens a product page.
(() => {
    const track = document.querySelector('.showcase-track');
    if (!track) return;

    const DRAG_THRESHOLD = 6; // px of movement before it counts as a drag
    let isDown = false;
    let didDrag = false;
    let startX = 0;
    let startScrollLeft = 0;

    // Cards are <a> links — block the browser's native link/image drag
    // (it shows a URL ghost overlay and hijacks the gesture)
    track.addEventListener('dragstart', e => e.preventDefault());

    track.addEventListener('mousedown', e => {
        isDown = true;
        didDrag = false;
        startX = e.pageX;
        startScrollLeft = track.scrollLeft;
        // Snap fights the cursor mid-drag — disable until release
        track.style.scrollSnapType = 'none';
        track.classList.add('dragging');
    });

    window.addEventListener('mousemove', e => {
        if (!isDown) return;
        const dx = e.pageX - startX;
        if (Math.abs(dx) > DRAG_THRESHOLD) didDrag = true;
        if (didDrag) {
            e.preventDefault();
            track.scrollLeft = startScrollLeft - dx;
        }
    });

    // Ease to the nearest card instead of letting snap jump instantly.
    // scrollIntoView(inline:'start') reuses the browser's own snap geometry,
    // so the smooth landing matches the native snap point (no post-jerk).
    function snapToNearest() {
        const cards = [...track.querySelectorAll('.showcase-card')];
        if (!cards.length) return;
        const trackLeft = track.getBoundingClientRect().left;
        let best = cards[0], bestDist = Infinity;
        for (const card of cards) {
            const dist = Math.abs(card.getBoundingClientRect().left - trackLeft);
            if (dist < bestDist) { bestDist = dist; best = card; }
        }
        best.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }

    window.addEventListener('mouseup', () => {
        if (!isDown) return;
        isDown = false;
        track.classList.remove('dragging');
        if (didDrag) {
            snapToNearest();
            // restore native snapping once the smooth glide has settled
            setTimeout(() => { track.style.scrollSnapType = ''; }, 450);
        } else {
            track.style.scrollSnapType = '';
        }
    });

    // Swallow the click that follows a drag so card links don't fire
    track.addEventListener('click', e => {
        if (didDrag) {
            e.preventDefault();
            e.stopPropagation();
            didDrag = false;
        }
    }, true);
})();

// ── Globe ──────────────────────────────────────────────
const globeEl = document.getElementById('globe-container');
const GEOJSON_URL = 'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';

// ── Travel history (2026, round-trips from the Jakarta hub) ───────
const HOME = { name: 'Jakarta, Indonesia', lat: -6.2088, lng: 106.8456 };

// Places visited (deduped), with coords and the date(s) there
const PLACES = {
    Bali:      { name: 'Bali, Indonesia',      date: '15 Jan 2026',      lat: -8.4095,  lng: 115.1889 },
    Tasmania:  { name: 'Tasmania, Australia',  date: '16 Mar 2026',      lat: -42.8821, lng: 147.3272 },
    Melbourne: { name: 'Melbourne, Australia', date: '21 Mar 2026',      lat: -37.8136, lng: 144.9631 },
    Shanghai:  { name: 'Shanghai, China',      date: '16 Apr 2026',      lat: 31.2304,  lng: 121.4737 },
    Rome:      { name: 'Rome, Italy',          date: '16 & 24 Apr 2026', lat: 41.9028,  lng: 12.4964 },
    Florence:  { name: 'Florence, Italy',      date: '18 Apr 2026',      lat: 43.7696,  lng: 11.2558 },
    Milan:     { name: 'Milan, Italy',         date: '20 Apr 2026',      lat: 45.4642,  lng: 9.1900 },
    Naples:    { name: 'Naples, Florida, USA', date: '25 Apr 2026',      lat: 26.1420,  lng: -81.7948 },
};

// Chronological journey as round-trips out of Jakarta (each trip returns home)
const JOURNEY = [
    HOME, PLACES.Bali, HOME,                                   // Jan: Bali return
    PLACES.Tasmania, PLACES.Melbourne, HOME,                   // Mar: Tasmania → Melbourne → home
    PLACES.Shanghai, PLACES.Rome, PLACES.Florence,             // Apr: Shanghai → Italy …
    PLACES.Milan, PLACES.Rome, PLACES.Naples, PLACES.Rome, HOME, // … → Florida → Rome → home
];

// Build arcs from an ordered waypoint list, deduped undirected (out-and-back drawn once)
function buildArcs(waypoints) {
    const arcs = [], seen = new Set();
    for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i], b = waypoints[i + 1];
        if (a.lat === b.lat && a.lng === b.lng) continue; // skip zero-length leg
        const key = [`${a.lat},${a.lng}`, `${b.lat},${b.lng}`].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        arcs.push({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng });
    }
    return arcs;
}
const TRAVEL_ARCS = buildArcs(JOURNEY);

// City markers = curated base destinations (Jakarta = the live pin) + auto-tracked stops
const TRAVEL_DOTS = Object.values(PLACES);
let autoStops = []; // appended from location_history (future travel)

// Great-circle km between two coords — client-side de-dupe of auto stops
function kmBetween(la1, lo1, la2, lo2) {
    const R = 6371, r = d => d * Math.PI / 180;
    const dLa = r(la2 - la1), dLo = r(lo2 - lo1);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function getGlobeSize() {
    return Math.min(globeEl.clientWidth, globeEl.clientHeight, 480);
}

// Build globe shell first (no hex data yet)
const globe = Globe()(globeEl)
    .backgroundColor('rgba(0,0,0,0)')
    .showGlobe(true)
    .showAtmosphere(true)
    .atmosphereColor('#6a5acd')
    .atmosphereAltitude(0.15)
    .globeImageUrl('')
    .width(getGlobeSize())
    .height(getGlobeSize())
    // Hex grid countries — flat hexagons (not dots) for performance
    .hexPolygonResolution(3)
    .hexPolygonMargin(0.35)
    .hexPolygonUseDots(false)
    .hexPolygonColor(() => '#baa6d0')
    // Antarctica as individual label dots to match hex style
    .labelsData([])
    .labelLat(d => d.lat)
    .labelLng(d => d.lng)
    .labelText(() => '')
    .labelDotRadius(0.35)
    .labelColor(() => '#baa6d0')
    .labelResolution(6)
    .labelAltitude(0.001)
    // Location pins — live (white spike) + travel dots (periwinkle)
    .pointsData([])
    .pointColor(d => d.color || '#ffffff')
    .pointAltitude(d => d.alt != null ? d.alt : 0.14)
    .pointRadius(d => d.radius != null ? d.radius : 0.05)
    .pointsMerge(false)
    // Hover tooltip — where I was + when (live pin shows "You are here")
    .pointLabel(d => {
        if (d.kind === 'live') {
            return `<div class="globe-tip"><span class="globe-tip-name">${currentCity}</span><span class="globe-tip-sub">Current location</span></div>`;
        }
        return `<div class="globe-tip"><span class="globe-tip-name">${d.name}</span><span class="globe-tip-sub">${d.date}</span></div>`;
    })
    // Travel arcs — chronological journey path
    .arcsData(TRAVEL_ARCS)
    .arcCurveResolution(128)
    .arcColor(() => ['rgba(169,184,232,0.25)', 'rgba(169,184,232,0.9)'])
    .arcStroke(0.45)
    .arcDashLength(0.6)
    .arcDashGap(0.25)
    .arcDashInitialGap(() => Math.random())
    .arcDashAnimateTime(3800)
    // 3D surface pulse rings — conform to globe curvature
    .ringsData([])
    .ringColor(() => t => `rgba(255,255,255,${0.8 * (1 - t)})`)
    .ringMaxRadius(5)
    .ringPropagationSpeed(1.5)
    .ringRepeatPeriod(1400)
;

// Dark globe surface — access Three.js via globe's scene
const mat = globe.globeMaterial();
mat.color.set('#0d0d18');
mat.emissive = mat.color.clone();
mat.emissiveIntensity = 0.1;

globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0;   // managed by updateAutoSpin()
globe.controls().enableZoom = false;

// ── Auto-spin control ─────────────────────────────────
// Pause while the user is interacting (dragging or hovering the globe);
// resume after 3s of stillness, ramping the speed up gradually.
const AUTO_SPIN_SPEED = 0.3;
const RESUME_DELAY_MS = 3000;
const SPIN_RAMP_STEP = 0.01; // per-frame speed increase → quick but smooth acceleration
let spinDragging = false;
let spinHovering = false;
let lastInteractionAt = performance.now() - RESUME_DELAY_MS; // spin up right away on load

globe.controls().addEventListener('start', () => { spinDragging = true; });
globe.controls().addEventListener('end', () => { spinDragging = false; lastInteractionAt = performance.now(); });
globeEl.addEventListener('mouseenter', () => { spinHovering = true; });
globeEl.addEventListener('mouseleave', () => { spinHovering = false; lastInteractionAt = performance.now(); });

function updateAutoSpin() {
    const ctrl = globe.controls();
    if (spinDragging || spinHovering) {
        // Actively engaging the globe — stop immediately and hold
        lastInteractionAt = performance.now();
        ctrl.autoRotateSpeed = 0;
    } else if (performance.now() - lastInteractionAt > RESUME_DELAY_MS) {
        // Idle long enough — ease the spin back up to full speed
        ctrl.autoRotateSpeed = Math.min(AUTO_SPIN_SPEED, ctrl.autoRotateSpeed + SPIN_RAMP_STEP);
    } else {
        // Within the idle grace window — stay stopped
        ctrl.autoRotateSpeed = 0;
    }
}

// Point-in-polygon test (ray casting)
function pointInPolygon(lat, lng, polygon) {
    for (const ring of polygon) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i];
            const [xj, yj] = ring[j];
            if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        if (inside) return true;
    }
    return false;
}

function pointInFeature(lat, lng, feature) {
    const geom = feature.geometry;
    if (geom.type === 'Polygon') {
        return pointInPolygon(lat, lng, geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
        return geom.coordinates.some(poly => pointInPolygon(lat, lng, poly));
    }
    return false;
}

// Load country data then apply hex + dot layers
fetch(GEOJSON_URL)
    .then(r => r.json())
    .then(data => {
        // Hex grid for everything except Antarctica
        globe.hexPolygonsData(data.features.filter(f => f.properties.ISO_A2 !== 'AQ'));

        // Generate grid of dots for Antarctica to match hex style
        const aq = data.features.find(f => f.properties.ISO_A2 === 'AQ');
        if (aq) {
            const dots = [];
            const step = 0.9; // match hex resolution 3 (~1° spacing)
            let row = 0;
            for (let lat = -90; lat <= -60; lat += step) {
                // Adjust longitude step for latitude convergence
                const lngStep = step / Math.max(Math.cos(lat * Math.PI / 180), 0.05);
                // Hex stagger: offset every other row by half a cell
                const offset = (row % 2 === 0) ? 0 : lngStep / 2;
                for (let lng = -180 + offset; lng < 180; lng += lngStep) {
                    if (pointInFeature(lat, lng, aq)) {
                        dots.push({ lat, lng });
                    }
                }
                row++;
            }
            globe.labelsData(dots);
        }
    });

// Persistent glow overlay — stays visible (faded) when pin is behind globe
// Insert into globe.gl's own wrapper div so getScreenCoords aligns directly
const persistentGlow = document.createElement('div');
persistentGlow.className = 'pin-glow-persistent';
const globeWrapper = globeEl.querySelector(':scope > div');
globeWrapper.style.position = 'relative';
globeWrapper.appendChild(persistentGlow);

let pinLat = null, pinLng = null;

// Fallback location + vitals until API responds
setLocation(-6.2088, 106.8456); // fallback: Jakarta

// Render travel city dots + the live location pin in one points layer
// Travel dots use a roomy radius so they're easy to hover (hit area = dot size)
function renderPoints() {
    const pts = [...TRAVEL_DOTS, ...autoStops].map(p => ({
        lat: p.lat, lng: p.lng, color: '#a9b8e8', radius: 0.5, alt: 0.01,
        name: p.name, date: p.date, kind: 'travel'
    }));
    if (pinLat !== null) {
        // Large invisible hit target so the tiny beacon is easy to hover
        pts.push({ lat: pinLat, lng: pinLng, color: 'rgba(0,0,0,0)', radius: 0.5, alt: 0.01, kind: 'live' });
        // Visible glowing beacon
        pts.push({ lat: pinLat, lng: pinLng, color: '#ffffff', radius: 0.05, alt: 0.14, kind: 'live' });
    }
    globe.pointsData(pts);
}

function setLocation(lat, lng) {
    pinLat = lat;
    pinLng = lng;
    renderPoints();
    globe.ringsData([{ lat, lng }]); // pulse only on live location
    globe.pointOfView({ lat, lng, altitude: 2.5 }, 1000);
}

// ── Auto-tracked travel (location_history) ────────────
// Reverse-geocode a coord → "City, Country" (free, no key), cached
const _geoCache = {};
async function reverseGeocode(lat, lng) {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    if (_geoCache[key]) return _geoCache[key];
    try {
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
        const d = await r.json();
        const city = d.city || d.locality || d.principalSubdivision || '';
        const name = city ? `${city}, ${d.countryName}` : (d.countryName || key);
        _geoCache[key] = name;
        return name;
    } catch (e) {
        return key;
    }
}

// Merge KV location history onto the curated base: new stops become dots + arcs.
// Skips pings near home (the live pin) and de-dupes by proximity (~60km).
async function applyLocations(locations) {
    if (!Array.isArray(locations) || !locations.length) return;
    const dots = [];
    for (const loc of locations) {
        if (kmBetween(loc.lat, loc.lng, HOME.lat, HOME.lng) < 60) continue; // home → live pin
        if ([...TRAVEL_DOTS, ...dots].some(p => kmBetween(loc.lat, loc.lng, p.lat, p.lng) < 60)) continue; // dup
        const name = await reverseGeocode(loc.lat, loc.lng);
        const date = new Date(loc.t).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        dots.push({ name, date, lat: loc.lat, lng: loc.lng });
    }
    autoStops = dots;
    renderPoints();
    // Extend the journey arcs through the raw stops (returns home included)
    const tail = locations.map(l => ({ lat: l.lat, lng: l.lng }));
    globe.arcsData(buildArcs([...JOURNEY, ...tail]));
}

// Track pin screen position and visibility each frame
// Smooth opacity + scale with lerp to avoid instant jumps
let currentOpacity = 0.5;
let currentScale = 1.0;
const LERP_SPEED = 0.9; // lower = smoother/slower transition

(function trackPin() {
    updateAutoSpin();
    if (pinLat !== null) {
        const coords = globe.getScreenCoords(pinLat, pinLng);
        if (coords) {
            const x = coords.x;
            const y = coords.y;

            // Angular distance from center of view to pin
            const pov = globe.pointOfView();
            const toRad = d => d * Math.PI / 180;
            const dLat = toRad(pinLat - pov.lat);
            const dLng = toRad(pinLng - pov.lng);
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(pov.lat)) * Math.cos(toRad(pinLat)) * Math.sin(dLng/2)**2;
            const angularDist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const halfPI = Math.PI / 2;

            // Target opacity and scale based on angular distance
            let targetOpacity, targetScale;
            if (angularDist < halfPI * 0.7) {
                // Clearly in front — full glow
                targetOpacity = 1.0;
                targetScale = 1.5;
            } else if (angularDist < halfPI) {
                // Approaching edge — fading
                const t = (angularDist - halfPI * 0.7) / (halfPI * 0.3);
                targetOpacity = 1.0 - t * 0.3;
                targetScale = 1.5 - t * 0.5;
            } else if (angularDist < Math.PI * 0.7) {
                // Behind but near edge
                const t = (angularDist - halfPI) / (Math.PI * 0.2);
                targetOpacity = 0.7 - t * 0.3;
                targetScale = 1.0 - t * 0.3;
            } else {
                // Deep behind — dim
                targetOpacity = 0.4;
                targetScale = 0.7;
            }

            // Lerp towards targets for smooth gradual change
            currentOpacity += (targetOpacity - currentOpacity) * LERP_SPEED;
            currentScale += (targetScale - currentScale) * LERP_SPEED;

            persistentGlow.style.left = `${x}px`;
            persistentGlow.style.top = `${y}px`;
            persistentGlow.style.opacity = currentOpacity;
            persistentGlow.style.transform = `translate(-50%, -50%) scale(${currentScale})`;
        }
    }
    requestAnimationFrame(trackPin);
})();

// ── Guided-replay comet ───────────────────────────────
// A glowing marker flies the journey in chronological order, riding the arcs.
let REPLAY_MODE = 'continuous'; // 'continuous' | 'once' | 'off'
if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    REPLAY_MODE = 'off'; // respect reduced-motion
}
const COMET_LEG_BASE_MS = 1400; // min time per leg
const COMET_LEG_DIST_MS = 2600; // extra time scaled by leg length
const COMET_HOLD_MS = 300;      // brief beat on arrival at each city
const COMET_LABEL_MS = 1300;    // how long the arrival label lingers

// Ordered legs straight from the journey (keeps returns; not deduped)
const COMET_LEGS = [];
for (let i = 0; i < JOURNEY.length - 1; i++) {
    if (JOURNEY[i] !== JOURNEY[i + 1]) COMET_LEGS.push([JOURNEY[i], JOURNEY[i + 1]]);
}

// Geo ↔ unit vector + great-circle slerp (so the comet follows the arc's curve)
const _toVec = (lat, lng) => {
    const a = lat * Math.PI / 180, b = lng * Math.PI / 180;
    return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
};
const _toLatLng = v => [Math.asin(v[2]) * 180 / Math.PI, Math.atan2(v[1], v[0]) * 180 / Math.PI];

const ARC_ALT_SCALE = 0.28; // tuned so the Bézier peak matches globe.gl's rendered arc altitude

// lat/lng/alt → 3D point (sphere radius 1, +alt above surface)
function _cart(lat, lng, alt) {
    const u = _toVec(lat, lng), r = 1 + alt;
    return [u[0] * r, u[1] * r, u[2] * r];
}

// Each leg as a 3D cubic Bézier — the SAME construction globe.gl uses for arcs
// (control points at the great-circle quarter-points, lifted to altitude×1.5),
// so the comet rides exactly on the drawn arc.
const COMET_PATH = COMET_LEGS.map(([a, b]) => {
    const va = _toVec(a.lat, a.lng), vb = _toVec(b.lat, b.lng);
    const omega = Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])));
    const so = Math.sin(omega) || 1;
    const gc = f => {
        const f1 = Math.sin((1 - f) * omega) / so, f2 = Math.sin(f * omega) / so;
        return _toLatLng([f1 * va[0] + f2 * vb[0], f1 * va[1] + f2 * vb[1], f1 * va[2] + f2 * vb[2]]);
    };
    const A = ARC_ALT_SCALE * 2 * Math.sin(omega / 2); // auto-altitude basis (chord)
    const m1 = gc(0.25), m2 = gc(0.75);
    return {
        a, b, omega,
        dur: COMET_LEG_BASE_MS + (omega / Math.PI) * COMET_LEG_DIST_MS,
        P0: _cart(a.lat, a.lng, 0),
        P1: _cart(m1[0], m1[1], A * 1.5),
        P2: _cart(m2[0], m2[1], A * 1.5),
        P3: _cart(b.lat, b.lng, 0),
    };
});

// Comet head + arrival label DOM (positioned each frame via getScreenCoords);
// the trail is drawn analytically on a canvas overlay — sampled from the leg's
// Bézier by *time along the path*, not from frame history, so it stays a
// continuous streak no matter how fast the comet moves.
const TRAIL_MS = 900;    // how far back in time the trail reaches
const TRAIL_SAMPLES = 32; // polyline resolution
const comet = document.createElement('div');
comet.className = 'replay-comet';
globeWrapper.appendChild(comet);
const trailCanvas = document.createElement('canvas');
trailCanvas.className = 'replay-trail-canvas';
globeWrapper.appendChild(trailCanvas);
const trailCtx = trailCanvas.getContext('2d');
// globe.gl's wrapper div itself is 0×0 (absolutely-positioned children), so
// size the overlay from the globe's rendered WebGL canvas — getScreenCoords
// shares that canvas's coordinate origin.
function sizeTrailCanvas() {
    const glCanvas = globeWrapper.querySelector('canvas');
    if (!glCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = glCanvas.clientWidth, h = glCanvas.clientHeight;
    if (!w || !h) return;
    trailCanvas.width = w * dpr;
    trailCanvas.height = h * dpr;
    trailCanvas.style.width = `${w}px`;
    trailCanvas.style.height = `${h}px`;
    trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeTrailCanvas();
const cometLabel = document.createElement('div');
cometLabel.className = 'replay-label';
globeWrapper.appendChild(cometLabel);

// Angular distance from the current view centre → used to hide things behind the globe
function viewAngle(lat, lng) {
    const pov = globe.pointOfView();
    const r = d => d * Math.PI / 180;
    const dLat = r(lat - pov.lat), dLng = r(lng - pov.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(pov.lat)) * Math.cos(r(lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

let legIdx = 0, legT = 0, holdT = 0, replayDone = false;
let labelCity = null, labelUntil = 0;
let cometPrev = performance.now();

// Evaluate a leg's cubic Bézier at t → {lat, lng, alt}
function bezierPoint(leg, t) {
    const u = 1 - t;
    const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
    const x = w0 * leg.P0[0] + w1 * leg.P1[0] + w2 * leg.P2[0] + w3 * leg.P3[0];
    const y = w0 * leg.P0[1] + w1 * leg.P1[1] + w2 * leg.P2[1] + w3 * leg.P3[1];
    const z = w0 * leg.P0[2] + w1 * leg.P1[2] + w2 * leg.P2[2] + w3 * leg.P3[2];
    const rr = Math.hypot(x, y, z);
    return {
        lat: Math.asin(z / rr) * 180 / Math.PI,
        lng: Math.atan2(y, x) * 180 / Math.PI,
        alt: rr - 1,
    };
}

// True visibility horizon for a camera at finite distance: a surface point
// hides at acos(1/d) from the view centre (~73° at the default zoom, NOT 90°),
// while altitude extends visibility by acos(1/(1+alt)). Small margin so
// strokes don't linger on the limb.
function horizonAngle(alt) {
    const d = 1 + (globe.pointOfView().altitude || 2.5); // camera distance in globe radii
    return Math.acos(1 / d) + Math.acos(1 / (1 + Math.max(0, alt))) - 0.02;
}

const trailHistory = []; // recent exact path positions: {lat, lng, alt, t}

function hideComet() {
    comet.style.opacity = 0;
    trailHistory.length = 0;
    trailCtx.clearRect(0, 0, trailCanvas.clientWidth, trailCanvas.clientHeight);
}

(function animateComet(now) {
    requestAnimationFrame(animateComet);
    const dt = Math.min(now - cometPrev, 64); // clamp so a throttled tab doesn't make it leap
    cometPrev = now;
    if (REPLAY_MODE === 'off' || !COMET_PATH.length || replayDone) { hideComet(); return; }

    // Globe canvas lays out after init — keep the overlay matched to it
    const glCanvas = globeWrapper.querySelector('canvas');
    if (glCanvas && (trailCanvas.clientWidth !== glCanvas.clientWidth ||
        trailCanvas.clientHeight !== glCanvas.clientHeight)) sizeTrailCanvas();

    // Keep flying during interaction — getScreenCoords already tracks the rotation
    if (holdT > 0) {
        holdT -= dt;
    } else {
        legT += dt / COMET_PATH[legIdx].dur;
        if (legT >= 1) {
            legT = 0;
            holdT = COMET_HOLD_MS;
            const arrived = COMET_PATH[legIdx].b;
            labelCity = arrived; labelUntil = now + COMET_LABEL_MS; // every stop, home included
            legIdx++;
            if (legIdx >= COMET_PATH.length) {
                if (REPLAY_MODE === 'once') { replayDone = true; hideComet(); return; }
                legIdx = 0;
            }
        }
    }

    // Comet position along the current leg — evaluate the cubic Bézier (rides the arc)
    const leg = COMET_PATH[legIdx];
    const { lat, lng, alt } = bezierPoint(leg, legT);

    const c = globe.getScreenCoords(lat, lng, alt);
    if (c) {
        comet.style.left = `${c.x}px`;
        comet.style.top = `${c.y}px`;
        comet.style.opacity = viewAngle(lat, lng) < horizonAngle(alt) ? 1 : 0; // hide on far side
    }

    // Trail — one continuous tapered stroke over the last TRAIL_MS of travel.
    // Positions are exact Bézier evaluations buffered with timestamps, then
    // resampled uniformly in time — so the streak stays continuous at any
    // speed, flows across leg boundaries, and eases into a city during holds
    // instead of snapping away.
    trailHistory.unshift({ lat, lng, alt, t: now });
    while (trailHistory.length > 2 && trailHistory[trailHistory.length - 2].t < now - TRAIL_MS) trailHistory.pop();

    trailCtx.clearRect(0, 0, trailCanvas.clientWidth, trailCanvas.clientHeight);
    if (trailHistory.length > 2) {
        // Resample head → tail at uniform time offsets (lerped in 3D between
        // buffered frames — safe across the antimeridian); null = far side
        const pts = [];
        let hi = 0;
        for (let k = 0; k <= TRAIL_SAMPLES; k++) {
            const tk = now - (k / TRAIL_SAMPLES) * TRAIL_MS;
            while (hi < trailHistory.length - 1 && trailHistory[hi + 1].t > tk) hi++;
            const h0 = trailHistory[hi], h1 = trailHistory[Math.min(hi + 1, trailHistory.length - 1)];
            let p;
            if (h0 === h1 || h0.t === h1.t) {
                p = h0;
            } else {
                const f = Math.min(1, Math.max(0, (h0.t - tk) / (h0.t - h1.t)));
                const v0 = _cart(h0.lat, h0.lng, h0.alt), v1 = _cart(h1.lat, h1.lng, h1.alt);
                const x = v0[0] + (v1[0] - v0[0]) * f, y = v0[1] + (v1[1] - v0[1]) * f, z = v0[2] + (v1[2] - v0[2]) * f;
                const rr = Math.hypot(x, y, z);
                p = { lat: Math.asin(z / rr) * 180 / Math.PI, lng: Math.atan2(y, x) * 180 / Math.PI, alt: rr - 1 };
            }
            const sc = globe.getScreenCoords(p.lat, p.lng, p.alt);
            pts.push(sc && viewAngle(p.lat, p.lng) < horizonAngle(p.alt) ? sc : null);
        }
        trailCtx.globalCompositeOperation = 'lighter';
        trailCtx.lineCap = 'round';
        for (let k = 0; k < TRAIL_SAMPLES; k++) {
            const p0 = pts[k], p1 = pts[k + 1];
            if (!p0 || !p1) continue;
            const fade = 1 - k / TRAIL_SAMPLES; // 1 at head → 0 at tail
            // soft outer glow + bright core, both tapering toward the tail
            trailCtx.strokeStyle = `rgba(169, 184, 232, ${(fade * fade * 0.28).toFixed(3)})`;
            trailCtx.lineWidth = 1.5 + fade * 4.5;
            trailCtx.beginPath();
            trailCtx.moveTo(p0.x, p0.y);
            trailCtx.lineTo(p1.x, p1.y);
            trailCtx.stroke();
            trailCtx.strokeStyle = `rgba(228, 234, 255, ${(fade * fade * 0.55).toFixed(3)})`;
            trailCtx.lineWidth = 0.5 + fade * 1.6;
            trailCtx.beginPath();
            trailCtx.moveTo(p0.x, p0.y);
            trailCtx.lineTo(p1.x, p1.y);
            trailCtx.stroke();
        }
        trailCtx.globalCompositeOperation = 'source-over';
    }

    // Lingering arrival label at its city
    if (labelCity && now < labelUntil) {
        if (cometLabel.dataset.city !== labelCity.name) {
            cometLabel.dataset.city = labelCity.name;
            // Name only — dates live on the pin hover tooltips; "Home" keeps
            // the Jakarta popup uniform with the dated stops
            cometLabel.innerHTML = `<span class="replay-label-name">${labelCity.name}</span><span class="replay-label-date">${labelCity === HOME ? 'Home' : ''}</span>`;
        }
        const lc = globe.getScreenCoords(labelCity.lat, labelCity.lng, 0.04);
        if (lc) {
            cometLabel.style.left = `${lc.x}px`;
            cometLabel.style.top = `${lc.y}px`;
            cometLabel.style.opacity = viewAngle(labelCity.lat, labelCity.lng) < Math.PI / 2 ? 1 : 0;
        }
    } else {
        cometLabel.style.opacity = 0;
        labelCity = null;
    }
})(performance.now());

window.addEventListener('resize', () => {
    const size = getGlobeSize();
    globe.width(size).height(size);
    sizeTrailCanvas();
});

// ── Vitals ────────────────────────────────────────────
// Vercel serverless API — relative path, works automatically
const VITALS_API = '/api/data';

function setVitals({ steps, distance, calories }) {
    document.getElementById('steps').textContent = steps.toLocaleString();
    document.getElementById('distance').textContent = distance.toFixed(1) + ' km';
    document.getElementById('calories').textContent = Math.round(calories).toLocaleString();
}

// ── Weekly trend chart (steps / distance / calories combined) ─────────
const TREND_W = 260, TREND_H = 44, TREND_PAD = 4;
const TREND_METRICS = [
    { key: 'steps',    label: 'Steps',    color: '#8f9ed0' },
    { key: 'distance', label: 'Distance', color: '#73a596' },
    { key: 'calories', label: 'Calories', color: '#bf94a0' },
];

// Raw-value formatting for the hover tooltip
const TREND_FMT = {
    steps: v => v.toLocaleString() + ' steps',
    distance: v => v.toFixed(1) + ' km',
    calories: v => Math.round(v).toLocaleString() + ' cal',
};

function fmtTrendDate(d) {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

// Pinch-zoom anchoring for position:fixed tooltips. When zoomed on mobile,
// getBoundingClientRect() is relative to the visual viewport but position:fixed
// resolves against the layout viewport — so add the visual viewport's offset to
// convert into layout coords, and clamp to the visible region. All zeros / full
// width when unzoomed, so desktop behavior is unchanged.
function visualViewportBox() {
    const vv = window.visualViewport;
    if (!vv) return { left: 0, top: 0, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
    return { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height };
}

// One subtle chart: each metric normalized to its own range, overlaid (they move
// together, so it reads as a single weekly trend). Hover a day → guide + tooltip.
function renderTrend(history) {
    const el = document.getElementById('vitals-trend');
    if (!el) return;
    const recent = Array.isArray(history) ? history.slice(-7) : [];
    if (recent.length < 2) { el.innerHTML = ''; el.style.display = 'none'; return; }

    const n = recent.length;
    const xOf = i => TREND_PAD + (i / (n - 1)) * (TREND_W - TREND_PAD * 2);
    const series = TREND_METRICS.map(({ key, color }) => {
        const vals = recent.map(h => Number(h[key]) || 0);
        const min = Math.min(...vals), max = Math.max(...vals);
        const range = (max - min) || 1;
        const ys = vals.map(v => TREND_H - TREND_PAD - ((v - min) / range) * (TREND_H - TREND_PAD * 2));
        return { key, color, ys };
    });

    const lines = series.map(s =>
        `<polyline points="${s.ys.map((y, i) => `${xOf(i).toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="1.25" stroke-opacity="0.55" stroke-linecap="round" stroke-linejoin="round"/>`
    ).join('');
    const guide = `<line class="trend-guide" y1="${TREND_PAD}" y2="${TREND_H - TREND_PAD}" stroke="#666" stroke-width="0.6" stroke-dasharray="2 2" opacity="0"/>`;
    const dots = series.map(s => `<circle class="trend-hi" r="2.2" fill="${s.color}" opacity="0"/>`).join('');
    const hit = `<rect x="0" y="0" width="${TREND_W}" height="${TREND_H}" fill="transparent" pointer-events="all"/>`;
    const svg = `<svg class="trend-svg" viewBox="0 0 ${TREND_W} ${TREND_H}" xmlns="http://www.w3.org/2000/svg">${hit}${guide}${lines}${dots}</svg>`;
    const legend = TREND_METRICS.map(({ label, color }) =>
        `<span class="trend-lg"><i style="background:${color}"></i>${label}</span>`).join('');

    el.innerHTML = `<span class="trend-label">Past 7 days</span>${svg}<div class="trend-legend">${legend}</div>`;
    el.style.display = 'flex';

    // ── hover interaction ──
    const svgEl = el.querySelector('.trend-svg');
    const guideEl = el.querySelector('.trend-guide');
    const dotEls = [...el.querySelectorAll('.trend-hi')];
    // Tooltip lives on <body> so position:fixed is viewport-relative (the dropdown's
    // fade-in transform would otherwise re-anchor it and the overflow clip would hide it)
    let tip = document.querySelector('body > .trend-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'trend-tip'; document.body.appendChild(tip); }

    // Bind viewport-level dismissal once (renderTrend re-runs on each data refresh).
    // A fixed tooltip can't follow the sparkline, so hide it on scroll instead of
    // letting it stick to the screen; also hide it when tapping elsewhere.
    if (!window._trendTipDismissBound) {
        window._trendTipDismissBound = true;
        const hideTrendTip = () => {
            const t = document.querySelector('body > .trend-tip');
            if (t) t.classList.remove('show');
            const g = document.querySelector('.trend-guide');
            if (g) g.setAttribute('opacity', '0');
            document.querySelectorAll('.trend-hi').forEach(d => d.setAttribute('opacity', '0'));
        };
        // capture:true so scrolls inside the dropdown (which don't bubble) are caught too
        window.addEventListener('scroll', hideTrendTip, { passive: true, capture: true });
        window.visualViewport?.addEventListener('scroll', hideTrendTip); // pinch-zoom pan
        document.addEventListener('pointerdown', e => {
            if (!(e.target instanceof Element) || !e.target.closest('.trend-svg')) hideTrendTip();
        }, true);
    }

    function showAt(i) {
        const x = xOf(i);
        guideEl.setAttribute('x1', x); guideEl.setAttribute('x2', x); guideEl.setAttribute('opacity', '1');
        series.forEach((s, k) => { dotEls[k].setAttribute('cx', x); dotEls[k].setAttribute('cy', s.ys[i]); dotEls[k].setAttribute('opacity', '1'); });
        const h = recent[i];
        tip.innerHTML = `<span class="trend-tip-date">${fmtTrendDate(h.date)}</span>`
            + TREND_METRICS.map(({ key, color }) => `<span class="trend-tip-row"><i style="background:${color}"></i>${TREND_FMT[key](Number(h[key]) || 0)}</span>`).join('');
        const sRect = svgEl.getBoundingClientRect();
        const vp = visualViewportBox(); // convert to layout coords so it stays put when pinch-zoomed
        tip.style.left = (sRect.left + (x / TREND_W) * sRect.width + vp.left) + 'px';
        tip.style.top = (sRect.top + vp.top) + 'px';
        tip.classList.add('show');
    }
    function hide() {
        guideEl.setAttribute('opacity', '0');
        dotEls.forEach(d => d.setAttribute('opacity', '0'));
        tip.classList.remove('show');
    }

    const nearestTo = clientX => {
        const r = svgEl.getBoundingClientRect();
        const vx = ((clientX - r.left) / r.width) * TREND_W;
        let bi = 0, bd = Infinity;
        for (let i = 0; i < n; i++) { const d = Math.abs(xOf(i) - vx); if (d < bd) { bd = d; bi = i; } }
        return bi;
    };
    svgEl.addEventListener('mousemove', e => showAt(nearestTo(e.clientX)));
    svgEl.addEventListener('mouseleave', hide);
    // Touch/pen: tap or drag along the chart to scrub (hover doesn't fire on touch)
    svgEl.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') showAt(nearestTo(e.clientX)); });
    svgEl.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') showAt(nearestTo(e.clientX)); });
}

// Sample history so the trend chart renders in local/demo mode (dates = last 7 days)
const DEMO_HISTORY = [
    { steps: 5200,  distance: 3.9, calories: 240 },
    { steps: 9100,  distance: 6.8, calories: 380 },
    { steps: 7400,  distance: 5.2, calories: 310 },
    { steps: 11200, distance: 8.1, calories: 450 },
    { steps: 6800,  distance: 4.7, calories: 295 },
    { steps: 8900,  distance: 6.5, calories: 360 },
    { steps: 8432,  distance: 6.2, calories: 340 },
].map((e, i, arr) => {
    const d = new Date();
    d.setDate(d.getDate() - (arr.length - 1 - i));
    return { ...e, date: d.toISOString().slice(0, 10) };
});

// Sample auto-tracked stops so the append is visible in local/demo mode.
// Realistic: each trip returns to Jakarta (just like real pings record it).
const DEMO_LOCATIONS = [
    { lat: 1.3521,  lng: 103.8198, t: Date.now() - 12 * 864e5 }, // Singapore
    { lat: -6.2088, lng: 106.8456, t: Date.now() - 10 * 864e5 }, // ← home to Jakarta
    { lat: 35.6762, lng: 139.6503, t: Date.now() -  4 * 864e5 }, // Tokyo
    { lat: -6.2088, lng: 106.8456, t: Date.now() -  2 * 864e5 }, // ← home to Jakarta
];

// Fetch live data from Vercel API, fall back to demo values
fetch(VITALS_API)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
        setVitals({
            steps: data.steps,
            distance: data.distance,
            calories: data.calories,
        });
        renderTrend(data.history);
        applyLocations(data.locations);
        // Update globe to owner's real location + fetch weather
        if (data.lat && data.lng) {
            setLocation(data.lat, data.lng);
            fetchWeather(data.lat, data.lng);
        }
    })
    .catch(() => {
        // API not set up yet — show demo values
        setVitals({ steps: 8432, distance: 6.2, calories: 340 });
        renderTrend(DEMO_HISTORY);
        applyLocations(DEMO_LOCATIONS);
        fetchWeather(-6.2088, 106.8456); // fallback: Jakarta
        document.getElementById('location-label').textContent = 'Local Time — Jakarta';
    });

// ── Weather & Time ───────────────────────────────────
const WMO_CODES = {
    0: ['Clear', '☀'], 1: ['Mostly Clear', '☀'], 2: ['Partly Cloudy', '⛅'], 3: ['Overcast', '☁'],
    45: ['Foggy', '☁'], 48: ['Fog', '☁'], 51: ['Light Drizzle', '☂'], 53: ['Drizzle', '☂'], 55: ['Heavy Drizzle', '☂'],
    61: ['Light Rain', '☂'], 63: ['Rain', '☂'], 65: ['Heavy Rain', '☂'], 71: ['Light Snow', '❄'], 73: ['Snow', '❄'],
    75: ['Heavy Snow', '❄'], 80: ['Light Showers', '☂'], 81: ['Showers', '☂'], 82: ['Heavy Showers', '☂'],
    95: ['Thunderstorm', '⚡'], 96: ['Thunderstorm', '⚡'], 99: ['Thunderstorm', '⚡']
};

let locationTimezone = null;
let currentCity = 'Jakarta'; // shown in the live-pin hover tooltip

function fetchWeather(lat, lng) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`;
    fetch(url)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
            const temp = Math.round(data.current.temperature_2m);
            const code = data.current.weather_code;
            const [condition, icon] = WMO_CODES[code] || ['', ''];
            // Use moon icon at night (between 6pm and 6am local time)
            const tz = data.timezone;
            const hour = new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
            const isNight = parseInt(hour) >= 18 || parseInt(hour) < 6;
            const weatherIcon = (isNight && code <= 1) ? '☾' : icon;
            document.getElementById('weather').textContent = `${weatherIcon} ${temp}°C ${condition}`;
            locationTimezone = data.timezone;
            // Show city from timezone (e.g. "Asia/Jakarta" → "Jakarta")
            const city = data.timezone.split('/').pop().replace(/_/g, ' ');
            currentCity = city;
            document.getElementById('location-label').textContent = `Local Time — ${city}`;
        })
        .catch(() => {});
}

function updateLocalTime() {
    const tz = locationTimezone || 'Asia/Jakarta';
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    document.getElementById('local-time').textContent = timeStr;
}

// Update clock every second
updateLocalTime();
setInterval(updateLocalTime, 1000);

// Refresh data every 5 minutes
setInterval(() => {
    fetch(VITALS_API)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
            setVitals({
                steps: data.steps,
                distance: data.distance,
                calories: data.calories,
            });
            renderTrend(data.history);
            applyLocations(data.locations);
            if (data.lat && data.lng) {
                setLocation(data.lat, data.lng);
                fetchWeather(data.lat, data.lng);
            }
        })
        .catch(() => {});
}, 5 * 60 * 1000);

// ── Hero panel accordion (GitHub / LinkedIn / Parklane) ──────────────
// Opening one of the three hero reveals closes any other that's open.
const _heroPanels = [];
function registerHeroPanel(toggle, panel, onOpen) {
    _heroPanels.push(panel);
    toggle.addEventListener('click', e => {
        e.preventDefault();
        const willOpen = !panel.classList.contains('open');
        _heroPanels.forEach(p => {
            if (p !== panel) {
                p.classList.remove('open');
                const t = document.querySelector(`[aria-controls="${p.id}"]`);
                if (t) t.setAttribute('aria-expanded', 'false');
            }
        });
        panel.classList.toggle('open', willOpen);
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen && onOpen) onOpen();
    });
}

// ── GitHub activity heatmap (lazy — loads only when the Github link is opened) ──
(() => {
    const toggle = document.getElementById('gh-toggle');
    const panel = document.getElementById('github-panel');
    const heatmap = document.getElementById('github-heatmap');
    if (!toggle || !panel || !heatmap) return;

    const GH_USER = 'labartist';
    const GH_WEEKS = 17; // ~4 months
    const GH_COLORS = ['#17171f', '#2e2b3a', '#4a4459', '#746b8c', '#aa9fc6']; // levels 0–4 (muted violet)
    let loaded = false;

    // Custom dark tooltip (shares .trend-tip styling), on <body> so the hero transform can't clip it
    const ghTip = document.createElement('div');
    ghTip.className = 'gh-tip';
    document.body.appendChild(ghTip);

    function render(days) {
        if (!days.length) { heatmap.innerHTML = '<span class="github-err">No recent activity.</span>'; return; }
        const CELL = 12, GAP = 3, PITCH = CELL + GAP, TOP = 14;
        const byDate = {};
        days.forEach(d => { byDate[d.date] = d; });
        // Anchor to today, like GitHub: the last column is the current week (cells fill
        // top→bottom as the week progresses); the oldest week drops off the left edge.
        const end = new Date(); end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(end.getDate() - end.getDay() - (GH_WEEKS - 1) * 7); // Sunday, GH_WEEKS-1 weeks back
        const cells = [], months = [];
        let total = 0;
        for (let w = 0; w < GH_WEEKS; w++) {
            for (let dow = 0; dow < 7; dow++) {
                const dt = new Date(start);
                dt.setDate(start.getDate() + w * 7 + dow);
                if (dt > end) continue;
                const ds = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; // local date (not UTC) so today maps right
                const rec = byDate[ds];
                const lvl = rec ? rec.level : 0;
                total += rec ? rec.count : 0;
                const x = w * PITCH, y = TOP + dow * PITCH;
                cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2.5" fill="${GH_COLORS[lvl] || GH_COLORS[0]}" data-d="${ds}" data-c="${rec ? rec.count : 0}"></rect>`);
                if (dow === 0 && dt.getDate() <= 7) months.push(`<text x="${x}" y="9" class="gh-mon">${dt.toLocaleDateString('en-GB', { month: 'short' })}</text>`);
            }
        }
        const W = GH_WEEKS * PITCH - GAP, H = TOP + 7 * PITCH - GAP;
        heatmap.innerHTML = `<svg class="gh-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${months.join('')}${cells.join('')}</svg>`
            + `<div class="gh-cap">${total.toLocaleString()} Contributions · Past 4 months</div>`;

        // Themed tooltip on cell hover (desktop) / tap (touch), clamped on-screen
        const svg = heatmap.querySelector('svg');
        const TIP_PAD = 8; // keep this far from the viewport edges

        function showTipFor(rect) {
            if (!rect || !rect.dataset || !rect.dataset.d) return;
            const dateStr = new Date(rect.dataset.d + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
            const c = +rect.dataset.c;
            ghTip.innerHTML = `<span class="trend-tip-date">${dateStr}</span><span class="trend-tip-row">${c} Contribution${c === 1 ? '' : 's'}</span>`;
            ghTip.classList.add('show'); // show first so the tip has measurable dimensions
            const bb = rect.getBoundingClientRect();
            const tip = ghTip.getBoundingClientRect();
            const vp = visualViewportBox();
            // Center over the cell, but clamp within the visible region (handles pinch-zoom)
            const half = tip.width / 2;
            const cx = Math.max(vp.left + TIP_PAD + half, Math.min(bb.left + bb.width / 2 + vp.left, vp.left + vp.width - TIP_PAD - half));
            // Sit above the cell; flip below when there isn't room above it on-screen
            const flipBelow = bb.top - tip.height - 6 < TIP_PAD;
            ghTip.style.left = `${cx}px`;
            ghTip.style.top = `${(flipBelow ? bb.bottom : bb.top) + vp.top}px`;
            ghTip.style.transform = flipBelow
                ? 'translate(-50%, 6px)'
                : 'translate(-50%, calc(-100% - 6px))';
        }
        const hideTip = () => ghTip.classList.remove('show');

        // Desktop: follow the pointer across cells
        svg.addEventListener('mouseover', e => showTipFor(e.target));
        svg.addEventListener('mouseleave', hideTip);
        // Touch/pen: tap a cell to show (hover events don't fire reliably on touch)
        svg.addEventListener('pointerdown', e => {
            if (e.pointerType !== 'mouse') showTipFor(e.target);
        });
        // Dismiss when tapping away or scrolling (a fixed tip would otherwise drift)
        document.addEventListener('pointerdown', e => { if (!svg.contains(e.target)) hideTip(); }, true);
        window.addEventListener('scroll', hideTip, { passive: true });
        window.visualViewport?.addEventListener('scroll', hideTip); // pinch-zoom pan
    }

    async function loadHeatmap() {
        if (loaded) return;
        loaded = true;
        try {
            const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${GH_USER}?y=last`);
            if (!r.ok) throw new Error('bad response');
            const data = await r.json();
            render(data.contributions || []);
        } catch (e) {
            loaded = false; // let the next open retry
            heatmap.innerHTML = '<span class="github-err">Couldn\'t load GitHub activity.</span>';
        }
    }

    registerHeroPanel(toggle, panel, () => loadHeatmap());

    // Preload on page load so the heatmap is ready the instant the panel opens
    loadHeatmap();
})();

// ── LinkedIn about panel ──────────────────────────────
(() => {
    const toggle = document.getElementById('li-toggle');
    const panel = document.getElementById('linkedin-panel');
    if (!toggle || !panel) return;
    registerHeroPanel(toggle, panel);
})();

// ── Parklane showcase panel (carousel now lives here, under the icon) ──
(() => {
    const toggle = document.getElementById('pk-toggle');
    const panel = document.getElementById('parklane-panel');
    if (!toggle || !panel) return;
    registerHeroPanel(toggle, panel);
})();

// ── Work list — fade + scroll affordance only when it actually overflows ──
(() => {
    const el = document.querySelector('.work-scroll');
    if (!el) return;
    const update = () => el.classList.toggle('scrollable', el.scrollHeight > el.clientHeight + 1);
    update();
    window.addEventListener('resize', update);
})();

// ── Contact corner — compact enquiry box, POSTs to /api/contact so no
// email address ever appears on the page ──
(() => {
    const toggle = document.getElementById('contact-toggle');
    const card = document.getElementById('contact-card');
    if (!toggle || !card) return;
    const status = document.getElementById('contact-status');
    const send = document.getElementById('contact-send');

    toggle.addEventListener('click', () => {
        const open = card.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        status.textContent = ''; // fresh card every toggle — no stale words
        if (open) document.getElementById('contact-subject').focus();
    });

    card.addEventListener('submit', async e => {
        e.preventDefault();
        const subject = document.getElementById('contact-subject').value.trim();
        const message = document.getElementById('contact-message').value.trim();
        const reply = document.getElementById('contact-reply').value.trim();
        if (!subject || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reply)) {
            status.textContent = 'All fields required';
            return;
        }
        send.disabled = true;
        status.textContent = 'Sending…';
        try {
            const resp = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject, message, reply,
                    website: document.getElementById('contact-website').value, // honeypot
                }),
            });
            if (!resp.ok) throw new Error((await resp.json()).error || 'failed');
            status.textContent = 'Sent — I’ll get back to you';
            card.reset();
            setTimeout(() => {
                card.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                status.textContent = '';
                send.disabled = false;
            }, 2200);
        } catch (err) {
            status.textContent = 'Couldn’t send — try later';
            send.disabled = false;
            setTimeout(() => { status.textContent = ''; }, 3000); // don't let the error linger
        }
    });
})();
