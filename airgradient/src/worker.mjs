import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import clientJs from './client.jsx';
import clientHtml from './client.html';
const app = new Hono();

function predictWeather(pressure, pressureTrend, temperature, humidity) {
    // Enhanced Zambretti-inspired algorithm
    const predictions = [
        "Settled fine", "Fine weather", "Becoming fine",
        "Fine, becoming less settled", "Fine, possible showers",
        "Fairly fine, improving", "Fairly fine, possible showers",
        "Showery, becoming more unsettled", "Unsettled, rain later",
        "Unsettled, rain at times", "Rain at times, worse later",
        "Rain at times, becoming very unsettled"
    ];

    // Adjust pressure to sea level
    const seaLevelPressure = pressure;  // Already at sea level

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
    let index = Math.floor((seaLevelPressure - 950) / 10);
    index = Math.max(0, Math.min(index, 11));

    // Adjust for pressure trend
    if (pressureTrend > 0) index -= 2;
    else if (pressureTrend < 0) index += 2;

    // Adjust for temperature and humidity
    if (temperature > 25 && humidity > 70) index += 1;  // Hot and humid
    else if (temperature < 10 && humidity > 80) index += 1;  // Cold and damp

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
	let start = parseInt(c.req.query('start')) || (Date.now() - 60 * 60 * 1000) / 1000;
	let end = parseInt(c.req.query('end')) || (Date.now() / 1000);

	start = Math.round(start);
	end = Math.round(end);

	const timeRange = end - start;
	let interval;

	if (timeRange > 30 * 24 * 60 * 60) { // More than 30 days
		interval = '1 hour';
	} else if (timeRange > 7 * 24 * 60 * 60) { // More than 7 days
		interval = '15 minute';
	} else if (timeRange > 24 * 60 * 60) { // More than 1 day
		interval = '5 minute';
	} else {
		interval = '1 minute';
	}

	let intervalFunction;
	if (interval === '1 hour') {
		intervalFunction = 'toDateTime(intDiv(toUInt32(timestamp), 3600) * 3600)';
	} else if (interval === '15 minute') {
		intervalFunction = 'toDateTime(intDiv(toUInt32(timestamp), 900) * 900)';
	} else if (interval === '5 minute') {
		intervalFunction = 'toDateTime(intDiv(toUInt32(timestamp), 300) * 300)';
	} else { // 1 minute
		intervalFunction = 'toDateTime(intDiv(toUInt32(timestamp), 60) * 60)';
	}

	const query = `
		SELECT
			${intervalFunction} AS ts,
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

		// Calculate pressure trend
		let pressureTrend = 0;
		if (data.length > 1) {
			const lastPressure = data[data.length - 1].pressure;
			const firstPressure = data[0].pressure;
			pressureTrend = lastPressure - firstPressure;
		}

		// Get the latest readings
		const latestData = data.length > 0 ? data[data.length - 1] : { pressure: 1013, atmp: 20, rhum: 50 };
		const latestPressure = latestData.pressure;
		const latestTemperature = latestData.atmp;
		const latestHumidity = latestData.rhum;

		// Predict weather
		const weatherPrediction = predictWeather(latestPressure, pressureTrend, latestTemperature, latestHumidity);

		return c.json({
			version: c.env.APP_VERSION,
			data: data,
			weatherPrediction: weatherPrediction
		});
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
