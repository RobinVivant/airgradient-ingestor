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
		label: 'Felt Temp',
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
	aqi: {
		label: 'Air Quality',
		unit: '',
		gaugeColor: '#8B008B',
		visible: true
	}
};

function getTimeRangeInMs(timeRange) {
	const minute = 60 * 1000;
	const hour = 60 * minute;
	const day = 24 * hour;
	const year = 365 * day;
	switch (timeRange) {
		case '15m':
			return 15 * minute;
		case '30m':
			return 30 * minute;
		case '1h':
			return hour;
		case '3h':
			return 3 * hour;
		case '6h':
			return 6 * hour;
		case '12h':
			return 12 * hour;
		case '24h':
			return day;
		case '2d':
			return 2 * day;
		case '7d':
			return 7 * day;
		case '14d':
			return 14 * day;
		case '30d':
			return 30 * day;
		case '1y':
			return year;
		default:
			return hour;
	}
}

function reduceDataPoints(data, targetPoints) {
	if (data.length <= targetPoints) return data;

	const step = Math.floor(data.length / targetPoints);
	return data.filter((_, index) => index % step === 0);
}

function smoothData(data, windowSize) {
  return data.map((point, index, array) => {
    const halfWindow = Math.floor(windowSize / 2);
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(array.length, index + halfWindow + 1);
    const window = array.slice(start, end);
    
    const smoothed = {};
    Object.keys(point).forEach(key => {
      if (typeof point[key] === 'number') {
        const weights = window.map((_, i) => 1 - Math.abs(i - (index - start)) / halfWindow);
        const weightedSum = window.reduce((sum, p, i) => sum + p[key] * weights[i], 0);
        const weightSum = weights.reduce((sum, w) => sum + w, 0);
        smoothed[key] = weightedSum / weightSum;
      } else {
        smoothed[key] = point[key];
      }
    });
    return smoothed;
  });
}

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
		transform: isAnimating ? 'scale(1.05)' : 'scale(1)'
	};

	const displayValue = value !== 'N/A' ?
		(metric === 'rco2' || metric === 'pm02' ?
			Math.round(parseFloat(value))
		: metric === 'atmp' || metric === 'feltTemp' || metric === 'rhum' ?
			parseFloat(value) % 1 === 0 ? parseInt(value) : parseFloat(value).toFixed(1)
		: metric === 'pressure' || metric === 'tvoc_index' || metric === 'nox_index' ?
			parseFloat(value) % 1 === 0 ? parseInt(value) : parseFloat(value).toFixed(1)
		: metric === 'aqi' ?
			getAirQualityLabel(Math.round(parseFloat(value)))
		: parseFloat(value).toFixed(1))
		: 'N/A';

	return (
		<div className="bg-white p-2 sm:p-4 rounded-lg shadow" style={style} onClick={() => onToggle(metric)}>
			<div className="text-xs sm:text-lg font-semibold" style={{ color: gaugeColor }}>
				<RotatingNumber value={displayValue} />
				{value !== 'N/A' && unit}
			</div>
			<div className="text-xs sm:text-sm text-gray-500">{label}</div>
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
		transform: isRotating ? 'rotateX(90deg)' : 'rotateX(0deg)'
	};

	return <span style={style}>{displayValue}</span>;
}

function TimeRangeSelector({ timeRange, onTimeRangeChange }) {
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
		{ value: '1y', label: '1y' }
	];

	return (
		<div className="w-full">
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
		</div>
	);
}

function getAirQualityLabel(aqi) {
	switch(aqi) {
		case 1: return 'Good';
		case 2: return 'Moderate';
		case 3: return 'Unhealthy for Sensitive Groups';
		case 4: return 'Unhealthy';
		case 5: return 'Very Unhealthy';
		case 6: return 'Hazardous';
		default: return 'Unknown';
	}
}

