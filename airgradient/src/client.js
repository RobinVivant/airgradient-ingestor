const sensorId = "{{__sensorId__}}";
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const gaugeColors = {
	atmpGauge: '#FF4500', // OrangeRed for temperature
	heatIndexGauge: '#FF8C00', // DarkOrange for perceived temperature
	rhumGauge: '#1E90FF', // DodgerBlue for relative humidity
	rco2Gauge: '#228B22', // ForestGreen for CO2 present in the atmosphere
	pm02Gauge: '#8B4513', // SaddleBrown for particulate matter 2.5
	tvoc_indexGauge: '#5F9EA0', // CadetBlue for Total Volatile Organic Compounds
	nox_indexGauge: '#B22222', // FireBrick for Nitrogen Oxides
	wifi: '#8A2BE2', // BlueViolet for WiFi
	pressureGauge: '#000080' // Navy for Pressure
};


let chart;
let latestTimestamp = 1;
let isPageActive = true;
let refreshHandle = setInterval(fetchDataAndUpdateChart, 30000);
const fetchDataButton = document.getElementById('fetchDataButton');

document.getElementById('fetchDataButton').addEventListener('click', onClickFetchDataButton);
document.addEventListener("visibilitychange", onVisibilityChange);

(async () => {
	const ONE_DAY = 24 * 60 * 60 * 1000;
	await fetchDataAndUpdateChart(Date.now() - ONE_DAY);
	setupGauges();
})();

async function onClickFetchDataButton() {
	const start = getTimestampFromInput('start') || latestTimestamp;
	const end = getTimestampFromInput('end') || Date.now();

	if (start > end) {
		alert("Start time must be before end time.");
		return;
	}

	latestTimestamp = 1;
	clearInterval(refreshHandle);

	await fetchDataAndUpdateChart(start, end, true);
}

function onVisibilityChange() {
	updatePageActiveState(document.hidden);
}

function getTimestampFromInput(elementId) {
	const input = document.getElementById(elementId).value;
	return input && new Date(input).getTime();
}

async function setDefaultDateTimeInputs(start, end) {

	const startDateTimeInput = document.getElementById('start');
	const endDateTimeInput = document.getElementById('end');

	const toLocalDateTimeInputString = (timestamp) => {
		const date = new Date(timestamp);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");

		return `${year}-${month}-${day}T${hours}:${minutes}`;
	};

	// Only update start input if it's not the default (latestTimestamp)
	if (latestTimestamp === 1) {
		startDateTimeInput.value = toLocalDateTimeInputString(start);
	}

	// continue updating end input as usual
	endDateTimeInput.value = toLocalDateTimeInputString(end);
}

fetchDataButton.addEventListener('click', function () {
	const startInput = document.getElementById('start')
	const endInput = document.getElementById('end')
	const start = startInput.value ? new Date(startInput.value).getTime() : latestTimestamp;
	const end = endInput.value ? new Date(endInput.value).getTime() : Date.now();

	if (start > end) {
		alert("Start time must be before end time.");
		return;
	}

	latestTimestamp = 1;
	clearInterval(refreshHandle);

	fetchDataAndUpdateChart(start, end, true);
});

function formatDate(d) {
	return d.toLocaleString('en-US', {
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		hour12: false,
		timeZone: timezone
	}) + 'h';
}

function updateGauge(gaugeId, name, unit, value, datasetIndex) {
	const gauge = document.getElementById(gaugeId);
	gauge.innerHTML = `<span class='gauge_name'>${name}</span><span class='gauge_value'>${value} ${unit || ''}</span>`;
	gauge.style.color = ((chart && chart.data.datasets[datasetIndex].hidden) ? "gray" : gaugeColors[gaugeId]) || "gray";
}

