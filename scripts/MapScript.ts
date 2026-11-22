type Point = {
	op: "add" | "remove";
	x: number;
	y: number;
	distance: number;
	angle: number;
	timestamp: number;
};

type Line = {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
};

type SimplePoint = {
	worldX: number;
	worldY: number;
	timestamp: number;
};

type RoboPosition = {
	x: number;
	y: number;
	angle: number;
	timestamp: number;
	path: SimplePoint[];
};
let hasFirstPosition = false;

(globalThis as any).ROOM_LINES = [] satisfies Point[];
(globalThis as any).EXPECTED_LINES = [] satisfies Point[];
(globalThis as any).MAP_POINTS = [] satisfies Point[];

function setPublicRoboPosition(x: number, y: number, angleDegree: number) {
	if (!hasFirstPosition) {
		robo.classList.remove("hidden");
		document.getElementById("loadingLabel")?.classList.add("hidden");
		hasFirstPosition = true;
	}

	roboPosition.x = x;
	roboPosition.y = y;

	roboPosition.angle = angleDegree;

	addRoboPathPoint();
	render();
}

(globalThis as any).setPublicRoboPosition = setPublicRoboPosition;
(globalThis as any).radientToDegree = radientToDegree;
(globalThis as any).render = render;
(globalThis as any).worldToCanvas = worldToCanvas;
(globalThis as any).canvasToWorld = canvasToWorld;
(globalThis as any).drawSensorCone = drawSensorCone;
(globalThis as any).drawSensorCones_Optimized = drawSensorCones_Optimized;

let ROOM_LINES: Line[] = (globalThis as any).ROOM_LINES;
let EXPECTED_LINES: Line[] = (globalThis as any).EXPECTED_LINES;
let MAP_POINTS: Point[] = (globalThis as any).MAP_POINTS;

(globalThis as any).roboPosition = {
	x: 0,
	y: -300,
	//lastX: undefined,
	//lastY: undefined,
	angle: 0,
	timestamp: Date.now(),
	path: [],
} satisfies RoboPosition;
const roboPosition: RoboPosition = (globalThis as any).roboPosition;
//roboPosition.x = 12;

let followRobo = false;
let lockOrientation = false;
let sliderMapProjectionRotation = 0;
let mapProjectionRotation = 0;

const robo = document.getElementById("robo") as HTMLDivElement;
const mapSection = document.getElementById("mapSection") as HTMLDivElement;
const mapCanvas = document.getElementById("mapCanvas") as HTMLCanvasElement;
const ctx = mapCanvas.getContext("2d");
let rect = mapCanvas.getBoundingClientRect();
let canvasWidth = rect.width;
let canvasHeight = rect.height;
mapCanvas.width = canvasWidth;
mapCanvas.height = canvasHeight;

let canvas_originX = canvasWidth / 2;
let canvas_originY = canvasHeight / 2;

/*setInterval(() => {
	originY += 1;
	drawMap();
}, 10);*/

/*setInterval(() => {
	if (roboPosition.y <= -height / 2) {
		roboPosition.y = height / 2; // Reset to the bottom of the canvas
	}
	roboPosition.y -= 0.5;
	//roboRotation += 0.5; // Increment rotation
	const x = roboPosition.x * SCALE;
	const y = roboPosition.y * SCALE; // Invertiere Y-Achse für Canvas Coordinaten
	setRoboRotation(90);
	setRoboPosition(x, y);
	drawMap();
}, 10);*/

/* setInterval(() => {
	roboRotation++;
	roboRotation = roboRotation % 360;

	roboPosition.x += Math.sin(degreeToRadient(roboRotation)) * 2;
	roboPosition.y += Math.cos(degreeToRadient(roboRotation)) * 2;

	//roboPosition.y -= 0.5;
	//roboRotation += 0.5; // Increment rotation
	const x = roboPosition.x * SCALE;
	const y = -roboPosition.y * SCALE; // Invertiere Y-Achse für Canvas Coordinaten
	setRoboRotation(roboRotation);
	setRoboPosition(x, y);
	//console.log("robo pos", roboPosition.x, roboPosition.y, roboRotation);
	drawMap();
	drawRoboPath();
}, 20); */

let SCALE = 1;

