import { Column, Model, Table, DataType, HasMany } from 'sequelize-typescript';
import { Image } from './image.model';

export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

interface ProcessingRequestAttributes {
  id?: string;
  productName?: string;
  status: ProcessingStatus;
  webhookUrl?: string;
  errorMessage?: string;
}

@Table({
  tableName: 'processing_requests',
  timestamps: true,
})
export class ProcessingRequest extends Model<ProcessingRequestAttributes> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare productName: string;

  @Column({
    type: DataType.ENUM(...Object.values(ProcessingStatus)),
    defaultValue: ProcessingStatus.PENDING,
    allowNull: false,
  })
  declare status: ProcessingStatus;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare webhookUrl: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare errorMessage: string;

  @HasMany(() => Image)
  images: Image[];
} 