function setupGauges() {
	const gauges = ["atmpGauge", "rhumGauge", null, "rco2Gauge", "pm02Gauge", "tvoc_indexGauge", "nox_indexGauge", "heatIndexGauge", "pressureGauge"];
	gauges.forEach((gaugeId, index) => {
		if (!gaugeId) {
			return;
		}
		const gauge = document.getElementById(gaugeId);
		gauge.style.cursor = "pointer";

		if (chart && chart.data.datasets[index] && chart.data.datasets[index].hidden) {
			gauge.style.color = "gray";
		}

		gauge.addEventListener('click', function () {
			if (chart && chart.data.datasets[index]) {
				chart.data.datasets[index].hidden = !chart.data.datasets[index].hidden;
				gauge.style.color = chart.data.datasets[index].hidden ? "gray" : gaugeColors[gaugeId];
				chart.update();
			}
		});

	});
	chart.update();
}

const TO_F_FACTOR = 9 / 5, TO_C_FACTOR = 5 / 9,
	F_OFFSET = 32, MIN_F_TEMP = 80, MIN_HUMIDITY = 40,
	CONSTANT_A = -42.379, CONSTANT_B = 2.04901523,
	CONSTANT_C = 10.14333127, CONSTANT_D = -0.22475541,
	CONSTANT_E = -0.00683783, CONSTANT_F = -0.05481717,
	CONSTANT_G = 0.00122874, CONSTANT_H = 0.00085282,
	CONSTANT_I = -0.00000199;

function computeHeatIndex(temperature, relativeHumidity) {
	let temperatureInFahrenheit = temperature * TO_F_FACTOR + F_OFFSET;
	if (temperatureInFahrenheit < MIN_F_TEMP || relativeHumidity < MIN_HUMIDITY) {
		return temperature;
	}

	let heatIndexInFahrenheit = CONSTANT_A
		+ CONSTANT_B * temperatureInFahrenheit
		+ CONSTANT_C * relativeHumidity
		+ CONSTANT_D * temperatureInFahrenheit * relativeHumidity
		+ CONSTANT_E * temperatureInFahrenheit * temperatureInFahrenheit
		+ CONSTANT_F * relativeHumidity * relativeHumidity
		+ CONSTANT_G * temperatureInFahrenheit * temperatureInFahrenheit * relativeHumidity
		+ CONSTANT_H * temperatureInFahrenheit * relativeHumidity * relativeHumidity
		+ CONSTANT_I * temperatureInFahrenheit * temperatureInFahrenheit * relativeHumidity * relativeHumidity;

	return Number(((heatIndexInFahrenheit - F_OFFSET) * TO_C_FACTOR).toFixed(1));
}

function updatePageActiveState(hidden) {
	if (hidden) {
		isPageActive = false;
		clearInterval(refreshHandle);
	} else {
		isPageActive = true;
		fetchDataAndUpdateChart();
		refreshHandle = setInterval(fetchDataAndUpdateChart, 30000);
	}
}

