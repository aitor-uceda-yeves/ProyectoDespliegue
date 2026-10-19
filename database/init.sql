CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  shirt_number INTEGER NOT NULL UNIQUE CHECK (shirt_number BETWEEN 1 AND 99),
  position VARCHAR(30) NOT NULL CHECK (position IN ('Portero','Defensa','Centrocampista','Extremo','Delantero')),
  age INTEGER NOT NULL CHECK (age BETWEEN 15 AND 50),
  nationality VARCHAR(80) NOT NULL DEFAULT 'España',
  foot VARCHAR(12) NOT NULL DEFAULT 'Derecho',
  status VARCHAR(20) NOT NULL DEFAULT 'Disponible' CHECK (status IN ('Disponible','Lesionado','Baja')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  annual_salary NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (annual_salary >= 0),
  signing_bonus NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (signing_bonus >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'Vigente' CHECK (status IN ('Vigente','Renovación','Finalizado')),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id SERIAL PRIMARY KEY,
  session_date TIMESTAMPTZ NOT NULL,
  session_type VARCHAR(60) NOT NULL,
  intensity INTEGER NOT NULL DEFAULT 3 CHECK (intensity BETWEEN 1 AND 5),
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 10 AND 240),
  attendance INTEGER NOT NULL DEFAULT 0 CHECK (attendance >= 0),
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  opponent VARCHAR(120) NOT NULL,
  competition VARCHAR(80) NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  venue VARCHAR(12) NOT NULL CHECK (venue IN ('Local','Visitante')),
  goals_for INTEGER CHECK (goals_for >= 0),
  goals_against INTEGER CHECK (goals_against >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'Programado' CHECK (status IN ('Programado','Finalizado','Aplazado')),
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS player_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season VARCHAR(12) NOT NULL DEFAULT '2026/27',
  appearances INTEGER NOT NULL DEFAULT 0 CHECK (appearances >= 0),
  minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  goals INTEGER NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists INTEGER NOT NULL DEFAULT 0 CHECK (assists >= 0),
  yellow_cards INTEGER NOT NULL DEFAULT 0 CHECK (yellow_cards >= 0),
  red_cards INTEGER NOT NULL DEFAULT 0 CHECK (red_cards >= 0),
  UNIQUE(player_id, season)
);

CREATE TABLE IF NOT EXISTS injuries (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  injury_type VARCHAR(120) NOT NULL,
  start_date DATE NOT NULL,
  estimated_return DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'En recuperación' CHECK (status IN ('En recuperación','Disponible','Recaída')),
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id SERIAL PRIMARY KEY,
  transaction_type VARCHAR(12) NOT NULL CHECK (transaction_type IN ('Ingreso','Gasto')),
  category VARCHAR(60) NOT NULL,
  description VARCHAR(180) NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE
);

INSERT INTO players (full_name, shirt_number, position, age, nationality, foot, status) VALUES
('Mateo Serrano', 1, 'Portero', 28, 'España', 'Derecho', 'Disponible'),
('Iván Robles', 4, 'Defensa', 25, 'España', 'Derecho', 'Disponible'),
('Nicolás Vega', 15, 'Defensa', 22, 'Argentina', 'Zurdo', 'Disponible'),
('Álex Medina', 6, 'Centrocampista', 27, 'España', 'Derecho', 'Disponible'),
('Bruno Salas', 8, 'Centrocampista', 23, 'Uruguay', 'Derecho', 'Disponible'),
('Hugo Campos', 11, 'Extremo', 21, 'España', 'Zurdo', 'Disponible'),
('Dani Roldán', 9, 'Delantero', 26, 'España', 'Derecho', 'Disponible'),
('Leo Duarte', 19, 'Delantero', 20, 'Portugal', 'Zurdo', 'Lesionado')
ON CONFLICT DO NOTHING;

INSERT INTO contracts (player_id, start_date, end_date, annual_salary, signing_bonus, status)
SELECT id, DATE '2025-07-01', DATE '2028-06-30',
       CASE shirt_number WHEN 1 THEN 850000 WHEN 4 THEN 720000 WHEN 15 THEN 500000 WHEN 6 THEN 780000 WHEN 8 THEN 420000 WHEN 11 THEN 360000 WHEN 9 THEN 950000 ELSE 250000 END,
       25000, 'Vigente'
FROM players
ON CONFLICT DO NOTHING;

INSERT INTO matches (opponent, competition, match_date, venue, goals_for, goals_against, status, notes) VALUES
('Atlético Norte', 'Liga', NOW() - INTERVAL '8 days', 'Local', 2, 1, 'Finalizado', 'Victoria con gol en el tramo final.'),
('Deportivo Central', 'Copa', NOW() - INTERVAL '3 days', 'Visitante', 1, 1, 'Finalizado', 'Clasificación pendiente de la vuelta.'),
('Unión del Puerto', 'Liga', NOW() + INTERVAL '3 days', 'Local', NULL, NULL, 'Programado', 'Plan de partido por definir.'),
('Real Sierra', 'Liga', NOW() + INTERVAL '10 days', 'Visitante', NULL, NULL, 'Programado', 'Salida exigente.')
ON CONFLICT DO NOTHING;

INSERT INTO player_stats (player_id, appearances, minutes, goals, assists, yellow_cards, red_cards)
SELECT id,
  CASE shirt_number WHEN 9 THEN 8 WHEN 11 THEN 7 ELSE 6 END,
  CASE shirt_number WHEN 9 THEN 610 WHEN 11 THEN 520 ELSE 450 END,
  CASE shirt_number WHEN 9 THEN 5 WHEN 11 THEN 2 ELSE 0 END,
  CASE shirt_number WHEN 6 THEN 3 WHEN 8 THEN 2 WHEN 11 THEN 2 ELSE 0 END,
  CASE shirt_number WHEN 4 THEN 3 WHEN 6 THEN 2 ELSE 1 END,
  0
FROM players
ON CONFLICT (player_id, season) DO NOTHING;

INSERT INTO injuries (player_id, injury_type, start_date, estimated_return, status, notes)
SELECT id, 'Sobrecarga muscular', CURRENT_DATE - 5, CURRENT_DATE + 8, 'En recuperación', 'Trabajo individual y readaptación progresiva.'
FROM players WHERE shirt_number = 19
ON CONFLICT DO NOTHING;

INSERT INTO finance_transactions (transaction_type, category, description, amount, transaction_date) VALUES
('Ingreso', 'Patrocinio', 'Patrocinador principal — mensualidad', 180000, CURRENT_DATE - 10),
('Ingreso', 'Taquilla', 'Recaudación partido en casa', 42500, CURRENT_DATE - 8),
('Gasto', 'Salarios', 'Nómina deportiva mensual', 310000, CURRENT_DATE - 5),
('Gasto', 'Instalaciones', 'Mantenimiento del campo de entrenamiento', 12500, CURRENT_DATE - 3),
('Gasto', 'Viajes', 'Desplazamiento de competición', 6800, CURRENT_DATE - 2)
ON CONFLICT DO NOTHING;
