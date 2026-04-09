// ── Globe ──────────────────────────────────────────────
const globeEl = document.getElementById('globe-container');
const GEOJSON_URL = 'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';

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
    // Location pin — white, taller, with glow
    .pointsData([])
    .pointColor(() => '#ffffff')
    .pointAltitude(0.14)
    .pointRadius(0.05)
    .pointsMerge(false)
    // 3D surface pulse rings — conform to globe curvature
    .ringsData([])
    .ringColor(() => t => `rgba(255,255,255,${0.8 * (1 - t)})`)
    .ringMaxRadius(5)
    .ringPropagationSpeed(1.5)
    .ringRepeatPeriod(1400)
    // Steady glow on pin
    .htmlElementsData([])
    .htmlElement(() => {
        const el = document.createElement('div');
        el.className = 'pin-glow';
        return el;
    })
    .htmlTransitionDuration(400);

// Dark globe surface — access Three.js via globe's scene
const mat = globe.globeMaterial();
mat.color.set('#0d0d18');
mat.emissive = mat.color.clone();
mat.emissiveIntensity = 0.1;

globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.3;
globe.controls().enableZoom = false;

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

// Get the visitor's location and pin it on the globe
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => setLocation(pos.coords.latitude, pos.coords.longitude),
        () => setLocation(-33.8688, 151.2093) // fallback: Sydney
    );
} else {
    setLocation(-33.8688, 151.2093);
}

// Persistent glow overlay — stays visible (faded) when pin is behind globe
// Insert into globe.gl's own wrapper div so getScreenCoords aligns directly
const persistentGlow = document.createElement('div');
persistentGlow.className = 'pin-glow-persistent';
const globeWrapper = globeEl.querySelector(':scope > div');
globeWrapper.style.position = 'relative';
globeWrapper.appendChild(persistentGlow);

let pinLat = null, pinLng = null;

function setLocation(lat, lng) {
    pinLat = lat;
    pinLng = lng;
    const point = [{ lat, lng }];
    globe.pointsData(point);
    globe.ringsData(point);
    globe.htmlElementsData(point);
    globe.pointOfView({ lat, lng, altitude: 2.5 }, 1000);
}

// Track pin screen position and visibility each frame
(function trackPin() {
    if (pinLat !== null) {
        const coords = globe.getScreenCoords(pinLat, pinLng);
        if (coords) {
            // Coordinates are in canvas pixels relative to the wrapper
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

            // Gradual opacity: full when in view, dimmer when behind
            let opacity;
            if (angularDist < halfPI * 0.7) {
                // Clearly in front — full brightness
                opacity = 0.5;
            } else if (angularDist < halfPI) {
                // Approaching edge — brightest
                const t = (angularDist - halfPI * 0.7) / (halfPI * 0.3);
                opacity = 0.5 + t * 0.5;
            } else if (angularDist < Math.PI * 0.7) {
                // Behind but near edge — bright, fading
                const t = (angularDist - halfPI) / (Math.PI * 0.2);
                opacity = 1.0 - t * 0.3;
            } else {
                // Deep behind — dimmer
                opacity = 0.7;
            }

            persistentGlow.style.left = `${x}px`;
            persistentGlow.style.top = `${y}px`;
            persistentGlow.style.opacity = opacity;
        }
    }
    requestAnimationFrame(trackPin);
})();

window.addEventListener('resize', () => {
    const size = getGlobeSize();
    globe.width(size).height(size);
});

// ── Vitals (placeholder) ──────────────────────────────
// Apple Health has no web API. To display real data you could:
//   1. Create an iOS Shortcut that reads HealthKit → posts JSON to your server
//   2. Serve the latest data from a simple API endpoint
//   3. Fetch it here and populate the cards
//
// For now, show demo values:
function setVitals({ steps, distance, calories }) {
    document.getElementById('steps').textContent = steps.toLocaleString();
    document.getElementById('distance').textContent = distance.toFixed(1);
    document.getElementById('calories').textContent = calories.toLocaleString();
}

// Demo data — replace with a fetch() to your API
setVitals({ steps: 8432, distance: 6.2, calories: 340 });
