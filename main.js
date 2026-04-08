// ── Globe ──────────────────────────────────────────────
const globeEl = document.getElementById('globe-container');

function getGlobeSize() {
    return Math.min(globeEl.clientWidth, globeEl.clientHeight, 480);
}

const globe = Globe()
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
    .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('#6a5acd')
    .atmosphereAltitude(0.15)
    .width(getGlobeSize())
    .height(getGlobeSize())
    .pointsData([])
    .pointColor(() => '#b8a9e8')
    .pointAltitude(0.05)
    .pointRadius(0.4)
    .ringsData([])
    .ringColor(() => t => `rgba(184,169,232,${1 - t})`)
    .ringMaxRadius(3)
    .ringPropagationSpeed(1.5)
    .ringRepeatPeriod(2000)
    (globeEl);

globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.3;
globe.controls().enableZoom = false;

// Get the visitor's location and pin it on the globe
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => setLocation(pos.coords.latitude, pos.coords.longitude),
        () => setLocation(-33.8688, 151.2093) // fallback: Sydney
    );
} else {
    setLocation(-33.8688, 151.2093);
}

function setLocation(lat, lng) {
    const point = [{ lat, lng }];
    globe.pointsData(point);
    globe.ringsData(point);
    globe.pointOfView({ lat, lng, altitude: 2.5 }, 1000);
}

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
