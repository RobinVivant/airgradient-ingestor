const sensorId = '{{__sensorId__}}';

let chart;

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

document.addEventListener('DOMContentLoaded', () => {
	setupEventListeners();
	fetchDataAndUpdateChart();
	startAutoUpdate();
	window.addEventListener('resize', debounce(() => {
		if (chart) {
			chart.resize();
		}
	}, 250));
});

function setupEventListeners() {
	const timeRangeElement = document.getElementById('timeRange');

	if (timeRangeElement) {
		timeRangeElement.addEventListener('change', handleTimeRangeChange);
	} else {
		console.error('Time range element not found');
	}

	// Set up gauge divs as toggle buttons
	Object.keys(sensorMetrics).forEach(metric => {
		const gaugeElement = document.getElementById(`${metric}Gauge`);
		if (gaugeElement) {
			gaugeElement.addEventListener('click', () => toggleChartSeries(metric));
			gaugeElement.style.cursor = 'pointer';
			updateGaugeAppearance(metric, sensorMetrics[metric].visible);
		}
	});

	// Remove the update button from the HTML
	const updateButtonElement = document.getElementById('updateButton');
	if (updateButtonElement) {
		updateButtonElement.remove();
	}
}

function toggleChartSeries(metric) {
	sensorMetrics[metric].visible = !sensorMetrics[metric].visible;
	updateGaugeAppearance(metric, sensorMetrics[metric].visible);
	if (chart) {
		const datasetIndex = chart.data.datasets.findIndex(dataset => dataset.label === sensorMetrics[metric].label);
		if (datasetIndex > -1) {
			chart.setDatasetVisibility(datasetIndex, sensorMetrics[metric].visible);
			chart.update();
		}
	}
}

function updateGaugeAppearance(metric, isVisible) {
	const gaugeElement = document.getElementById(`${metric}Gauge`);
	if (gaugeElement) {
		gaugeElement.style.opacity = isVisible ? '1' : '0.5';
		gaugeElement.style.filter = isVisible ? 'none' : 'grayscale(100%)';
	}
}

function handleTimeRangeChange() {
	const timeRange = document.getElementById('timeRange');
	const customDateRange = document.getElementById('customDateRange');

	if (timeRange && customDateRange) {
		customDateRange.style.display = timeRange.value === 'custom' ? 'block' : 'none';
		if (timeRange.value !== 'custom') {
			fetchDataAndUpdateChart();
		}
	} else {
		console.error('Time range or custom date range elements not found');
	}
}

let updateInterval;

function startAutoUpdate() {
	// Clear any existing interval
	if (updateInterval) {
		clearInterval(updateInterval);
	}

	// Set new interval to update every 30 seconds
	updateInterval = setInterval(() => {
		fetchDataAndUpdateChart();
	}, 30000);
}

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

async function fetchDataAndUpdateChart() {
	const timeRange = document.getElementById('timeRange');
	const startDate = document.getElementById('startDate');
	const endDate = document.getElementById('endDate');

	let start, end;

	if (timeRange.value === 'custom' && startDate && endDate) {
		start = new Date(startDate.value).getTime();
		end = new Date(endDate.value).getTime();
	} else {
		end = Date.now();
		start = end - getTimeRangeInMs(timeRange.value);
	}

	try {
		const response = await fetch(`/sensors/${sensorId}?start=${Math.round(start / 1000)}&end=${Math.round(end / 1000)}`);
		const data = await response.json();

		const reducedData = reduceDataPoints(data, 100); // Reduce to about 100 data points
		const processedData = reducedData.map(d => ({
			...d,
			feltTemp: calculateHeatIndex(d.atmp, d.rhum)
		}));

		updateGauges(processedData[processedData.length - 1]);
		updateChart(processedData);
	} catch (error) {
		console.error('Error fetching or processing data:', error);
	}
}

function reduceDataPoints(data, targetPoints) {
	if (data.length <= targetPoints) return data;

	const step = Math.floor(data.length / targetPoints);
	return data.filter((_, index) => index % step === 0);
}

