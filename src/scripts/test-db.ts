import { Sequelize } from 'sequelize-typescript';
import databaseConfig from '../config/database.config';

async function testConnection() {
  const config = databaseConfig();
  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    dialectOptions: config.dialectOptions,
    logging: console.log,
  });

  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    const [results] = await sequelize.query('SELECT VERSION()');
    console.log('PostgreSQL Version:', results[0]);
    
    await sequelize.close();
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

testConnection(); 