import 'dotenv/config';
import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
  options: '-c search_path=questoes,public', connectionTimeoutMillis: 5000 });
pool.on('error', (error) => console.error('Conexão ociosa encerrada; o pool criará outra conexão:', error.message));
