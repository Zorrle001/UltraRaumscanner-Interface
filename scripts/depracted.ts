function detailed_origin_scaling(oldScale: number, newScale: number) {
	// Zurückrechnen auf rotierte x,y koordinaten
	let rx_old = canvasWidth / 2 - canvas_originX;
	let ry_old = canvasHeight / 2 - canvas_originY;

	// Zurückrotieren -> negativer mapRotation winkel
	const { x: x_old, y: y_old } = rotatePoint(
		rx_old,
		ry_old,
		0,
		0,
		-mapProjectionRotation,
	);
	console.log("REAL ORIGIN x:", x_old / oldScale, "y:", -y_old / oldScale);

	// Word Koordinaten
	const worldOriginX = x_old / oldScale;
	const worldOriginY = -y_old / oldScale;

	// Umrechnen der Welt Koordinaten mit neuem Scale in Canvas Koordinaten

	const x_new = worldOriginX * newScale;
	const y_new = -worldOriginY * newScale; // Y-Achse invertiert

	// Roboter-Offset mit der NEUEN Rotation drehen
	const { x: rx_new, y: ry_new } = rotatePoint(
		x_new,
		y_new,
		0,
		0,
		mapProjectionRotation,
	);

	// DIE ROTATIONS HEBEN SICH AUF -> KÜRZBAR AUF:
	const k = newScale / oldScale;

	canvas_originX = canvasWidth / 2 - (canvasWidth / 2 - canvas_originX) * k;
	canvas_originY = canvasHeight / 2 - (canvasHeight / 2 - canvas_originY) * k;
}

function drawLine(x1: number, y1: number, x2: number, y2: number) {
	if (!ctx) return;
	console.log("DRAW LINE", x1, y1, x2, y2);
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.strokeStyle = "lime";
	ctx.lineWidth = 15;

	// Enden der Linie abrunden
	ctx.lineCap = "round";
	// Ecken (Verbindungen zwischen zwei Linien) abrunden
	//ctx.lineJoin = "round";

	ctx.stroke();
}
