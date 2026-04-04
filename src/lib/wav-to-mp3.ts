// src/lib/wav-to-mp3.ts
// WAV utilities + MP3 encoding using lamejs (pure JS LAME encoder).
// No native dependencies — works on Vercel serverless.

import { Mp3Encoder } from "lamejs";

/**
 * Extract raw PCM data from a WAV buffer (strips RIFF header).
 * Returns { pcmData, sampleRate, channels, bitsPerSample }.
 */
export function extractPCM(wavBuffer: Buffer): {
  pcmData: Buffer;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
} {
  const view = new DataView(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.byteLength);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);

  // Find the "data" chunk
  let offset = 12;
  while (offset < wavBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === "data") {
      return {
        pcmData: wavBuffer.subarray(offset + 8, offset + 8 + chunkSize),
        sampleRate,
        channels,
        bitsPerSample,
      };
    }
    offset += 8 + chunkSize;
  }
  throw new Error("No data chunk found in WAV");
}

/**
 * Concatenate multiple WAV buffers into one by extracting and merging PCM data.
 * Returns a proper WAV buffer with a single RIFF header.
 */
export function concatenateWavBuffers(wavBuffers: Buffer[]): Buffer {
  if (wavBuffers.length === 0) return Buffer.alloc(0);
  if (wavBuffers.length === 1) return wavBuffers[0];

  const pcmChunks: Buffer[] = [];
  let sampleRate = 0;

  for (const wav of wavBuffers) {
    const { pcmData, sampleRate: sr } = extractPCM(wav);
    pcmChunks.push(pcmData);
    sampleRate = sr;
  }

  const totalPcmSize = pcmChunks.reduce((sum, c) => sum + c.byteLength, 0);

  // Build a proper WAV header
  const header = Buffer.alloc(44);
  const view = new DataView(header.buffer);

  // RIFF header
  header.write("RIFF", 0);
  view.setUint32(4, 36 + totalPcmSize, true);
  header.write("WAVE", 8);

  // fmt chunk
  header.write("fmt ", 12);
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (16-bit mono)
  view.setUint16(32, 2, true);  // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  header.write("data", 36);
  view.setUint32(40, totalPcmSize, true);

  return Buffer.concat([header, ...pcmChunks]);
}

/**
 * Convert a WAV buffer (RIFF 16-bit PCM mono) to MP3 buffer.
 * @param wavBuffer - WAV file buffer with RIFF header
 * @param kbps - MP3 bitrate (default 192 to match previous Azure MP3 output)
 * @returns MP3 buffer
 */
export function wavToMp3(wavBuffer: Buffer, kbps: number = 192): Buffer {
  // Parse WAV header to get sample rate and data offset
  const view = new DataView(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.byteLength);

  // Verify RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== "RIFF") throw new Error("Not a valid WAV file (missing RIFF header)");

  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);

  if (bitsPerSample !== 16) throw new Error(`Expected 16-bit PCM, got ${bitsPerSample}-bit`);
  if (channels !== 1) throw new Error(`Expected mono, got ${channels} channels`);

  // Find the "data" chunk
  let dataOffset = 12; // skip RIFF header
  let dataSize = 0;
  while (dataOffset < wavBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(dataOffset), view.getUint8(dataOffset + 1),
      view.getUint8(dataOffset + 2), view.getUint8(dataOffset + 3)
    );
    const chunkSize = view.getUint32(dataOffset + 4, true);
    if (chunkId === "data") {
      dataOffset += 8;
      dataSize = chunkSize;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  if (dataSize === 0) throw new Error("No data chunk found in WAV file");

  // Extract PCM samples as Int16Array
  const samples = new Int16Array(
    wavBuffer.buffer,
    wavBuffer.byteOffset + dataOffset,
    dataSize / 2
  );

  // Encode to MP3
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const mp3Chunks: Int8Array[] = [];

  // Process in blocks of 1152 samples (LAME frame size)
  const blockSize = 1152;
  for (let i = 0; i < samples.length; i += blockSize) {
    const block = samples.subarray(i, Math.min(i + blockSize, samples.length));
    const mp3Data = encoder.encodeBuffer(block);
    if (mp3Data.length > 0) mp3Chunks.push(mp3Data);
  }

  // Flush remaining
  const mp3End = encoder.flush();
  if (mp3End.length > 0) mp3Chunks.push(mp3End);

  // Concatenate all MP3 chunks
  const totalLength = mp3Chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const mp3Buffer = Buffer.alloc(totalLength);
  let offset = 0;
  for (const chunk of mp3Chunks) {
    mp3Buffer.set(chunk, offset);
    offset += chunk.length;
  }

  console.log(`[wav-to-mp3] Encoded ${(wavBuffer.byteLength / 1024 / 1024).toFixed(1)}MB WAV → ${(mp3Buffer.byteLength / 1024 / 1024).toFixed(1)}MB MP3 (${sampleRate}Hz, ${kbps}kbps)`);

  return mp3Buffer;
}