document.getElementById("scaleSlider")?.addEventListener("input", (event) => {
	const target = event.target as HTMLInputElement;
	const newScale = parseFloat(target.value);
	if (!isNaN(newScale) && newScale > 0) {
		let oldScale = SCALE;

		SCALE = newScale;
		document.getElementById("scaleValue")!.textContent = SCALE.toString();

		renderMeasurementTape();

		// Behalte origin in der mitte nach zoom
		const k = newScale / oldScale;

		canvas_originX =
			canvasWidth / 2 - (canvasWidth / 2 - canvas_originX) * k;
		canvas_originY =
			canvasHeight / 2 - (canvasHeight / 2 - canvas_originY) * k;

		render();
	}
});

const rotationSlider = document.getElementById(
	"rotationSlider",
) as HTMLInputElement;

rotationSlider.addEventListener("input", (event) => {
	const newMapRotation = parseFloat(rotationSlider.value);
	if (isNaN(newMapRotation)) return;

	sliderMapProjectionRotation = newMapRotation;
	document.getElementById("rotationValue")!.textContent =
		`${sliderMapProjectionRotation}°`;

	if (lockOrientation && followRobo) {
		return;
	}

	const oldMapRotation = mapProjectionRotation;
	mapProjectionRotation = sliderMapProjectionRotation;

	// behalte origin in der mitte
	const delta_rotation = newMapRotation - oldMapRotation;

	const { x, y } = rotatePoint(
		canvasWidth / 2 - canvas_originX,
		canvasHeight / 2 - canvas_originY,
		0,
		0,
		delta_rotation,
	);

	canvas_originX = canvasWidth / 2 - x;
	canvas_originY = canvasHeight / 2 - y;

	render();
	//setRoboRotationDegree(roboRotation); ??? needed?
});

console.log(mapCanvas);

function clearMap() {
	if (!ctx) {
		console.error("Canvas context is not available.");
		return;
	}
	ctx.clearRect(0, 0, canvasWidth, canvasHeight);
}

function drawMap() {
	if (!ctx) {
		console.error("Canvas context is not available.");
		return;
	}

	ctx.clearRect(0, 0, canvasWidth, canvasHeight);

	// NEW FOR CONES:
	drawSensorCones_Optimized(MAP_POINTS);
	return;

	let i = 0;
	ctx.beginPath();
	for (const point of MAP_POINTS) {
		if (point === undefined) continue;
		//console.log("POINT", point);
		if (point.op === "remove") {
			console.log("REMOVE", point, MAP_POINTS[i]);
			delete MAP_POINTS[i];
			i++;

			continue;
		}

		drawSensorCone(point.x, point.y, point.distance, point.angle);
		continue;

		const canvasX = canvas_originX + point.x * SCALE;
		const canvasY = canvas_originY - point.y * SCALE; // Invertiere Y-Achse für Canvas Coordinaten
		const { x: rotatedCanvasX, y: rotatedCanvasY } = rotatePoint(
			canvasX,
			canvasY,
			!followRobo || true
				? canvas_originX
				: canvas_originX + roboPosition.x * SCALE,
			!followRobo || true
				? canvas_originY
				: canvas_originY - roboPosition.y * SCALE,
			mapProjectionRotation,
		);
		drawX(ctx, rotatedCanvasX, rotatedCanvasY, 5, true);

		i++;
	}
	ctx.stroke();
}

//drawMap();
render();

let DRAG_X = 0;
let DRAG_Y = 0;
let DRAG_ORIGIN_X = 0;
let DRAG_ORIGIN_Y = 0;
let isDragging = false;

mapSection.addEventListener("pointerdown", (e) => {
	if (followRobo) return; // KEIN DRAGGING IM FOLLOW MODE

	e.preventDefault();
	DRAG_X = (e.clientX - rect.left - canvas_originX) * SCALE;
	DRAG_Y = (e.clientY - rect.top - canvas_originY) * -1 * SCALE;
	console.log(`Pointer down at: ${DRAG_X}, ${DRAG_Y}`);

	DRAG_ORIGIN_X = canvas_originX;
	DRAG_ORIGIN_Y = canvas_originY;

	isDragging = true;
});

