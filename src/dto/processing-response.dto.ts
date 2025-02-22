import { ApiProperty } from '@nestjs/swagger';

export class ProcessingRequestDto {
  @ApiProperty({
    description: 'Unique identifier for the processing request',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Name of the product being processed',
    example: 'Sample Product',
  })
  productName: string;

  @ApiProperty({
    description: 'Current status of the processing request',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    example: 'PROCESSING',
  })
  status: string;

  @ApiProperty({
    description: 'Webhook URL for notifications',
    example: 'https://your-webhook.com/callback',
    required: false,
  })
  webhookUrl?: string;

  @ApiProperty({
    description: 'Error message if processing failed',
    required: false,
    example: 'Failed to download image from URL',
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'Timestamp when the request was created',
    example: '2024-03-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the request was last updated',
    example: '2024-03-15T10:35:00Z',
  })
  updatedAt: Date;
}

export class ImageProcessingDto {
  @ApiProperty({
    description: 'Unique identifier for the image',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Serial number of the image in the CSV',
    example: 1,
  })
  serialNumber: number;

  @ApiProperty({
    description: 'Name of the product',
    example: 'Sample Product',
  })
  productName: string;

  @ApiProperty({
    description: 'Original image URL',
    example: 'https://example.com/input.jpg',
  })
  inputUrl: string;

  @ApiProperty({
    description: 'Processed image URL',
    example: 'https://example.com/output.jpg',
    required: false,
  })
  outputUrl?: string;

  @ApiProperty({
    description: 'Processing status of the image',
    enum: ['pending', 'processing', 'completed', 'failed'],
    example: 'completed',
  })
  status: string;

  @ApiProperty({
    description: 'Size of the input image in bytes',
    example: 1024000,
    required: false,
  })
  inputSize?: number;

  @ApiProperty({
    description: 'Size of the output image in bytes',
    example: 512000,
    required: false,
  })
  outputSize?: number;

  @ApiProperty({
    description: 'Compression ratio achieved',
    example: 0.5,
    required: false,
  })
  compressionRatio?: number;
} 