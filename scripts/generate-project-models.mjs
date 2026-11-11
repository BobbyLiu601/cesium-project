import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(projectRoot, 'src/assets/models')
const encoder = new TextEncoder()

const cube = {
  positions: [
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5,
    -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
    0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
    0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    0.5, -0.5, -0.5, 0.5,
  ],
  normals: [
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 1, 0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
  ],
  indices: [
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16,
    18, 19, 20, 21, 22, 20, 22, 23,
  ],
}

function align4(value) {
  return (value + 3) & ~3
}

function createGlb({ nodes, meshes, materials, animations, copyright }) {
  const chunks = []
  const bufferViews = []
  const accessors = []
  let byteLength = 0

  function addBufferView(data, target) {
    const padding = align4(byteLength) - byteLength
    if (padding) {
      chunks.push(Buffer.alloc(padding))
      byteLength += padding
    }

    const bufferView = {
      buffer: 0,
      byteOffset: byteLength,
      byteLength: data.byteLength,
      ...(target ? { target } : {}),
    }
    chunks.push(Buffer.from(data))
    bufferViews.push(bufferView)
    byteLength += data.byteLength
    return bufferViews.length - 1
  }

  function addAccessor(typedArray, type, componentType, minMax) {
    const view = addBufferView(
      new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength),
      componentType === 5125 ? 34963 : undefined,
    )
    const count = typedArray.length / (type === 'VEC3' ? 3 : type === 'VEC4' ? 4 : 1)
    accessors.push({
      bufferView: view,
      componentType,
      count,
      type,
      ...minMax,
    })
    return accessors.length - 1
  }

  const positionAccessor = addAccessor(new Float32Array(cube.positions), 'VEC3', 5126, {
    min: [-0.5, -0.5, -0.5],
    max: [0.5, 0.5, 0.5],
  })
  const normalAccessor = addAccessor(new Float32Array(cube.normals), 'VEC3', 5126, {})
  const indexAccessor = addAccessor(new Uint16Array(cube.indices), 'SCALAR', 5123, {})

  const sceneMeshes = meshes.map(({ material }) => ({
    primitives: [
      {
        attributes: {
          POSITION: positionAccessor,
          NORMAL: normalAccessor,
        },
        indices: indexAccessor,
        material,
      },
    ],
  }))

  const gltfAnimations = []
  if (animations?.length) {
    const animation = animations[0]
    const times = new Float32Array(animation.times)
    const rotations = new Float32Array(animation.rotations)
    const timeAccessor = addAccessor(times, 'SCALAR', 5126, {
      min: [Math.min(...animation.times)],
      max: [Math.max(...animation.times)],
    })
    const rotationAccessor = addAccessor(rotations, 'VEC4', 5126, {})
    gltfAnimations.push({
      name: animation.name,
      channels: [
        {
          sampler: 0,
          target: {
            node: animation.node,
            path: 'rotation',
          },
        },
      ],
      samplers: [
        {
          input: timeAccessor,
          output: rotationAccessor,
          interpolation: 'LINEAR',
        },
      ],
    })
  }

  byteLength = align4(byteLength)
  if (byteLength > chunks.reduce((total, chunk) => total + chunk.byteLength, 0)) {
    chunks.push(
      Buffer.alloc(byteLength - chunks.reduce((total, chunk) => total + chunk.byteLength, 0)),
    )
  }

  const json = {
    asset: {
      version: '2.0',
      generator: 'cesium-project model asset generator',
      copyright,
    },
    scene: 0,
    scenes: [{ nodes: nodes.filter((node) => node.root !== false).map((node) => node.index) }],
    nodes: nodes.map(({ root: _root, index: _index, ...node }) => node),
    meshes: sceneMeshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength }],
    ...(gltfAnimations.length ? { animations: gltfAnimations } : {}),
  }

  const jsonBytes = encoder.encode(JSON.stringify(json))
  const jsonPadding = align4(jsonBytes.byteLength) - jsonBytes.byteLength
  const jsonLength = jsonBytes.byteLength + jsonPadding
  const binaryLength = byteLength
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength
  const glb = Buffer.alloc(totalLength)
  glb.writeUInt32LE(0x46546c67, 0)
  glb.writeUInt32LE(2, 4)
  glb.writeUInt32LE(totalLength, 8)
  glb.writeUInt32LE(jsonLength, 12)
  glb.writeUInt32LE(0x4e4f534a, 16)
  glb.set(jsonBytes, 20)
  glb.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonLength)
  glb.writeUInt32LE(binaryLength, 20 + jsonLength)
  glb.writeUInt32LE(0x004e4942, 24 + jsonLength)
  Buffer.concat(chunks).copy(glb, 28 + jsonLength)
  return glb
}

function material(name, color) {
  return {
    name,
    pbrMetallicRoughness: {
      baseColorFactor: color,
      metallicFactor: 0.15,
      roughnessFactor: 0.72,
    },
  }
}

function createWindTurbineModel() {
  const quaternion = (degrees) => {
    const half = (degrees * Math.PI) / 360
    return [0, 0, Math.sin(half), Math.cos(half)]
  }
  const nodes = [
    { index: 0, name: 'Foundation', mesh: 0, translation: [0, 0.2, 0], scale: [1.8, 0.4, 1.8] },
    { index: 1, name: 'Tower', mesh: 0, translation: [0, 4, 0], scale: [0.36, 8, 0.36] },
    { index: 2, name: 'Nacelle', mesh: 0, translation: [0, 8, 0], scale: [0.9, 0.55, 0.65] },
    {
      index: 3,
      name: 'Rotor',
      translation: [0, 8, -0.52],
      children: [4, 6, 8],
    },
    { index: 4, name: 'BladeHolder_A', rotation: quaternion(0), children: [5] },
    { index: 5, name: 'Blade_A', mesh: 0, translation: [0, 2.2, 0], scale: [0.14, 4.4, 0.08] },
    { index: 6, name: 'BladeHolder_B', rotation: quaternion(120), children: [7] },
    { index: 7, name: 'Blade_B', mesh: 0, translation: [0, 2.2, 0], scale: [0.14, 4.4, 0.08] },
    { index: 8, name: 'BladeHolder_C', rotation: quaternion(240), children: [9] },
    { index: 9, name: 'Blade_C', mesh: 0, translation: [0, 2.2, 0], scale: [0.14, 4.4, 0.08] },
  ]
  const animationFrames = [0, 0.5, 1, 1.5, 2]

  return createGlb({
    nodes: nodes.map((node) => ({ ...node, root: node.index <= 3 })),
    meshes: [{ material: 0 }],
    materials: [material('WindTurbineWhite', [0.88, 0.91, 0.92, 1])],
    animations: [
      {
        name: 'RotorSpin',
        node: 3,
        times: animationFrames,
        rotations: animationFrames.flatMap((_, index) => quaternion(index * 90)),
      },
    ],
    copyright: 'Project-created procedural wind turbine asset; no third-party model data.',
  })
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(resolve(outputDirectory, 'wind-turbine.glb'), createWindTurbineModel())