window.addEventListener("pointermove", (e) => {
	if (mapSection.matches(":hover")) {
		showPointerInfo(e);
	}

	if (!isDragging) return;
	e.preventDefault();

	calculateDragging(e);
});

window.addEventListener("pointerup", (e) => {
	if (!isDragging) return;
	e.preventDefault();

	calculateDragging(e);
	isDragging = false;
});

mapSection.addEventListener("pointerleave", () => {
	hidePointerInfo();
});

function showPointerInfo(e: PointerEvent) {
	const pointerInfo = document.getElementById("pointerInfo");
	const pointerCoords = document.getElementById("pointerCoords");
	if (pointerInfo && pointerCoords) {
		pointerInfo.classList.remove("hidden");
		let POINTER_CANVASX = e.clientX - rect.left;
		let POINTER_CANVASY = e.clientY - rect.top;
		console.log("POINTER_CANVAS:", POINTER_CANVASX, POINTER_CANVASY);
		const { x: rotatedPointerX, y: rotatedPointerY } = canvasToWorld(
			POINTER_CANVASX,
			POINTER_CANVASY,
		);
		pointerCoords.textContent = `(${Math.round(rotatedPointerX * 10) / 10} / ${Math.round(rotatedPointerY * 10) / 10})`;
	}
}

function hidePointerInfo() {
	const pointerInfo = document.getElementById("pointerInfo");
	if (!pointerInfo) return;

	pointerInfo.classList.add("hidden");
}

function calculateDragging(e: PointerEvent) {
	let NEW_DRAG_X = (e.clientX - rect.left - DRAG_ORIGIN_X) * SCALE;
	let NEW_DRAG_Y = (e.clientY - rect.top - DRAG_ORIGIN_Y) * -1 * SCALE;
	console.log(`Pointer moving at: ${NEW_DRAG_X}, ${NEW_DRAG_Y}`);

	let DELTA_X = NEW_DRAG_X - DRAG_X;
	let DELTA_Y = NEW_DRAG_Y - DRAG_Y;

	canvas_originX += DELTA_X / SCALE;
	canvas_originY -= DELTA_Y / SCALE; // Invertiere Y-Achse für Canvas Coordinaten

	DRAG_X = NEW_DRAG_X;
	DRAG_Y = NEW_DRAG_Y;

	render();
}

function rotatePoint(
	px: number,
	py: number,
	mx: number,
	my: number,
	angleDegrees: number,
): { x: number; y: number } {
	const angle = (angleDegrees * Math.PI) / 180;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	const dx = px - mx;
	const dy = py - my;

	return {
		x: mx + dx * cos - dy * sin,
		y: my + dx * sin + dy * cos,
	};
}

function drawX(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	noStroke: boolean = false,
) {
	if (noStroke) ctx.beginPath();
	// Erste Diagonale (von oben links nach unten rechts)
	ctx.moveTo(x - size, y - size);
	ctx.lineTo(x + size, y + size);

	// Zweite Diagonale (von oben rechts nach unten links)
	ctx.moveTo(x + size, y - size);
	ctx.lineTo(x - size, y + size);

	ctx.strokeStyle = "#000000"; // Linienfarbe
	ctx.lineWidth = 3; // Linienstärke
	ctx.lineCap = "round";
	if (noStroke) ctx.stroke();
}

function drawSensorCone(
	baseX: number,
	baseY: number,
	height: number,
	angle: number,
) {
	if (height > 5000) {
		console.error("Sensor range cannot exceed 5 meters.");
		return;
	}

	if (height <= 0) return;

	const coneAngle = 15;
	const toRadians = Math.PI / 180;
	const centerAngle = angle + mapProjectionRotation - 90;
	const startAngle = (centerAngle - coneAngle / 2) * toRadians;
	const endAngle = (centerAngle + coneAngle / 2) * toRadians;

	const canvas_base = worldToCanvas(baseX, baseY);
	const canvas_height = height * SCALE;

	//ctx.save();

	// Kreissektor hellblau und leicht transparent füllen.
	ctx.beginPath();
	ctx.moveTo(canvas_base.x, canvas_base.y);
	ctx.arc(canvas_base.x, canvas_base.y, canvas_height, startAngle, endAngle);
	ctx.closePath();
	ctx.fillStyle = "rgba(135, 206, 250, 0.3)";
	ctx.fill();

	// Nur den runden Außenbogen schwarz zeichnen.
	ctx.beginPath();
	ctx.strokeStyle = "black";
	ctx.lineWidth = 2;
	ctx.arc(canvas_base.x, canvas_base.y, canvas_height, startAngle, endAngle);

	//ctx.lineCap = "round";
	ctx.stroke();

	//ctx.restore();
}

