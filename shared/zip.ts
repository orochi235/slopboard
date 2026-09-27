/**
 * A zip writer, streaming, stored (uncompressed).
 *
 * The wall zips renders — PNG, JPEG, MP4, glb — which deflate to within a
 * percent of themselves, so the compressor would buy nothing and cost the
 * daemon a core per download. Stored entries also mean the archive is written
 * in one pass with no buffering beyond the file in hand.
 *
 * Shared because both halves zip: the daemon streams a zone off disk, and the
 * demo wall, which has no daemon, builds the same archive in the browser from
 * what it has already fetched.
 */

const LOCAL = 0x04034b50
const CENTRAL = 0x02014b50
const END = 0x06054b50
const ZIP64_END = 0x06064b50
const ZIP64_LOCATOR = 0x07064b50
/** The value a 32-bit field carries when the real one is in a zip64 record. */
const MAX32 = 0xffffffff
/** A regular file, readable — the unix mode the entry carries. Left at zero,
 *  Info-ZIP extracts every file mode 000 and nothing can open what it wrote. */
const MODE = (0o100644 << 16) >>> 0

const table = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** MS-DOS time and date, which is what a zip entry stamps. Seconds have half
 *  the resolution and the epoch is 1980; both are the format's, not ours. */
function dosStamp(at: Date): { time: number; date: number } {
  const year = Math.max(1980, at.getFullYear())
  return {
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
  }
}

/** One file going in: its path inside the archive and its bytes. */
export type ZipSource = { name: string; bytes: Uint8Array; at?: Date }

type Written = {
  name: Uint8Array
  crc: number
  size: number
  offset: number
  time: number
  date: number
}

const bytesOf = (n: number) => {
  const b = new Uint8Array(n)
  return { b, v: new DataView(b.buffer) }
}

function localHeader(entry: Written, zip64: boolean): Uint8Array {
  const extra = zip64 ? 20 : 0
  const { b, v } = bytesOf(30 + entry.name.length + extra)
  v.setUint32(0, LOCAL, true)
  v.setUint16(4, zip64 ? 45 : 20, true)
  // Bit 11: the name below is UTF-8 rather than the format's ancient CP437.
  v.setUint16(6, 0x0800, true)
  v.setUint16(8, 0, true)
  v.setUint16(10, entry.time, true)
  v.setUint16(12, entry.date, true)
  v.setUint32(14, entry.crc, true)
  v.setUint32(18, zip64 ? MAX32 : entry.size, true)
  v.setUint32(22, zip64 ? MAX32 : entry.size, true)
  v.setUint16(26, entry.name.length, true)
  v.setUint16(28, extra, true)
  b.set(entry.name, 30)
  if (zip64) {
    const at = 30 + entry.name.length
    v.setUint16(at, 0x0001, true)
    v.setUint16(at + 2, 16, true)
    v.setBigUint64(at + 4, BigInt(entry.size), true)
    v.setBigUint64(at + 12, BigInt(entry.size), true)
  }
  return b
}

function centralHeader(entry: Written): Uint8Array {
  const big = entry.size > MAX32
  const far = entry.offset > MAX32
  // Only the fields that overflowed go in the extra, and they go in the order
  // the spec lists them — a reader takes them positionally.
  const extra = big || far ? 4 + (big ? 16 : 0) + (far ? 8 : 0) : 0
  const { b, v } = bytesOf(46 + entry.name.length + extra)
  v.setUint32(0, CENTRAL, true)
  v.setUint16(4, 0x031e, true)
  v.setUint16(6, extra ? 45 : 20, true)
  v.setUint16(8, 0x0800, true)
  v.setUint16(10, 0, true)
  v.setUint16(12, entry.time, true)
  v.setUint16(14, entry.date, true)
  v.setUint32(16, entry.crc, true)
  v.setUint32(20, big ? MAX32 : entry.size, true)
  v.setUint32(24, big ? MAX32 : entry.size, true)
  v.setUint16(28, entry.name.length, true)
  v.setUint16(30, extra, true)
  v.setUint32(38, MODE, true)
  v.setUint32(42, far ? MAX32 : entry.offset, true)
  b.set(entry.name, 46)
  if (extra) {
    let at = 46 + entry.name.length
    v.setUint16(at, 0x0001, true)
    v.setUint16(at + 2, extra - 4, true)
    at += 4
    if (big) {
      v.setBigUint64(at, BigInt(entry.size), true)
      v.setBigUint64(at + 8, BigInt(entry.size), true)
      at += 16
    }
    if (far) v.setBigUint64(at, BigInt(entry.offset), true)
  }
  return b
}

function tail(written: Written[], start: number, size: number): Uint8Array {
  const zip64 = written.length > 0xffff || start > MAX32 || size > MAX32
  const { b, v } = bytesOf((zip64 ? 56 + 20 : 0) + 22)
  let at = 0
  if (zip64) {
    v.setUint32(0, ZIP64_END, true)
    v.setBigUint64(4, 44n, true)
    v.setUint16(12, 0x031e, true)
    v.setUint16(14, 45, true)
    v.setBigUint64(24, BigInt(written.length), true)
    v.setBigUint64(32, BigInt(written.length), true)
    v.setBigUint64(40, BigInt(size), true)
    v.setBigUint64(48, BigInt(start), true)
    v.setUint32(56, ZIP64_LOCATOR, true)
    v.setBigUint64(60, BigInt(start + size), true)
    v.setUint32(68, 1, true)
    at = 76
  }
  v.setUint32(at, END, true)
  const count = Math.min(written.length, 0xffff)
  v.setUint16(at + 8, count, true)
  v.setUint16(at + 10, count, true)
  v.setUint32(at + 12, Math.min(size, MAX32), true)
  v.setUint32(at + 16, Math.min(start, MAX32), true)
  return b
}

/**
 * The archive, chunk by chunk. One source is held in memory at a time, so a
 * zone of a hundred renders costs the biggest one rather than the sum.
 */
export async function* zipStream(
  files: AsyncIterable<ZipSource> | Iterable<ZipSource>,
): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder()
  const written: Written[] = []
  let offset = 0
  for await (const file of files) {
    const stamp = dosStamp(file.at ?? new Date())
    const entry: Written = {
      name: encoder.encode(file.name),
      crc: crc32(file.bytes),
      size: file.bytes.length,
      offset,
      ...stamp,
    }
    const header = localHeader(entry, entry.size > MAX32)
    written.push(entry)
    offset += header.length + entry.size
    yield header
    yield file.bytes
  }
  const start = offset
  let size = 0
  for (const entry of written) {
    const header = centralHeader(entry)
    size += header.length
    yield header
  }
  yield tail(written, start, size)
}

/** The whole archive in one buffer, for a caller handing it to a download
 *  rather than to a socket. */
export async function zipBytes(
  files: AsyncIterable<ZipSource> | Iterable<ZipSource>,
): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of zipStream(files)) {
    chunks.push(chunk)
    total += chunk.length
  }
  const all = new Uint8Array(new ArrayBuffer(total))
  let at = 0
  for (const chunk of chunks) {
    all.set(chunk, at)
    at += chunk.length
  }
  return all
}
