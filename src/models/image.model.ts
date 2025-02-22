import { Column, Model, Table, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { ProcessingRequest } from './processing-request.model';

interface ImageAttributes {
  id?: string;
  serialNumber: number;
  productName: string;
  inputUrl: string;
  outputUrl: string;
  status: string;
  processingRequestId: string;
  inputSize?: number;
  outputSize?: number;
  compressionRatio?: number;
}

@Table({
  tableName: 'images',
  timestamps: true,
})
export class Image extends Model<ImageAttributes> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare serialNumber: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare productName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare inputUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare outputUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: string;

  @Column({
    type: DataType.BIGINT,
    allowNull: true,
  })
  declare inputSize: number;

  @Column({
    type: DataType.BIGINT,
    allowNull: true,
  })
  declare outputSize: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  declare compressionRatio: number;

  @ForeignKey(() => ProcessingRequest)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare processingRequestId: string;

  @BelongsTo(() => ProcessingRequest)
  processingRequest: ProcessingRequest;
} 