type SensorCone = {
	baseX: number;
	baseY: number;
	height: number; // Millimeter vor der Skalierung
	angle: number; // Grad, 0 = oben vor der Kartenrotation
};

function drawSensorCones_Optimized_2(cones: readonly Point[]) {
	const fillPath = new Path2D();
	const borderPath = new Path2D();

	const toRadians = Math.PI / 180;
	const halfOpening = 7.5 * toRadians;
	const rotation = (mapProjectionRotation - 90) * toRadians;

	for (const { x: baseX, y: baseY, distance: height, angle } of cones) {
		if (!Number.isFinite(height) || height <= 0) continue;

		if (height > 5000) {
			console.error("Sensor range cannot exceed 5 meters.");
			continue;
		}

		const { x, y } = worldToCanvas(baseX, baseY);
		const radius = height * SCALE;
		const center = angle * toRadians + rotation;
		const start = center - halfOpening;
		const end = center + halfOpening;

		fillPath.moveTo(x, y);
		fillPath.arc(x, y, radius, start, end);
		fillPath.closePath();

		// Einen neuen Teilpfad starten, damit keine Bögen verbunden werden.
		borderPath.moveTo(
			x + radius * Math.cos(start),
			y + radius * Math.sin(start),
		);
		borderPath.arc(x, y, radius, start, end);
	}

	ctx.save();

	ctx.fillStyle = "rgba(135, 206, 250, 0.3)";
	ctx.fill(fillPath);

	ctx.strokeStyle = "black";
	ctx.lineWidth = 2;
	ctx.stroke(borderPath);

	ctx.restore();
}

function drawSensorCones_Optimized(cones: readonly Point[]) {
	const borderPath = new Path2D();

	const toRadians = Math.PI / 180;
	const halfOpening = 7.5 * toRadians;
	const rotation = (mapProjectionRotation - 90) * toRadians;

	ctx.save();
	ctx.globalCompositeOperation = "source-over";
	ctx.fillStyle = "rgba(135, 206, 250, 0.3)";
	ctx.strokeStyle = "black";
	ctx.lineCap = "butt";
	ctx.lineWidth = 2;

	//const { width, height: canvasHeight } = ctx.canvas;
	for (const { x: baseX, y: baseY, distance: height, angle } of cones) {
		if (!Number.isFinite(height) || height <= 0 || height > 5000) {
			continue;
		}

		const { x, y } = worldToCanvas(baseX, baseY);
		const radius = height * SCALE;

		// CHECK OB KREIS IM VIEWPORT
		const outerRadius = radius + 2; // Rand + Antialiasing
		if (
			x + outerRadius < 0 ||
			x - outerRadius > canvasWidth ||
			y + outerRadius < 0 ||
			y - outerRadius > canvasHeight
		) {
			continue;
		}

		const center = angle * toRadians + rotation;
		const start = center - halfOpening;
		const end = center + halfOpening;
		/* performance beeinträchtigend
		if (
			!isConeVisible(
				x,
				y,
				radius,
				start,
				end,
				canvasWidth / 2,
				canvasHeight / 2,
			)
		) {
			continue;
		}*/

		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.arc(x, y, radius, start, end);
		ctx.closePath();
		ctx.fill();

		/* ctx.beginPath();
		ctx.arc(x, y, radius, start, end);
		ctx.stroke(); */

		// Jeden Bogen als eigenen Teilpfad starten, damit keine
		// Verbindungslinien zwischen den Bögen entstehen.
		borderPath.moveTo(
			x + radius * Math.cos(start),
			y + radius * Math.sin(start),
		);
		borderPath.arc(x, y, radius, start, end);
	}

	ctx.stroke(borderPath);
	ctx.restore();
}