function calculateHeatIndex(tempCelsius, relativeHumidity) {
	// Optimized Heat Index calculation
	const t = tempCelsius * 1.8 + 32; // Convert to Fahrenheit
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

	return Number(((hi - 32) / 1.8).toFixed(1)); // Convert back to Celsius
}

function updateGauges(latestData) {
	Object.keys(sensorMetrics).forEach(metric => {
		const gaugeElement = document.getElementById(`${metric}Gauge`);
		if (gaugeElement) {
			let value = 'N/A';
			if (latestData[metric] !== undefined && latestData[metric] !== null) {
				if (typeof latestData[metric] === 'number') {
					value = latestData[metric].toFixed(1);
				} else {
					console.warn(`Metric ${metric} is not a number:`, latestData[metric]);
					value = latestData[metric].toString();
				}
			}
			updateGauge(gaugeElement, sensorMetrics[metric].label, `${value}${sensorMetrics[metric].unit}`);
		} else {
			console.warn(`Gauge element for ${metric} not found`);
		}
	});
}

function updateGauge(gaugeElement, label, value) {
	const metric = gaugeElement.id.replace('Gauge', '');
	gaugeElement.innerHTML = `
        <div class="text-lg font-semibold" style="color: ${sensorMetrics[metric].gaugeColor}">${value}</div>
        <div class="text-sm text-gray-500">${label}</div>
    `;
}

function updateChart(data) {
	const chartElement = document.getElementById('airQualityChart');
	if (!chartElement) {
		console.error('Chart element not found');
		return;
	}

	const ctx = chartElement.getContext('2d');

	if (chart) {
		chart.destroy();
	}

	chart = new Chart(ctx, {
		type: 'line',
		data: {
			labels: data.map(d => new Date(d.ts)),
			datasets: Object.keys(sensorMetrics).map(metric =>
				createDataset(sensorMetrics[metric].label, data.map(d => {
					const value = d[metric];
					if (typeof value === 'number') {
						return value;
					} else if (typeof value === 'string') {
						const parsed = parseFloat(value);
						if (!isNaN(parsed)) {
							return parsed;
						}
					}
					console.warn(`Metric ${metric} is not a valid number:`, value);
					return null;
				}), sensorMetrics[metric].gaugeColor, !sensorMetrics[metric].visible)
			)
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: {
				duration: 0 // Disable all animations
			},
			hover: {
				animationDuration: 0 // Disable animations on hover
			},
			responsiveAnimationDuration: 0, // Disable animations on resize
			scales: {
				x: {
					type: 'time',
					time: {
						unit: 'hour',
						displayFormats: {
							hour: 'MMM d, HH:mm'
						},
						tooltipFormat: 'MMM d, yyyy HH:mm'
					},
					title: {
						display: false
					},
					ticks: {
						source: 'auto',
						autoSkip: true,
						maxRotation: 0,
						major: {
							enabled: true
						},
						font: function(context) {
							if (context.tick && context.tick.major) {
								return {
									weight: 'bold'
								};
							}
						}
					},
					adapters: {
						date: {
							zone: 'local' // This ensures local timezone is used
						}
					}
				},
				y: {
					beginAtZero: false,
					title: {
						display: false
					}
				}
			},
			plugins: {
				legend: {
					display: false // Remove the legend
				},
				tooltip: {
					mode: 'index',
					intersect: false,
					animation: {
						duration: 0 // Disable tooltip animations
					}
				}
			},
			elements: {
				point: {
					radius: 0
				},
				line: {
					borderWidth: 1
				}
			},
			transitions: {
				active: {
					animation: {
						duration: 0 // Disable transitions when hovering
					}
				}
			}
		}
	});

	// Ensure chart visibility matches sensorMetrics visibility
	chart.data.datasets.forEach((dataset, index) => {
		const metric = Object.keys(sensorMetrics).find(key => sensorMetrics[key].label === dataset.label);
		if (metric) {
			chart.setDatasetVisibility(index, sensorMetrics[metric].visible);
		}
	});

	chart.update();
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

function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}
