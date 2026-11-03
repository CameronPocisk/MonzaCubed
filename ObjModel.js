// =====================================================================
//  A tiny OBJ + MTL loader for WebGL (no libraries)
// =====================================================================
// An .obj file is plain text. The lines we care about:
//   v  x y z        a vertex position
//   vt u v          a texture coordinate (UV): where on the image this corner reads its color
//   vn x y z        a normal (which way the surface faces, for lighting)
//   usemtl name     "the faces after this line use material `name`"
//   f a/b/c ...     a face: each corner is position/uv/normal indices (1-based)
//   mtllib file     the .mtl file that describes the materials
//
// An .mtl file lists materials. For each one we read:
//   newmtl name     start of a material
//   Kd r g b        its base color
//   map_Kd file     the image (texture) to paint it with
//
// We turn the whole model into ONE GPU buffer where every vertex is 8 floats:
//   x, y, z,  nx, ny, nz,  u, v
// and remember which range of vertices uses which material ("groups"),
// so we can switch textures between draw calls.

export const FLOATS_PER_VERTEX = 8;

export async function loadObjModel(gl, objUrl) {
  const folder = objUrl.slice(0, objUrl.lastIndexOf('/') + 1);
  const objText = await (await fetch(objUrl)).text();

  const positions = [], uvs = [], normals = [];
  const data = [];          // the interleaved vertex data we'll upload
  const groups = [];        // { material, start, count }
  let current = null;
  let mtlFile = null;

  for (const rawLine of objText.split('\n')) {
    const parts = rawLine.trim().split(/\s+/);
    switch (parts[0]) {
      case 'v':  positions.push([+parts[1], +parts[2], +parts[3]]); break;
      case 'vt': uvs.push([+parts[1], +parts[2]]); break;
      case 'vn': normals.push([+parts[1], +parts[2], +parts[3]]); break;
      case 'mtllib': mtlFile = parts.slice(1).join(' '); break;
      case 'usemtl':
        current = { material: parts[1], start: data.length / FLOATS_PER_VERTEX, count: 0 };
        groups.push(current);
        break;
      case 'f': {
        if (!current) { current = { material: null, start: 0, count: 0 }; groups.push(current); }
        // A face can have more than 3 corners; split it into a fan of triangles.
        const corners = parts.slice(1);
        for (let i = 1; i < corners.length - 1; i++) {
          for (const corner of [corners[0], corners[i], corners[i + 1]]) {
            const [vi, ti, ni] = corner.split('/').map(s => (s ? parseInt(s, 10) : 0));
            const p = positions[vi - 1];
            const n = ni ? normals[ni - 1] : [0, 1, 0];
            const t = ti ? uvs[ti - 1] : [0, 0];
            data.push(p[0], p[1], p[2], n[0], n[1], n[2], t[0], t[1]);
            current.count++;
          }
        }
        break;
      }
    }
  }

  // Bounding box, so the caller can center and scale the model.
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of positions) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], p[k]);
    max[k] = Math.max(max[k], p[k]);
  }

  // Upload all vertices to the GPU once.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

  const materials = mtlFile ? await loadMtl(gl, folder, mtlFile) : {};

  return {
    buffer,
    vertexCount: data.length / FLOATS_PER_VERTEX,
    groups: groups.filter(g => g.count > 0).map(g => ({ ...g, ...(materials[g.material] || defaultMaterial(gl)) })),
    min, max,
  };
}

async function loadMtl(gl, folder, file) {
  const text = await (await fetch(folder + file)).text();
  const materials = {};
  let current = null;
  const pending = [];
  for (const rawLine of text.split('\n')) {
    const parts = rawLine.trim().split(/\s+/);
    if (parts[0] === 'newmtl') {
      current = materials[parts[1]] = { color: [1, 1, 1], texture: null };
    } else if (current && parts[0] === 'Kd') {
      current.color = [+parts[1], +parts[2], +parts[3]];
    } else if (current && parts[0] === 'map_Kd') {
      const material = current;
      pending.push(loadTexture(gl, folder + parts.slice(1).join(' ')).then(t => { material.texture = t; }));
    }
  }
  await Promise.all(pending);
  // A material with a texture shows the texture's own colors (Blender writes Kd 0.8 by default)
  for (const m of Object.values(materials)) {
    if (m.texture) m.color = [1, 1, 1];
    else m.texture = whiteTexture(gl);
  }
  return materials;
}

// Load an image file into a WebGL texture.
export function loadTexture(gl, url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(textureFromImage(gl, image));
    image.onerror = () => reject(new Error('Could not load texture ' + url));
    image.src = url;
  });
}

// Works for <img> and <canvas> (we use canvases for the team liveries).
export function textureFromImage(gl, image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // OBJ UVs have v = 0 at the BOTTOM of the image; images start at the top.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  // All the car's textures are powers of two, so mipmaps + repeat are allowed.
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return texture;
}

let white = null;
function whiteTexture(gl) {
  if (white) return white;
  white = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, white);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  return white;
}
function defaultMaterial(gl) {
  return { color: [0.8, 0.8, 0.8], texture: whiteTexture(gl) };
}
