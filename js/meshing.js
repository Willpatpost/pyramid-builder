import { BLOCK, WY, CHUNK } from "./config.js";
import { BLOCKS } from "./blocks.js";

// Corner order per face: bottom-left, bottom-right, top-right, top-left as seen
// from outside the block (CCW winding); on side faces the v axis follows +y.
const FACES = [
  { d: [1, 0, 0], name: "side", shade: 0.75, corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { d: [-1, 0, 0], name: "side", shade: 0.75, corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { d: [0, 1, 0], name: "top", shade: 1.0, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { d: [0, -1, 0], name: "bottom", shade: 0.55, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { d: [0, 0, 1], name: "side", shade: 0.85, corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { d: [0, 0, -1], name: "side", shade: 0.85, corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] }
];

function makeChunkMaterial(atlas) {
  return new THREE.MeshLambertMaterial({
    map: atlas.texture,
    vertexColors: true,
    alphaTest: 0.5
  });
}

function buildChunkGeometry(world, cx, cz, atlas) {
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  for (let lz = 0; lz < CHUNK; lz++) {
    const z = z0 + lz;
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx;
      for (let y = 0; y < WY; y++) {
        const id = world.getBlock(x, y, z);
        if (id === BLOCK.AIR) continue;
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nid = world.getBlock(x + face.d[0], y + face.d[1], z + face.d[2]);
          if (nid !== BLOCK.AIR && BLOCKS[nid].opaque) continue;
          if (id === BLOCK.LEAVES && nid === BLOCK.LEAVES) continue;

          const rect = atlas.uv(id, face.name);
          const vi = positions.length / 3;
          for (let c = 0; c < 4; c++) {
            const corner = face.corners[c];
            positions.push(lx + corner[0], y + corner[1], lz + corner[2]);
            normals.push(face.d[0], face.d[1], face.d[2]);
            colors.push(face.shade, face.shade, face.shade);
          }
          uvs.push(rect[0], rect[1], rect[2], rect[1], rect[2], rect[3], rect[0], rect[3]);
          indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        }
      }
    }
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export { makeChunkMaterial, buildChunkGeometry };
