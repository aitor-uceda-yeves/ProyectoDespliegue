const express = require('express');
const pool = require('./db');
const redis = require('./redis');
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(express.json({ limit: '100kb' }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const validId = value => Number.isInteger(Number(value)) && Number(value) > 0;
const clearDashboard = async () => {
  const keys = await redis.keys('dashboard:*');
  if (keys.length) await redis.del(...keys);
};

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  const pong = await redis.ping();
  res.json({ status: 'ok', database: 'connected', redis: pong, service: 'ClubManager API' });
}));

app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  const cached = await redis.get('dashboard:summary');
  if (cached) return res.json(JSON.parse(cached));
  const [players, contracts, injuries, matches, finance, stats] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = $1)::int AS available FROM players', ['Disponible']),
    pool.query("SELECT COALESCE(SUM(annual_salary),0)::float AS payroll FROM contracts WHERE status IN ('Vigente','Renovación')"),
    pool.query("SELECT COUNT(*)::int AS total FROM injuries WHERE status = 'En recuperación'"),
    pool.query("SELECT id, opponent, competition, match_date, venue, goals_for, goals_against, status FROM matches ORDER BY match_date ASC LIMIT 5"),
    pool.query("SELECT COALESCE(SUM(amount) FILTER (WHERE transaction_type='Ingreso'),0)::float AS income, COALESCE(SUM(amount) FILTER (WHERE transaction_type='Gasto'),0)::float AS expenses FROM finance_transactions"),
    pool.query('SELECT COALESCE(SUM(goals),0)::int AS goals, COALESCE(SUM(assists),0)::int AS assists FROM player_stats')
  ]);
  const result = {
    players: players.rows[0], contracts: contracts.rows[0], injuries: injuries.rows[0],
    upcomingMatches: matches.rows, finance: { ...finance.rows[0], balance: finance.rows[0].income - finance.rows[0].expenses },
    performance: stats.rows[0]
  };
  await redis.set('dashboard:summary', JSON.stringify(result), 'EX', 20);
  res.json(result);
}));

app.get('/api/players', asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const position = String(req.query.position || '').trim();
  const values = [], where = [];
  if (q) { values.push(`%${q}%`); where.push(`(p.full_name ILIKE $${values.length} OR p.nationality ILIKE $${values.length})`); }
  if (position && position !== 'Todas') { values.push(position); where.push(`p.position = $${values.length}`); }
  const result = await pool.query(`
    SELECT p.*, c.start_date, c.end_date, c.annual_salary::float, c.signing_bonus::float, c.status AS contract_status
    FROM players p LEFT JOIN LATERAL
      (SELECT * FROM contracts WHERE player_id=p.id ORDER BY id DESC LIMIT 1) c ON TRUE
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.shirt_number`, values);
  res.json(result.rows);
}));

app.post('/api/players', asyncRoute(async (req, res) => {
  const { full_name, shirt_number, position, age, nationality = 'España', foot = 'Derecho', status = 'Disponible' } = req.body || {};
  if (!String(full_name || '').trim() || !validId(shirt_number) || !validId(age) ||
      !['Portero','Defensa','Centrocampista','Extremo','Delantero'].includes(position) ||
      !['Derecho','Zurdo','Ambidiestro'].includes(foot) || !['Disponible','Lesionado','Baja'].includes(status)) {
    return res.status(400).json({ error: 'Revisa nombre, dorsal, edad, posición, pie y estado.' });
  }
  if (Number(shirt_number) > 99 || Number(age) < 15 || Number(age) > 50) return res.status(400).json({ error: 'Dorsal o edad fuera de rango.' });
  const result = await pool.query(
    'INSERT INTO players(full_name,shirt_number,position,age,nationality,foot,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [String(full_name).trim(), Number(shirt_number), position, Number(age), String(nationality).slice(0,80), foot, status]);
  await clearDashboard();
  res.status(201).json(result.rows[0]);
}));

app.put('/api/players/:id', asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
  const { full_name, shirt_number, position, age, nationality, foot, status } = req.body || {};
  if (!String(full_name || '').trim() || !validId(shirt_number) || !validId(age) ||
      !['Portero','Defensa','Centrocampista','Extremo','Delantero'].includes(position) ||
      !['Derecho','Zurdo','Ambidiestro'].includes(foot) || !['Disponible','Lesionado','Baja'].includes(status)) {
    return res.status(400).json({ error: 'Datos del jugador inválidos.' });
  }
  const result = await pool.query(
    'UPDATE players SET full_name=$1,shirt_number=$2,position=$3,age=$4,nationality=$5,foot=$6,status=$7 WHERE id=$8 RETURNING *',
    [String(full_name).trim(), Number(shirt_number), position, Number(age), String(nationality || 'España').slice(0,80), foot, status, Number(req.params.id)]);
  if (!result.rowCount) return res.status(404).json({ error: 'Jugador no encontrado' });
  await clearDashboard();
  res.json(result.rows[0]);
}));

