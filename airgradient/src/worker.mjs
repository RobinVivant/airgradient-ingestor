import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import clientJs from './client.jsx';
import clientHtml from './client.html';
const app = new Hono();

function predictWeather(pastDayData) {
    const predictions = [
        "Settled fine", "Fine weather", "Becoming fine",
        "Fine, becoming less settled", "Fine, possible showers",
        "Fairly fine, improving", "Fairly fine, possible showers",
        "Showery, becoming more unsettled", "Unsettled, rain later",
        "Unsettled, rain at times", "Rain at times, worse later",
        "Rain at times, becoming very unsettled"
    ];

    // Calculate trends
    const pressureTrend = pastDayData[pastDayData.length - 1].pressure - pastDayData[0].pressure;
    const temperatureTrend = pastDayData[pastDayData.length - 1].atmp - pastDayData[0].atmp;
    const humidityTrend = pastDayData[pastDayData.length - 1].rhum - pastDayData[0].rhum;

    // Get current values
    const currentPressure = pastDayData[pastDayData.length - 1].pressure;
    const currentTemperature = pastDayData[pastDayData.length - 1].atmp;
    const currentHumidity = pastDayData[pastDayData.length - 1].rhum;

    // Get current date
    const currentDate = new Date();
    const month = currentDate.getMonth();  // 0-11

    // Determine season (Northern Hemisphere)
    let season;
    if (month >= 2 && month <= 4) season = "spring";
    else if (month >= 5 && month <= 7) season = "summer";
    else if (month >= 8 && month <= 10) season = "autumn";
    else season = "winter";

    // Calculate base index
    let index = Math.floor((currentPressure - 950) / 10);
    index = Math.max(0, Math.min(index, 11));

    // Adjust for pressure trend
    if (pressureTrend > 2) index -= 2;
    else if (pressureTrend < -2) index += 2;

    // Adjust for temperature trend
    if (temperatureTrend > 5) index -= 1;
    else if (temperatureTrend < -5) index += 1;

    // Adjust for humidity trend
    if (humidityTrend > 10) index += 1;
    else if (humidityTrend < -10) index -= 1;

    // Adjust for current conditions
    if (currentTemperature > 25 && currentHumidity > 70) index += 1;  // Hot and humid
    else if (currentTemperature < 10 && currentHumidity > 80) index += 1;  // Cold and damp

    // Seasonal adjustments
    if (season === "summer" && index < 4) index += 1;  // More likely to be unsettled in summer
    else if (season === "winter" && index > 8) index -= 1;  // More likely to be settled in winter

    index = Math.max(0, Math.min(index, 11));

    return predictions[index];
}


app.use(async (c, next) => {
	try {
		await next();
	} catch (err) {
		console.error(err);
		throw err;
	}
});

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
			rhum: z.number(),
			pressure: z.number()
		})
	),
	async c => {
		const { id } = c.req.param();
		const body = c.req.valid('json');

		const { wifi, rco2, pm02, tvoc_index, nox_index, atmp, rhum, pressure } = body;

		try {
			await c.env.MEASURES.writeDataPoint({
				'doubles': [wifi, rco2, pm02, tvoc_index, nox_index, atmp, rhum, pressure],
				'indexes': [id.split(':')[1]]
			});

			c.status(201);
			return c.json({ message: 'Data point created successfully' });
		} catch (error) {
			console.error('Error writing data point:', error);
			return c.json({ error: 'Failed to write data point' }, 500);
		}
	});

app.get('/sensors/:id', async c => {
	const { id } = c.req.param();
	let start = parseInt(c.req.query('start')) || (Date.now() - 24 * 60 * 60 * 1000) / 1000; // Default to 24 hours ago
	let end = parseInt(c.req.query('end')) || (Date.now() / 1000);

	start = Math.round(start);
	end = Math.round(end);

	const query = `
		SELECT
			toDateTime(intDiv(toUInt32(timestamp), 900) * 900) AS ts,
			avg(double1) AS wifi,
			avg(double2) AS rco2,
			avg(double3) AS pm02,
			avg(double4) AS tvoc_index,
			avg(double5) AS nox_index,
			avg(double6) AS atmp,
			avg(double7) AS rhum,
			avg(double8) AS pressure
		FROM MEASURES
		WHERE timestamp >= toDateTime(${start})
			AND timestamp <= toDateTime(${end})
		GROUP BY ts
		ORDER BY ts ASC
	`;

	const API = `https://api.cloudflare.com/client/v4/accounts/${c.env.ACCOUNT_ID}/analytics_engine/sql`;
	const queryResponse = await fetch(API, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${c.env.API_TOKEN}`
		},
		body: query
	});

	if (queryResponse.status !== 200) {
		const errorText = await queryResponse.text();
		console.error('Error querying:', errorText);
		return c.json({ error: 'An error occurred while fetching data', details: errorText }, 500);
	}

	try {
		const queryJSON = await queryResponse.json();
		const data = queryJSON.data;

		// Predict weather for the next 24 hours
		const weatherPrediction = predictWeather(data);

		const processedData = data.map(d => ({
			...d,
			aqi: calculateAirQualityIndex(d.pm02, d.rco2, d.nox_index)
		}));

		return c.json({
			version: c.env.APP_VERSION,
			data: processedData,
			weatherPrediction: weatherPrediction
		});

		function calculateAirQualityIndex(pm25, co2, nox) {
			// PM2.5 index
			let pm25Index;
			if (pm25 <= 12) pm25Index = 1;
			else if (pm25 <= 35.4) pm25Index = 2;
			else if (pm25 <= 55.4) pm25Index = 3;
			else if (pm25 <= 150.4) pm25Index = 4;
			else if (pm25 <= 250.4) pm25Index = 5;
			else pm25Index = 6;

			// CO2 index
			let co2Index;
			if (co2 <= 1000) co2Index = 1;
			else if (co2 <= 2000) co2Index = 2;
			else if (co2 <= 5000) co2Index = 3;
			else if (co2 <= 10000) co2Index = 4;
			else if (co2 <= 40000) co2Index = 5;
			else co2Index = 6;

			// NOx index
			let noxIndex;
			if (nox <= 1) noxIndex = 1;
			else if (nox <= 2) noxIndex = 2;
			else if (nox <= 3) noxIndex = 3;
			else if (nox <= 4) noxIndex = 4;
			else if (nox <= 5) noxIndex = 5;
			else noxIndex = 6;

			// Overall index (worst of the three)
			return Math.max(pm25Index, co2Index, noxIndex);
		}
	} catch (error) {
		console.error('Error parsing JSON:', error);
		return c.json({ error: 'An error occurred while parsing data', details: error.message }, 500);
	}
});

app.get('/sensors/:id/chart', async c => {
	const { id } = c.req.param();
	const html = clientHtml.replace('\'{{__clientJs__}}\'', clientJs.replace('{{__sensorId__}}', id));
	return c.html(html);
});

export default app;
