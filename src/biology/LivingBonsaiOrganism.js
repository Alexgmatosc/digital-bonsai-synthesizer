import { createPRNG, SPECIES_PROFILES } from './SpeciesProfiles.js';

/**
 * Causal & Fractal Biological Bonsai Engine
 *
 * Models the complete ontogenetic cycle:
 *   Axillary Leaf-Bud (AXILLARY_LEAF_BUD) -> Swelling Bud -> Herbaceous Green Shoot
 *   -> Node Formation (Leaves + New Axillary Leaf-Buds) -> Multi-Order Fractal Branching
 *   -> Leonardo's Pipe Model + Cambial Thickening + Leaf Abscission -> Woody Trunk.
 */
export class LivingBonsaiOrganism {
  constructor(seed = 0x84A3F2, species = 'BONSAI_MAPLE', startMode = 'SEEDLING_SHOOT') {
    this.seed = typeof seed === 'number' ? seed : 0x84A3F2;
    this.species = SPECIES_PROFILES[species] ? species : 'BONSAI_MAPLE';
    this.startMode = startMode || 'SEEDLING_SHOOT';
    this.profile = SPECIES_PROFILES[this.species];
    this.rng = createPRNG(this.seed);

    this.segments = [];
    this.SegmentMap = new Map();
    this.buds = [];
    this.leaves = [];
    this.nebariRoots = [];
    this.pellets = [];
    this.fallingClips = [];
    this.undoStack = [];

    this.simDays = 1;
    this.nextId = 1;
    this.lastFlushDay = 0;

    if (this.startMode === 'TRAINED_TRUNK') {
      this.initTrainedTrunkAndDormantBuds();
      // Pre-grow initial spring canopy flush so trained pre-bonsai starts with lush shoots
      for (let i = 0; i < 65; i++) {
        this.stepBiology(0.05);
      }
      this.undoStack = [];
    } else {
      this.initSeedlingShoot();
    }
  }

  /**
   * Initializes soil pellets and embryonic/mature Nebari surface roots.
   */
  _initSoilAndNebari(initialTrunkRadius) {
    const rng = this.rng;
    this.nebariRoots = [];
    this.pellets = [];

    const scale = Math.max(0.12, initialTrunkRadius / 22.0);
    const numRoots = 8 + Math.floor(rng() * 3);
    for (let i = 0; i < numRoots; i++) {
      const frac = (i / (numRoots - 1)) * 2 - 1;
      const angle = frac * 1.35 + (rng() - 0.5) * 0.15;
      const fullLen = 34 + Math.abs(frac) * 20 + rng() * 14;
      const fullR0 = 9.5 - Math.abs(frac) * 3.0;
      const fullR1 = 2.2;
      const z0 = (rng() - 0.5) * 8;
      const y1 = -5 - rng() * 4;
      const z1Full = Math.cos(angle) * 14;

      const reachScale = 0.32 + 0.68 * Math.min(1.3, scale);
      this.nebariRoots.push({
        frac,
        angle,
        fullLen,
        fullR0,
        fullR1,
        z1Full,
        x0: frac * 10 * reachScale,
        y0: 2,
        z0,
        x1: Math.sin(angle) * fullLen * reachScale,
        y1,
        z1: z1Full * reachScale,
        r0: Math.max(0.55, fullR0 * scale),
        r1: Math.max(0.28, fullR1 * scale)
      });
    }

    // White Tamahi Organic Fertilizer Cakes on the soil rim
    const pelletX = [-82, -54, -25, 48, 78];
    for (const px of pelletX) {
      this.pellets.push({
        x: px + (rng() - 0.5) * 8,
        y: -2.5,
        z: 8 + (rng() - 0.5) * 10,
        rx: 8.5 + rng() * 2.0,
        ry: 4.2 + rng() * 1.0
      });
    }
  }

  /**
   * Scales Nebari surface roots proportionally to the basal trunk radius.
   */
  _updateNebariFromTrunk() {
    const baseSeg = this.segments[0];
    if (!baseSeg) return;
    const scale = Math.max(0.12, baseSeg.r0 / 22.0);
    const reachScale = 0.32 + 0.68 * Math.min(1.35, scale);

    for (const root of this.nebariRoots) {
      if (root.fullR0 === undefined) continue;
      root.x0 = root.frac * 10 * reachScale;
      root.x1 = Math.sin(root.angle) * root.fullLen * reachScale;
      root.z1 = root.z1Full * reachScale;
      root.r0 = Math.max(0.55, root.fullR0 * scale);
      root.r1 = Math.max(0.28, root.fullR1 * scale);
    }
  }

  /**
   * Mode A: 'SEEDLING_SHOOT'
   * Starts as a single young tender green shoot (r0 = 1.4, r1 = 1.1, woodiness = 0.0,
   * generation = 0, remainingInternodes = 4) emerging from the moss mound (y0 = -2 to y1 = 26).
   */
  initSeedlingShoot() {
    const rng = this.rng;
    this.segments = [];
    this.SegmentMap.clear();
    this.buds = [];
    this.leaves = [];
    this.fallingClips = [];
    this.undoStack = [];
    this.simDays = 1;

    const initialR0 = 1.4;
    const initialR1 = 1.1;
    this._initSoilAndNebari(initialR0);

    const leanAngle = (rng() - 0.5) * 0.14;
    const shootLen = 28.0;
    const x1 = Math.sin(leanAngle) * shootLen;
    const y1 = -2 + Math.cos(leanAngle) * shootLen; // ~26

    const baseShoot = this.createSegment({
      parentId: null,
      type: 'INTERNODE',
      x0: 0,
      y0: -2,
      z0: 0,
      x1,
      y1,
      z1: 0,
      r0: initialR0,
      r1: initialR1,
      woodiness: 0.0,
      generation: 0,
      internodeIdx: 0,
      curT: 0.35,
      dirAngle: leanAngle,
      dirZ: (rng() - 0.5) * 0.15,
      remainingInternodes: 4,
      hasChopScar: false,
      scarStyle: null,
      hasWire: false
    });

    // Add 2 latent basal epicormic buds near the lower collar for future back-budding if chopped low
    for (const side of [-1, 1]) {
      const bAng = leanAngle + side * 0.52;
      this.buds.push({
        id: `BUD_${this.nextId++}`,
        parentSegId: baseShoot.id,
        attachFrac: 0.45 + (side > 0 ? 0.12 : 0.0),
        leafId: null,
        side,
        type: 'LATENT_TRUNK',
        state: 'DORMANT',
        swell: 0.15,
        x: x1 * 0.5 + side * 1.2,
        y: 10 + side * 2,
        z: side * 1.0,
        dirAngle: bAng,
        dirZ: (rng() - 0.5) * 0.25,
        generation: 1,
        remainingInternodes: 3,
        hasWire: false,
        pruned: false
      });
    }
  }

