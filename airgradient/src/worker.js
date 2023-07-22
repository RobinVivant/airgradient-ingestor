import {Hono} from 'hono'
import {zValidator} from '@hono/zod-validator'
import {z} from 'zod'

const app = new Hono();

app.post('/sensors/:id/measures',
	zValidator(
		'json',
		z.object({
			wifi: z.number(),
			rco2: z.number(),
			pm02: z.number(),
			tvoc_index: z.number(),
			nox_index: z.number(),
			atmp: z.number(),
			rhum: z.number()
		})
	),
	async c => {
		const {id} = c.req.param()
		const body = c.req.valid('json')
		console.log(id, body)

		const {wifi, rco2, pm02, tvoc_index, nox_index, atmp, rhum} = body;
		const {success} = await c.env.DB.prepare(`
			insert into sensor_measures (sensor_id, ts, wifi, rco2, pm02, tvoc_index, nox_index, atmp, rhum)
			values (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(id, Date.now(), wifi, rco2, pm02, tvoc_index, nox_index, atmp, rhum).run();

		if (success) {
			c.status(201)
			return c.text("Created");
		} else {
			c.status(500)
			return c.text("Something went wrong");
		}
	})

app.get('/sensors/:id', async c => {
	const {id} = c.req.param();
	let start = c.req.query('start') || Date.now() - 24 * 60 * 60 * 1000; // Default to past 24 hours
	let end = c.req.query('end') || Date.now(); // Default to current time

	start = parseInt(start);
	end = parseInt(end);

	const {results} = await c.env.DB.prepare(`
		select *
		from sensor_measures
		where sensor_id = ?
			and ts >= ?
			and ts <= ?
		order by ts asc
	`).bind(id, start, end).all();  // fetch data between the start and end timestamp

	return c.json(results);
});


app.get('/sensors/:id/chart', async c => {
	const {id} = c.req.param();

	const html = `
		<!doctype html>
		<html>
		<head>
			<title>Sensor ${id} Chart</title>
			<style>
			body, html {
				margin: 0;
				height: 100vh;
				display: flex;
				flex-direction: column;
			}

			canvas {
				flex: 1;
				overflow: hidden;
			}

			.gauges {
			 display: flex;
			 flex-wrap: wrap;
			 justify-content: space-between;
			 width: 100%;
			}
			.gauge {
				flex: 1;
				text-align: center;
				font-size: 20px;
				padding: 10px;
				background-color: #f0f0f0;
				border-radius: 4px;
				margin: 5px;
				box-shadow: 0 2px 5px rgba(0,0,0,0.15);
				font-family: "Arial Rounded MT", sans-serif;

				/* add the following lines */
				display: flex;
				justify-content: center;
				align-items: center;
				flex-direction: column;
			}
		 </style>
		</head>
		<body>

		<label for="start">Start:</label>
		<input type="datetime-local" id="start" name="start">
		<label for="end">End:</label>
		<input type="datetime-local" id="end" name="end">
		<button id="fetchDataButton">Fetch Data</button>

		<canvas id="myChart"></canvas>

		<div class="gauges">
			<div id="atmpGauge" class="gauge"></div>
			<div id="heatIndexGauge" class="gauge"></div>
			<div id="rhumGauge" class="gauge"></div>
			<div id="rco2Gauge" class="gauge"></div>
			<div id="pm02Gauge" class="gauge"></div>
			<div id="tvoc_indexGauge" class="gauge"></div>
			<div id="nox_indexGauge" class="gauge"></div>
		</div>

		<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.3.0/chart.umd.min.js" integrity="sha512-TJ7U6JRJx5IpyvvO9atNnBzwJIoZDaQnQhb0Wmw32Rj5BQHAmJG16WzaJbDns2Wk5VG6gMt4MytZApZG47rCdg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
		<script>
			let chart;
			let latestTimestamp = 0;

      const fetchDataButton = document.getElementById('fetchDataButton');
			fetchDataButton.addEventListener('click', function() {
			 const startInput = document.getElementById('start')
			 const endInput = document.getElementById('end')
			 const start = startInput.value ? new Date(startInput.value).getTime() : latestTimestamp;
			 const end = endInput.value ? new Date(endInput.value).getTime() : Date.now();

			 if(start > end) {
				alert("Start time must be before end time.");
				return;
			 }

			 latestTimestamp = 0;
       clearInterval(refreshHandle);

			 fetchDataAndUpdateChart(start, end, true);
			});

      function formatDate(d){
					return d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', hour12: false }) + 'h';
			}

      function getColorForValue(value, threshold) {
					const warningRange = 0.2 * threshold;  // tweak this as necessary
					if (value < threshold - warningRange) {
							return 'green';  // Normal
					} else if (value < threshold) {
							return 'orange';  // Warning
					} else {
							return 'red';  // Danger
					}
			}

      function updateGauge(gaugeId, name, unit, value, threshold) {
					const gauge = document.getElementById(gaugeId);
					gauge.textContent =  name + " " + value;
					if(unit) {
							gauge.textContent += ' (' + unit + ')';
					}
					gauge.style.color = getColorForValue(value, threshold);
			}

      function computeHeatIndex(temperature, relativeHumidity) {
					let temperatureInFahrenheit = temperature * 9/5 + 32;
					if (temperatureInFahrenheit < 80 || relativeHumidity < 40) {
							return temperature;
					}
					let heatIndexInFahrenheit = -42.379
							+ 2.04901523 * temperatureInFahrenheit
							+ 10.14333127 * relativeHumidity
							- 0.22475541 * temperatureInFahrenheit * relativeHumidity
							- 0.00683783 * temperatureInFahrenheit * temperatureInFahrenheit
							- 0.05481717 * relativeHumidity * relativeHumidity
							+ 0.00122874 * temperatureInFahrenheit * temperatureInFahrenheit * relativeHumidity
							+ 0.00085282 * temperatureInFahrenheit * relativeHumidity * relativeHumidity
							- 0.00000199 * temperatureInFahrenheit * temperatureInFahrenheit * relativeHumidity * relativeHumidity;
					return (heatIndexInFahrenheit -32) * 5/9;
			}

      let isPageActive = true;
			// Listen for visibility change events
			document.addEventListener("visibilitychange", function() {
				updatePageActiveState(document.hidden);
			}, false);

			function updatePageActiveState(hidden) {
				if(hidden){
					isPageActive = false;
					clearInterval(refreshHandle);
				}
				else {
					isPageActive = true;
					fetchDataAndUpdateChart();
					refreshHandle = setInterval(fetchDataAndUpdateChart, 30000);
				}
			}

			function fetchDataAndUpdateChart(start = latestTimestamp, end = Date.now(), clear = false) {
			 	if(!isPageActive){
					return;
				}

        fetch('/sensors/${id}?start=' + start + '&end=' + end)
					.then(response => response.json())
					.then(data => {
            const newDataTimestamps = data.map(d => d.ts);
						if(newDataTimestamps.length > 0) {
								latestTimestamp = Math.max(...newDataTimestamps);
						}

						if(data.length > 0) {
								const latestData = data[data.length - 1];
								const heatIndex = computeHeatIndex(latestData.atmp, latestData.rhum);
								updateGauge('atmpGauge', 'Temp.', '°C', latestData.atmp, 35);
								updateGauge('heatIndexGauge', 'Perceived Temp.', '°C', heatIndex, 35);
								updateGauge('rhumGauge', 'R. Hum.', '%', latestData.rhum, 60);
								updateGauge('rco2Gauge', 'CO2', 'ppm', latestData.rco2, 1000);
								updateGauge('pm02Gauge', 'PM 2.5', 'μg/m³', latestData.pm02, 25); // WHO 24-hour mean recommendation
								updateGauge('tvoc_indexGauge', 'TVOC', 'ind', latestData.tvoc_index, 300); // German Federal Environmental Agency recommendation
								updateGauge('nox_indexGauge', 'NOx', 'ind', latestData.nox_index, 2); // WHO annual mean recommendation
						}

							if(chart && !clear){
									chart.data.labels.push(...data.map(d => formatDate(new Date(d.ts))));
									chart.data.datasets[0].data.push(...data.map(d => d.atmp));
									chart.data.datasets[1].data.push(...data.map(d => d.rhum));
									chart.data.datasets[2].data.push(...data.map(d => d.wifi));
									chart.data.datasets[3].data.push(...data.map(d => d.rco2));
									chart.data.datasets[4].data.push(...data.map(d => d.pm02));
									chart.data.datasets[5].data.push(...data.map(d => d.tvoc_index));
									chart.data.datasets[6].data.push(...data.map(d => d.nox_index));
                  chart.data.datasets[7].data.push(...data.map(d => computeHeatIndex(d.atmp, d.rhum)));
									chart.update();
							} else {
								const ctx = document.getElementById('myChart').getContext('2d');
                if(chart){
                  chart.destroy();
                }
								 chart = new Chart(ctx, {
										type: 'line',
										options: {
											responsive: true,
    									maintainAspectRatio: false,
											tooltips: {
													mode: 'x',
													intersect: false,
													callbacks: {
															title: function(tooltipItems) {
																	let d = new Date(tooltipItems[0].xLabel * 1000);
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
												labels: data.map(d => formatDate(new Date(d.ts))),
												datasets: [
													{
														label: 'Temp.',
														data: data.map(d => d.atmp),
														borderColor: '#F3C98B',
														pointRadius: 0,
														tension: 0.5
													},
													{
														label: 'R. Hum.',
														data: data.map(d => d.rhum),
														borderColor: '#92C4AF',
														pointRadius: 0,
														tension: 0.5
													},
													{
														label: 'Wifi',
														data: data.map(d => d.wifi),
														borderColor: '#EBA45E',
														pointRadius: 0,
														tension: 0.5,
														hidden: true
													},
													{
														label: 'CO2',
														data: data.map(d => d.rco2),
														borderColor: '#B284BE',
														pointRadius: 0,
														tension: 0.5,
														hidden: true
													},
													{
														label: 'PM2.5',
														data: data.map(d => d.pm02),
														borderColor: '#87A8D0',
														pointRadius: 0,
														tension: 0.5
													},
													{
														label: 'TVOC',
														data: data.map(d => d.tvoc_index),
														borderColor: '#66999B',
														pointRadius: 0,
														tension: 0.5
													},
													{
														label: 'NOx',
														data: data.map(d => d.nox_index),
														borderColor: '#E07C83',
														pointRadius: 0,
														tension: 0.5,
														hidden: true
													},
													{
														label: 'Perceived Temp.',
														data: data.map(d => computeHeatIndex(d.atmp, d.rhum)),
														borderColor: 'rgba(255, 159, 192, 1)', // Feel free to choose any color you prefer
														pointRadius: 0,
														tension: 0.5
													}
												]
											},
									});
							}
					})
					.catch(error => console.error('Error fetching data:', error));
			}

			fetchDataAndUpdateChart(Date.now() - 24 * 60 * 60 * 1000);
			let refreshHandle = setInterval(fetchDataAndUpdateChart, 30000);
		</script>
		</body>
		</html>
	`;

	return c.html(html);
})

export default app
