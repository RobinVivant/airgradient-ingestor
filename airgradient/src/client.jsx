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

function Gauge({ metric, value, visible, onToggle, isAnimating }) {
	const { label, unit, gaugeColor } = sensorMetrics[metric];
	const style = {
		opacity: visible ? 1 : 0.5,
		filter: visible ? 'none' : 'grayscale(100%)',
		cursor: 'pointer',
		transition: 'all 0.3s ease',
		transform: isAnimating ? 'scale(1.05)' : 'scale(1)',
	};

	return (
		<div className="bg-white p-4 rounded-lg shadow" style={style} onClick={() => onToggle(metric)}>
			<div className="text-lg font-semibold" style={{ color: gaugeColor }}>
				<RotatingNumber value={value} />
				{unit}
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
	const [visibleMetrics, setVisibleMetrics] = React.useState(
		Object.fromEntries(Object.entries(sensorMetrics).map(([key, value]) => [key, value.visible]))
	);
	const [animatingMetrics, setAnimatingMetrics] = React.useState({});

	const svgRef = React.useRef(null);
	const [currentVersion, setCurrentVersion] = React.useState(null);


	React.useEffect(() => {
		if (data.length > 0 && svgRef.current) {
			updateChart();
		}
	}, [data, visibleMetrics]);

	React.useEffect(() => {
		function handleResize() {
			if (data.length > 0 && svgRef.current) {
				updateChart();
			}
		}
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [data, visibleMetrics]);

	React.useEffect(() => {
		const fetchDataAndVersion = async () => {
			await fetchDataAndUpdateChart();
			await fetchVersion();
		};

		fetchDataAndVersion(); // Initial fetch
		const interval = setInterval(fetchDataAndVersion, 30000); // Fetch every 30 seconds

		return () => clearInterval(interval);
	}, [timeRange, startDate, endDate]);

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
			start = new Date(startDate).getTime();
			end = new Date(endDate).getTime();
		} else {
			end = Date.now();
			start = end - getTimeRangeInMs(timeRange);
		}

		try {
			const response = await fetch(`/sensors/${sensorId}?start=${Math.round(start / 1000)}&end=${Math.round(end / 1000)}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const rawData = await response.json();

			const reducedData = reduceDataPoints(rawData, 100);
			const processedData = reducedData.map(d => ({
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
			// You might want to set an error state here and display it to the user
		}
	}

	function updateChart() {
		if (!svgRef.current) return;

		const margin = { top: 20, right: 20, bottom: 30, left: 50 };
		const width = svgRef.current.clientWidth - margin.left - margin.right;
		const height = svgRef.current.clientHeight - margin.top - margin.bottom;

		d3.select(svgRef.current).selectAll("*").remove();

		const visibleMetricKeys = Object.keys(sensorMetrics).filter(metric => visibleMetrics[metric]);

		const y = d3.scaleLinear()
			.domain([
				d3.min(data, d => Math.min(...visibleMetricKeys.map(metric => d[metric]))),
				d3.max(data, d => Math.max(...visibleMetricKeys.map(metric => d[metric])))
			])
			.range([height, 0]);

		const svg = d3.select(svgRef.current)
			.append("svg")
			.attr("width", "100%")
			.attr("height", "100%")
			.attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
			.append("g")
			.attr("transform", `translate(${margin.left},${margin.top})`);

		const x = d3.scaleTime()
			.domain(d3.extent(data, d => d.ts))
			.range([0, width]);

		svg.append("g")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(x));

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

		// Add brush functionality
		const brush = d3.brushX()
			.extent([[0, 0], [width, height]])
			.on("end", brushended);

		svg.append("g")
			.attr("class", "brush")
			.call(brush);

		function brushended(event) {
			if (!event.selection) return;
			const [x0, x1] = event.selection.map(x.invert);
			setTimeRange('custom');
			setStartDate(x0.toISOString().slice(0, 16));
			setEndDate(x1.toISOString().slice(0, 16));
			fetchDataAndUpdateChart();
			svg.select(".brush").call(brush.move, null);
		}
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
						value={data.length > 0 ? data[data.length - 1][metric].toFixed(1) : 'N/A'} 
						visible={visibleMetrics[metric]}
						onToggle={toggleChartSeries}
						isAnimating={animatingMetrics[metric]}
					/>
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

			<div id="chartContainer" className="bg-white p-4 rounded-lg shadow flex-grow" style={{ height: 'calc(100vh - 300px)' }}>
				<svg ref={svgRef} width="100%" height="100%"></svg>
			</div>
		</div>
	);
}

ReactDOM.render(<App />, document.getElementById('root'));
