/** @jsxRuntime classic */
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
	const minute = 60 * 1000;
	const hour = 60 * minute;
	const day = 24 * hour;
	const year = 365 * day;
	switch (timeRange) {
		case '15m': return 15 * minute;
		case '30m': return 30 * minute;
		case '1h': return hour;
		case '3h': return 3 * hour;
		case '6h': return 6 * hour;
		case '12h': return 12 * hour;
		case '24h': return day;
		case '2d': return 2 * day;
		case '7d': return 7 * day;
		case '14d': return 14 * day;
		case '30d': return 30 * day;
		case '1y': return year;
		default: return hour;
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

function Gauge({ metric, value, visible, onToggle, isAnimating }) {
	const { label, unit, gaugeColor } = sensorMetrics[metric];
	const style = {
		opacity: visible ? 1 : 0.5,
		filter: visible ? 'none' : 'grayscale(100%)',
		cursor: 'pointer',
		transition: 'all 0.3s ease',
		transform: isAnimating ? 'scale(1.05)' : 'scale(1)',
	};

	const displayValue = value !== 'N/A' ? 
		(metric === 'pressure' ? parseFloat(value).toFixed(0) : parseFloat(value).toFixed(1)) 
		: 'N/A';

	return (
		<div className="bg-white p-4 rounded-lg shadow" style={style} onClick={() => onToggle(metric)}>
			<div className="text-lg font-semibold" style={{ color: gaugeColor }}>
				<RotatingNumber value={displayValue} />
				{value !== 'N/A' && unit}
			</div>
			<div className="text-sm text-gray-500">{label}</div>
		</div>
	);
}

function RotatingNumber({ value }) {
	const [displayValue, setDisplayValue] = React.useState(value);
	const [isRotating, setIsRotating] = React.useState(false);

	React.useEffect(() => {
		if (value !== displayValue) {
			setIsRotating(true);
			const timer = setTimeout(() => {
				setDisplayValue(value);
				setIsRotating(false);
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [value, displayValue]);

	const style = {
		display: 'inline-block',
		transition: 'all 0.5s',
		transform: isRotating ? 'rotateX(90deg)' : 'rotateX(0deg)',
	};

	return <span style={style}>{displayValue}</span>;
}

function TimeRangeSelector({ timeRange, onTimeRangeChange, startDate, endDate, onStartDateChange, onEndDateChange }) {
	const timeRanges = [
		{ value: '15m', label: '15m' },
		{ value: '30m', label: '30m' },
		{ value: '1h', label: '1h' },
		{ value: '3h', label: '3h' },
		{ value: '6h', label: '6h' },
		{ value: '12h', label: '12h' },
		{ value: '24h', label: '24h' },
		{ value: '2d', label: '2d' },
		{ value: '7d', label: '7d' },
		{ value: '14d', label: '14d' },
		{ value: '30d', label: '30d' },
		{ value: '1y', label: '1y' },
		{ value: 'custom', label: 'Custom' }
	];

	return (
		<div className="w-full space-y-4">
			<div className="flex flex-wrap gap-2">
				{timeRanges.map(({ value, label }) => (
					<button
						key={value}
						onClick={() => onTimeRangeChange(value)}
						className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
							timeRange === value
								? 'bg-indigo-600 text-white'
								: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
						}`}
					>
						{label}
					</button>
				))}
			</div>
			{timeRange === 'custom' && (
				<div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
					<div className="w-full md:w-1/2">
						<label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date:</label>
						<input
							id="startDate"
							type="datetime-local"
							value={startDate ? new Date(startDate).toISOString().slice(0, 16) : ''}
							onChange={(e) => onStartDateChange(new Date(e.target.value).toLocaleString())}
							className="block w-full bg-white border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
						/>
					</div>
					<div className="w-full md:w-1/2">
						<label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">End Date:</label>
						<input
							id="endDate"
							type="datetime-local"
							value={endDate ? new Date(endDate).toISOString().slice(0, 16) : ''}
							onChange={(e) => onEndDateChange(new Date(e.target.value).toLocaleString())}
							className="block w-full bg-white border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
						/>
					</div>
				</div>
			)}
		</div>
	);
}

function App() {
	const [data, setData] = React.useState([]);
	const [timeRange, setTimeRange] = React.useState('1h');
	const [startDate, setStartDate] = React.useState('');
	const [endDate, setEndDate] = React.useState('');
	const [visibleMetrics, setVisibleMetrics] = React.useState(
		Object.fromEntries(Object.entries(sensorMetrics).map(([key, value]) => [key, value.visible]))
	);
	const [animatingMetrics, setAnimatingMetrics] = React.useState({});

	const svgRef = React.useRef(null);
	const [currentVersion, setCurrentVersion] = React.useState(null);
	React.useEffect(() => {
		const fetchDataAndVersion = async () => {
			await fetchDataAndUpdateChart();
			await fetchVersion();
		};

		fetchDataAndVersion(); // Initial fetch
		const interval = setInterval(fetchDataAndVersion, 30000); // Fetch every 30 seconds

		return () => clearInterval(interval);
	}, [timeRange, startDate, endDate]);

	React.useEffect(() => {
		if (data.length > 0) {
			updateChart();
		}
	}, [data, visibleMetrics]);

	async function fetchVersion() {
		try {
			const response = await fetch('/version');
			const { version } = await response.json();
			if (currentVersion && currentVersion !== version) {
				window.location.reload();
			} else {
				setCurrentVersion(version);
			}
		} catch (error) {
			console.error('Error fetching version:', error);
		}
	}

	async function fetchDataAndUpdateChart() {
		let start, end;

		if (timeRange === 'custom' && startDate && endDate) {
			start = new Date(startDate);
			end = new Date(endDate);
		} else {
			end = new Date();
			start = new Date(end - getTimeRangeInMs(timeRange));
		}

		try {
			const response = await fetch(`/sensors/${sensorId}?start=${Math.round(start.getTime() / 1000)}&end=${Math.round(end.getTime() / 1000)}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const rawData = await response.json();

			if (!Array.isArray(rawData) || rawData.length === 0) {
				console.warn('Received empty or invalid data');
				return; // Exit the function early
			}

			const processedData = rawData.map(d => ({
				...d,
				feltTemp: calculateHeatIndex(d.atmp, d.rhum),
				ts: new Date(d.ts)
			}));

			setData(prevData => {
				const newAnimatingMetrics = {};
				if (prevData.length > 0 && processedData.length > 0) {
					Object.keys(sensorMetrics).forEach(metric => {
						if (processedData[processedData.length - 1][metric] !== prevData[prevData.length - 1][metric]) {
							newAnimatingMetrics[metric] = true;
						}
					});
				}
				setAnimatingMetrics(newAnimatingMetrics);
				setTimeout(() => setAnimatingMetrics({}), 1000);
				return processedData;
			});
		} catch (error) {
			console.error('Error fetching or processing data:', error);
			setTimeRange('1h'); // Reset time range to default
		}
	}

	function updateChart() {
		if (!svgRef.current || data.length === 0) return;

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = svgRef.current.clientWidth - margin.left - margin.right;
		const height = svgRef.current.clientHeight - margin.top - margin.bottom;

		d3.select(svgRef.current).selectAll("*").remove();

		const svg = d3.select(svgRef.current)
			.append("svg")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.append("g")
			.attr("transform", `translate(${margin.left},${margin.top})`);

		const visibleMetricKeys = Object.keys(sensorMetrics).filter(metric => visibleMetrics[metric]);

		const x = d3.scaleTime()
			.domain(d3.extent(data, d => d.ts))
			.range([0, width]);

		const y = d3.scaleLinear()
			.domain([
				d3.min(data, d => Math.min(...visibleMetricKeys.map(metric => d[metric]))),
				d3.max(data, d => Math.max(...visibleMetricKeys.map(metric => d[metric])))
			])
			.nice()
			.range([height, 0]);

		const xAxis = d3.axisBottom(x)
			.tickFormat(d => d.toLocaleString(undefined, { 
				month: 'short', 
				day: 'numeric', 
				hour: 'numeric', 
				minute: 'numeric' 
			}));

		svg.append("g")
			.attr("transform", `translate(0,${height})`)
			.call(xAxis)
			.selectAll("text")
			.style("text-anchor", "end")
			.attr("dx", "-.8em")
			.attr("dy", ".15em")
			.attr("transform", "rotate(-45)");

		svg.append("g")
			.call(d3.axisLeft(y));

		visibleMetricKeys.forEach(metric => {
			const line = d3.line()
				.x(d => x(d.ts))
				.y(d => y(d[metric]));

			svg.append("path")
				.datum(data)
				.attr("fill", "none")
				.attr("stroke", sensorMetrics[metric].gaugeColor)
				.attr("stroke-width", 1.5)
				.attr("d", line);
		});
	}

	function toggleChartSeries(metric) {
		setVisibleMetrics(prev => ({
			...prev,
			[metric]: !prev[metric]
		}));
	}

	return (
		<div className="container mx-auto px-4 py-8 h-screen flex flex-col">
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
				{Object.keys(sensorMetrics).map(metric => (
					<Gauge 
						key={metric} 
						metric={metric} 
						value={data.length > 0 && data[data.length - 1][metric] !== undefined ? data[data.length - 1][metric] : 'N/A'} 
						visible={visibleMetrics[metric]}
						onToggle={toggleChartSeries}
						isAnimating={animatingMetrics[metric]}
					/>
				))}
			</div>

			<div className="mb-8">
				<TimeRangeSelector 
					timeRange={timeRange} 
					onTimeRangeChange={setTimeRange}
					startDate={startDate}
					endDate={endDate}
					onStartDateChange={setStartDate}
					onEndDateChange={setEndDate}
				/>
			</div>

			<div id="chartContainer" className="bg-white p-4 rounded-lg shadow flex-grow" style={{ height: 'calc(100vh - 300px)' }}>
				<svg ref={svgRef} width="100%" height="100%"></svg>
			</div>
		</div>
	);
}

ReactDOM.render(<App />, document.getElementById('root'));
