/** @jsx React.createElement */
const sensorId = '{{__sensorId__}}';

const sensorMetrics = {
	atmp: {
		label: 'Temperature',
		unit: '°C',
		gaugeColor: '#FF4500',
		visible: true
	},
	feltTemp: {
		label: 'Felt Temperature',
		unit: '°C',
		gaugeColor: '#FF8C00',
		visible: true
	},
	rhum: {
		label: 'Humidity',
		unit: '%',
		gaugeColor: '#1E90FF',
		visible: true
	},
	pressure: {
		label: 'Pressure',
		unit: 'hPa',
		gaugeColor: '#800080',
		visible: false
	},
	rco2: {
		label: 'CO2',
		unit: 'ppm',
		gaugeColor: '#228B22',
		visible: false
	},
	pm02: {
		label: 'PM2.5',
		unit: 'μg/m³',
		gaugeColor: '#8B4513',
		visible: true
	},
	tvoc_index: {
		label: 'TVOC Index',
		unit: '',
		gaugeColor: '#FF1493',
		visible: true
	},
	nox_index: {
		label: 'NOx Index',
		unit: '',
		gaugeColor: '#FF8C00',
		visible: false
	}
};

function getTimeRangeInMs(timeRange) {
	const hour = 60 * 60 * 1000;
	const day = 24 * hour;
	switch (timeRange) {
		case '1h':
			return hour;
		case '24h':
			return day;
		case '7d':
			return 7 * day;
		case '30d':
			return 30 * day;
		default:
			return hour;
	}
}

function reduceDataPoints(data, targetPoints) {
	if (data.length <= targetPoints) return data;

	const step = Math.floor(data.length / targetPoints);
	return data.filter((_, index) => index % step === 0);
}

function calculateHeatIndex(tempCelsius, relativeHumidity) {
	const t = tempCelsius * 1.8 + 32;
	const r = relativeHumidity;

	let hi = 0.5 * (t + 61 + (t - 68) * 1.2 + r * 0.094);

	if (hi > 79) {
		const t2 = t * t;
		const r2 = r * r;
		hi = -42.379 + 2.04901523 * t + 10.14333127 * r
			- 0.22475541 * t * r - 0.00683783 * t2
			- 0.05481717 * r2 + 0.00122874 * t2 * r
			+ 0.00085282 * t * r2 - 0.00000199 * t2 * r2;

		if (r < 13 && t >= 80 && t <= 112) {
			hi -= ((13 - r) * 0.25) * Math.sqrt((17 - Math.abs(t - 95)) * 0.05882);
		} else if (r > 85 && t >= 80 && t <= 87) {
			hi += ((r - 85) * 0.1) * ((87 - t) * 0.2);
		}
	}

	return Number(((hi - 32) / 1.8).toFixed(1));
}

function Gauge({ metric, value }) {
	const { label, unit, gaugeColor, visible } = sensorMetrics[metric];
	const style = {
		opacity: visible ? 1 : 0.5,
		filter: visible ? 'none' : 'grayscale(100%)',
		cursor: 'pointer',
	};

	return (
		<div className="bg-white p-4 rounded-lg shadow" style={style} onClick={() => toggleChartSeries(metric)}>
			<div className="text-lg font-semibold" style={{ color: gaugeColor }}>{value}{unit}</div>
			<div className="text-sm text-gray-500">{label}</div>
		</div>
	);
}

function TimeRangeSelector({ timeRange, onTimeRangeChange }) {
	return (
		<div className="w-full md:w-auto mb-4 md:mb-0">
			<label htmlFor="timeRange" className="block text-sm font-medium text-gray-700 mb-1">Time Range:</label>
			<select
				id="timeRange"
				value={timeRange}
				onChange={(e) => onTimeRangeChange(e.target.value)}
				className="block w-full bg-white border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
			>
				<option value="1h">Last Hour</option>
				<option value="24h">Last 24 Hours</option>
				<option value="7d">Last 7 Days</option>
				<option value="30d">Last 30 Days</option>
				<option value="custom">Custom Range</option>
			</select>
		</div>
	);
}

function CustomDateRange({ startDate, endDate, onStartDateChange, onEndDateChange }) {
	return (
		<div className="w-full md:w-auto">
			<input
				type="datetime-local"
				value={startDate}
				onChange={(e) => onStartDateChange(e.target.value)}
				className="block w-full bg-white border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 mb-2 md:mb-0 md:mr-2"
			/>
			<input
				type="datetime-local"
				value={endDate}
				onChange={(e) => onEndDateChange(e.target.value)}
				className="block w-full bg-white border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
			/>
		</div>
	);
}