function isConeVisible(
	x: number,
	y: number,
	radius: number,
	start: number,
	end: number,
	width: number,
	height: number,
): boolean {
	// 1 px für den halben 2-px-Rand, 1 px Reserve für Antialiasing.
	const padding = 2;
	const outerRadius = radius + padding;

	if (
		x + outerRadius < 0 ||
		x - outerRadius > width ||
		y + outerRadius < 0 ||
		y - outerRadius > height
	) {
		return false;
	}

	// Wenn schon der ganze Kreis im Canvas liegt, ist der Cone sichtbar.
	if (
		x - outerRadius >= 0 &&
		x + outerRadius <= width &&
		y - outerRadius >= 0 &&
		y + outerRadius <= height
	) {
		return true;
	}

	// Die Bounding Box enthält die Spitze und beide Bogenenden.
	const startX = radius * Math.cos(start);
	const startY = radius * Math.sin(start);
	const endX = radius * Math.cos(end);
	const endY = radius * Math.sin(end);

	let minX = Math.min(0, startX, endX);
	let maxX = Math.max(0, startX, endX);
	let minY = Math.min(0, startY, endY);
	let maxY = Math.max(0, startY, endY);

	// Der Bogen kann zwischen seinen Endpunkten weiter hinausragen.
	const tau = 2 * Math.PI;
	const sweep = end - start;
	const normalizedStart = ((start % tau) + tau) % tau;

	if (tau - normalizedStart <= sweep || normalizedStart === 0) {
		maxX = radius;
	}
	if ((Math.PI / 2 - normalizedStart + tau) % tau <= sweep) {
		maxY = radius;
	}
	if ((Math.PI - normalizedStart + tau) % tau <= sweep) {
		minX = -radius;
	}
	if (((3 * Math.PI) / 2 - normalizedStart + tau) % tau <= sweep) {
		minY = -radius;
	}

	return (
		x + maxX + padding >= 0 &&
		x + minX - padding <= width &&
		y + maxY + padding >= 0 &&
		y + minY - padding <= height
	);
}

function drawRoboPath() {
	if (!ctx) return;

	let hasStartPoint = false;
	for (const point of roboPosition.path) {
		//const x = originX + point.x * SCALE;
		//const y = originY + point.y * SCALE;

		const canvasX = canvas_originX + point.worldX * SCALE;
		const canvasY = canvas_originY - point.worldY * SCALE; // Invertiere Y-Achse für Canvas Coordinaten
		const { x: rotatedCanvasX, y: rotatedCanvasY } = rotatePoint(
			canvasX,
			canvasY,
			!followRobo || true
				? canvas_originX
				: canvas_originX + roboPosition.x * SCALE,
			!followRobo || true
				? canvas_originY
				: canvas_originY - roboPosition.y * SCALE,
			mapProjectionRotation,
		);

		if (!hasStartPoint) {
			ctx.beginPath();
			ctx.moveTo(rotatedCanvasX, rotatedCanvasY);
			hasStartPoint = true;
		} else {
			ctx.lineTo(rotatedCanvasX, rotatedCanvasY);
		}
	}

	if (hasStartPoint == true) {
		/* const gradient = ctx.createLinearGradient(0, 0, width, height);
		gradient.addColorStop(0, "red");
		gradient.addColorStop(0.5, "purple");
		gradient.addColorStop(1, "blue"); */

		// Set the fill style and draw a rectangle
		//ctx.fillStyle = gradient;

		ctx.strokeStyle = "lime";
		//ctx.strokeStyle = gradient;
		ctx.lineWidth = 3;

		// Enden der Linie abrunden
		ctx.lineCap = "round";
		// Ecken (Verbindungen zwischen zwei Linien) abrunden
		//ctx.lineJoin = "round";

		ctx.stroke();
	}
}

function setRoboRotationDegree(angle: number) {
	roboPosition.angle = angle;
	render();
}

document.getElementById("centerButton")?.addEventListener("click", () => {
	if (followRobo) return;

	render({ centerRobot: true });
});

const followRoboCheckbox = document.getElementById(
	"followRoboCheckbox",
) as HTMLInputElement;

const lockOrientationCheckbox = document.getElementById(
	"lockOrientationCheckbox",
) as HTMLInputElement;

