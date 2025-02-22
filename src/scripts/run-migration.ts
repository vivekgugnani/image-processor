import { Sequelize } from 'sequelize-typescript';
import databaseConfig from '../config/database.config';
import { up } from '../migrations/20250223-add-size-columns-to-images';

async function runMigration() {
  const config = databaseConfig();
  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    dialectOptions: config.dialectOptions,
  });

  try {
    await up(sequelize.getQueryInterface());
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
  }
}

runMigration(); 