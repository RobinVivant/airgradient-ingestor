# AirGradient Ingestor

This project is a comprehensive solution for ingesting, processing, and visualizing data from AirGradient sensors. It uses Cloudflare Workers for serverless deployment and provides a real-time dashboard for monitoring air quality metrics.

## About AirGradient Sensors

AirGradient provides high-quality, open-source air quality monitors for indoor and outdoor use. The AirGradient ONE (Model I-9PSL) is an indoor air quality monitor that measures:

- PM1, PM2.5, and PM10 (particulate matter)
- CO2 (carbon dioxide)
- TVOCs (Total Volatile Organic Compounds)
- NOx (nitrogen oxides)
- Temperature
- Humidity

Key features of AirGradient sensors include:

- High-quality sensor modules from industry leaders like SenseAir, Sensirion, and Plantower
- Multi-step testing and calibration process for high accuracy
- NDIR technology for CO2 measurements with automatic baseline calibration
- Laser scattering technology for particulate matter measurements
- Factory-calibrated sensors
- Built-in OLED display and programmable RGB LEDs
- WiFi connectivity for data transmission
- Open-source design allowing for customization and extensions

## Features of this Project

- Data ingestion from AirGradient sensors
- Real-time data processing and storage using Cloudflare Workers and Analytics Engine
- Interactive dashboard for visualizing air quality metrics
- Weather prediction based on sensor data
- Responsive design for both desktop and mobile devices
- Support for Home Assistant integration

## Tech Stack

- **Backend**: Cloudflare Workers (JavaScript)
- **Frontend**: React.js
- **Data Visualization**: D3.js
- **Build Tool**: Rollup.js
- **API**: Hono framework
- **Data Validation**: Zod

## Project Structure

- `airgradient/`: Main project directory
  - `src/`: Source code
    - `worker.mjs`: Main worker script (backend)
    - `client.jsx`: React components for the dashboard
    - `client.html`: HTML template for the dashboard
    - `db-init.sql`: SQL script for initializing the database
  - `dist/`: Compiled and minified code (generated on build)
  - `wrangler.toml`: Configuration file for Cloudflare Workers
  - `package.json`: Node.js dependencies and scripts
  - `rollup.config.js`: Rollup configuration for building the project

## Setup and Deployment

1. Install dependencies:
   ```
   npm install
   ```

2. Build the project:
   ```
   npm run build
   ```

3. Deploy to Cloudflare Workers:
   ```
   npm run deploy
   ```

4. For local development:
   ```
   npm run start
   ```

## API Endpoints

- `POST /sensors/:id/measures`: Ingest sensor data
- `GET /sensors/:id`: Retrieve sensor data for a specific time range
- `GET /sensors/:id/chart`: Render the dashboard for a specific sensor

## Dashboard

The dashboard provides real-time visualization of various air quality metrics:

- Temperature
- Felt Temperature
- Humidity
- Pressure
- CO2 levels
- PM2.5 levels
- TVOC Index
- Air Quality Index

It also includes a weather prediction feature based on the collected data.

## Open Source and Community

AirGradient is committed to open-source principles:

- All code, schematics, and 3D files are published under CC-BY-SA 4.0 license
- Users own their data and have full flexibility in monitoring and using it
- Partnership with openAQ for open air quality data
- Active community engagement and support for educational and research projects

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open-source and available under the [MIT License](LICENSE).
