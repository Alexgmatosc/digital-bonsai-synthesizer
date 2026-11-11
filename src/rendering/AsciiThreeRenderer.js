/* ============================================================================
   THREE.JS WEBGL GPU ASCII PROJECTION RENDERER (60-120 FPS)
   ============================================================================
   Manages:
   1. 3D Botanical Scene (bioScene) with high-capacity InstancedMesh pools:
      - MAX_CYLINDERS = 3500 (Nebari roots, trunk, fractal internodes, petioles)
      - MAX_SPHERES   = 2500 (Axillary leaf-buds, swelling buds, chop scars, wire coils, Tamahi)
      - MAX_LEAVES    = 3500 (Palmate Maple, Serrated Ulmus, or Black Pine Needle Clusters)
   2. Continuous bark lignification shading (woodiness 0.0 tender green shoot ->
      0.35 reddish-olive young branch -> 0.75..1.0 aged silver-taupe trunk).
   3. Clear rendering of Axillary Leaf-Buds (AXILLARY_LEAF_BUD) in the upper
      angle between stem and petiole with hover & swelling states.
   4. Fullscreen WebGL Fragment Shader sampling the 32-glyph ASCII Font Atlas.
   ============================================================================ */

import {
  createAsciiFontAtlas,
  createPalmateMapleLeafGeometry,
  createUlmusLeafGeometry,
  createPineNeedleClusterGeometry
} from './BotanicalGeometries.js';

const THREE = window.THREE;

export const MAX_CYLINDERS = 3500;
export const MAX_SPHERES = 2500;
export const MAX_LEAVES = 3500;

