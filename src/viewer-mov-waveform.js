'use strict'
const fs = require('node:fs/promises')

// Read PCM samples directly from MOV chunk tables. Never decode video or modify
// the source. Bound metadata allocations and yield between small audio reads.
async function readMovWaveform(filename, signal) {
  const file = await fs.open(filename, 'r')
  const fail = message => { const error = new Error(message); error.code = 'MOV_PCM_UNSUPPORTED'; throw error }
  try {
    const size = (await file.stat()).size
    const read = async (position, length) => {
      signal?.throwIfAborted()
      if (!Number.isSafeInteger(position) || position < 0 || length < 0 || length > 64 * 1024 * 1024 || position + length > size) fail('Invalid MOV range')
      const b = Buffer.alloc(length)
      if ((await file.read(b, 0, length, position)).bytesRead !== length) fail('Truncated MOV')
      return b
    }
    let moov
    for (let offset = 0, count = 0; offset + 8 <= size && count < 100000; count++) {
      const head = await read(offset, Math.min(16, size - offset))
      let length = head.readUInt32BE(0), header = 8
      if (length === 1) { length = Number(head.readBigUInt64BE(8)); header = 16 }
      if (length === 0) length = size - offset
      if (!Number.isSafeInteger(length) || length < header || offset + length > size) fail('Invalid MOV atom')
      if (head.toString('ascii', 4, 8) === 'moov') { moov = await read(offset + header, length - header); break }
      offset += length
    }
    if (!moov) fail('MOV metadata unavailable')
    const atoms = b => {
      const result = []
      for (let i = 0; i + 8 <= b.length;) {
        let n = b.readUInt32BE(i), h = 8
        if (n === 1) { if (i + 16 > b.length) fail('Invalid atom'); n = Number(b.readBigUInt64BE(i + 8)); h = 16 }
        if (!n) n = b.length - i
        if (!Number.isSafeInteger(n) || n < h || i + n > b.length) fail('Invalid atom')
        result.push({type:b.toString('ascii', i + 4, i + 8), data:b.subarray(i + h, i + n)})
        i += n
      }
      return result
    }
    const child = (b, type) => atoms(b).find(a => a.type === type)?.data
    let table
    for (const track of atoms(moov).filter(a => a.type === 'trak')) {
      const mdia = child(track.data, 'mdia')
      const handler = mdia && child(mdia, 'hdlr')
      if (handler?.toString('ascii', 8, 12) === 'soun') { table = child(child(mdia, 'minf'), 'stbl'); break }
    }
    if (!table) fail('No audio track')
    const description = child(table, 'stsd'), sizes = child(table, 'stsz'), chunks = child(table, 'stsc')
    const offsets = child(table, 'stco') || child(table, 'co64')
    const wide = !child(table, 'stco')
    if (!description || !sizes || !chunks || !offsets || description.readUInt32BE(4) !== 1) fail('Unsupported audio tables')
    const entry = atoms(description.subarray(8))[0]
    const b = entry.data, version = b.readUInt16BE(8)
    const channels = b.readUInt16BE(16), bits = b.readUInt16BE(18), rate = b.readUInt32BE(24) / 65536
    const little = entry.type === 'sowt', float = ['fl32','fl64'].includes(entry.type)
    if (!['sowt','twos','raw ','in24','in32','fl32','fl64'].includes(entry.type) || version > 1 || !channels || channels > 64 || !rate || ![8,16,24,32,64].includes(bits) || (!float && bits > 32)) fail('Unsupported embedded audio codec: ' + entry.type)
    const width = bits / 8, align = channels * width
    const fixed = sizes.readUInt32BE(4), count = sizes.readUInt32BE(8)
    if (!fixed && sizes.length < 12 + count * 4) fail('Invalid sample sizes')
    const maps = chunks.readUInt32BE(4), numChunks = offsets.readUInt32BE(4)
    if (!maps || chunks.length < 8 + maps * 12 || offsets.length < 8 + numChunks * (wide ? 8 : 4)) fail('Invalid chunk tables')
    let bytes = fixed * count
    if (!fixed) { bytes = 0; for (let i=0;i<count;i++) bytes += sizes.readUInt32BE(12+i*4) }
    if (!bytes || bytes % align) fail('Invalid PCM length')
    const frames = bytes / align, perBin = Math.ceil(frames / 8192), peaks = Array(Math.ceil(frames / perBin)).fill(0)
    let sample = 0, frame = 0, map = 0
    for (let i = 0; i < numChunks; i++) {
      while (map + 1 < maps && chunks.readUInt32BE(8 + (map + 1) * 12) <= i + 1) map++
      if (chunks.readUInt32BE(16 + map * 12) !== 1) fail('Multiple sample descriptions')
      const samples = chunks.readUInt32BE(12 + map * 12)
      if (sample + samples > count) fail('Invalid sample count')
      let length = fixed * samples
      if (!fixed) { length = 0; for (let j=0;j<samples;j++) length += sizes.readUInt32BE(12+(sample+j)*4) }
      sample += samples
      if (length % align) fail('Unaligned PCM chunk')
      let position = wide ? Number(offsets.readBigUInt64BE(8+i*8)) : offsets.readUInt32BE(8+i*4)
      while (length) {
        const n = Math.min(length, Math.floor(262144/align)*align), data = await read(position,n)
        for (let at=0;at<n;at+=align,frame++) {
          let peak = 0
          for (let c=0;c<channels;c++) {
            const o=at+c*width
            let value
            if (float) value = bits === 32 ? data.readFloatBE(o) : data.readDoubleBE(o)
            else if (bits === 8) value = entry.type === 'raw ' ? (data[o]-128)/128 : data.readInt8(o)/128
            else value = (little ? data.readIntLE(o,width) : data.readIntBE(o,width)) / 2**(bits-1)
            if (Number.isFinite(value)) peak = Math.max(peak,Math.abs(value))
          }
          const bin=Math.floor(frame/perBin);peaks[bin]=Math.max(peaks[bin],Math.min(1,peak))
        }
        position+=n;length-=n
        await new Promise(resolve=>setImmediate(resolve))
      }
    }
    if (sample !== count || frame !== frames) fail('Incomplete PCM samples')
    return {peaks,duration:frames/rate,step:perBin/rate}
  } finally { await file.close() }
}
module.exports = { readMovWaveform }
