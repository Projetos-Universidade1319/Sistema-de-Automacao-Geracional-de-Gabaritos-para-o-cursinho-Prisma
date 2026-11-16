import 'dotenv/config';
import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.on('connect', (c) => c.query('SET search_path TO questoes, public'));