followRoboCheckbox?.addEventListener("input", () => {
	//if (followRoboCheckbox == null) return;
	followRobo = followRoboCheckbox.checked;
	document
		.getElementById("lockOrientationDiv")
		?.classList.toggle("disabled", !followRobo);
	document
		.getElementById("rotationDiv")
		?.classList.toggle("disabled", lockOrientation && followRobo);

	if (!followRobo) {
		// Nordierung aus dem Slider wiederherstellen
		mapProjectionRotation = sliderMapProjectionRotation;

		const canvas_unrotatedX = roboPosition.x * SCALE;
		const canvas_unrotatedY = -roboPosition.y * SCALE; // Y-Achse invertiert

		// Roboter-Offset mit der NEUEN Rotation drehen
		const { x: rx, y: ry } = rotatePoint(
			canvas_unrotatedX,
			canvas_unrotatedY,
			0,
			0,
			mapProjectionRotation,
		);

		// Origin so setzen, dass der Roboter in der Bildmitte liegt
		canvas_originX = canvasWidth / 2 - rx;
		canvas_originY = canvasHeight / 2 - ry;

		render();
	} else {
		// FOLLOW wurde aktiviert
		render(); // center should be active
	}
});

lockOrientationCheckbox?.addEventListener("input", () => {
	//if (followRoboCheckbox == null) return;
	lockOrientation = lockOrientationCheckbox.checked;
	document
		.getElementById("rotationDiv")
		?.classList.toggle("disabled", lockOrientation && followRobo);

	console.log({
		roboAngle: roboPosition.angle,
		sliderRotation: (
			document.getElementById("rotationSlider") as HTMLInputElement | null
		)?.valueAsNumber,
		mapRotation: mapProjectionRotation,
		origin: [canvas_originX, canvas_originY],
	});

	if (!lockOrientation && followRobo) {
		mapProjectionRotation = sliderMapProjectionRotation;

		render();
	} else if (lockOrientation && followRobo) {
		render();
	}
});

window.addEventListener("resize", () => {
	const newRect = mapCanvas.getBoundingClientRect();
	rect = newRect;

	const newWidth = newRect.width;
	const newHeight = newRect.height;

	const deltaWidth = newWidth - canvasWidth;
	const deltaHeight = newHeight - canvasHeight;

	if (newWidth !== canvasWidth || newHeight !== canvasHeight) {
		canvasWidth = newWidth;
		canvasHeight = newHeight;
		mapCanvas.width = canvasWidth;
		mapCanvas.height = canvasHeight;

		canvas_originX += deltaWidth / 2;
		canvas_originY += deltaHeight / 2;

		render();
	}
});

function renderMeasurementTape() {
	// 1px == 1mm
	const measurementTape = document.getElementById("measurementTape");
	const measureLabel = document.getElementById("measureLabel");
	if (!measureLabel) return;

	if (SCALE >= 2) {
		measurementTape?.style.setProperty("--width", SCALE * 50 + "px");
		measureLabel.textContent = "5cm";
	} else if (SCALE >= 0.9) {
		measurementTape?.style.setProperty("--width", SCALE * 100 + "px");
		measureLabel.textContent = "10cm";
	} else if (SCALE >= 0.5) {
		measurementTape?.style.setProperty("--width", SCALE * 250 + "px");
		measureLabel.textContent = "25cm";
	} else if (SCALE >= 0.3) {
		measurementTape?.style.setProperty("--width", SCALE * 500 + "px");
		measureLabel.textContent = "0,5m";
	} else {
		measurementTape?.style.setProperty("--width", SCALE * 1000 + "px");
		measureLabel.textContent = "1m";
	}
}

