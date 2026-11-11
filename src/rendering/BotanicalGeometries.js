/* ============================================================================
   BOTANICAL 3D GEOMETRIES & GPU ASCII GLYPH ATLAS
   ============================================================================
   Procedural Three.js BufferGeometries for:
   1. 1024x128 32-Glyph GPU ASCII Font Atlas (Density Ramp + Contour/Vein Glyphs)
   2. Acer palmatum (Japanese Maple): 5-lobed deeply serrated palmate leaf
   3. Ulmus parvifolia (Chinese Elm): Doubly-serrated ovate leaf with pinnate veins
   4. Pinus thunbergii (Japanese Black Pine): Radiating fascicle fan of 5 needle pairs
   ============================================================================ */

/**
 * Creates the high-resolution 16x2 ASCII Glyph Atlas Texture (32 glyphs at 64x64px each).
 * Row 0 (indices 0..15): Botanical luminance density ramp
 * Row 1 (indices 16..31): Directional contour, bark fissure & leaf vein glyphs
 * @param {object} THREE - Three.js namespace
 * @returns {THREE.CanvasTexture}
 */
export function createAsciiFontAtlas(THREE = window.THREE) {
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = 1024;
  atlasCanvas.height = 128;
  const c = atlasCanvas.getContext('2d');
  c.fillStyle = '#000000';
  c.fillRect(0, 0, atlasCanvas.width, atlasCanvas.height);

  const glyphs = [
    ' ', '.', '·', ':', ';', '-', '=', '+', '*', 'o', '4', '6', '8', '0', '%', '#',
    '(', ')', '/', '\\', '|', '¦', '_', '~', '^', 'v', '@', '!', 'x', 'w', '#', '@'
  ];

  c.font = 'bold 46px "JetBrains Mono", monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#ffffff';

  for (let i = 0; i < 32; i++) {
    const col = i % 16;
    const row = Math.floor(i / 16);
    const cx = col * 64 + 32;
    const cy = row * 64 + 34;
    c.fillText(glyphs[i], cx, cy);
  }

  const tex = new THREE.CanvasTexture(atlasCanvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a custom 5-lobed palmate Japanese Maple leaf BufferGeometry (Acer palmatum)
 * with serrated sawtooth margins, elevated central vein ridge, and vertex colors.
 * @param {object} THREE - Three.js namespace
 * @returns {THREE.BufferGeometry}
 */
export function createPalmateMapleLeafGeometry(THREE = window.THREE) {
  const positions = [];
  const normals = [];
  const colors = [];

  // 5 radiating lobes of a Japanese Maple leaf: Basal L/R, Lateral L/R, Central
  const lobes = [
    { ang: -1.40, len: 0.56, wid: 0.20 },
    { ang:  1.40, len: 0.56, wid: 0.20 },
    { ang: -0.70, len: 0.86, wid: 0.25 },
    { ang:  0.70, len: 0.86, wid: 0.25 },
    { ang:  0.00, len: 1.00, wid: 0.27 }
  ];

  const veinCol = [1.32, 1.38, 1.15]; // Bright midrib vein highlight
  const edgeCol = [1.12, 1.18, 1.05];

  const pushTri = (pA, pB, pC, cA, cB, cC, nX, nY, nZ) => {
    positions.push(...pA, ...pB, ...pC);
    normals.push(nX, nY, nZ, nX, nY, nZ, nX, nY, nZ);
    colors.push(...cA, ...cB, ...cC);
  };

  for (const lobe of lobes) {
    const steps = 6;
    const cosA = Math.cos(lobe.ang);
    const sinA = Math.sin(lobe.ang);

    for (let s = 0; s < steps; s++) {
      const u0 = s / steps;
      const u1 = (s + 1) / steps;

      // Serrated sawtooth width profile
      const tooth0 = 1.0 + (s % 2 === 1 ? 0.22 : -0.08);
      const tooth1 = 1.0 + ((s + 1) % 2 === 1 ? 0.22 : -0.08);
      const w0 = lobe.wid * Math.sin(Math.pow(u0, 0.65) * Math.PI) * tooth0;
      const w1 = lobe.wid * Math.sin(Math.pow(u1, 0.65) * Math.PI) * tooth1;

      const l0 = u0 * lobe.len;
      const l1 = u1 * lobe.len;

      const toWorld = (localL, localW, zHeight) => {
        const x = localL * sinA + localW * cosA;
        const y = localL * cosA - localW * sinA;
        return [x, y, zHeight];
      };

      // Central vein ridge is slightly elevated in Z for 3D normal contrast
      const c0 = toWorld(l0, 0, 0.08);
      const c1 = toWorld(l1, 0, 0.08);
      const left0 = toWorld(l0, -w0, 0.0);
      const left1 = toWorld(l1, -w1, 0.0);
      const right0 = toWorld(l0, w0, 0.0);
      const right1 = toWorld(l1, w1, 0.0);

      // Left half of lobe segment
      pushTri(c0, left0, c1, veinCol, edgeCol, veinCol, -0.18, 0.25, 0.95);
      pushTri(left0, left1, c1, edgeCol, edgeCol, veinCol, -0.18, 0.25, 0.95);
      // Right half of lobe segment
      pushTri(c0, c1, right0, veinCol, veinCol, edgeCol, 0.18, 0.25, 0.85);
      pushTri(right0, c1, right1, edgeCol, veinCol, edgeCol, 0.18, 0.25, 0.85);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geom;
}

/**
 * Creates a serrated oval Chinese Elm leaf BufferGeometry (Ulmus parvifolia)
 * with pinnate central & lateral vein highlights and doubly-toothed margin.
 * @param {object} THREE - Three.js namespace
 * @returns {THREE.BufferGeometry}
 */
export function createUlmusLeafGeometry(THREE = window.THREE) {
  const positions = [];
  const normals = [];
  const colors = [];

  const steps = 10;
  const maxLen = 0.96;
  const maxWid = 0.44;

  const midribCol = [1.36, 1.42, 1.18];
  const lateralVeinCol = [1.18, 1.25, 1.06];
  const laminaCol = [0.90, 0.96, 0.88];

  const pushTri = (pA, pB, pC, cA, cB, cC, nX, nY, nZ) => {
    positions.push(...pA, ...pB, ...pC);
    normals.push(nX, nY, nZ, nX, nY, nZ, nX, nY, nZ);
    colors.push(...cA, ...cB, ...cC);
  };

  for (let s = 0; s < steps; s++) {
    const u0 = s / steps;
    const u1 = (s + 1) / steps;

    // Ulmus parvifolia ovate-elliptic profile with fine serrations
    const env0 = Math.sin(Math.pow(u0, 0.72) * Math.PI);
    const env1 = Math.sin(Math.pow(u1, 0.72) * Math.PI);
    const serration0 = 1.0 + (s % 2 === 1 ? 0.14 : -0.05);
    const serration1 = 1.0 + ((s + 1) % 2 === 1 ? 0.14 : -0.05);

    const w0 = maxWid * env0 * serration0;
    const w1 = maxWid * env1 * serration1;

    const y0 = u0 * maxLen;
    const y1 = u1 * maxLen;

    // Slight dorsal arch along leaf blade
    const arch0 = Math.sin(u0 * Math.PI) * 0.06;
    const arch1 = Math.sin(u1 * Math.PI) * 0.06;

    const c0 = [0, y0, 0.08 + arch0];
    const c1 = [0, y1, 0.08 + arch1];
    const left0 = [-w0, y0, arch0];
    const left1 = [-w1, y1, arch1];
    const right0 = [w0, y0, arch0];
    const right1 = [w1, y1, arch1];

    // Alternate pinnate lateral vein highlight every second segment
    const edgeC0 = (s % 2 === 0) ? lateralVeinCol : laminaCol;
    const edgeC1 = ((s + 1) % 2 === 0) ? lateralVeinCol : laminaCol;

    // Left blade half (tilted normal for crisp ASCII contour gradient)
    pushTri(c0, left0, c1, midribCol, edgeC0, midribCol, -0.28, 0.22, 0.92);
    pushTri(left0, left1, c1, edgeC0, edgeC1, midribCol, -0.28, 0.22, 0.92);

    // Right blade half
    pushTri(c0, c1, right0, midribCol, midribCol, edgeC0, 0.28, 0.22, 0.84);
    pushTri(right0, c1, right1, edgeC0, midribCol, edgeC1, 0.28, 0.22, 0.84);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geom;
}

/**
 * Creates a fan of 5 sharp needle pairs (10 needles in a radiating fascicle fan)
 * for Pinus thunbergii (Japanese Black Pine).
 * @param {object} THREE - Three.js namespace
 * @returns {THREE.BufferGeometry}
 */
export function createPineNeedleClusterGeometry(THREE = window.THREE) {
  const positions = [];
  const normals = [];
  const colors = [];

  const pushTri = (pA, pB, pC, cA, cB, cC, nX, nY, nZ) => {
    positions.push(...pA, ...pB, ...pC);
    normals.push(nX, nY, nZ, nX, nY, nZ, nX, nY, nZ);
    colors.push(...cA, ...cB, ...cC);
  };

  // 5 needle pairs (10 needles) fanned from -68° to +68°
  const pairAngles = [-1.18, -0.62, 0.0, 0.62, 1.18];
  const baseSheathCol = [0.68, 0.56, 0.44];
  const midNeedleCol = [1.05, 1.18, 0.96];
  const tipNeedleCol = [1.28, 1.38, 1.12];

  for (let p = 0; p < pairAngles.length; p++) {
    const baseAng = pairAngles[p];
    // Two twin needles per fascicle pair
    for (let twin = -1; twin <= 1; twin += 2) {
      const ang = baseAng + twin * 0.09;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);

      const len = 1.05 - Math.abs(baseAng) * 0.12;
      const baseW = 0.048;
      const midW = 0.036;
      const zLift = (p % 2 === 0 ? 0.06 : -0.04) + twin * 0.025;

      const toWorld = (l, w, z) => [
        l * sinA + w * cosA,
        l * cosA - w * sinA,
        z
      ];

      const p0L = toWorld(0.0, -baseW, 0.0);
      const p0R = toWorld(0.0,  baseW, 0.0);
      const pMidC = toWorld(len * 0.52, 0.0, zLift + 0.05);
      const pMidL = toWorld(len * 0.52, -midW, zLift);
      const pMidR = toWorld(len * 0.52,  midW, zLift);
      const pTip = toWorld(len, 0.0, zLift + 0.08);

      const nX = sinA * 0.25 + twin * 0.15;
      const nY = cosA * 0.25;
      const nZ = 0.92;

      // Lower half of needle (from fascicle sheath to mid-needle)
      pushTri(p0L, pMidL, pMidC, baseSheathCol, midNeedleCol, midNeedleCol, nX, nY, nZ);
      pushTri(p0L, pMidC, p0R, baseSheathCol, midNeedleCol, baseSheathCol, nX, nY, nZ);
      pushTri(p0R, pMidC, pMidR, baseSheathCol, midNeedleCol, midNeedleCol, nX, nY, nZ);

      // Upper half of needle tapering to a sharp point
      pushTri(pMidL, pTip, pMidC, midNeedleCol, tipNeedleCol, midNeedleCol, nX, nY, nZ);
      pushTri(pMidC, pTip, pMidR, midNeedleCol, tipNeedleCol, midNeedleCol, nX, nY, nZ);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geom;
}