  /**
   * Mode B: 'TRAINED_TRUNK'
   * Starts with the muscular multi-head chopped bonsai trunk (TRUNK + 3-4 TRUNK_HEAD pillars
   * with chop scars, Nebari flare, Tamahi pellets, and collar buds).
   */
  initTrainedTrunkAndDormantBuds() {
    const rng = this.rng;
    this.segments = [];
    this.SegmentMap.clear();
    this.buds = [];
    this.leaves = [];
    this.fallingClips = [];
    this.undoStack = [];
    this.simDays = 1;

    const baseRadius = 22.0 + rng() * 4.0;
    this._initSoilAndNebari(baseRadius);

    const leanX = (rng() - 0.5) * 12;

    const trunkBase = this.createSegment({
      parentId: null,
      type: 'TRUNK',
      x0: 0,
      y0: -2,
      z0: 0,
      x1: leanX,
      y1: 38 + rng() * 8,
      z1: 0,
      r0: baseRadius,
      r1: baseRadius * 0.78,
      woodiness: 1.0,
      generation: 0,
      internodeIdx: 0,
      curT: 1.0,
      hasChopScar: true,
      scarStyle: 'DARK_PASTE'
    });

    const numHeads = 3 + (rng() > 0.45 ? 1 : 0);
    const spreadAngles = numHeads === 4
      ? [-0.56, -0.18, 0.16, 0.52]
      : [-0.46, -0.02, 0.44];

    for (let h = 0; h < numHeads; h++) {
      const ang = spreadAngles[h] + (rng() - 0.5) * 0.15;
      const isCenter = Math.abs(ang) < 0.24;
      const len = (isCenter ? 42 : 32) + rng() * 12;
      const startX = trunkBase.x1 + ang * 16;
      const startY = trunkBase.y1 - Math.abs(ang) * 8;
      const startZ = (h % 2 === 0 ? 1 : -1) * 4;

      const endX = startX + Math.sin(ang) * len;
      const endY = startY + Math.cos(ang) * len;
      const endZ = startZ + (rng() - 0.5) * 8;
      const headR = (isCenter ? 11.5 : 9.0) + rng() * 2.0;

      const headSeg = this.createSegment({
        parentId: trunkBase.id,
        type: 'TRUNK_HEAD',
        x0: startX,
        y0: startY,
        z0: startZ,
        x1: endX,
        y1: endY,
        z1: endZ,
        r0: headR,
        r1: headR * 0.80,
        woodiness: 0.96,
        generation: 0,
        internodeIdx: 1,
        curT: 1.0,
        dirAngle: ang,
        dirZ: 0,
        hasChopScar: true,
        scarStyle: h === 0 ? 'DARK_PASTE' : 'CALLUS_BEVEL'
      });

      const budOffsets = [-0.52, 0.05, 0.52, rng() > 0.5 ? -0.82 : 0.82];
      for (let b = 0; b < budOffsets.length; b++) {
        const bAng = ang * 0.75 + budOffsets[b] + (rng() - 0.5) * 0.14;
        const attachFrac = b < 2 ? 0.92 : 0.55 + rng() * 0.3;
        const bx = startX + (endX - startX) * attachFrac + Math.sin(bAng) * (headR * 0.65);
        const by = startY + (endY - startY) * attachFrac;
        const bz = startZ + (endZ - startZ) * attachFrac + (rng() - 0.5) * 6;

        const isInitiallyActive = b < 2;
        const side = bOffsetsSign(budOffsets[b]);
        const budObj = {
          id: `BUD_${this.nextId++}`,
          parentSegId: headSeg.id,
          attachFrac,
          leafId: null,
          side,
          type: isInitiallyActive ? 'COLLAR_ACTIVE' : 'LATENT_TRUNK',
          state: isInitiallyActive ? 'SWELLING' : 'DORMANT',
          swell: isInitiallyActive ? 0.4 + rng() * 0.5 : 0.15,
          x: bx,
          y: by,
          z: bz,
          dirAngle: bAng,
          dirZ: (rng() - 0.5) * 0.35,
          generation: 1,
          remainingInternodes: 3 + Math.floor(rng() * 2),
          hasWire: h === numHeads - 1 && b === 1,
          pruned: false
        };
        this.buds.push(budObj);
        headSeg.nodeBudIds.push(budObj.id);
      }
    }
  }

  createSegment(cfg) {
    const seg = {
      id: `SEG_${this.nextId++}`,
      parentId: cfg.parentId || null,
      type: cfg.type || 'INTERNODE', // 'TRUNK' | 'TRUNK_HEAD' | 'INTERNODE'
      attachFrac: cfg.attachFrac !== undefined ? cfg.attachFrac : 1.0,
      x0: cfg.x0,
      y0: cfg.y0,
      z0: cfg.z0 || 0,
      x1: cfg.x1,
      y1: cfg.y1,
      z1: cfg.z1 || 0,
      r0: cfg.r0 !== undefined ? cfg.r0 : 2.0,
      r1: cfg.r1 !== undefined ? cfg.r1 : 1.6,
      woodiness: cfg.woodiness !== undefined ? cfg.woodiness : 0.0,
      generation: cfg.generation !== undefined ? cfg.generation : 1,
      internodeIdx: cfg.internodeIdx || 0,
      curT: cfg.curT !== undefined ? cfg.curT : 0.04,
      dirAngle: cfg.dirAngle || 0,
      dirZ: cfg.dirZ || 0,
      remainingInternodes: cfg.remainingInternodes || 0,
      hasNodeFormed: cfg.curT >= 1.0,
      hasChopScar: cfg.hasChopScar || false,
      scarStyle: cfg.scarStyle || null,
      hasWire: cfg.hasWire || false,
      auxin: 0,
      cytokinin: 0.5,
      phloemFlux: 0,
      pruned: false,
      childrenIds: [],
      nodeBudIds: [],
      nodeLeafIds: []
    };
    this.segments.push(seg);
    this.SegmentMap.set(seg.id, seg);
    if (seg.parentId && this.SegmentMap.has(seg.parentId)) {
      this.SegmentMap.get(seg.parentId).childrenIds.push(seg.id);
    }
    return seg;
  }