function degreeToRadient(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

function radientToDegree(radians: number): number {
	return (radians * 180) / Math.PI;
}

function setCanvasOriginToRoboPosition() {
	const canvas_unrotatedX = roboPosition.x * SCALE;
	const canvas_unrotatedY = -roboPosition.y * SCALE; // Y-Achse invertiert

	// Roboter-Offset mit der NEUEN Rotation drehen
	const { x: rx, y: ry } = rotatePoint(
		canvas_unrotatedX,
		canvas_unrotatedY,
		0,
		0,
		mapProjectionRotation,
	);

	// Origin so setzen, dass der Roboter in der Bildmitte liegt
	canvas_originX = canvasWidth / 2 - rx;
	canvas_originY = canvasHeight / 2 - ry;
}

// NEEEEWWW
function worldToCanvas(x: number, y: number) {
	const canvas_unrotatedX = x * SCALE;
	const canvas_unrotatedY = -y * SCALE;

	const offset = rotatePoint(
		canvas_unrotatedX,
		canvas_unrotatedY,
		0,
		0,
		mapProjectionRotation,
	);

	return {
		x: canvas_originX + offset.x,
		y: canvas_originY + offset.y,
	};
}

function canvasToWorld(canvasX: number, canvasY: number) {
	const offsetX = canvasX - canvas_originX;
	const offsetY = canvasY - canvas_originY;

	const canvas_unrotated = rotatePoint(
		offsetX,
		offsetY,
		0,
		0,
		-mapProjectionRotation,
	);

	const worldX = canvas_unrotated.x / SCALE;
	const worldY = -canvas_unrotated.y / SCALE;

	return {
		x: worldX,
		y: worldY,
	};
}

function render({ centerRobot = false } = {}) {
	const headingLocked = followRobo && lockOrientation;

	mapProjectionRotation = headingLocked
		? -roboPosition.angle
		: sliderMapProjectionRotation;

	if (hasFirstPosition && (followRobo || centerRobot)) {
		setCanvasOriginToRoboPosition();
	}

	drawMap();
	drawRoomLines();
	drawExpectedLines();
	drawRoboPath();

	if (!hasFirstPosition) return;

	const { x, y } = worldToCanvas(roboPosition.x, roboPosition.y);
	const screenAngle = headingLocked
		? 0
		: roboPosition.angle + mapProjectionRotation;

	robo.style.setProperty("--x", `${x}px`);
	robo.style.setProperty("--y", `${y}px`);
	robo.style.setProperty("--rotation", `${screenAngle}deg`);
}

function addRoboPathPoint() {
	roboPosition.path.unshift({
		// shift other points back
		worldX: roboPosition.x,
		worldY: roboPosition.y,
		timestamp: performance.now(),
	});

	shortenRoboPath();
}

// könnte in interval aufgerufen werden, um path auch ohne positionsupdates verschwinden zu lassen
function shortenRoboPath() {
	if (!roboPosition.path[0] || !roboPosition.path[0].timestamp) return;
	let latestTimestamp = roboPosition.path[0].timestamp; // Newest point on array start
	let maxTimestampDelta = 4 * 1000; // 5s in ms

	for (let i = roboPosition.path.length - 1; i >= 0; i--) {
		const point = roboPosition.path[i];
		if (latestTimestamp - point.timestamp > maxTimestampDelta) {
			roboPosition.path.pop();
		} else {
			// Punkte immer in richtiger timestamp reihenfolge - sobald ein Punkt von hinten erreicht wird der "jung" genug ist müssen es die davor auch sein -> break
			break;
		}
	}
}

function drawRoomLines() {
	if (!ctx) return;

	ctx?.beginPath();
	for (const line of ROOM_LINES) {
		const canvas_line1 = worldToCanvas(line.x1, line.y1);
		const canvas_line2 = worldToCanvas(line.x2, line.y2);
		ctx?.moveTo(canvas_line1.x, canvas_line1.y);
		ctx?.lineTo(canvas_line2.x, canvas_line2.y);
	}
	ctx.strokeStyle = "green";
	ctx.lineWidth = 2;
	ctx.lineCap = "round";
	ctx?.stroke();
}

function drawExpectedLines() {
	if (!ctx) return;

	ctx?.beginPath();
	for (const line of EXPECTED_LINES) {
		const canvas_line1 = worldToCanvas(line.x1, line.y1);
		const canvas_line2 = worldToCanvas(line.x2, line.y2);
		ctx?.moveTo(canvas_line1.x, canvas_line1.y);
		ctx?.lineTo(canvas_line2.x, canvas_line2.y);
	}
	ctx.strokeStyle = "red";
	ctx.lineWidth = 2;
	ctx.lineCap = "round";
	ctx?.stroke();
}
