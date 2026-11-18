const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const CRC_TABLE = createCrcTable()

export function createRgbaPngDataUri(width: number, height: number, pixels: Uint8Array) {
  if (pixels.length !== width * height * 4) {
    throw new Error('RGBA pixel data does not match the requested texture size')
  }

  const header = new Uint8Array(13)
  const headerView = new DataView(header.buffer)
  headerView.setUint32(0, width)
  headerView.setUint32(4, height)
  header.set([8, 6, 0, 0, 0], 8)

  const png = concatBytes(
    PNG_SIGNATURE,
    createChunk('IHDR', header),
    createChunk('IDAT', createZlibStore(createScanlines(width, height, pixels))),
    createChunk('IEND', new Uint8Array()),
  )

  return `data:image/png;base64,${bytesToBase64(png)}`
}

function createScanlines(width: number, height: number, pixels: Uint8Array) {
  const rowLength = width * 4
  const scanlines = new Uint8Array(height * (rowLength + 1))

  for (let row = 0; row < height; row += 1) {
    const targetOffset = row * (rowLength + 1)
    scanlines[targetOffset] = 0
    scanlines.set(pixels.subarray(row * rowLength, (row + 1) * rowLength), targetOffset + 1)
  }

  return scanlines
}

function createZlibStore(data: Uint8Array) {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])]

  for (let offset = 0; offset < data.length; offset += 65_535) {
    const length = Math.min(65_535, data.length - offset)
    const finalBlock = offset + length >= data.length ? 1 : 0
    const blockHeader = new Uint8Array(5)
    blockHeader[0] = finalBlock
    blockHeader[1] = length & 0xff
    blockHeader[2] = (length >>> 8) & 0xff
    blockHeader[3] = ~length & 0xff
    blockHeader[4] = (~length >>> 8) & 0xff
    blocks.push(blockHeader, data.subarray(offset, offset + length))
  }

  const checksum = new Uint8Array(4)
  new DataView(checksum.buffer).setUint32(0, adler32(data))
  blocks.push(checksum)
  return concatBytes(...blocks)
}

function createChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type)
  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length)
  chunk.set(typeBytes, 4)
  chunk.set(data, 8)
  view.setUint32(8 + data.length, crc32(typeBytes, data))
  return chunk
}

function createCrcTable() {
  const table = new Uint32Array(256)

  for (let index = 0; index < table.length; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb8_8320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }

  return table
}

function crc32(type: Uint8Array, data: Uint8Array) {
  let crc = 0xffff_ffff

  for (const byte of type) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }

  return (crc ^ 0xffff_ffff) >>> 0
}

function adler32(data: Uint8Array) {
  let first = 1
  let second = 0

  for (const byte of data) {
    first = (first + byte) % 65_521
    second = (second + first) % 65_521
  }

  return ((second << 16) | first) >>> 0
}

function concatBytes(...arrays: Uint8Array[]) {
  const length = arrays.reduce((total, array) => total + array.length, 0)
  const result = new Uint8Array(length)
  let offset = 0

  for (const array of arrays) {
    result.set(array, offset)
    offset += array.length
  }

  return result
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }

  return btoa(binary)
}
