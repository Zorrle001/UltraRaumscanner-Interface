function detailed_origin_scaling(oldScale: number, newScale: number) {
	// Zurückrechnen auf rotierte x,y koordinaten
	let rx_old = width / 2 - canvas_originX;
	let ry_old = height / 2 - canvas_originY;

	// Zurückrotieren -> negativer mapRotation winkel
	const { x: x_old, y: y_old } = rotatePoint(
		rx_old,
		ry_old,
		0,
		0,
		-mapRotation,
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
		mapRotation,
	);

	// DIE ROTATIONS HEBEN SICH AUF -> KÜRZBAR AUF:
	const k = newScale / oldScale;

	canvas_originX = width / 2 - (width / 2 - canvas_originX) * k;
	canvas_originY = height / 2 - (height / 2 - canvas_originY) * k;
}
