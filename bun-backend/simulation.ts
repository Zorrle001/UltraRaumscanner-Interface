import type { ServerWebSocket } from "bun";

const FPS = 2;
const INTERVAL = 1000 / FPS;

const server = Bun.serve({
	hostname: "0.0.0.0",
	port: 5000,

	fetch(req, server) {
		if (server.upgrade(req)) return;
		return new Response("Car-WebSocket läuft");
	},

	websocket: {
		open(ws) {
			roboPosition.x = 0;
			roboPosition.y = 0;
			roboPosition.angle = 0;

			ws.send(
				JSON.stringify({
					id: "room_lines",
					data: ROOM_LINES,
				}),
			);

			ws.send(
				JSON.stringify({
					id: "car",
					data: {
						x: roboPosition.x,
						y: roboPosition.y,
						angle: roboPosition.angle * DEG_TO_RAD,
					},
				}),
			);

			setTimeout(() => {
				movementLoop(ws);
			}, INTERVAL);
		},
		message() {},
	},
});

console.log("WebSocket: ws://192.168.137.51:5000");

// ---

type Line = {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
};

type RoboPosition = {
	x: number;
	y: number;
	angle: number;
};

type Point = {
	op?: "add" | "remove";
	x: number;
	y: number;
	sensorAngle: number;
	sensorIndex: number;
	distance: number;
	angle: number;
	timestamp: number;
};

const roboPosition: RoboPosition = {
	x: 0,
	y: 0,
	angle: 0,
};

const ROOM_LINES: Line[] = [
	// Rechteck
	{
		x1: -250,
		y1: 100,
		x2: 250,
		y2: 150,
	},
	{
		x1: 250,
		y1: 150,
		x2: 250,
		y2: -100,
	},
	{
		x1: 250,
		y1: -100,
		x2: -250,
		y2: -100,
	},
	{
		x1: -250,
		y1: -100,
		x2: -250,
		y2: 100,
	},
];

const SENSOR_ANGLES = [0, 60, 120, 180, 240, 300];
const MAX_DISTANCE = 5000;
const DEG_TO_RAD = Math.PI / 180;
const CONE_SLOPE = Math.tan(7.5 * DEG_TO_RAD);
const EPSILON = 1e-9;

const SCANNED_DISTANCES: Point[] = [];
const EXPECTED_LINES: Line[] = [];

function getRoboDistance(
	roboPosition: RoboPosition,
	sensorAngle: number,
	walls: readonly Line[] = ROOM_LINES,
): number {
	/*const angle = (90 - roboPosition.angle - sensorAngle) * DEG_TO_RAD;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);*/
	const heading = (roboPosition.angle + sensorAngle) * DEG_TO_RAD;
	const cos = Math.sin(heading); // X-Anteil der Sensorachse
	const sin = Math.cos(heading); // Y-Anteil der Sensorachse (+Y nach oben)

	let nearest = Infinity;

	wallLoop: for (const wall of walls) {
		// Wandendpunkte relativ zum Roboter.
		const ax = wall.x1 - roboPosition.x;
		const ay = wall.y1 - roboPosition.y;
		const bx = wall.x2 - roboPosition.x;
		const by = wall.y2 - roboPosition.y;

		// Koordinaten entlang und quer zur Sensorachse.
		const aForward = ax * cos + ay * sin;
		const bForward = bx * cos + by * sin;
		const aSide = -ax * sin + ay * cos;
		const bSide = -bx * sin + by * cos;

		// t = 0 ist der erste Wandendpunkt, t = 1 der zweite.
		let tMin = 0;
		let tMax = 1;

		// Die Wand an beiden Rändern des Messkegels abschneiden.
		for (const side of [-1, 1]) {
			const a = aForward * CONE_SLOPE + side * aSide;
			const b = bForward * CONE_SLOPE + side * bSide;
			const f0 = Math.abs(a) <= EPSILON ? 0 : a;
			const f1 = Math.abs(b) <= EPSILON ? 0 : b;

			if (f0 < 0 && f1 < 0) {
				continue wallLoop;
			}

			if (f0 < 0) {
				tMin = Math.max(tMin, f0 / (f0 - f1));
			} else if (f1 < 0) {
				tMax = Math.min(tMax, f0 / (f0 - f1));
			}
		}

		if (tMin > tMax) {
			continue;
		}

		// Den Roboter auf die Wand projizieren und die Projektion
		// auf das sichtbare Teilstück begrenzen.
		const dx = bx - ax;
		const dy = by - ay;
		const lengthSquared = dx * dx + dy * dy;
		const projection =
			lengthSquared === 0 ? 0 : -(ax * dx + ay * dy) / lengthSquared;
		const t = Math.max(tMin, Math.min(tMax, projection));

		nearest = Math.min(nearest, Math.hypot(ax + t * dx, ay + t * dy));
	}

	return nearest <= MAX_DISTANCE ? nearest : -1;
}

