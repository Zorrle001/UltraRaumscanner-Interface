enum CONNECTION_STATE_ENUM {
	DISCONNECTED,
	CONNECTING,
	CONNECTED,
}

let state = CONNECTION_STATE_ENUM.CONNECTING;
const ws = new WebSocket("ws://192.168.137.1:5000");
console.log("SCRIPT");

const connectionLabel = document.getElementById(
	"connectionLabel",
) as HTMLElement;

ws.onopen = () => {
	state = CONNECTION_STATE_ENUM.CONNECTED;
	console.log("WebSocket opened!");
	connectionLabel.textContent = "Verbunden 🟢";
};

let lastT = performance.now();

ws.onmessage = async (e) => {
	const json = JSON.parse(e.data);
	//console.log("Recieved message:", e, json);

	if (json == undefined || json.id == undefined) return;

	if (json.id == "points") {
		//console.log(json.data.points);
		for (const point of json.data.points) {
			(globalThis as any).MAP_POINTS.push(point);
		}
		render();
	} else if (json.id == "car") {
		let nowT = performance.now();
		//console.log("deltaT", nowT - lastT);
		lastT = nowT;

		//console.log("CAR", json.data);
		//console.log(json.data.x, json.data.y);
		setPublicRoboPosition(
			json.data.x,
			json.data.y,
			radientToDegree(json.data.angle),
		);

		//drawEverything();
	} else {
		console.error("Message ID is unknown");
	}
};

ws.onclose = () => {
	state = CONNECTION_STATE_ENUM.DISCONNECTED;
	connectionLabel.textContent = "Verbindungsfehler 🔴";
};

ws.onerror = (e) => {
	console.error(e);
};