  /**
   * Main Causal Biological Simulation Tick with internal sub-stepping (maxStep = 0.05)
   * so turbo 30x speed is rock-solid and deterministic.
   */
  stepBiology(dt) {
    if (!dt || dt <= 0) return;
    const maxStep = 0.05;
    let remaining = Math.min(dt, 12.0);
    while (remaining > 1e-6) {
      const subDt = Math.min(maxStep, remaining);
      this._stepSubBiology(subDt);
      remaining -= subDt;
    }
  }

  _stepSubBiology(dt) {
    const rng = this.rng;
    const profile = this.profile;
    this.simDays += dt * 4.5;

    // 1. Reset hormones and count active segments
    let activeSegCount = 0;
    for (const seg of this.segments) {
      seg.auxin = 0;
      seg.phloemFlux = 0;
      if (!seg.pruned) {
        activeSegCount++;
      }
    }

    // 2. Basipetal Auxin (A) downward from active elongating segments (curT < 1) & swelling buds
    let activeMeristemCount = 0;
    for (const seg of this.segments) {
      if (seg.pruned) continue;
      if (seg.curT < 1.0) {
        activeMeristemCount++;
        this.propagateAuxinDown(seg.id, 0.95);
      }
    }
    for (const bud of this.buds) {
      if (bud.pruned || bud.state === 'SPENT') continue;
      if (bud.state === 'SWELLING') {
        activeMeristemCount++;
        // Propagate auxin below the bud's parent segment so twin opposite buds on the SAME node don't inhibit each other
        const pSeg = this.SegmentMap.get(bud.parentSegId);
        if (pSeg && pSeg.parentId) {
          this.propagateAuxinDown(pSeg.parentId, 0.55);
        }
      }
    }

    // 3. Acropetal Cytokinin (C) / Root Sap Vigor upward & Bud Dormancy Release
    const baseSeg = this.segments[0];
    const rootVigor = baseSeg ? Math.min(2.6, 0.75 + baseSeg.r0 * 0.07) : 1.0;

    // Periodic seasonal flush pulse so a seedling continuously develops 4-6 fractal branching orders
    const isFlushWindow = (this.simDays - this.lastFlushDay) >= 18.0;
    const seasonalPulse = isFlushWindow ? 0.55 : 0.0;

    for (const seg of this.segments) {
      if (seg.pruned) continue;
      const distPenalty = Math.pow(0.92, seg.generation);
      const chopBoost = seg.hasChopScar ? 0.85 : 0.0;
      const terminalBoost = seg.childrenIds.length === 0 ? 0.35 : 0.15;
      seg.cytokinin = rootVigor * distPenalty + chopBoost + terminalBoost + seasonalPulse;
    }

    // Dynamic target active meristems: scales with tree development up to canopy cap
    const maxCanopySegments = 220;
    const desiredMeristems = activeSegCount >= maxCanopySegments
      ? 0
      : Math.min(10, Math.max(4, 3 + Math.floor(activeSegCount / 8)));

    if (activeSegCount < maxCanopySegments && (activeMeristemCount < desiredMeristems || isFlushWindow)) {
      if (isFlushWindow) {
        this.lastFlushDay = this.simDays;
      }

      const candidates = [];
      for (const b of this.buds) {
        if (b.pruned || b.state !== 'DORMANT') continue;
        // Cap automatic branching at generation 5 so tree stays refined
        if (b.generation > 5) continue;
        const pSeg = this.SegmentMap.get(b.parentSegId);
        if (!pSeg || pSeg.pruned || pSeg.curT < 0.95) continue;

        // Hormone ratio C / (1 + beta * A)
        const hormoneRatio = pSeg.cytokinin / (1.0 + 1.8 * pSeg.auxin);
        const threshold = b.type === 'AXILLARY_LEAF_BUD' ? 0.42 : 0.52;
        if (hormoneRatio >= threshold || pSeg.auxin < 0.38) {
          candidates.push({ bud: b, pSeg, hormoneRatio });
        }
      }

      if (candidates.length > 0) {
        // Prioritize axillary leaf-buds across developing generations + chopped stubs
        candidates.sort((a, b) => {
          const scoreA =
            (a.pSeg.hasChopScar ? 3.5 : 0) +
            (a.bud.type === 'AXILLARY_LEAF_BUD' ? 1.5 : 0.4) +
            a.bud.generation * 0.45 +
            a.hormoneRatio * 0.8 +
            rng() * 0.45;
          const scoreB =
            (b.pSeg.hasChopScar ? 3.5 : 0) +
            (b.bud.type === 'AXILLARY_LEAF_BUD' ? 1.5 : 0.4) +
            b.bud.generation * 0.45 +
            b.hormoneRatio * 0.8 +
            rng() * 0.45;
          return scoreB - scoreA;
        });

        const wakeBudget = Math.max(2, desiredMeristems - activeMeristemCount);
        const toWake = Math.min(candidates.length, wakeBudget);
        for (let i = 0; i < toWake; i++) {
          const picked = candidates[i].bud;
          picked.state = 'SWELLING';
          picked.swell = Math.max(picked.swell, 0.25);

          // For opposite decussate species (Maple), often wake the opposite twin bud on the same node
          // so natural dichotomous Y-branching emerges organically!
          if (profile.phyllotaxy === 'OPPOSITE_DECUSSATE' && activeSegCount < maxCanopySegments - 10) {
            for (const twinId of candidates[i].pSeg.nodeBudIds) {
              if (twinId === picked.id) continue;
              const twin = this.buds.find(x => x.id === twinId);
              if (twin && !twin.pruned && twin.state === 'DORMANT' && rng() < 0.72) {
                twin.state = 'SWELLING';
                twin.swell = Math.max(twin.swell, 0.22);
              }
            }
          }
        }
      }
    }

    // 4. Anchor Buds to Parent Node/Axil & Advance Swelling Buds -> Sprout New Internode Shoots!
    for (const bud of this.buds) {
      if (bud.pruned) continue;
      const pSeg = this.SegmentMap.get(bud.parentSegId);
      if (!pSeg || pSeg.pruned) {
        bud.pruned = true;
        continue;
      }

      // Keep bud (x, y, z) anchored to parent node/axil as parent elongates or thickens
      const pCurX1 = pSeg.x0 + (pSeg.x1 - pSeg.x0) * pSeg.curT;
      const pCurY1 = pSeg.y0 + (pSeg.y1 - pSeg.y0) * pSeg.curT;
      const pCurZ1 = pSeg.z0 + (pSeg.z1 - pSeg.z0) * pSeg.curT;
      const frac = bud.attachFrac !== undefined ? bud.attachFrac : 0.98;
      const axX = pSeg.x0 + (pCurX1 - pSeg.x0) * frac;
      const axY = pSeg.y0 + (pCurY1 - pSeg.y0) * frac;
      const axZ = pSeg.z0 + (pCurZ1 - pSeg.z0) * frac;
      const rAtFrac = pSeg.r0 + (pSeg.r1 - pSeg.r0) * frac;
      const radialOffset = Math.min(8.5, rAtFrac * 0.72 + 1.1);

      bud.x = axX + Math.sin(bud.dirAngle) * radialOffset;
      bud.y = axY + Math.cos(bud.dirAngle) * 1.1;
      bud.z = axZ + (bud.side || 0) * 1.5;

      if (bud.state === 'SWELLING' && pSeg.curT >= 0.95) {
        bud.swell += dt * 1.05;
        if (bud.swell >= 1.0) {
          bud.state = 'SPENT';
          this.sproutInternodeFromBud(bud, pSeg);
        }
      }
    }

    // 5. Elongate Active Internode Shoots & Form Species-Specific Nodes (Leaves + Axillary Leaf-Buds)
    for (const seg of this.segments) {
      if (seg.pruned) continue;

      // Keep segment base locked to parent attachment point
      if (seg.parentId && this.SegmentMap.has(seg.parentId)) {
        const pSeg = this.SegmentMap.get(seg.parentId);
        if (pSeg.type === 'INTERNODE') {
          const frac = seg.attachFrac !== undefined ? seg.attachFrac : 1.0;
          const pCurX1 = pSeg.x0 + (pSeg.x1 - pSeg.x0) * pSeg.curT;
          const pCurY1 = pSeg.y0 + (pSeg.y1 - pSeg.y0) * pSeg.curT;
          const pCurZ1 = pSeg.z0 + (pSeg.z1 - pSeg.z0) * pSeg.curT;
          const targetX0 = pSeg.x0 + (pCurX1 - pSeg.x0) * frac;
          const targetY0 = pSeg.y0 + (pCurY1 - pSeg.y0) * frac;
          const targetZ0 = pSeg.z0 + (pCurZ1 - pSeg.z0) * frac;

          const dx = targetX0 - seg.x0;
          const dy = targetY0 - seg.y0;
          const dz = targetZ0 - seg.z0;
          if (Math.abs(dx) > 1e-5 || Math.abs(dy) > 1e-5 || Math.abs(dz) > 1e-5) {
            seg.x0 += dx;
            seg.y0 += dy;
            seg.z0 += dz;
            seg.x1 += dx;
            seg.y1 += dy;
            seg.z1 += dz;
          }
        }
      }

      if (seg.curT < 1.0) {
        seg.curT = Math.min(1.0, seg.curT + dt * 0.95);
        if (seg.curT >= 1.0 && !seg.hasNodeFormed) {
          seg.hasNodeFormed = true;
          this.formNodeAtTip(seg);
        }
      }
    }

    // 6. Leaf Maturation, Anchor Update & Leaf Abscission on Lignified Wood (woodiness > 0.62)
    for (const lf of this.leaves) {
      if (lf.pruned) continue;
      const pSeg = this.SegmentMap.get(lf.parentSegId);
      if (!pSeg || pSeg.pruned) {
        lf.pruned = true;
        continue;
      }

      const pCurX1 = pSeg.x0 + (pSeg.x1 - pSeg.x0) * pSeg.curT;
      const pCurY1 = pSeg.y0 + (pSeg.y1 - pSeg.y0) * pSeg.curT;
      const pCurZ1 = pSeg.z0 + (pSeg.z1 - pSeg.z0) * pSeg.curT;
      lf.x = pSeg.x0 + (pCurX1 - pSeg.x0) * lf.attachT;
      lf.y = pSeg.y0 + (pCurY1 - pSeg.y0) * lf.attachT;
      lf.z = pSeg.z0 + (pCurZ1 - pSeg.z0) * lf.attachT;

      if (lf.age < 1.0) {
        lf.age = Math.min(1.0, lf.age + dt * 0.42);
      }

      // Abscission of old nodal leaves once supporting stem has lignified into woody branch/trunk
      if (pSeg.woodiness > profile.abscissionWoodiness && lf.age >= 1.0) {
        lf.pruned = true;
        lf.abscised = true;
        this.fallingClips.push({
          x: lf.x,
          y: lf.y,
          z: lf.z,
          vx: (rng() - 0.5) * 1.2,
          vy: -0.35,
          r: lf.maxRadius * 0.45,
          alpha: 1.0
        });
      }
    }

    // 7. Leonardo's Pipe Model + Irreversible Cambial Thickening (bottom-up from tips to basal trunk)
    this._applyPipeModelAndCambialGrowth(dt);

    // 8. Scale Nebari roots proportionally to basal trunk radius
    this._updateNebariFromTrunk();
  }

