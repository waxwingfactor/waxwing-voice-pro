const ULAW_BIAS = 0x84;
const ULAW_CLIP = 32635;

export function decodeMuLawToPcm16(muLaw: Buffer): Buffer {
  const pcm = Buffer.alloc(muLaw.length * 2);
  for (let i = 0; i < muLaw.length; i += 1) {
    pcm.writeInt16LE(muLawToLinear(muLaw[i]), i * 2);
  }
  return pcm;
}

export function encodePcm16ToMuLaw(pcm16: Buffer): Buffer {
  const muLaw = Buffer.alloc(Math.floor(pcm16.length / 2));
  for (let i = 0; i < muLaw.length; i += 1) {
    muLaw[i] = linearToMuLaw(pcm16.readInt16LE(i * 2));
  }
  return muLaw;
}

export function upsample8kTo16k(pcm8k: Buffer): Buffer {
  const sampleCount = Math.floor(pcm8k.length / 2);
  const out = Buffer.alloc(sampleCount * 4);
  for (let i = 0; i < sampleCount; i += 1) {
    const sample = pcm8k.readInt16LE(i * 2);
    out.writeInt16LE(sample, i * 4);
    out.writeInt16LE(sample, i * 4 + 2);
  }
  return out;
}

export function downsample24kTo8k(pcm24k: Buffer): Buffer {
  const inputSamples = Math.floor(pcm24k.length / 2);
  const outputSamples = Math.floor(inputSamples / 3);
  const out = Buffer.alloc(outputSamples * 2);
  for (let i = 0; i < outputSamples; i += 1) {
    out.writeInt16LE(pcm24k.readInt16LE(i * 3 * 2), i * 2);
  }
  return out;
}

export function twilioBase64MuLawToGeminiPcm16(payload: string): Buffer {
  const muLaw = Buffer.from(payload, "base64");
  return upsample8kTo16k(decodeMuLawToPcm16(muLaw));
}

export function geminiPcm24ToTwilioBase64MuLaw(pcm24: Buffer): string {
  return encodePcm16ToMuLaw(downsample24kTo8k(pcm24)).toString("base64");
}

export function muLaw8kToWav(muLaw: Buffer): Buffer {
  return pcm16ToWav(decodeMuLawToPcm16(muLaw), 8000);
}

export function pcm16ToWav(pcm16: Buffer, sampleRate: number): Buffer {
  const channelCount = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channelCount * (bitsPerSample / 8);
  const blockAlign = channelCount * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm16.byteLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channelCount, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm16.byteLength, 40);

  return Buffer.concat([header, pcm16]);
}

function muLawToLinear(value: number): number {
  const muLaw = ~value & 0xff;
  const sign = muLaw & 0x80;
  const exponent = (muLaw >> 4) & 0x07;
  const mantissa = muLaw & 0x0f;
  let sample = ((mantissa << 3) + ULAW_BIAS) << exponent;
  sample -= ULAW_BIAS;
  return sign ? -sample : sample;
}

function linearToMuLaw(sample: number): number {
  let sign = 0;
  let magnitude = sample;
  if (magnitude < 0) {
    sign = 0x80;
    magnitude = -magnitude;
  }
  magnitude = Math.min(magnitude, ULAW_CLIP) + ULAW_BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (magnitude & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent -= 1;
  }

  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}