function App() {
	const [data, setData] = React.useState([]);
	const [timeRange, setTimeRange] = React.useState('1h');
	const [startDate, setStartDate] = React.useState('');
	const [endDate, setEndDate] = React.useState('');
	const [chart, setChart] = React.useState(null);

	const chartRef = React.useRef(null);

	React.useEffect(() => {
		fetchDataAndUpdateChart();
		const interval = setInterval(fetchDataAndUpdateChart, 30000);
		return () => clearInterval(interval);
	}, [timeRange, startDate, endDate]);

	React.useEffect(() => {
		if (data.length > 0) {
			updateChart();
		}
	}, [data]);

	async function fetchDataAndUpdateChart() {
		let start, end;

		if (timeRange === 'custom' && startDate && endDate) {
			start = new Date(startDate).getTime();
			end = new Date(endDate).getTime();
		} else {
			end = Date.now();
			start = end - getTimeRangeInMs(timeRange);
		}

		try {
			const response = await fetch(`/sensors/${sensorId}?start=${Math.round(start / 1000)}&end=${Math.round(end / 1000)}`);
			const rawData = await response.json();

			const reducedData = reduceDataPoints(rawData, 100);
			const processedData = reducedData.map(d => ({
				...d,
				feltTemp: calculateHeatIndex(d.atmp, d.rhum)
			}));

			setData(processedData);
		} catch (error) {
			console.error('Error fetching or processing data:', error);
		}
	}

	function updateChart() {
		if (!chartRef.current) return;

		const ctx = chartRef.current.getContext('2d');

		if (chart) {
			chart.destroy();
		}

		const newChart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: data.map(d => new Date(d.ts)),
				datasets: Object.keys(sensorMetrics).map(metric =>
					createDataset(sensorMetrics[metric].label, data.map(d => d[metric]), sensorMetrics[metric].gaugeColor, !sensorMetrics[metric].visible)
				)
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: { duration: 0 },
				hover: { animationDuration: 0 },
				responsiveAnimationDuration: 0,
				scales: {
					x: {
						type: 'time',
						time: {
							unit: 'hour',
							displayFormats: { hour: 'MMM d, HH:mm' },
							tooltipFormat: 'MMM d, yyyy HH:mm'
						},
						title: { display: false },
						ticks: {
							source: 'auto',
							autoSkip: true,
							maxRotation: 0,
							major: { enabled: true },
							font: function(context) {
								if (context.tick && context.tick.major) {
									return { weight: 'bold' };
								}
							}
						},
						adapters: {
							date: { zone: 'local' }
						}
					},
					y: {
						beginAtZero: false,
						title: { display: false }
					}
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						mode: 'index',
						intersect: false,
						animation: { duration: 0 }
					}
				},
				elements: {
					point: { radius: 0 },
					line: { borderWidth: 1 }
				},
				transitions: {
					active: { animation: { duration: 0 } }
				}
			}
		});

		setChart(newChart);
	}

	function createDataset(label, data, color, hidden = false) {
		return {
			label: label,
			data: data,
			borderColor: color,
			backgroundColor: 'transparent',
			fill: false,
			tension: 0.1,
			hidden: hidden
		};
	}

	function toggleChartSeries(metric) {
		sensorMetrics[metric].visible = !sensorMetrics[metric].visible;
		if (chart) {
			const datasetIndex = chart.data.datasets.findIndex(dataset => dataset.label === sensorMetrics[metric].label);
			if (datasetIndex > -1) {
				chart.setDatasetVisibility(datasetIndex, sensorMetrics[metric].visible);
				chart.update();
			}
		}
	}

	return (
		<div className="container mx-auto px-4 py-8 h-screen flex flex-col">
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
				{Object.keys(sensorMetrics).map(metric => (
					<Gauge key={metric} metric={metric} value={data.length > 0 ? data[data.length - 1][metric].toFixed(1) : 'N/A'} />
				))}
			</div>

			<div className="flex flex-col md:flex-row justify-between items-center mb-8">
				<TimeRangeSelector timeRange={timeRange} onTimeRangeChange={setTimeRange} />
				{timeRange === 'custom' && (
					<CustomDateRange
						startDate={startDate}
						endDate={endDate}
						onStartDateChange={setStartDate}
						onEndDateChange={setEndDate}
					/>
				)}
			</div>

			<div id="chartContainer" className="bg-white p-4 rounded-lg shadow flex-grow">
				<canvas ref={chartRef} id="airQualityChart"></canvas>
			</div>
		</div>
	);
}

ReactDOM.render(<App />, document.getElementById('root'));
