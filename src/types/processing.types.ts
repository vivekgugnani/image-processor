import { ProcessingStatus } from '../models/processing-request.model';

export interface ProcessingStatusResponse {
  id: string;
  status: ProcessingStatus;
  errorMessage?: string;
  productName?: string;
  images: {
    serialNumber: number;
    productName: string;
    inputUrl: string;
    outputUrl: string;
    status: string;
    sizes: {
      input: number;
      output: number;
      compressionRatio: number;
    };
  }[];
}

export interface CsvRecord {
  'S. No.': number;
  'Product Name': string;
  'Input Image Urls': string;
} 