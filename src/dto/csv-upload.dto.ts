import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CsvUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'CSV file containing image URLs to process',
  })
  file: Express.Multer.File;

  @ApiProperty({
    description: 'Optional webhook URL to notify when processing is complete',
    required: false,
    example: 'https://your-webhook.com/callback',
  })
  @IsOptional()
  @IsUrl()
  @IsString()
  webhookUrl?: string;
} 