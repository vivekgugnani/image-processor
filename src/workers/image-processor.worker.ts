import { parentPort, threadId } from 'worker_threads';
import axios from 'axios';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';

interface WorkerData {
  inputUrl: string;
  imageId: string;
  outputDir: string;
}

function log(message: string) {
  console.log(`[Worker ${threadId}] ${message}`);
}

function error(message: string) {
  console.error(`[Worker ${threadId}] ${message}`);
}

async function processImage(data: WorkerData) {
  try {
    log(`Starting to process image ${data.imageId} from ${data.inputUrl}`);
    
    log(`Downloading image ${data.imageId}`);
    const response = await axios.get(data.inputUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    const inputBuffer = Buffer.from(response.data);
    const inputSize = inputBuffer.length;
    log(`Downloaded image ${data.imageId} (${(inputSize / 1024).toFixed(2)} KB)`);

    const outputPath = path.join(data.outputDir, `${data.imageId}.jpg`);
    log(`Processing image ${data.imageId} with Sharp`);
    
    await sharp(inputBuffer)
      .jpeg({
        quality: 30,
        chromaSubsampling: '4:2:0',
        force: true,
        mozjpeg: true
      })
      .resize({
        width: 800,
        height: 800,
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFile(outputPath);

    const outputStats = await fs.stat(outputPath);
    const compressionRatio = ((1 - outputStats.size / inputSize) * 100).toFixed(2);
    log(`Completed processing image ${data.imageId} (${(outputStats.size / 1024).toFixed(2)} KB, ${compressionRatio}% reduction)`);

    return {
      id: data.imageId,
      inputSize,
      outputSize: outputStats.size,
      compressionRatio: parseFloat(compressionRatio),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    error(`Failed to process image ${data.imageId}: ${errorMessage}`);
    throw error;
  }
}

if (parentPort) {
  log('Worker initialized and ready for tasks');
  
  parentPort.on('message', async (data: WorkerData) => {
    try {
      log(`Received task for image ${data.imageId}`);
      const result = await processImage(data);
      log(`Successfully completed processing image ${data.imageId}`);
      parentPort!.postMessage({ success: true, result });
    } catch (err) {
      error(`Error processing image ${data.imageId}`);
      parentPort!.postMessage({ 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
    }
  });
} 