async function fetchDataAndUpdateChart(start = latestTimestamp, end = Date.now(), clear = false) {
	if (!isPageActive) {
		return;
	}

	const response = await fetch(`/sensors/${sensorId}?start=` + (Math.round(start / 1000)) + '&end=' + (Math.round(end / 1000)));
	const data = await response.json();

	await setDefaultDateTimeInputs(start, end);

	latestTimestamp = end;

	if (data.length > 0) {
		const latestData = data[data.length - 1];
		const heatIndex = computeHeatIndex(latestData.atmp, latestData.rhum);
		updateGauge('atmpGauge', 'Temp.', '°C', latestData.atmp, 0);
		updateGauge('heatIndexGauge', 'Perceived Temp.', '°C', heatIndex, 7);
		updateGauge('rhumGauge', 'R. Hum.', '%', latestData.rhum, 1);
		updateGauge('rco2Gauge', 'CO2', 'ppm', latestData.rco2, 3);
		updateGauge('pm02Gauge', 'PM 2.5', 'μg/m³', latestData.pm02, 4);
		updateGauge('tvoc_indexGauge', 'TVOC', 'ind', latestData.tvoc_index, 5);
		updateGauge('nox_indexGauge', 'NOx', 'ind', latestData.nox_index, 6);
		updateGauge('pressureGauge', 'Pressure', 'hPa', latestData.pressure || -1, 7);
	}

	if (chart && !clear) {
		chart.data.labels.push.apply(chart.data.labels, data.map(d => new Date(d.ts)));
		for (let i = 0; i < 8; i++) {
			switch (i) {
				case 0:
					chart.data.datasets[i].data.push.apply(chart.data.datasets[i].data, data.map(d => d.atmp));
					break;
				case 1:
					chart.data.datasets[i].data.push.apply(chart.data.datasets[i].data, data.map(d => d.rhum));
					break;
				case 2:
					chart.data.datasets[i].data.push.apply(chart.data.datasets[i].data, data.map(d => d.wifi));
					break;
				case 3:
					chart.data.datasets[i].data.push.apply(chart.data.datasets[i].data, data.map(d => d.rco2));
					break;
				case 4:
					chart.data.datasets[i].data.push.apply(chart.data.datasets[i].data, data.map(d => d.pm02));
					break;
				case 5:
					chart.data.datasets[i].data.push.apply(chart.data.datasets[i].data, data.map(d => d.tvoc_index));
					break;
				case 6:
					chart.data.datasets[i].data.push.apply(chart.data.datasets[i].data, data.map(d => d.nox_index));
					break;
				case 7:
					chart.data.datasets[i].data.push.apply(chart.data.datasets[i].data, data.map(d => computeHeatIndex(d.atmp, d.rhum)));
					break;
				case 8:
					chart.data.datasets[i].data.push.apply(chart.data.datasets[i].data, data.map(d => d.pressure || 0));
					break;
				default:
					break;
			}
		}
		chart.update();
	} else {
		const ctx = document.getElementById('myChart').getContext('2d');
		if (chart) {
			chart.destroy();
		}
		const borderWidth = 2;
		chart = new Chart(ctx, {
			type: 'line',
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'nearest',
					axis: 'x',
					intersect: false
				},
				layout: {
					padding: 10
				},
				scales: {
					x: {
						type: 'time',
						ticks: {
							source: 'auto',
							// Disabled rotation for performance
							maxRotation: 0,
							autoSkip: true,
						}
					}
				},
				plugins: {
					decimation: 'lttb',
					legend: {
						display: false
					}
				},
				tooltips: {
					mode: 'x',
					intersect: false,
					callbacks: {
						title: function (tooltipItems) {
							let d = new Date(tooltipItems[0].xLabel);
							return formatDate(d);
						}
					}
				},
				hover: {
					mode: 'x',
					intersect: false,
				}
			},
			data: {
				labels: data.map(d => new Date(d.ts)),
				datasets: [
					{
						label: 'Temp.',
						data: data.map(d => d.atmp),
						borderColor: gaugeColors.atmpGauge,
						pointRadius: 0,
						borderWidth
					},
					{
						label: 'R. Hum.',
						data: data.map(d => d.rhum),
						borderColor: gaugeColors.rhumGauge,
						pointRadius: 0,
						borderWidth
					},
					{
						label: 'Wifi',
						data: data.map(d => d.wifi),
						borderColor: gaugeColors.wifi,
						pointRadius: 0,
						borderWidth,
						hidden: true
					},
					{
						label: 'CO2',
						data: data.map(d => d.rco2),
						borderColor: gaugeColors.rco2Gauge,
						pointRadius: 0,
						borderWidth
					},
					{
						label: 'PM2.5',
						data: data.map(d => d.pm02),
						borderColor: gaugeColors.pm02Gauge,
						pointRadius: 0,
						borderWidth
					},
					{
						label: 'TVOC',
						data: data.map(d => d.tvoc_index),
						borderColor: gaugeColors.tvoc_indexGauge,
						pointRadius: 0,
						borderWidth
					},
					{
						label: 'NOx',
						data: data.map(d => d.nox_index),
						borderColor: gaugeColors.nox_indexGauge,
						pointRadius: 0,
						borderWidth
					},
					{
						label: 'Perceived Temp.',
						data: data.map(d => computeHeatIndex(d.atmp, d.rhum)),
						borderColor: gaugeColors.heatIndexGauge,
						pointRadius: 0,
						borderWidth
					},
					{
						label: 'Pressure',
						data: data.map(d => d.pressure || 0),
						borderColor: gaugeColors.pressureGauge,
						pointRadius: 0,
						borderWidth
					}
				]
			},
		});
	}
}

