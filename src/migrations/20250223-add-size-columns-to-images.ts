import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('images', 'inputSize', {
    type: DataTypes.BIGINT,
    allowNull: true,
  });

  await queryInterface.addColumn('images', 'outputSize', {
    type: DataTypes.BIGINT,
    allowNull: true,
  });

  await queryInterface.addColumn('images', 'compressionRatio', {
    type: DataTypes.FLOAT,
    allowNull: true,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('images', 'inputSize');
  await queryInterface.removeColumn('images', 'outputSize');
  await queryInterface.removeColumn('images', 'compressionRatio');
} 