export class AsciiThreeRenderer {
  /**
   * @param {HTMLElement} containerEl - DOM container for the WebGL canvas
   */
  constructor(containerEl) {
    this.containerEl = containerEl;
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;

    // 1. WebGLRenderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(this.viewW, this.viewH);
    if (this.containerEl) {
      this.containerEl.appendChild(this.renderer.domElement);
    }

    // 2. 3D Botanical Scene & Planar Orthographic Camera
    this.bioScene = new THREE.Scene();
    this.bioScene.background = new THREE.Color(0x000000);

    this.orthoCamera = new THREE.OrthographicCamera(-300, 300, 350, -90, -600, 600);
    this.orthoCamera.position.set(0, 0, 240);
    this.orthoCamera.lookAt(0, 0, 0);

    // 3. Three-point botanical lighting for cylindrical bark & leaf vein relief
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.54);
    this.bioScene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff8e7, 0.96);
    this.sunLight.position.set(-140, 220, 180);
    this.bioScene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x50e3c2, 0.34);
    this.rimLight.position.set(160, 80, -100);
    this.bioScene.add(this.rimLight);

    // 4. Pre-build species leaf geometries
    this.speciesGeometries = {
      BONSAI_MAPLE: createPalmateMapleLeafGeometry(THREE),
      BONSAI_ULMUS: createUlmusLeafGeometry(THREE),
      BONSAI_PINE: createPineNeedleClusterGeometry(THREE)
    };
    this.currentSpecies = 'BONSAI_MAPLE';

    // 5. High-capacity InstancedMesh pools (zero per-frame GC allocations)
    const cylGeom = new THREE.CylinderGeometry(0.84, 1.0, 1.0, 8, 1);
    const cylMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.cylInstanced = new THREE.InstancedMesh(cylGeom, cylMat, MAX_CYLINDERS);
    this.cylInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cylInstanced.frustumCulled = false;
    this.bioScene.add(this.cylInstanced);

    const sphereGeom = new THREE.SphereGeometry(1.0, 8, 6);
    const sphereMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.sphereInstanced = new THREE.InstancedMesh(sphereGeom, sphereMat, MAX_SPHERES);
    this.sphereInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sphereInstanced.frustumCulled = false;
    this.bioScene.add(this.sphereInstanced);

    const leafMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      vertexColors: true,
      side: THREE.DoubleSide
    });
    this.leafInstanced = new THREE.InstancedMesh(
      this.speciesGeometries.BONSAI_MAPLE,
      leafMat,
      MAX_LEAVES
    );
    this.leafInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.leafInstanced.frustumCulled = false;
    this.bioScene.add(this.leafInstanced);

    // 6. Ceramic Tokoname Bonsai Pot & Domed Moss Mound
    this.potGroup = new THREE.Group();
    this.bioScene.add(this.potGroup);
    this._buildPotAndMossMeshes();

    // 7. Offscreen RenderTarget & Fullscreen GPU ASCII Post-Processing Pass
    this.sceneRT = new THREE.WebGLRenderTarget(512, 512, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });

    this.asciiAtlasTex = createAsciiFontAtlas(THREE);
    this.asciiPostScene = new THREE.Scene();
    this.asciiPostCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.baseCellW = 6.5;
    this.baseCellH = 8.5;

    this.asciiShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.sceneRT.texture },
        tAscii: { value: this.asciiAtlasTex },
        uResolution: { value: new THREE.Vector2(this.viewW, this.viewH) },
        uCellSize: { value: new THREE.Vector2(this.baseCellW, this.baseCellH) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D tScene;
        uniform sampler2D tAscii;
        uniform vec2 uResolution;
        uniform vec2 uCellSize;
        varying vec2 vUv;

        float getLuma(vec3 c) {
          return dot(c, vec3(0.299, 0.587, 0.114));
        }

        void main() {
          vec2 pixelPos = vUv * uResolution;
          vec2 cellIndex = floor(pixelPos / uCellSize);
          vec2 cellFract = fract(pixelPos / uCellSize);
          vec2 cellCenterUV = (cellIndex + 0.5) * uCellSize / uResolution;

          vec4 centerSample = texture2D(tScene, cellCenterUV);
          float luma = getLuma(centerSample.rgb);

          // Pure dark background outside the specimen
          if (luma < 0.022) {
            gl_FragColor = vec4(0.008, 0.012, 0.02, 1.0);
            return;
          }

          // Sample neighbor cells to detect silhouette edges, bark contours & leaf veins
          vec2 stepUV = uCellSize / uResolution;
          float lL = getLuma(texture2D(tScene, cellCenterUV + vec2(-stepUV.x, 0.0)).rgb);
          float lR = getLuma(texture2D(tScene, cellCenterUV + vec2( stepUV.x, 0.0)).rgb);
          float lU = getLuma(texture2D(tScene, cellCenterUV + vec2(0.0,  stepUV.y)).rgb);
          float lD = getLuma(texture2D(tScene, cellCenterUV + vec2(0.0, -stepUV.y)).rgb);

          float gx = lR - lL;
          float gy = lU - lD;
          float edgeMag = sqrt(gx * gx + gy * gy);

          float glyphCol = 0.0;
          float glyphRow = 0.0;

          // Deterministic cell hash for organic ASCII character variety
          float cellHash = fract(sin(dot(cellIndex, vec2(12.9898, 78.233))) * 43758.5453);

          if (edgeMag > 0.23) {
            // Directional contour / vein glyph (Row 1)
            glyphRow = 1.0;
            if (abs(gx) > abs(gy) * 1.4) {
              glyphCol = gx > 0.0 ? 0.0 : 1.0; // '(' or ')'
            } else if (abs(gy) > abs(gx) * 1.4) {
              glyphCol = 6.0; // '_'
            } else {
              glyphCol = (gx * gy > 0.0) ? 2.0 : 3.0; // '/' or '\\'
            }
          } else {
            // Density ramp glyph (Row 0: 1..15)
            glyphRow = 0.0;
            float variedLuma = clamp(luma * 1.15 + (cellHash - 0.5) * 0.16, 0.08, 0.99);
            glyphCol = floor(variedLuma * 15.0);
          }

          // Sample crisp glyph from the 16x2 Atlas Texture
          float u = (glyphCol + cellFract.x) / 16.0;
          float v = (glyphRow < 0.5)
            ? (0.5 + (1.0 - cellFract.y) * 0.5)
            : ((1.0 - cellFract.y) * 0.5);

          float mask = texture2D(tAscii, vec2(u, v)).r;

          // Boost color saturation & subtle phosphor glow
          vec3 boostedColor = centerSample.rgb * (1.22 + luma * 0.25);
          vec3 bg = vec3(0.008, 0.012, 0.02);
          vec3 finalCol = mix(bg, boostedColor, mask);

          gl_FragColor = vec4(finalCol, 1.0);
        }
      `
    });

    const quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.asciiShaderMat);
    this.asciiPostScene.add(quadMesh);

    // Scratch math objects to avoid per-frame allocations
    this._dummyObj = new THREE.Object3D();
    this._tmpColor = new THREE.Color();
    this._upVec = new THREE.Vector3(0, 1, 0);
    this._segVec = new THREE.Vector3();
    this._midVec = new THREE.Vector3();

    this.resize(this.viewW, this.viewH);
  }

  /**
   * Builds the static 3D Ceramic Bonsai Pot & Velvet Moss Mound meshes.
   */
  _buildPotAndMossMeshes() {
    // Domed green moss mound on top of pot
    const mossGeom = new THREE.CylinderGeometry(96, 102, 10, 24, 1);
    const mossMat = new THREE.MeshLambertMaterial({ color: 0x56a84c });
    const mossMesh = new THREE.Mesh(mossGeom, mossMat);
    mossMesh.position.set(0, -4, -5);
    this.potGroup.add(mossMesh);

    // Terracotta Pot Rim Lip
    const lipGeom = new THREE.CylinderGeometry(108, 106, 6, 24, 1);
    const lipMat = new THREE.MeshLambertMaterial({ color: 0xd48866 });
    const lipMesh = new THREE.Mesh(lipGeom, lipMat);
    lipMesh.position.set(0, -9, 0);
    this.potGroup.add(lipMesh);

    // Terracotta Pot Body
    const bodyGeom = new THREE.CylinderGeometry(102, 84, 38, 24, 1);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xb26244 });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    bodyMesh.position.set(0, -29, 0);
    this.potGroup.add(bodyMesh);

    // Pot Feet (Left & Right)
    const footGeom = new THREE.BoxGeometry(24, 6, 30);
    const footMat = new THREE.MeshLambertMaterial({ color: 0x8a4830 });
    const leftFoot = new THREE.Mesh(footGeom, footMat);
    leftFoot.position.set(-64, -50, 0);
    const rightFoot = new THREE.Mesh(footGeom, footMat);
    rightFoot.position.set(64, -50, 0);
    this.potGroup.add(leftFoot, rightFoot);
  }

  /**
   * Subtly scales the GPU ASCII cell size based on camera zoom so glyphs stay razor-sharp
   * both in macro full-tree view (0.35x) and close-up axillary bud inspection (3.0x).
   * @param {number} zoomFactor
   */
  setCellScale(zoomFactor = 1.0) {
    const z = Math.max(0.25, Math.min(3.5, zoomFactor || 1.0));
    const cellScale = Math.max(0.80, Math.min(1.22, Math.pow(z, 0.14)));
    this.asciiShaderMat.uniforms.uCellSize.value.set(
      this.baseCellW * cellScale,
      this.baseCellH * cellScale
    );
  }

  /**
   * Computes continuous bark RGB color based on segment woodiness (0.0 -> 1.0) and species.
   * - woodiness = 0.0: bright green / crimson-tipped tender herbaceous shoot
   * - woodiness = 0.35: olive / reddish-brown semi-lignified 1st-year twig
   * - woodiness = 0.75..1.0: mature fissured silver-taupe / grey-brown woody trunk
   */
  _setBarkColor(targetColor, woodiness, species) {
    const w = Math.max(0, Math.min(1, woodiness || 0));

    // Stage 0: Tender green shoot
    const r0 = 0.45, g0 = 0.84, b0 = 0.36;
    // Stage 1 (w ~ 0.35): Olive / reddish-brown young woody twig
    const r1 = 0.66, g1 = 0.56, b1 = 0.40;
    // Stage 2 (w -> 1.0): Mature woody trunk bark (species-tuned)
    let r2 = 0.75, g2 = 0.72, b2 = 0.65; // Acer palmatum silver-taupe bark
    if (species === 'BONSAI_ULMUS') {
      r2 = 0.68; g2 = 0.63; b2 = 0.55; // Ulmus warm grey-ochre bark
    } else if (species === 'BONSAI_PINE') {
      r2 = 0.58; g2 = 0.51; b2 = 0.46; // Pinus thunbergii dark scaly bark
    }

    if (w < 0.38) {
      const t = w / 0.38;
      targetColor.setRGB(
        r0 + (r1 - r0) * t,
        g0 + (g1 - g0) * t,
        b0 + (b1 - b0) * t
      );
    } else {
      const t = (w - 0.38) / 0.62;
      targetColor.setRGB(
        r1 + (r2 - r1) * t,
        g1 + (g2 - g1) * t,
        b1 + (b2 - b1) * t
      );
    }
  }

  /**
   * Synchronizes the biological state of the living bonsai with the Three.js InstancedMeshes.
   * @param {object} bonsai - LivingBonsaiOrganism instance
   * @param {number} timeSec - Elapsed animation time in seconds
   * @param {object} interactionState - { hoveredSegId, hoveredBudId, hoveredLeafId, hoveredDescSet, activeTool, seasonTheme }
   * @returns {{ activeBudCount: number, activeLeafCount: number, activeBranchCount: number, trunkCaliberMm: number }}
   */
  syncBiology(bonsai, timeSec = 0, interactionState = {}) {
    if (!bonsai) {
      return { activeBudCount: 0, activeLeafCount: 0, activeBranchCount: 0, trunkCaliberMm: 0 };
    }

    const {
      hoveredSegId = null,
      hoveredBudId = null,
      hoveredLeafId = null,
      hoveredDescSet = null,
      activeTool = 'PRUNE',
      seasonTheme = 'SPRING'
    } = interactionState;

    // Swap leaf BufferGeometry whenever species changes
    if (bonsai.species && bonsai.species !== this.currentSpecies) {
      const nextGeom = this.speciesGeometries[bonsai.species] || this.speciesGeometries.BONSAI_MAPLE;
      this.leafInstanced.geometry = nextGeom;
      this.currentSpecies = bonsai.species;
    }

    let cylIdx = 0;
    let sphIdx = 0;
    let leafIdx = 0;

    const dummyObj = this._dummyObj;
    const tmpColor = this._tmpColor;
    const upVec = this._upVec;
    const segVec = this._segVec;
    const midVec = this._midVec;

    const pushCylinder = (x0, y0, z0, x1, y1, z1, r0, r1, color) => {
      if (cylIdx >= MAX_CYLINDERS) return;
      segVec.set(x1 - x0, y1 - y0, z1 - z0);
      const len = segVec.length();
      if (len < 0.08) return;

      midVec.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
      dummyObj.position.copy(midVec);
      dummyObj.quaternion.setFromUnitVectors(upVec, segVec.normalize());
      const avgR = Math.max(0.35, (r0 + r1) * 0.5);
      dummyObj.scale.set(avgR, len, avgR);
      dummyObj.updateMatrix();

      this.cylInstanced.setMatrixAt(cylIdx, dummyObj.matrix);
      this.cylInstanced.setColorAt(cylIdx, color);
      cylIdx++;
    };

    const pushSphere = (x, y, z, rx, ry, rz, color) => {
      if (sphIdx >= MAX_SPHERES) return;
      dummyObj.position.set(x, y, z);
      dummyObj.rotation.set(0, 0, 0);
      dummyObj.scale.set(rx, ry, rz);
      dummyObj.updateMatrix();

      this.sphereInstanced.setMatrixAt(sphIdx, dummyObj.matrix);
      this.sphereInstanced.setColorAt(sphIdx, color);
      sphIdx++;
    };

    // 1. Nebari Surface Roots
    if (bonsai.nebariRoots) {
      tmpColor.setRGB(0.68, 0.64, 0.56);
      for (const r of bonsai.nebariRoots) {
        pushCylinder(r.x0, r.y0, r.z0, r.x1, r.y1, r.z1, r.r0, r.r1, tmpColor);
      }
    }

    // 2. White Tamahi Organic Fertilizer Cakes on the Soil Rim
    if (bonsai.pellets) {
      tmpColor.setRGB(0.88, 0.85, 0.78);
      for (const p of bonsai.pellets) {
        pushSphere(p.x, p.y, p.z, p.rx, p.ry, p.rx, tmpColor);
      }
    }

    // 3. Trunk, Chopped Trunk Heads & Fractal Internode Branches
    let activeBranchCount = 0;
    for (const seg of bonsai.segments) {
      if (seg.pruned) continue;

      const curT = seg.curT !== undefined ? seg.curT : 1.0;
      const curX1 = seg.x0 + (seg.x1 - seg.x0) * curT;
      const curY1 = seg.y0 + (seg.y1 - seg.y0) * curT;
      const curZ1 = seg.z0 + (seg.z1 - seg.z0) * curT;

      const isDescHovered = hoveredDescSet ? hoveredDescSet.has(seg.id) : false;
      const isDirectlyHovered = hoveredSegId === seg.id;
      const isCutHighlight = (activeTool === 'PRUNE' && (isDescHovered || isDirectlyHovered));

      if (seg.type !== 'TRUNK' && seg.type !== 'TRUNK_HEAD') {
        activeBranchCount++;
      }

      if (isCutHighlight) {
        tmpColor.setRGB(1.0, 0.30, 0.40);
      } else if (activeTool === 'PINCH' && isDirectlyHovered) {
        tmpColor.setRGB(0.35, 0.98, 0.78);
      } else {
        const effectiveWoodiness = (seg.type === 'TRUNK' || seg.type === 'TRUNK_HEAD')
          ? Math.max(0.85, seg.woodiness ?? 1.0)
          : (seg.woodiness ?? 0.0);
        this._setBarkColor(tmpColor, effectiveWoodiness, bonsai.species);
      }

      pushCylinder(seg.x0, seg.y0, seg.z0, curX1, curY1, curZ1, seg.r0, seg.r1, tmpColor);

      // Nodal bark ridge on lignified segments so thickened seedling shoots show realistic trunk rings
      if (!isCutHighlight && (seg.woodiness > 0.55 || seg.r0 > 4.0) && seg.curT >= 0.98) {
        this._setBarkColor(tmpColor, Math.min(1.0, (seg.woodiness || 0.6) + 0.12), bonsai.species);
        pushSphere(curX1, curY1, curZ1, seg.r1 * 1.08, Math.max(1.2, seg.r1 * 0.32), seg.r1 * 1.08, tmpColor);
      }

      // Render Copper Training Wire Coils if segment is wired
      if (seg.hasWire && !isCutHighlight) {
        tmpColor.setRGB(0.85, 0.52, 0.28);
        for (let wStep = 0.25; wStep <= 0.75; wStep += 0.25) {
          if (curT < wStep) break;
          const wx = seg.x0 + (seg.x1 - seg.x0) * wStep;
          const wy = seg.y0 + (seg.y1 - seg.y0) * wStep;
          const wz = seg.z0 + (seg.z1 - seg.z0) * wStep;
          const wr = (seg.r0 * (1 - wStep) + seg.r1 * wStep) * 1.18;
          pushSphere(wx, wy, wz + 0.8, Math.max(1.2, wr), 1.1, Math.max(1.2, wr), tmpColor);
        }
      }

      // Render Chop Scars / Cut Paste / Fresh Green Cut Disc at top of chopped segments
      if (seg.hasChopScar && curT >= 0.95 && !isCutHighlight) {
        if (seg.scarStyle === 'DARK_PASTE') {
          tmpColor.setRGB(0.38, 0.43, 0.48); // Grey Japanese cut-paste seal
          pushSphere(curX1, curY1, curZ1 + 2.0, seg.r1 * 0.85, 3.2, seg.r1 * 0.85, tmpColor);
        } else if (seg.scarStyle === 'FRESH_GREEN_CUT') {
          tmpColor.setRGB(0.78, 0.95, 0.65); // Fresh green-white cambium ring after pruning
          pushSphere(curX1, curY1, curZ1 + 2.0, Math.max(1.8, seg.r1 * 1.25), 2.3, Math.max(1.8, seg.r1 * 1.25), tmpColor);
        } else {
          tmpColor.setRGB(0.82, 0.78, 0.66); // Healed callus bevel
          pushSphere(curX1, curY1, curZ1 + 1.5, seg.r1 * 0.82, 2.8, seg.r1 * 0.82, tmpColor);
        }
      }

      // Clean cut / pinch ring indicator on hovered segment
      if (isDirectlyHovered) {
        if (activeTool === 'PRUNE') {
          tmpColor.setRGB(1.0, 0.25, 0.45);
          pushSphere(seg.x0, seg.y0, seg.z0 + 4.0, Math.max(3.5, seg.r0 * 1.55), 2.2, 3.5, tmpColor);
        } else if (activeTool === 'PINCH') {
          tmpColor.setRGB(0.25, 1.0, 0.78);
          pushSphere(curX1, curY1, curZ1 + 4.0, Math.max(3.2, seg.r1 * 1.5), 2.2, 3.2, tmpColor);
        }
      }
    }

    // 4. Axillary Leaf-Buds (AXILLARY_LEAF_BUD) & Collar/Latent Buds
    let activeBudCount = 0;
    if (bonsai.buds) {
      for (const bud of bonsai.buds) {
        if (bud.pruned || bud.state === 'SPENT') continue;
        const pSeg = bonsai.SegmentMap ? bonsai.SegmentMap.get(bud.parentSegId) : null;
        if (!pSeg || pSeg.pruned || (pSeg.curT !== undefined && pSeg.curT < 0.90)) continue;

        const isBudHovered = hoveredBudId === bud.id;
        // Offset slightly into the upper leaf-axil pocket so the bud is distinctly visible between stem & petiole
        const axilOffsetX = (bud.side || 0) * 1.15;
        const axilOffsetY = bud.type === 'AXILLARY_LEAF_BUD' ? 1.1 : 0.0;
        const bx = bud.x + axilOffsetX;
        const by = bud.y + axilOffsetY;
        const bz = (bud.z || 0) + 3.2;

        if (isBudHovered) {
          activeBudCount++;
          const pulse = 1.0 + Math.sin(timeSec * 8.0) * 0.18;
          tmpColor.setRGB(0.22, 1.0, 0.80); // Bright cyan-lime hover highlight
          pushSphere(bx, by, bz + 2.0, 3.1 * pulse, 3.6 * pulse, 3.1 * pulse, tmpColor);
        } else if (bud.state === 'SWELLING') {
          activeBudCount++;
          // Glowing crimson-lime swelling bud breaking dormancy!
          const budPhase = typeof bud.id === 'number'
            ? bud.id
            : (parseInt(String(bud.id).replace(/\D+/g, ''), 10) || 0);
          const pulse = 1.0 + Math.sin(timeSec * 6.0 + budPhase) * 0.15;
          const swell = bud.swell || 0.35;
          const r = (2.1 + swell * 2.3) * pulse;
          tmpColor.setRGB(0.96 - swell * 0.22, 0.54 + swell * 0.42, 0.34);
          pushSphere(bx, by, bz + 1.5, r, r * 1.32, r, tmpColor);
        } else {
          // Dormant Axillary Leaf-Bud or Latent Collar Bud: warm ruby-amber scale
          const isAxillary = bud.type === 'AXILLARY_LEAF_BUD';
          if (isAxillary) {
            tmpColor.setRGB(0.88, 0.46, 0.34);
            pushSphere(bx, by, bz, 1.75, 2.15, 1.75, tmpColor);
          } else {
            tmpColor.setRGB(0.76, 0.42, 0.35);
            pushSphere(bx, by, bz, 1.55, 1.85, 1.55, tmpColor);
          }
        }
      }
    }

    // 5. Petioles & Species-Specific Leaf Blades (Maple / Ulmus / Pine)
    let activeLeafCount = 0;
    if (bonsai.leaves) {
      for (const lf of bonsai.leaves) {
        if (lf.pruned) continue;
        const pSeg = bonsai.SegmentMap ? bonsai.SegmentMap.get(lf.parentSegId) : null;
        if (!pSeg || pSeg.pruned) continue;

        activeLeafCount++;
        const isDescHovered = hoveredDescSet ? hoveredDescSet.has(lf.parentSegId) : false;
        const isLeafHovered = hoveredLeafId === lf.id ||
          (activeTool === 'PINCH' && hoveredSegId === lf.parentSegId);
        const isCutHighlight = (activeTool === 'PRUNE' && isDescHovered);

        // Gentle organic breeze sway
        const breeze = Math.sin(timeSec * 2.2 + lf.x * 0.05 + lf.y * 0.04) * 0.06;
        const age = lf.age !== undefined ? lf.age : 1.0;
        const curPetioleLen = (lf.petioleLen || 8.0) * (0.3 + 0.7 * age);
        const pAngle = (lf.angle || 0) + breeze;

        const bladeBaseX = lf.x + Math.sin(pAngle) * curPetioleLen;
        const bladeBaseY = lf.y + Math.cos(pAngle) * curPetioleLen - 1.8 * age;
        const bladeBaseZ = (lf.z || 0) + 4.0 + (lf.side || 1) * 3.0;

        // Slender Reddish-Coral Petiole (highlighted if hovered for defoliation/pruning)
        if (isCutHighlight) {
          tmpColor.setRGB(1.0, 0.30, 0.35);
        } else if (isLeafHovered) {
          tmpColor.setRGB(1.0, 0.78, 0.25);
        } else {
          tmpColor.setRGB(0.85, 0.32, 0.32);
        }
        pushCylinder(lf.x, lf.y, lf.z || 0, bladeBaseX, bladeBaseY, bladeBaseZ, 0.65, 0.55, tmpColor);

        // Species Leaf Blade Instance
        if (leafIdx < MAX_LEAVES) {
          const radius = (lf.maxRadius || 16.0) * (0.18 + 0.82 * Math.pow(age, 0.82));
          dummyObj.position.set(bladeBaseX, bladeBaseY, bladeBaseZ);
          dummyObj.rotation.set(0.22, (lf.tiltZ || 0) * 0.35, -pAngle);
          dummyObj.scale.set(radius, radius, radius);
          dummyObj.updateMatrix();
          this.leafInstanced.setMatrixAt(leafIdx, dummyObj.matrix);

          const shade = lf.shadeLayer !== undefined ? lf.shadeLayer : 0.5;
          const hueOff = (lf.hueOffset || 0) * 0.002;

          if (isCutHighlight) {
            tmpColor.setRGB(1.0, 0.28, 0.38);
          } else if (isLeafHovered) {
            // Bright amber-cyan highlight in PINCH / Mekiri defoliation mode
            tmpColor.setRGB(1.0, 0.76, 0.24);
          } else if (seasonTheme === 'AUTUMN' && bonsai.species !== 'BONSAI_PINE') {
            // Autumn Momiji crimson & fiery orange (or golden yellow on Ulmus)
            const baseAutumnHue = bonsai.species === 'BONSAI_ULMUS' ? 0.09 : 0.03;
            tmpColor.setHSL(baseAutumnHue + hueOff, 0.88, 0.32 + shade * 0.24);
          } else if (age < 0.38 && bonsai.species !== 'BONSAI_PINE') {
            // Newly sprouted spring leaf: warm bronze-red / apricot transition to lime
            const bronzeMix = 1.0 - (age / 0.38);
            const hue = 0.05 * bronzeMix + (0.29 + hueOff) * (1.0 - bronzeMix);
            tmpColor.setHSL(hue, 0.82, 0.36 + shade * 0.22);
          } else {
            // Mature lush emerald green canopy with depth layering
            const baseHue = bonsai.species === 'BONSAI_PINE' ? 0.36 : 0.31;
            const sat = bonsai.species === 'BONSAI_PINE' ? 0.68 : 0.78;
            const light = 0.24 + shade * 0.30;
            tmpColor.setHSL(baseHue + hueOff, sat, light);
          }

          this.leafInstanced.setColorAt(leafIdx, tmpColor);
          leafIdx++;
        }
      }
    }

    // 6. Falling Pruned Clippings & Abscised Old Trunk Leaves Animation
    if (bonsai.fallingClips) {
      for (let i = bonsai.fallingClips.length - 1; i >= 0; i--) {
        const clip = bonsai.fallingClips[i];
        clip.x += clip.vx || 0;
        clip.y += clip.vy || -1.0;
        clip.vy = (clip.vy || 0) - 0.18;
        clip.alpha = (clip.alpha !== undefined ? clip.alpha : 1.0) - 0.032;
        if (clip.alpha <= 0) {
          bonsai.fallingClips.splice(i, 1);
          continue;
        }
        if (leafIdx < MAX_LEAVES) {
          const clipScale = clip.radius || clip.r || 15;
          dummyObj.position.set(clip.x, clip.y, (clip.z || 0) + 10);
          dummyObj.rotation.set(0.3, 0.2, clip.alpha * 3.0);
          dummyObj.scale.set(clipScale, clipScale, clipScale);
          dummyObj.updateMatrix();
          this.leafInstanced.setMatrixAt(leafIdx, dummyObj.matrix);
          tmpColor.setRGB(0.95 * clip.alpha, 0.42 * clip.alpha, 0.36 * clip.alpha);
          this.leafInstanced.setColorAt(leafIdx, tmpColor);
          leafIdx++;
        }
      }
    }

    // Commit instance buffers to GPU
    this.cylInstanced.count = cylIdx;
    this.cylInstanced.instanceMatrix.needsUpdate = true;
    if (this.cylInstanced.instanceColor) this.cylInstanced.instanceColor.needsUpdate = true;

    this.sphereInstanced.count = sphIdx;
    this.sphereInstanced.instanceMatrix.needsUpdate = true;
    if (this.sphereInstanced.instanceColor) this.sphereInstanced.instanceColor.needsUpdate = true;

    this.leafInstanced.count = leafIdx;
    this.leafInstanced.instanceMatrix.needsUpdate = true;
    if (this.leafInstanced.instanceColor) this.leafInstanced.instanceColor.needsUpdate = true;

    const baseTrunk = bonsai.segments && bonsai.segments[0];
    const trunkCaliberMm = baseTrunk ? +(baseTrunk.r0 * 1.45).toFixed(1) : 0.0;

    return {
      activeBudCount,
      activeLeafCount,
      activeBranchCount,
      trunkCaliberMm
    };
  }

  /**
   * Renders Pass 1 (3D Botanical Scene -> sceneRT) and Pass 2 (ASCII Shader -> Screen).
   */
  render() {
    this.renderer.setRenderTarget(this.sceneRT);
    this.renderer.render(this.bioScene, this.orthoCamera);

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.asciiPostScene, this.asciiPostCam);
  }

  /**
   * Updates WebGLRenderer viewport, supersampled offscreen RenderTarget size, and camera projection.
   * @param {number} width
   * @param {number} height
   * @param {object} [cameraController]
   */
  resize(width, height, cameraController = null) {
    this.viewW = Math.max(1, width || window.innerWidth);
    this.viewH = Math.max(1, height || window.innerHeight);

    this.renderer.setSize(this.viewW, this.viewH);

    if (cameraController && typeof cameraController.updateProjection === 'function') {
      cameraController.updateProjection(this.viewW, this.viewH);
    } else {
      const aspect = this.viewW / this.viewH;
      const frustumH = 380;
      const frustumW = frustumH * aspect;
      this.orthoCamera.left = -frustumW / 2;
      this.orthoCamera.right = frustumW / 2;
      this.orthoCamera.top = frustumH * 0.78;
      this.orthoCamera.bottom = -frustumH * 0.22;
      this.orthoCamera.updateProjectionMatrix();
    }

    const rtW = Math.max(256, Math.floor(this.viewW / 2.2));
    const rtH = Math.max(256, Math.floor(this.viewH / 2.2));
    this.sceneRT.setSize(rtW, rtH);

    this.asciiShaderMat.uniforms.uResolution.value.set(this.viewW, this.viewH);
  }

  /**
   * @returns {HTMLCanvasElement}
   */
  getDomElement() {
    return this.renderer.domElement;
  }

  /**
   * @returns {THREE.OrthographicCamera}
   */
  getCamera() {
    return this.orthoCamera;
  }
}