app.delete('/api/players/:id', asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
  const result = await pool.query('DELETE FROM players WHERE id=$1 RETURNING id', [Number(req.params.id)]);
  if (!result.rowCount) return res.status(404).json({ error: 'Jugador no encontrado' });
  await clearDashboard();
  res.json({ deleted: true, id: result.rows[0].id });
}));

const resources = {
  contracts: {
    get: `SELECT c.*, p.full_name AS player_name, p.shirt_number FROM contracts c JOIN players p ON p.id=c.player_id ORDER BY c.end_date`,
    insert: `INSERT INTO contracts(player_id,start_date,end_date,annual_salary,signing_bonus,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    fields: ['player_id','start_date','end_date','annual_salary','signing_bonus','status'],
    required: ['player_id','start_date','end_date','annual_salary'],
    values: b => [Number(b.player_id),b.start_date,b.end_date,Number(b.annual_salary),Number(b.signing_bonus || 0),b.status || 'Vigente']
  },
  training: {
    get: 'SELECT * FROM training_sessions ORDER BY session_date DESC LIMIT 100',
    insert: 'INSERT INTO training_sessions(session_date,session_type,intensity,duration_minutes,attendance,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
    required: ['session_date','session_type'],
    values: b => [b.session_date,b.session_type,Number(b.intensity || 3),Number(b.duration_minutes || 60),Number(b.attendance || 0),String(b.notes || '').slice(0,2000)]
  },
  matches: {
    get: 'SELECT * FROM matches ORDER BY match_date DESC LIMIT 100',
    insert: 'INSERT INTO matches(opponent,competition,match_date,venue,goals_for,goals_against,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    required: ['opponent','competition','match_date','venue'],
    values: b => [b.opponent,b.competition,b.match_date,b.venue,b.goals_for ?? null,b.goals_against ?? null,b.status || 'Programado',String(b.notes || '').slice(0,2000)]
  },
  stats: {
    get: `SELECT s.*,p.full_name AS player_name,p.shirt_number,p.position FROM player_stats s JOIN players p ON p.id=s.player_id ORDER BY s.goals DESC,s.assists DESC`,
    insert: `INSERT INTO player_stats(player_id,season,appearances,minutes,goals,assists,yellow_cards,red_cards) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(player_id,season) DO UPDATE SET appearances=EXCLUDED.appearances,minutes=EXCLUDED.minutes,goals=EXCLUDED.goals,assists=EXCLUDED.assists,yellow_cards=EXCLUDED.yellow_cards,red_cards=EXCLUDED.red_cards RETURNING *`,
    required: ['player_id'],
    values: b => [Number(b.player_id),String(b.season || '2026/27'),Number(b.appearances || 0),Number(b.minutes || 0),Number(b.goals || 0),Number(b.assists || 0),Number(b.yellow_cards || 0),Number(b.red_cards || 0)]
  },
  injuries: {
    get: `SELECT i.*,p.full_name AS player_name,p.shirt_number FROM injuries i JOIN players p ON p.id=i.player_id ORDER BY i.start_date DESC`,
    insert: 'INSERT INTO injuries(player_id,injury_type,start_date,estimated_return,status,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
    required: ['player_id','injury_type','start_date'],
    values: b => [Number(b.player_id),b.injury_type,b.start_date,b.estimated_return || null,b.status || 'En recuperación',String(b.notes || '').slice(0,2000)]
  },
  finance: {
    get: 'SELECT * FROM finance_transactions ORDER BY transaction_date DESC,id DESC LIMIT 200',
    insert: 'INSERT INTO finance_transactions(transaction_type,category,description,amount,transaction_date) VALUES($1,$2,$3,$4,$5) RETURNING *',
    required: ['transaction_type','category','description','amount'],
    values: b => [b.transaction_type,b.category,b.description,Number(b.amount),b.transaction_date || new Date().toISOString().slice(0,10)]
  }
};

for (const [path, config] of Object.entries(resources)) {
  app.get(`/api/${path}`, asyncRoute(async (_req, res) => {
    if (path === 'finance') {
      const result = await pool.query(config.get);
      const summary = await pool.query(`SELECT
        COALESCE(SUM(amount) FILTER(WHERE transaction_type='Ingreso'),0)::float AS income,
        COALESCE(SUM(amount) FILTER(WHERE transaction_type='Gasto'),0)::float AS expenses
        FROM finance_transactions`);
      return res.json({ transactions: result.rows, summary: { ...summary.rows[0], balance: summary.rows[0].income - summary.rows[0].expenses } });
    }
    const result = await pool.query(config.get);
    res.json(result.rows);
  }));
  app.post(`/api/${path}`, asyncRoute(async (req, res) => {
    const body = req.body || {};
    const missing = (config.required || []).filter(key => body[key] === undefined || body[key] === null || body[key] === '');
    if (missing.length) return res.status(400).json({ error: `Campos obligatorios: ${missing.join(', ')}` });
    if (path === 'contracts' && (!validId(body.player_id) || Number(body.annual_salary) < 0 || Number(body.signing_bonus || 0) < 0 || new Date(body.end_date) < new Date(body.start_date))) return res.status(400).json({ error: 'Datos del contrato inválidos' });
    if (path === 'training' && (!['Técnico','Táctico','Físico','Recuperación','Estrategia'].includes(body.session_type) || Number(body.intensity || 3) < 1 || Number(body.intensity || 3) > 5)) return res.status(400).json({ error: 'Tipo o intensidad de entrenamiento inválidos' });
    if (path === 'matches' && (!['Local','Visitante'].includes(body.venue) || !['Programado','Finalizado','Aplazado'].includes(body.status || 'Programado'))) return res.status(400).json({ error: 'Datos del partido inválidos' });
    if (path === 'injuries' && (!validId(body.player_id) || !['En recuperación','Disponible','Recaída'].includes(body.status || 'En recuperación'))) return res.status(400).json({ error: 'Datos de lesión inválidos' });
    if (path === 'finance' && (!['Ingreso','Gasto'].includes(body.transaction_type) || Number(body.amount) <= 0)) return res.status(400).json({ error: 'Tipo o importe financiero inválido' });
    const result = await pool.query(config.insert, config.values(body));
    await clearDashboard();
    res.status(201).json(result.rows[0]);
  }));
}

app.patch('/api/injuries/:id', asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'ID inválido' });
  const { status, estimated_return, notes } = req.body || {};
  if (!['En recuperación','Disponible','Recaída'].includes(status)) return res.status(400).json({ error: 'Estado de lesión inválido' });
  const result = await pool.query(
    'UPDATE injuries SET status=$1,estimated_return=$2,notes=$3 WHERE id=$4 RETURNING *',
    [status, estimated_return || null, String(notes || '').slice(0,2000), Number(req.params.id)]);
  if (!result.rowCount) return res.status(404).json({ error: 'Lesión no encontrada' });
  await pool.query('UPDATE players SET status=$1 WHERE id=$2', [status === 'Disponible' ? 'Disponible' : 'Lesionado', result.rows[0].player_id]);
  await clearDashboard();
  res.json(result.rows[0]);
}));

app.use((err, _req, res, _next) => {
  console.error('API error:', err.message);
  if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos (por ejemplo, dorsal duplicado).' });
  if (err.code === '23503') return res.status(400).json({ error: 'La referencia a un jugador no existe.' });
  if (err.code === '23514' || err.code === '22P02' || err.code === '22007') return res.status(400).json({ error: 'Los datos enviados no cumplen las restricciones.' });
  res.status(500).json({ error: 'Error interno de la API.' });
});
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.listen(PORT, '0.0.0.0', () => console.log(`ClubManager API escuchando en ${PORT}`));