function getRoboDistances(): Point[] {
	const timestamp = Date.now();
	let i = 0;
	return SENSOR_ANGLES.map((angle) => ({
		x: roboPosition.x,
		y: roboPosition.y,
		sensorAngle: angle,
		sensorIndex: i++,
		distance: getRoboDistance(roboPosition, angle),
		angle: angle + roboPosition.angle,
		timestamp,
	}));
}

function driveForwards(distance: number): void {
	const angle = roboPosition.angle * DEG_TO_RAD;

	roboPosition.x += Math.sin(angle) * distance;
	roboPosition.y += Math.cos(angle) * distance;
}

function movementLoop(ws: ServerWebSocket) {
	const distances = getRoboDistances();
	if (distances.length != SENSOR_ANGLES.length || distances.length < 1) {
		console.error("NOT ENOUGH DISTANCES! ERROR!");
		return;
	}
	if (distances[0]?.distance && distances[0].distance > 10) {
		driveForwards(10);
	} else {
		roboPosition.angle = (roboPosition.angle - 90) % 360;
	}

	for (const distancePoint of distances) {
		SCANNED_DISTANCES.push(distancePoint);
	}

	ws.send(
		JSON.stringify({
			id: "points",
			data: {
				points: distances,
			},
		}),
	);

	ws.send(
		JSON.stringify({
			id: "car",
			data: {
				x: roboPosition.x,
				y: roboPosition.y,
				angle: roboPosition.angle * DEG_TO_RAD,
			},
		}),
	);

	// CALCULATE EXPECTED LINES
	if (SCANNED_DISTANCES.length % (8 * SENSOR_ANGLES.length) === 0) {
		rebuildExpectedLines();

		ws.send(
			JSON.stringify({
				id: "expected_lines",
				data: EXPECTED_LINES,
			}),
		);
	}

	setTimeout(() => {
		movementLoop(ws);
	}, INTERVAL);
}

console.log(getRoboDistances());

console.log(getRoboDistance({ x: 50, y: 25, angle: 0 }, 0)); // 75
console.log(getRoboDistance({ x: 50, y: 25, angle: 90 }, 0)); // 200
console.log(getRoboDistance({ x: 50, y: 25, angle: 180 }, 0)); // 125
console.log(getRoboDistance({ x: 50, y: 25, angle: 270 }, 0)); // 300

// EXPECTED LINE CALCULATIONS
const MAP_HALF_BEAM = 7.5 * DEG_TO_RAD;
const MAP_BEAM_COS = Math.cos(MAP_HALF_BEAM);
const MAP_BEAM_SIN = Math.sin(MAP_HALF_BEAM);

const MAP_MIN_POSITIONS = 5;
const MAP_MIN_LENGTH = 40;
const MAP_MIN_WEIGHT = 2.5;
const MAP_MAX_RMS = 2.5;
const MAP_MAX_GAP = 75;
const MAP_OFFSET_STEP = 4;
const MAP_MAX_LINES = 12;

type MapScan = RoboPosition & {
	distance: number;
	ux: number;
	uy: number;
	weight: number;
	origin: string;
};

type WallVote = {
	scan: MapScan;
	offset: number;
	along: number;
};

type WallFit = {
	line: Line;
	normalDeg: number;
	score: number;
	votes: WallVote[];
};

function collectMapScans(points: readonly Point[]): MapScan[] {
	const unique = new Map<string, MapScan>();

	for (const p of points) {
		// -1: kein Echo. 0: Kontakt im Ursprung, ohne Richtungsinformation.
		if (!(p.distance > 0 && p.distance <= MAX_DISTANCE)) continue;

		// p.angle ist bereits der absolute Sensorwinkel in Grad.
		const angle = ((p.angle % 360) + 360) % 360;
		const heading = angle * DEG_TO_RAD;
		const origin = `${Math.round(p.x / 5)},${Math.round(p.y / 5)}`;
		const key = `${origin}:${Math.round(angle * 10) % 3600}`;

		unique.set(key, {
			x: p.x,
			y: p.y,
			angle,
			distance: p.distance,
			ux: Math.sin(heading),
			uy: Math.cos(heading),
			weight: 1 / (1 + (p.distance / 150) ** 2),
			origin,
		});
	}

	return [...unique.values()];
}

function respectsFreeSpace(
	line: Line,
	scans: readonly MapScan[],
	support: number,
): boolean {
	const walls = [line];
	const maxConflict = Math.max(1, support * 0.2);
	let conflict = 0;

	for (const scan of scans) {
		// scan.angle ist schon die Sensorachse, also kein weiterer Offset.
		const predicted = getRoboDistance(scan, 0, walls);

		// Die geschätzte Wand darf nicht deutlich vor dem Echo liegen.
		if (predicted >= 0 && predicted + 6 < scan.distance) {
			conflict += scan.weight;
			if (conflict > maxConflict) return false;
		}
	}

	return true;
}

