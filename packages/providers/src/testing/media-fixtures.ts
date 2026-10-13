import zlib from 'node:zlib';

/**
 * Minimal media files for tests, generated in plain JS without ffmpeg: WAV and MP3 (silent frames) that ffprobe can decode, PNG, and bad files whose header is valid but whose content cannot be decoded.
 */

/** 16-bit mono PCM WAV (silence). */
export function wavFixture(durationSec = 0.5, sampleRate = 24_000): Buffer {
  const samples = Math.round(durationSec * sampleRate);
  const data = samples * 2;
  const buffer = Buffer.alloc(44 + data);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + data, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(data, 40);
  return buffer;
}

/**
 * Silent MPEG-1 Layer III frames at 128 kbps, 44.1 kHz, mono (side information all zeros, so it decodes to silence). Each frame is 417 bytes and 1152 samples.
 */
export function mp3Fixture(frames = 20): Buffer {
  const frame = Buffer.alloc(417);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x90;
  frame[3] = 0xc0;
  return Buffer.concat(Array.from({ length: frames }, () => frame));
}

/** Solid-colour RGB PNG; a different `shade` gives different content. */
export function pngFixture(width = 16, height = 9, shade = 0): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // Bit depth
  header[9] = 2; // RGB
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rows.set([200, 80, (40 + shade) & 0xff], y * (width * 3 + 1) + 1 + x * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** File header is PNG, but the content cannot be decoded. */
export function corruptPngFixture(): Buffer {
  return Buffer.concat([pngFixture().subarray(0, 8), Buffer.from('not really a png at all')]);
}

/** File header is RIFF/WAVE, but the content cannot be decoded. */
export function corruptWavFixture(): Buffer {
  return Buffer.concat([Buffer.from('RIFF\x10\x00\x00\x00WAVE', 'latin1'), Buffer.from('garbage-garbage')]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
