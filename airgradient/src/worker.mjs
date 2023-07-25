import {Hono} from 'hono'
import {zValidator} from '@hono/zod-validator'
import {z} from 'zod'
import clientJs from './client.js'
import clientHtml from './client.html'
import openapiYaml from './openapi.yaml'
import aiPluginJson from './ai-plugin.json'


const app = new Hono();

app.use(async (c, next) => {
	try {
		await next(); // Go to the next middleware
	} catch (err) {
		// Log the error
		console.error(err);
		throw err; // Keep throwing the error to let other middleware handle it
	}
});

app.get('/.well-known/ai-plugin.json', async c => {
	return c.json(JSON.parse(aiPluginJson));
});

app.get('/openapi.yaml', async c => {
	return c.text(openapiYaml);
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
		const {id} = c.req.param()
		const body = c.req.valid('json')
		console.log(id, body)

		const {wifi, rco2, pm02, tvoc_index, nox_index, atmp, rhum, pressure} = body;

		c.env.MEASURES.writeDataPoint({
			'doubles': [wifi, rco2, pm02, tvoc_index, nox_index, atmp, rhum, pressure],
			'indexes': [id.split(':')[1]]
		});

		c.status(201)
		return c.text("Created");
	})

app.get('/sensors/:id', async c => {
	const {id} = c.req.param();
	let start = parseInt(c.req.query('start')) || (Date.now() - 60 * 60* 1000)/1000; // Default to past 1 hour
	let end = parseInt(c.req.query('end')) || (Date.now()/1000); // Default to current time

	start = Math.round(start);
	end = Math.round(end);


	const query = `
      SELECT double1 AS wifi,
             double2 AS rco2,
             double3 AS pm02,
             double4 AS tvoc_index,
             double5 AS nox_index,
             double6 AS atmp,
             double7 AS rhum,
             double8 AS pressure, timestamp AS ts
      FROM MEASURES
      WHERE timestamp >= toDateTime(${start})
        AND timestamp <= toDateTime(${end})
      ORDER BY ts ASC
  `;

	const API = `https://api.cloudflare.com/client/v4/accounts/${c.env.ACCOUNT_ID}/analytics_engine/sql`;
	const queryResponse = await fetch(API, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${c.env.API_TOKEN}`,
		},
		body: query,
	});

	if (queryResponse.status !== 200) {
		console.error('Error querying:', await queryResponse.text());
		return new Response('An error occurred!', {status: 500});
	}

	// Read the JSON data from the query response and render the data as HTML.
	const queryJSON = await queryResponse.json();
	return c.json(queryJSON.data);
});


app.get('/sensors/:id/chart', async c => {
	const {id} = c.req.param();
	const html = clientHtml.replace("'{{__clientJs__}}'", clientJs.replace("{{__sensorId__}}", id));
	return c.html(html);
})

app.use(async (c, next) => {
	try {
		await next(); // Go to the next middleware
	} catch (err) {
		// Log the error
		console.error(err);
		throw err; // Keep throwing the error to let other middleware handle it
	}
});
export default app
