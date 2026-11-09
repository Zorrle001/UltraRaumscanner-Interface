type Point = {
	x: number;
	y: number;
	timestamp: number;
};

const points: Point[] = [
	{
		x: 100,
		y: 200,
		timestamp: Date.now(),
	},
	{
		x: -150,
		y: -250,
		timestamp: Date.now(),
	},
];

const roboPosition: Point = {
	x: 0,
	y: 0,
	timestamp: Date.now(),
};
let roboRotation = 0;

const robo = document.getElementById("robo") as HTMLDivElement;
const mapCanvas = document.getElementById("mapCanvas") as HTMLCanvasElement;
const ctx = mapCanvas.getContext("2d");
const rect = mapCanvas.getBoundingClientRect();
const width = rect.width;
const height = rect.height;
mapCanvas.width = width;
mapCanvas.height = height;

let originX = width / 2;
let originY = height / 2;

/*setInterval(() => {
	originY += 1;
	drawMap();
}, 10);*/

setInterval(() => {
	if (roboPosition.y <= -height / 2) {
		roboPosition.y = height / 2; // Reset to the bottom of the canvas
	}
	roboPosition.y -= 0.5;
	roboRotation += 0.5; // Increment rotation
	const x = roboPosition.x * SCALE;
	const y = roboPosition.y * SCALE; // Invertiere Y-Achse für Canvas Coordinaten
	setRoboRotation(roboRotation);
	setRoboPosition(x, y);
	drawMap();
}, 10);

let SCALE = 1;

document.getElementById("scaleSlider")?.addEventListener("input", (event) => {
	const target = event.target as HTMLInputElement;
	const newScale = parseFloat(target.value);
	if (!isNaN(newScale) && newScale > 0) {
		SCALE = newScale;
		document.getElementById("scaleValue")!.textContent = SCALE.toString();
		drawMap();
	}
});

console.log(mapCanvas);

function drawMap() {
	if (!ctx) {
		console.error("Canvas context is not available.");
		return;
	}

	ctx.clearRect(0, 0, width, height);

	for (const point of points) {
		const canvasX = originX + point.x * SCALE;
		const canvasY = originY - point.y * SCALE; // Invertiere Y-Achse für Canvas Coordinaten
		drawX(ctx, canvasX, canvasY, 5);
	}
}

drawMap();

let DRAG_X = 0;
let DRAG_Y = 0;
let DRAG_ORIGIN_X = 0;
let DRAG_ORIGIN_Y = 0;
let isDragging = false;

mapCanvas.addEventListener("pointerdown", (e) => {
	e.preventDefault();
	DRAG_X = (e.clientX - rect.left - originX) * SCALE;
	DRAG_Y = (e.clientY - rect.top - originY) * -1 * SCALE;
	console.log(`Pointer down at: ${DRAG_X}, ${DRAG_Y}`);

	DRAG_ORIGIN_X = originX;
	DRAG_ORIGIN_Y = originY;

	isDragging = true;
});

mapCanvas.addEventListener("pointermove", (e) => {
	if (!isDragging) return;
	e.preventDefault();

	calculateDragging(e);
});

mapCanvas.addEventListener("pointerup", (e) => {
	if (!isDragging) return;
	e.preventDefault();

	calculateDragging(e);
	isDragging = false;
});

function calculateDragging(e: PointerEvent) {
	let NEW_DRAG_X = (e.clientX - rect.left - DRAG_ORIGIN_X) * SCALE;
	let NEW_DRAG_Y = (e.clientY - rect.top - DRAG_ORIGIN_Y) * -1 * SCALE;
	console.log(`Pointer moving at: ${NEW_DRAG_X}, ${NEW_DRAG_Y}`);

	let DELTA_X = NEW_DRAG_X - DRAG_X;
	let DELTA_Y = NEW_DRAG_Y - DRAG_Y;

	originX += DELTA_X / SCALE;
	originY -= DELTA_Y / SCALE; // Invertiere Y-Achse für Canvas Coordinaten

	DRAG_X = NEW_DRAG_X;
	DRAG_Y = NEW_DRAG_Y;
}

function drawX(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
) {
	ctx.beginPath();
	// Erste Diagonale (von oben links nach unten rechts)
	ctx.moveTo(x - size, y - size);
	ctx.lineTo(x + size, y + size);

	// Zweite Diagonale (von oben rechts nach unten links)
	ctx.moveTo(x + size, y - size);
	ctx.lineTo(x - size, y + size);

	ctx.strokeStyle = "#000000"; // Linienfarbe
	ctx.lineWidth = 3; // Linienstärke
	ctx.stroke();
}

function setRoboPosition(x: number, y: number) {
	robo.style.setProperty("--x", `${originX + x}px`);
	robo.style.setProperty("--y", `${originY + y}px`);
}

function setRoboRotation(angle: number) {
	robo.style.setProperty("--rotation", `${angle}deg`);
}

document.getElementById("centerButton")?.addEventListener("click", () => {
	originX = width / 2;
	originY = height / 2;
	drawMap();
});
