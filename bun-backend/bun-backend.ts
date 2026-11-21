const FPS = 0.75;
const INTERVAL = 1000 / FPS;
const TAU = Math.PI * 2;

// Kreis konfigurieren

const RADIUS = 150;
const CENTER_X = 0;
const CENTER_Y = 0;
const LAP_SECONDS = 8; // Sekunden pro Runde

const server = Bun.serve({
	hostname: "0.0.0.0",
	port: 5000,

	fetch(req, server) {
		if (server.upgrade(req)) return;
		return new Response("Car-WebSocket läuft");
	},

	websocket: {
		open(ws) {
			ws.subscribe("car");
		},
		message() {},
	},
});

const start = performance.now();
let tickIndex = 1;

function tick() {
	const now = performance.now();
	const deadline = start + tickIndex * INTERVAL;

	if (now < deadline) {
		setTimeout(tick, Math.max(1, deadline - now));
		return;
	}

	// Bewegung anhand echter verstrichener Zeit berechnen.
	const seconds = (now - start) / 1000;
	const phase = ((seconds / LAP_SECONDS) * TAU) % TAU;

	const packet = {
		id: "car",
		data: {
			x: CENTER_X + RADIUS * Math.cos(phase),
			y: CENTER_Y + RADIUS * Math.sin(phase),
			angle: (TAU - phase) % TAU,
		},
	};

	server.publish("car", JSON.stringify(packet));

	// Nächster Termin auf festem 60-Hz-Raster.
	// Bei längeren Pausen keine veralteten Pakete nachschicken.
	tickIndex = Math.max(
		tickIndex + 1,
		Math.floor((performance.now() - start) / INTERVAL) + 1,
	);

	const delay = start + tickIndex * INTERVAL - performance.now();
	setTimeout(tick, Math.max(1, delay));
}

setTimeout(tick, INTERVAL);

console.log("WebSocket: ws://192.168.137.51:5000");