function App() {
	const [data, setData] = React.useState([]);
	const [timeRange, setTimeRange] = React.useState('12h');
	const [visibleMetrics, setVisibleMetrics] = React.useState(
		Object.fromEntries(Object.entries(sensorMetrics).map(([key, value]) => [key, value.visible]))
	);
	const [animatingMetrics, setAnimatingMetrics] = React.useState({});
	const [weatherPrediction, setWeatherPrediction] = React.useState('');

	const svgRef = React.useRef(null);
	const chartContainerRef = React.useRef(null);
	const [currentVersion, setCurrentVersion] = React.useState(null);
	const [newVersionAvailable, setNewVersionAvailable] = React.useState(false);
	const [chartDimensions, setChartDimensions] = React.useState({ width: 0, height: 0 });

	React.useEffect(() => {
		const fetchDataAndVersion = async () => {
			await fetchDataAndUpdateChart();
		};

		fetchDataAndVersion(); // Initial fetch
		const interval = setInterval(fetchDataAndVersion, 30000); // Fetch every 30 seconds

		return () => clearInterval(interval);
	}, [timeRange]);

	React.useEffect(() => {
		if (data.length > 0 && chartDimensions.width > 0 && chartDimensions.height > 0) {
			updateChart();
		}
	}, [data, visibleMetrics, chartDimensions]);

	React.useEffect(() => {
		const resizeObserver = new ResizeObserver(entries => {
			for (let entry of entries) {
				const { width, height } = entry.contentRect;
				setChartDimensions({ width, height });
			}
		});

		if (chartContainerRef.current) {
			resizeObserver.observe(chartContainerRef.current);
		}

		return () => {
			if (chartContainerRef.current) {
				resizeObserver.unobserve(chartContainerRef.current);
			}
		};
	}, []);


	async function fetchDataAndUpdateChart() {
		let start, end;

		end = new Date();
		start = new Date(end - getTimeRangeInMs(timeRange));

		try {
			const response = await fetch(`/sensors/${sensorId}?start=${Math.round(start.getTime() / 1000)}&end=${Math.round(end.getTime() / 1000)}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const { version, data: rawData, weatherPrediction } = await response.json();

			if (!Array.isArray(rawData) || rawData.length === 0) {
				console.warn('Received empty or invalid data');
				return; // Exit the function early
			}

			// Check if version has changed
			if (currentVersion === null) {
				setCurrentVersion(version);
			} else if (currentVersion !== version) {
				console.log('New version detected.');
				setCurrentVersion(version);
				setNewVersionAvailable(true);
			}

			setWeatherPrediction(weatherPrediction);

			let processedData = rawData.map(d => ({
				...d,
				feltTemp: calculateHeatIndex(d.atmp, d.rhum),
				aqi: calculateAirQualityIndex(d.pm02, d.rco2, d.nox_index),
				ts: new Date(d.ts)
			}));

			// Apply smoothing based on time range
			const smoothingFactor = Math.sqrt(getTimeRangeInMs(timeRange) / (15 * 60 * 1000)); // 15 minutes as base
			const windowSize = Math.max(3, Math.round(smoothingFactor * 2) | 1); // Ensure odd number
			processedData = smoothData(processedData, windowSize);

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
		if (!svgRef.current || data.length === 0 || chartDimensions.width === 0 || chartDimensions.height === 0) return;

		const margin = { top: 20, right: 0, bottom: 20, left: 40 };
		const width = chartDimensions.width - margin.left - margin.right;
		const height = chartDimensions.height - margin.top - margin.bottom;

		d3.select(svgRef.current).selectAll('*').remove();

		const svg = d3.select(svgRef.current)
			.attr('width', chartDimensions.width)
			.attr('height', chartDimensions.height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

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
			.ticks(5)
			.tickFormat(d => {
				const format = d3.timeFormat('%b %d %H:%M');
				return format(new Date(d.getTime() - d.getTimezoneOffset() * 60000));
			});

		svg.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(xAxis)
			.selectAll('text')
			.style('text-anchor', 'middle')
			.attr('dy', '1em')
			.style('font-size', '10px');

		svg.append('g')
			.call(d3.axisLeft(y))
			.selectAll('text')
			.style('font-size', '10px');

		visibleMetricKeys.forEach(metric => {
			const line = d3.line()
				.x(d => x(d.ts))
				.y(d => y(d[metric]))
				.curve(d3.curveMonotoneX);

			svg.append('path')
				.datum(data)
				.attr('fill', 'none')
				.attr('stroke', sensorMetrics[metric].gaugeColor)
				.attr('stroke-width', 1.5)
				.attr('d', line);
		});

		// Add a vertical line
		const verticalLine = svg.append('line')
			.attr('opacity', 0)
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', 'black')
			.attr('stroke-width', 1)
			.attr('pointer-events', 'none');

		// Add a tooltip
		const tooltip = d3.select('body').append('div')
			.attr('class', 'tooltip')
			.style('opacity', 0)
			.style('position', 'absolute')
			.style('background-color', 'white')
			.style('border', 'solid')
			.style('border-width', '1px')
			.style('border-radius', '5px')
			.style('padding', '10px')
			.style('pointer-events', 'none')
			.style('transform', 'translate(-50%, -100%)');

		// Create a rect to capture mouse events
		svg.append('rect')
			.attr('width', width)
			.attr('height', height)
			.style('fill', 'none')
			.style('pointer-events', 'all')
			.on('mouseover touchstart', () => {
				verticalLine.attr('opacity', 1);
				tooltip.style('opacity', 1);
			})
			.on('mouseout touchend', () => {
				verticalLine.attr('opacity', 0);
				tooltip.style('opacity', 0);
			})
			.on('mousemove touchmove', (event) => {
				event.preventDefault();
				const [xPos] = d3.pointer(event.type.startsWith('touch') ? event.touches[0] : event, svg.node());
				verticalLine.attr('x1', xPos).attr('x2', xPos);

				const x0 = x.invert(xPos);
				const bisectDate = d3.bisector(d => d.ts).left;
				const i = bisectDate(data, x0, 1);
				const d0 = data[i - 1];
				const d1 = data[i];
				const d = d1 && x0 - d0.ts > d1.ts - x0 ? d1 : d0;

				if (d && d.ts) {
					tooltip.html(`<strong>${new Date(d.ts.getTime() - d.ts.getTimezoneOffset() * 60000).toLocaleString(undefined, {
						month: 'short',
						day: 'numeric',
						hour: 'numeric',
						minute: 'numeric'
					})}</strong><br>${
						visibleMetricKeys.map(metric =>
							`<span style="color:${sensorMetrics[metric].gaugeColor}">${d[metric] !== undefined ? d[metric].toFixed(1) : 'N/A'}${sensorMetrics[metric].unit}</span>`
						).join('<br>')
					}`)
				} else {
					tooltip.html('No data available');
				}
				tooltip.style('left', (event.type.startsWith('touch') ? event.touches[0].pageX : event.pageX) + 'px')
					.style('top', (event.type.startsWith('touch') ? event.touches[0].pageY : event.pageY) - 10 + 'px');
			});
	}

	function toggleChartSeries(metric) {
		setVisibleMetrics(prev => ({
			...prev,
			[metric]: !prev[metric]
		}));
	}


	return (
		<div className="container mx-auto px-4 py-4 sm:py-8 h-screen flex flex-col overflow-hidden">
			{weatherPrediction && (
				<div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-2 mb-4" role="alert">
					<p className="font-bold">{weatherPrediction}</p>
				</div>
			)}
			{newVersionAvailable && (
				<div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
					<p className="font-bold">New Version Available</p>
					<p>A new version of the application is available. Please refresh the page to update.</p>
					<button
						onClick={() => window.location.reload()}
						className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
					>
						Refresh Now
					</button>
				</div>
			)}
			<div className="grid grid-cols-4 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
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

			<div className="mb-4 sm:mb-8">
				<TimeRangeSelector
					timeRange={timeRange}
					onTimeRangeChange={setTimeRange}
				/>
			</div>

			<div id="chartContainer" ref={chartContainerRef} className="bg-white pt-0 px-4 pb-4 rounded-lg shadow flex-grow overflow-hidden"
					 style={{ height: 'calc(100vh - 300px)' }}>
				<svg ref={svgRef}></svg>
			</div>
		</div>
	);
}

ReactDOM.render(<App />, document.getElementById('root'));
