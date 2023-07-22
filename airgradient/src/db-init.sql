DROP TABLE IF EXISTS sensor_measures;
CREATE TABLE IF NOT EXISTS sensor_measures (
	id integer PRIMARY KEY AUTOINCREMENT,
	sensor_id text NOT NULL,
	ts integer NOT NULL,
	wifi integer,
	rco2 integer,
	pm02 integer,
	tvoc_index integer,
	nox_index integer,
	atmp real,
	rhum integer
);
CREATE INDEX idx_sensor_measures_id ON sensor_measures (sensor_id);
CREATE INDEX idx_sensor_measures_ts ON sensor_measures (ts);