  /**
   * Bottom-up Leonardo Pipe Model (R_target^alpha = sum R_child^alpha + sum r_leaf^alpha)
   * combined with irreversible cambial ring deposition and strict acropetal taper (r_base > r_mid > r_tip).
   */
  _applyPipeModelAndCambialGrowth(dt) {
    const profile = this.profile;
    const alpha = profile.pipeAlpha;
    const invAlpha = 1.0 / alpha;

    // Pre-accumulate leaf vascular demand and photosynthetic sugar production per segment
    const leafPipeMap = new Map();
    const leafFluxMap = new Map();
    for (const lf of this.leaves) {
      if (lf.pruned) continue;
      const vigor = 0.35 + 0.65 * lf.age;
      const rLeafPipe = profile.leafPipeRadius * vigor;
      const pipeTerm = Math.pow(rLeafPipe, alpha);
      leafPipeMap.set(lf.parentSegId, (leafPipeMap.get(lf.parentSegId) || 0) + pipeTerm);
      leafFluxMap.set(lf.parentSegId, (leafFluxMap.get(lf.parentSegId) || 0) + vigor);
    }

    // Pass A: Traverse segments in reverse topological order (children before parents)
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      if (seg.pruned) continue;

      let childPipeSum = 0;
      let maxChildR0 = 0;
      let childFluxSum = 0;
      let activeChildCount = 0;

      for (const cid of seg.childrenIds) {
        const child = this.SegmentMap.get(cid);
        if (!child || child.pruned) continue;
        activeChildCount++;
        // Junction flare factor 1.04 ensures parent cross-section exceeds sum of children pipes
        childPipeSum += Math.pow(child.r0 * 1.04, alpha);
        if (child.r0 > maxChildR0) {
          maxChildR0 = child.r0;
        }
        childFluxSum += child.phloemFlux;
      }

      const ownLeafPipe = leafPipeMap.get(seg.id) || 0;
      const ownLeafFlux = leafFluxMap.get(seg.id) || 0;
      const elongatingFlux = seg.curT < 1.0 ? 0.45 : 0.14;

      seg.phloemFlux = ownLeafFlux + childFluxSum + elongatingFlux;

      const totalPipeSum = childPipeSum + ownLeafPipe;
      const pipeTargetR0 = totalPipeSum > 0 ? Math.pow(totalPipeSum, invAlpha) : seg.r0;

      // Maximum anatomical radius by hierarchy and internode index
      const isRootBase = i === 0;
      const depthDecay = Math.pow(0.92, seg.internodeIdx || 0);
      const maxR = isRootBase
        ? profile.maxTrunkRadius
        : seg.generation === 0
          ? profile.maxTrunkRadius * 0.86 * depthDecay
          : Math.max(2.6, profile.maxTrunkRadius * Math.pow(0.68, seg.generation) * depthDecay);

      // Cambial secondary xylem ring deposition (irreversible wood memory)
      const genBoost = isRootBase
        ? 2.20
        : seg.generation === 0
          ? 1.45 * depthDecay
          : seg.generation === 1
            ? 1.05
            : Math.pow(0.76, seg.generation - 1);

      const cambiumDelta =
        dt * profile.cambiumRate * Math.pow(Math.max(0.12, seg.phloemFlux), 0.65) * genBoost;
      const pipeDelta =
        pipeTargetR0 > seg.r0 ? dt * 2.4 * (pipeTargetR0 - seg.r0) : 0;

      seg.r0 = Math.min(maxR, seg.r0 + pipeDelta + cambiumDelta);

      if (activeChildCount > 0) {
        const minR1FromChild = maxChildR0 * 1.03;
        const targetR1 = Math.max(seg.r1 + (pipeDelta + cambiumDelta) * 0.80, minR1FromChild);
        seg.r1 = Math.min(seg.r0 * 0.93, targetR1);
        seg.r0 = Math.min(maxR, Math.max(seg.r0, seg.r1 * 1.06, pipeTargetR0 * 0.94));
      } else {
        seg.r1 = Math.max(0.85, Math.min(seg.r0 * 0.84, seg.r1 + cambiumDelta * 0.42));
      }

      // Progressive lignification (0.0 herbaceous shoot -> 1.0 mature fissured bark)
      if (seg.type === 'INTERNODE' && seg.curT >= 0.95) {
        const fluxLignin = dt * profile.lignificationRate * (0.30 + 0.25 * Math.min(2.5, seg.phloemFlux * 0.2));
        const radialLignin = Math.max(0, (seg.r0 - 1.4) / 4.8);
        seg.woodiness = Math.min(1.0, Math.max(seg.woodiness + fluxLignin, radialLignin));
      }
    }

