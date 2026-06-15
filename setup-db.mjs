import pg from './node_modules/.pnpm/pg@8.21.0/node_modules/pg/lib/index.js';
const { Client } = pg;

const c = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
});

await c.connect();
console.log('Connected to PostgreSQL as postgres');

await c.query('DROP DATABASE IF EXISTS lifeapp');
await c.query('DROP USER IF EXISTS lifeapp');
await c.query("CREATE USER lifeapp WITH PASSWORD 'lifeapp_secret'");
await c.query('CREATE DATABASE lifeapp OWNER lifeapp');
await c.query('GRANT ALL PRIVILEGES ON DATABASE lifeapp TO lifeapp');
await c.end();
console.log('Done: user lifeapp + database lifeapp created on 127.0.0.1:5432');
