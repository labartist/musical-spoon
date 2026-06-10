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

// Build arcs from consecutive legs, deduped undirected (out-and-back drawn once)
const TRAVEL_ARCS = [];
const _seenLegs = new Set();
for (let i = 0; i < JOURNEY.length - 1; i++) {
    const a = JOURNEY[i], b = JOURNEY[i + 1];
    if (a === b) continue; // skip any zero-length leg
    const key = [`${a.lat},${a.lng}`, `${b.lat},${b.lng}`].sort().join('|');
    if (_seenLegs.has(key)) continue;
    _seenLegs.add(key);
    TRAVEL_ARCS.push({ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng });
}

// City markers = the deduped destinations (Jakarta itself is the live pin)
const TRAVEL_DOTS = Object.values(PLACES);

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
    const pts = TRAVEL_DOTS.map(p => ({
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

window.addEventListener('resize', () => {
    const size = getGlobeSize();
    globe.width(size).height(size);
});

// ── Vitals ────────────────────────────────────────────
// Vercel serverless API — relative path, works automatically
const VITALS_API = '/api/data';

function setVitals({ steps, distance, calories }) {
    document.getElementById('steps').textContent = steps.toLocaleString();
    document.getElementById('distance').textContent = distance.toFixed(1) + ' km';
    document.getElementById('calories').textContent = Math.round(calories).toLocaleString();
}

// Fetch live data from Vercel API, fall back to demo values
fetch(VITALS_API)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
        setVitals({
            steps: data.steps,
            distance: data.distance,
            calories: data.calories,
        });
        // Update globe to owner's real location + fetch weather
        if (data.lat && data.lng) {
            setLocation(data.lat, data.lng);
            fetchWeather(data.lat, data.lng);
        }
    })
    .catch(() => {
        // API not set up yet — show demo values
        setVitals({ steps: 8432, distance: 6.2, calories: 340 });
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
            if (data.lat && data.lng) {
                setLocation(data.lat, data.lng);
                fetchWeather(data.lat, data.lng);
            }
        })
        .catch(() => {});
}, 5 * 60 * 1000);