    // Pass B: Top-down strict taper invariant enforcement (r_parent_0 > r_parent_1 > r_child_0 > r_child_1)
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (seg.pruned) continue;
      if (seg.r1 >= seg.r0 * 0.96) {
        seg.r1 = seg.r0 * 0.92;
      }
      for (const cid of seg.childrenIds) {
        const child = this.SegmentMap.get(cid);
        if (!child || child.pruned) continue;
        if (child.r0 >= seg.r1 * 0.97) {
          child.r0 = seg.r1 * 0.95;
        }
        if (child.r1 >= child.r0 * 0.95) {
          child.r1 = child.r0 * 0.88;
        }
      }
    }
  }

  propagateAuxinDown(segId, amount) {
    const decay = this.profile.apicalDominanceDecay;
    let curId = segId;
    let curAux = amount;
    while (curId && curAux > 0.04) {
      const seg = this.SegmentMap.get(curId);
      if (!seg || seg.pruned) break;
      seg.auxin += curAux;
      curId = seg.parentId;
      curAux *= decay;
    }
  }

  sproutInternodeFromBud(bud, parentSeg) {
    const rng = this.rng;
    const profile = this.profile;
    const gen = bud.generation || 1;

    // Fractal internode length contraction: L_k = L_0 * (contraction)^(k-1)
    const contraction = Math.pow(profile.internodeContraction, Math.max(0, gen - 1));
    const len = (profile.baseInternodeLen + rng() * profile.internodeLenVar) * contraction;

    // Phototropism + outward crown spread
    const angle = bud.dirAngle * 0.90 + (rng() - 0.5) * 0.14;
    const attachFrac = bud.attachFrac !== undefined ? bud.attachFrac : 0.98;

    const pCurX1 = parentSeg.x0 + (parentSeg.x1 - parentSeg.x0) * parentSeg.curT;
    const pCurY1 = parentSeg.y0 + (parentSeg.y1 - parentSeg.y0) * parentSeg.curT;
    const pCurZ1 = parentSeg.z0 + (parentSeg.z1 - parentSeg.z0) * parentSeg.curT;

    const startX = parentSeg.x0 + (pCurX1 - parentSeg.x0) * attachFrac;
    const startY = parentSeg.y0 + (pCurY1 - parentSeg.y0) * attachFrac;
    const startZ = parentSeg.z0 + (pCurZ1 - parentSeg.z0) * attachFrac;

    const endX = startX + Math.sin(angle) * len;
    const endY = Math.max(6.0, startY + Math.cos(angle) * len);
    const endZ = startZ + Math.sin(bud.dirZ) * (len * 0.35);

    const startR = Math.max(1.0, Math.min(2.2, parentSeg.r1 * 0.68));

    this.createSegment({
      parentId: parentSeg.id,
      type: 'INTERNODE',
      attachFrac,
      x0: startX,
      y0: startY,
      z0: startZ,
      x1: endX,
      y1: endY,
      z1: endZ,
      r0: startR,
      r1: Math.max(0.85, startR * 0.84),
      woodiness: 0.02,
      generation: gen,
      internodeIdx: 0,
      curT: 0.06,
      dirAngle: angle,
      dirZ: bud.dirZ,
      remainingInternodes: Math.max(0, (bud.remainingInternodes || 2) - 1),
      hasWire: bud.hasWire
    });
  }

  /**
   * Called when an internode reaches full length (curT == 1.0).
   * Spawns leaves and AXILLARY_LEAF_BUDs according to species phyllotaxy,
   * and continues apical elongation if remainingInternodes > 0.
   */
  formNodeAtTip(seg) {
    const rng = this.rng;
    const profile = this.profile;
    const isTerminal = seg.remainingInternodes <= 0;
    const ramScale = Math.pow(profile.leafScaleContraction, Math.max(0, seg.generation - 1));

    let nodeSides = [-1, 1];
    if (profile.phyllotaxy === 'ALTERNATE_ZIGZAG') {
      // Alternate distichous phyllotaxy: 1 leaf + 1 alternating axillary leaf-bud per node
      const altSide = (seg.internodeIdx + seg.generation) % 2 === 0 ? 1 : -1;
      nodeSides = [altSide];
    } else if (profile.phyllotaxy === 'WHORLED_CANDLE') {
      nodeSides = isTerminal ? [-1, 0, 1] : [-1, 1];
    }

    for (const side of nodeSides) {
      const effectiveSide = side === 0 ? (rng() > 0.5 ? 1 : -1) : side;
      const spreadAng =
        profile.branchAngleMin + rng() * (profile.branchAngleMax - profile.branchAngleMin);
      const budAngle =
        side === 0
          ? seg.dirAngle + (rng() - 0.5) * 0.22
          : seg.dirAngle + side * spreadAng;

      // Spawn leaf at node (for pine whorl center bud, pair with needle cluster too)
      let leafId = null;
      if (side !== 0 || profile.phyllotaxy !== 'WHORLED_CANDLE') {
        const leafAngle =
          seg.dirAngle + effectiveSide * (profile.leafAngleBase + rng() * profile.leafAngleSpread);
        leafId = `LF_${this.nextId++}`;
        const budIdPlaceholder = `BUD_${this.nextId}`;

        this.leaves.push({
          id: leafId,
          parentSegId: seg.id,
          budId: budIdPlaceholder,
          attachT: 0.98,
          x: seg.x1,
          y: seg.y1,
          z: seg.z1,
          side: effectiveSide,
          angle: leafAngle,
          tiltZ: effectiveSide * 0.25 + (rng() - 0.5) * 0.3,
          maxRadius: (isTerminal ? 18 + rng() * 6 : 24 + rng() * 8) * ramScale,
          petioleLen: (isTerminal ? 9 + rng() * 4 : 13 + rng() * 5) * ramScale,
          age: 0.05,
          shadeLayer: 0.45 + rng() * 0.55,
          hueOffset: (rng() - 0.5) * 14,
          pruned: false
        });
        seg.nodeLeafIds.push(leafId);
      }

      // Spawn Axillary Leaf-Bud sitting directly in the leaf axil
      const axBud = {
        id: `BUD_${this.nextId++}`,
        parentSegId: seg.id,
        attachFrac: 0.98,
        leafId,
        side: effectiveSide,
        type: 'AXILLARY_LEAF_BUD',
        state: 'DORMANT',
        swell: 0.2,
        x: seg.x1 + Math.sin(budAngle) * (seg.r1 * 0.8 + 1.1),
        y: seg.y1 + Math.cos(budAngle) * 1.1,
        z: seg.z1 + effectiveSide * 1.5,
        dirAngle: budAngle,
        dirZ: seg.dirZ + (rng() - 0.5) * 0.32,
        generation: seg.generation + 1,
        remainingInternodes: seg.generation === 0 ? 3 : 2 + (rng() > 0.55 ? 1 : 0),
        hasWire: false,
        pruned: false
      };
      this.buds.push(axBud);
      seg.nodeBudIds.push(axBud.id);
    }

    // Continue Apical Meristem into the next internode if remainingInternodes > 0
    if (seg.remainingInternodes > 0) {
      const contraction = Math.pow(profile.internodeContraction, Math.max(0, seg.generation));
      const nextLen = (profile.baseInternodeLen + rng() * profile.internodeLenVar) * contraction;

      // In Ulmus (ALTERNATE_ZIGZAG), deflect stem in opposite direction of the alternating leaf (±14°)
      let deflection = (rng() - 0.5) * 0.16;
      if (profile.phyllotaxy === 'ALTERNATE_ZIGZAG') {
        const altSide = (seg.internodeIdx + seg.generation) % 2 === 0 ? 1 : -1;
        deflection = -altSide * profile.stemDeflectionRad + (rng() - 0.5) * 0.06;
      }

      const nextAng = seg.dirAngle * 0.94 + deflection;
      const endX = seg.x1 + Math.sin(nextAng) * nextLen;
      const endY = Math.max(8.0, seg.y1 + Math.cos(nextAng) * nextLen);
      const endZ = seg.z1 + Math.sin(seg.dirZ) * (nextLen * 0.3);

      this.createSegment({
        parentId: seg.id,
        type: 'INTERNODE',
        attachFrac: 1.0,
        x0: seg.x1,
        y0: seg.y1,
        z0: seg.z1,
        x1: endX,
        y1: endY,
        z1: endZ,
        r0: seg.r1,
        r1: Math.max(0.85, seg.r1 * 0.85),
        woodiness: 0.0,
        generation: seg.generation,
        internodeIdx: seg.internodeIdx + 1,
        curT: 0.04,
        dirAngle: nextAng,
        dirZ: seg.dirZ,
        remainingInternodes: seg.remainingInternodes - 1,
        hasWire: seg.hasWire && seg.internodeIdx < 2
      });
    }
  }

  /**
   * Prunes any segment (except the basal root segment segments[0]) and all its descendants.
   * Immediately eliminates apical dominance above the cut and wakes dormant AXILLARY_LEAF_BUDs
   * on the parent segment and lower wood.
   */
  pruneSegment(segId) {
    const seg = this.SegmentMap.get(segId);
    if (!seg || seg.pruned) return false;
    // Allow pruning any segment except the root base segments[0]
    if (this.segments[0] && seg.id === this.segments[0].id) return false;
    if (!seg.parentId) return false;

    const descSegIds = [];
    this.collectDescendants(segId, descSegIds);

    const affectedBuds = [];
    const affectedLeaves = [];
    const parentSeg = this.SegmentMap.get(seg.parentId);

    for (const id of descSegIds) {
      const s = this.SegmentMap.get(id);
      if (!s || s.pruned) continue;
      s.pruned = true;

      this.fallingClips.push({
        x: (s.x0 + s.x1) * 0.5,
        y: (s.y0 + s.y1) * 0.5,
        z: s.z1,
        vx: (this.rng() - 0.5) * 1.5,
        vy: -0.5,
        r: 8.0,
        alpha: 1.0
      });

      for (const b of this.buds) {
        if (b.parentSegId === id && !b.pruned) {
          b.pruned = true;
          affectedBuds.push(b.id);
        }
      }
      for (const l of this.leaves) {
        if (l.parentSegId === id && !l.pruned) {
          l.pruned = true;
          affectedLeaves.push(l.id);
        }
      }
    }

    const wokeBudIds = [];
    const spawnedBudIds = [];

    if (parentSeg) {
      const prevScar = parentSeg.hasChopScar;
      const prevStyle = parentSeg.scarStyle;
      const prevRem = parentSeg.remainingInternodes;
      parentSeg.hasChopScar = true;
      parentSeg.scarStyle = 'FRESH_GREEN_CUT';
      parentSeg.remainingInternodes = 0;
      parentSeg.auxin = 0;
      parentSeg.cytokinin = 2.2;

      // 1. Wake up all dormant axillary/collar buds on parentSeg
      for (const b of this.buds) {
        if (b.parentSegId === parentSeg.id && !b.pruned && b.state === 'DORMANT') {
          b.state = 'SWELLING';
          b.swell = Math.max(b.swell, 0.42);
          wokeBudIds.push(b.id);
        }
      }

      // 2. Also check parent's parent if parentSeg had fewer than 2 dormant buds
      if (wokeBudIds.length < 2 && parentSeg.parentId) {
        const grandParent = this.SegmentMap.get(parentSeg.parentId);
        if (grandParent && !grandParent.pruned) {
          for (const b of this.buds) {
            if (b.parentSegId === grandParent.id && !b.pruned && b.state === 'DORMANT') {
              b.state = 'SWELLING';
              b.swell = Math.max(b.swell, 0.38);
              wokeBudIds.push(b.id);
            }
          }
        }
      }

      // 3. Compensatory back-budding on other dormant AXILLARY_LEAF_BUDs if still < 2 woken
      if (wokeBudIds.length < 2) {
        const extraBuds = this.buds.filter(b => !b.pruned && b.state === 'DORMANT');
        extraBuds.sort((a, b) => {
          const typeA = a.type === 'AXILLARY_LEAF_BUD' ? 1 : 0;
          const typeB = b.type === 'AXILLARY_LEAF_BUD' ? 1 : 0;
          return typeB - typeA || this.rng() - 0.5;
        });
        for (let i = 0; i < Math.min(2, extraBuds.length); i++) {
          extraBuds[i].state = 'SWELLING';
          extraBuds[i].swell = Math.max(extraBuds[i].swell, 0.38);
          wokeBudIds.push(extraBuds[i].id);
        }
      }

      // 4. If parentSeg had no remaining buds on itself (e.g. trunk-chopped old wood whose buds were already spent),
      // form 2 collar axillary/adventitious buds right below the chop scar!
      const activeOnParent = this.buds.filter(
        b => b.parentSegId === parentSeg.id && !b.pruned && b.state === 'SWELLING'
      );
      if (activeOnParent.length === 0) {
        for (const side of [-1, 1]) {
          const newBud = {
            id: `BUD_${this.nextId++}`,
            parentSegId: parentSeg.id,
            attachFrac: 0.94,
            leafId: null,
            side,
            type: 'AXILLARY_LEAF_BUD',
            state: 'SWELLING',
            swell: 0.38,
            x: parentSeg.x1 + side * (parentSeg.r1 * 0.8 + 1.2),
            y: parentSeg.y1 - 1.0,
            z: parentSeg.z1 + side * 1.5,
            dirAngle: (parentSeg.dirAngle || 0) + side * (0.48 + this.rng() * 0.2),
            dirZ: (this.rng() - 0.5) * 0.3,
            generation: parentSeg.generation + 1,
            remainingInternodes: 3,
            hasWire: false,
            pruned: false
          };
          this.buds.push(newBud);
          parentSeg.nodeBudIds.push(newBud.id);
          spawnedBudIds.push(newBud.id);
        }
      }

      this.undoStack.push({
        descSegIds,
        affectedBuds,
        affectedLeaves,
        wokeBudIds,
        spawnedBudIds,
        parentId: parentSeg.id,
        prevScar,
        prevStyle,
        prevRem
      });
    }

    return true;
  }

  /**
   * Pinches an apical shoot tip, directly wakes a dormant bud, or defoliates a leaf (Mekiri).
   * Accepts segId, budId, or leafId.
   */
  pinchOrWakeBud(targetId) {
    if (!targetId) return false;

    // 1. Check if targetId is a Bud ID
    const bud = this.buds.find(b => b.id === targetId && !b.pruned);
    if (bud) {
      const pSeg = this.SegmentMap.get(bud.parentSegId);
      if (pSeg) {
        pSeg.remainingInternodes = 0;
        pSeg.auxin = 0;
      }
      if (bud.state === 'DORMANT') {
        bud.state = 'SWELLING';
        bud.swell = Math.max(bud.swell, 0.55);
        return true;
      }
      if (bud.state === 'SWELLING') {
        bud.swell = 1.0;
        return true;
      }
      return false;
    }

    // 2. Check if targetId is a Leaf ID (Mekiri defoliation -> wakes axillary leaf-bud!)
    const leaf = this.leaves.find(l => l.id === targetId && !l.pruned);
    if (leaf) {
      leaf.pruned = true;
      this.fallingClips.push({
        x: leaf.x,
        y: leaf.y,
        z: leaf.z,
        vx: (this.rng() - 0.5) * 1.2,
        vy: -0.4,
        r: leaf.maxRadius * 0.5,
        alpha: 1.0
      });

      const pSeg = this.SegmentMap.get(leaf.parentSegId);
      if (pSeg) {
        pSeg.auxin = 0;
      }

      if (leaf.budId) {
        const axBud = this.buds.find(b => b.id === leaf.budId && !b.pruned);
        if (axBud && axBud.state === 'DORMANT') {
          axBud.state = 'SWELLING';
          axBud.swell = Math.max(axBud.swell, 0.55);
        }
      }
      for (const b of this.buds) {
        if (b.parentSegId === leaf.parentSegId && !b.pruned && b.state === 'DORMANT') {
          b.state = 'SWELLING';
          b.swell = Math.max(b.swell, 0.5);
        }
      }
      return true;
    }

    // 3. Otherwise treat targetId as a Segment ID
    const seg = this.SegmentMap.get(targetId);
    if (!seg || seg.pruned) return false;

    seg.remainingInternodes = 0;
    seg.auxin = 0;
    if (seg.curT < 1.0) {
      seg.curT = 1.0;
      if (!seg.hasNodeFormed) {
        seg.hasNodeFormed = true;
        this.formNodeAtTip(seg);
      }
    }

    let wokeAny = false;
    for (const b of this.buds) {
      if (b.parentSegId === seg.id && !b.pruned && b.state === 'DORMANT') {
        b.state = 'SWELLING';
        b.swell = Math.max(b.swell, 0.5);
        wokeAny = true;
      }
    }

    for (const l of this.leaves) {
      if (l.parentSegId === seg.id && !l.pruned && l.age > 0.6) {
        l.pruned = true;
        wokeAny = true;
      }
    }

    return wokeAny;
  }

  burstSpringFlush() {
    const dormant = this.buds.filter(b => !b.pruned && b.state === 'DORMANT');
    dormant.sort((a, b) => b.generation - a.generation || this.rng() - 0.5);
    for (let i = 0; i < Math.min(5, dormant.length); i++) {
      dormant[i].state = 'SWELLING';
      dormant[i].swell = Math.max(dormant[i].swell, 0.5);
    }
    this.stepBiology(1.75);
  }

  /**
   * Advances a complete seasonal flush cycle (~25-30 simDays) with bud awakening,
   * shoot elongation, leaf maturation, and secondary trunk thickening.
   */
  advanceSeason() {
    const dormant = this.buds.filter(b => !b.pruned && b.state === 'DORMANT' && b.generation <= 6);
    dormant.sort((a, b) => b.generation - a.generation || this.rng() - 0.5);
    for (let i = 0; i < Math.min(6, dormant.length); i++) {
      dormant[i].state = 'SWELLING';
      dormant[i].swell = Math.max(dormant[i].swell, 0.45);
    }
    this.stepBiology(5.5);
  }

  collectDescendants(segId, out) {
    out.push(segId);
    const seg = this.SegmentMap.get(segId);
    if (seg) {
      for (const cid of seg.childrenIds) {
        this.collectDescendants(cid, out);
      }
    }
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const last = this.undoStack.pop();
    for (const id of last.descSegIds) {
      const s = this.SegmentMap.get(id);
      if (s) s.pruned = false;
    }
    for (const bid of last.affectedBuds) {
      const b = this.buds.find(x => x.id === bid);
      if (b) b.pruned = false;
    }
    for (const lid of last.affectedLeaves) {
      const l = this.leaves.find(x => x.id === lid);
      if (l) l.pruned = false;
    }
    for (const bid of last.wokeBudIds) {
      const b = this.buds.find(x => x.id === bid);
      if (b && b.state === 'SWELLING') b.state = 'DORMANT';
    }
    if (last.spawnedBudIds) {
      for (const bid of last.spawnedBudIds) {
        const b = this.buds.find(x => x.id === bid);
        if (b) b.pruned = true;
      }
    }
    if (last.parentId && this.SegmentMap.has(last.parentId)) {
      const p = this.SegmentMap.get(last.parentId);
      p.hasChopScar = last.prevScar;
      p.scarStyle = last.prevStyle;
      if (last.prevRem !== undefined) {
        p.remainingInternodes = last.prevRem;
      }
    }
    return true;
  }

  /**
   * Computes world-space 2D bounding box including ceramic pot (down to y = -55)
   * and all active segments, buds, and leaves for CameraController.autoFit().
   */
  getBoundingBox() {
    let minX = -112;
    let maxX = 112;
    let minY = -55;
    let maxY = 42;

    for (const seg of this.segments) {
      if (seg.pruned) continue;
      const curX1 = seg.x0 + (seg.x1 - seg.x0) * seg.curT;
      const curY1 = seg.y0 + (seg.y1 - seg.y0) * seg.curT;
      const pad0 = seg.r0 + 4;
      const pad1 = seg.r1 + 4;

      if (seg.x0 - pad0 < minX) minX = seg.x0 - pad0;
      if (seg.x0 + pad0 > maxX) maxX = seg.x0 + pad0;
      if (seg.y0 - pad0 < minY) minY = seg.y0 - pad0;
      if (seg.y0 + pad0 > maxY) maxY = seg.y0 + pad0;

      if (curX1 - pad1 < minX) minX = curX1 - pad1;
      if (curX1 + pad1 > maxX) maxX = curX1 + pad1;
      if (curY1 - pad1 < minY) minY = curY1 - pad1;
      if (curY1 + pad1 > maxY) maxY = curY1 + pad1;
    }

    for (const lf of this.leaves) {
      if (lf.pruned) continue;
      const reach = (lf.petioleLen + lf.maxRadius) * (0.3 + 0.7 * lf.age);
      if (lf.x - reach < minX) minX = lf.x - reach;
      if (lf.x + reach > maxX) maxX = lf.x + reach;
      if (lf.y - reach < minY) minY = lf.y - reach;
      if (lf.y + reach > maxY) maxY = lf.y + reach;
    }

    const width = Math.max(120, maxX - minX);
    const height = Math.max(120, maxY - minY);
    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;

    return {
      minX,
      maxX,
      minY,
      maxY,
      centerX,
      centerY,
      width,
      height
    };
  }
}

function bOffsetsSign(val) {
  return val < 0 ? -1 : 1;
}