function fitWallAtAngle(
	normalDeg: number,
	scans: readonly MapScan[],
	allScans: readonly MapScan[],
	best: WallFit | undefined,
): WallFit | undefined {
	const normal = normalDeg * DEG_TO_RAD;
	const nx = Math.cos(normal);
	const ny = Math.sin(normal);
	const tx = -ny;
	const ty = nx;
	const bins = new Map<number, WallVote[]>();

	for (const scan of scans) {
		const dot = nx * scan.ux + ny * scan.uy;

		// Fast parallele Messungen sind für diese Wand schlecht verwertbar.
		if (Math.abs(dot) < 0.25) continue;

		// Dieselbe Wand kann von beiden Seiten gemessen werden.
		const side = dot >= 0 ? 1 : -1;
		let dx = nx * side;
		let dy = ny * side;

		if (Math.abs(dot) < MAP_BEAM_COS) {
			// Die Normale liegt außerhalb des Kegels: nächster Kegelrand.
			const turn = scan.ux * dy - scan.uy * dx >= 0 ? 1 : -1;
			dx = scan.ux * MAP_BEAM_COS - turn * scan.uy * MAP_BEAM_SIN;
			dy = scan.uy * MAP_BEAM_COS + turn * scan.ux * MAP_BEAM_SIN;
		}

		const x = scan.x + scan.distance * dx;
		const y = scan.y + scan.distance * dy;
		const vote = { scan, offset: x * nx + y * ny, along: x * tx + y * ty };
		const bin = Math.floor(vote.offset / MAP_OFFSET_STEP);

		// Überlappende Gruppen: Ein Treffer an einer Bingrenze geht nicht verloren.
		for (const key of [bin - 1, bin]) {
			const group = bins.get(key);
			if (group) group.push(vote);
			else bins.set(key, [vote]);
		}
	}

	for (const bin of bins.values()) {
		if (bin.length < MAP_MIN_POSITIONS) continue;
		bin.sort((a, b) => a.along - b.along);

		let start = 0;

		for (let end = 1; end <= bin.length; end++) {
			if (
				end < bin.length &&
				bin[end].along - bin[end - 1].along <= MAP_MAX_GAP
			) {
				continue;
			}

			// Große Lücken nicht mit einer durchgehenden Wand überbrücken.
			const votes = bin.slice(start, end);
			start = end;
			if (votes.length < MAP_MIN_POSITIONS) continue;

			const lo = votes[0].along;
			const hi = votes[votes.length - 1].along;
			if (hi - lo < MAP_MIN_LENGTH) continue;

			const positions = new Set(votes.map((v) => v.scan.origin));
			if (positions.size < MAP_MIN_POSITIONS) continue;

			const weight = votes.reduce((sum, v) => sum + v.scan.weight, 0);
			if (weight < MAP_MIN_WEIGHT) continue;

			const offset =
				votes.reduce((sum, v) => sum + v.scan.weight * v.offset, 0) /
				weight;

			const error = votes.reduce(
				(sum, v) => sum + v.scan.weight * (v.offset - offset) ** 2,
				0,
			);
			const rms = Math.sqrt(error / weight);
			if (rms > MAP_MAX_RMS) continue;

			const score = weight / (1 + (rms / MAP_MAX_RMS) ** 2);
			if (best && score <= best.score) continue;

			const line: Line = {
				x1: nx * offset + tx * lo,
				y1: ny * offset + ty * lo,
				x2: nx * offset + tx * hi,
				y2: ny * offset + ty * hi,
			};

			if (respectsFreeSpace(line, allScans, weight)) {
				best = { line, normalDeg, score, votes };
			}
		}
	}

	return best;
}

function rebuildExpectedLines(): void {
	const allScans = collectMapScans(SCANNED_DISTANCES);
	let remaining = allScans;
	const lines: Line[] = [];

	while (
		lines.length < MAP_MAX_LINES &&
		remaining.length >= MAP_MIN_POSITIONS
	) {
		let best: WallFit | undefined;

		// Erst grob nach der stärksten Wand suchen.
		for (let deg = 0; deg < 180; deg += 2) {
			best = fitWallAtAngle(deg, remaining, allScans, best);
		}

		if (!best) break;

		// Danach den Winkel der besten gefundenen Wand feiner abtasten.
		const coarseAngle = best.normalDeg;
		for (let step = -20; step <= 20; step++) {
			best =
				fitWallAtAngle(
					coarseAngle + step * 0.1,
					remaining,
					allScans,
					best,
				) ?? best;
		}

		lines.push(best.line);

		// Jedes Echo stützt nur eine Wand, prüft aber weiterhin den Freiraum.
		const used = new Set(best.votes.map((v) => v.scan));
		remaining = remaining.filter((scan) => !used.has(scan));
	}

	// Array-Referenz beibehalten, Inhalt durch den neuen Stand ersetzen.
	EXPECTED_LINES.length = 0;
	EXPECTED_LINES.push(...lines);
}
