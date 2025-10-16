const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.database);

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
  query,
  getClient,
  pool
};
