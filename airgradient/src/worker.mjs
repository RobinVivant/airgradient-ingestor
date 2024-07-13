import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import clientJs from './client.jsx';
import clientHtml from './client.html';
import openapiYaml from './openapi.yaml';
import aiPluginJson from './ai-plugin.json';

const app = new Hono();

app.get('/ws', (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();
  server.addEventListener('message', (event) => {
    console.log('Received message:', event.data);
    server.send('Echo: ' + event.data);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});

// Add a version endpoint
app.get('/version', (c) => {
  return c.json({ version: c.env.CF_PAGES_COMMIT_SHA || 'development' });
});

app.use(async (c, next) => {
	try {
		await next();
	} catch (err) {
		console.error(err);
		throw err;
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
		WHERE timestamp >= toDateTime(?)
			AND timestamp <= toDateTime(?)
		ORDER BY ts ASC
	`;

	const API = `https://api.cloudflare.com/client/v4/accounts/${c.env.ACCOUNT_ID}/analytics_engine/sql`;
	const queryResponse = await fetch(API, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${c.env.API_TOKEN}`
		},
		body: JSON.stringify({
			params: [start, end],
			sql: query
		})
	});

	if (queryResponse.status !== 200) {
		console.error('Error querying:', await queryResponse.text());
		return c.json({ error: 'An error occurred while fetching data' }, 500);
	}

	const queryJSON = await queryResponse.json();
	return c.json(queryJSON.data);
});

app.get('/sensors/:id/chart', async c => {
	const { id } = c.req.param();
	const html = clientHtml.replace('\'{{__clientJs__}}\'', clientJs.replace('{{__sensorId__}}', id));
	return c.html(html);
});

export default app;
