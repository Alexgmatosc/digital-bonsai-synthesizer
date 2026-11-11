/**
 * Deterministic Mulberry32 PRNG and Parametric Species Profiles
 * for Causal & Fractal Bonsai Morphogenesis.
 */

export function createPRNG(seed = 0x84A3F2) {
  let s = (typeof seed === 'number' ? seed : 0x84A3F2) >>> 0;
  return function () {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SPECIES_PROFILES = {
  BONSAI_MAPLE: {
    id: 'BONSAI_MAPLE',
    codeName: 'ACER_PALMATUM',
    scientificName: 'Acer palmatum',
    commonNameEs: 'Arce Japonés (Momiji)',
    phyllotaxy: 'OPPOSITE_DECUSSATE',
    leavesPerNode: 2,
    budsPerNode: 2,
    branchAngleMin: (32 * Math.PI) / 180,
    branchAngleMax: (45 * Math.PI) / 180, // Authentic 32°-45° Y-dichotomy for Acer palmatum
    leafAngleBase: 0.68,
    leafAngleSpread: 0.26,
    stemDeflectionRad: 0.04,
    internodeContraction: 0.84,
    leafScaleContraction: 0.85,
    baseInternodeLen: 24.0,
    internodeLenVar: 8.5,
    pipeAlpha: 2.15,
    leafPipeRadius: 0.72,
    cambiumRate: 0.28,
    lignificationRate: 0.32,
    abscissionWoodiness: 0.62,
    apicalDominanceDecay: 0.68,
    maxTrunkRadius: 42.0
  },

  BONSAI_ULMUS: {
    id: 'BONSAI_ULMUS',
    codeName: 'ULMUS_PARVIFOLIA',
    scientificName: 'Ulmus parvifolia',
    commonNameEs: 'Olmo Chino',
    phyllotaxy: 'ALTERNATE_ZIGZAG',
    leavesPerNode: 1,
    budsPerNode: 1,
    branchAngleMin: (36 * Math.PI) / 180,
    branchAngleMax: (52 * Math.PI) / 180,
    leafAngleBase: 0.72,
    leafAngleSpread: 0.22,
    stemDeflectionRad: (14 * Math.PI) / 180, // ±14° alternate zig-zag deflection
    internodeContraction: 0.80,
    leafScaleContraction: 0.83,
    baseInternodeLen: 20.0,
    internodeLenVar: 7.5,
    pipeAlpha: 2.08,
    leafPipeRadius: 0.68,
    cambiumRate: 0.25,
    lignificationRate: 0.30,
    abscissionWoodiness: 0.62,
    apicalDominanceDecay: 0.64,
    maxTrunkRadius: 38.0
  },

  BONSAI_PINE: {
    id: 'BONSAI_PINE',
    codeName: 'PINUS_THUNBERGII',
    scientificName: 'Pinus thunbergii',
    commonNameEs: 'Pino Negro Japonés (Kuromatsu)',
    phyllotaxy: 'WHORLED_CANDLE',
    leavesPerNode: 2,
    budsPerNode: 3, // 2-3 terminal whorl buds at candle tip
    branchAngleMin: (44 * Math.PI) / 180,
    branchAngleMax: (68 * Math.PI) / 180, // wider sculptural horizontal branching angles
    leafAngleBase: 0.56,
    leafAngleSpread: 0.32,
    stemDeflectionRad: 0.05,
    internodeContraction: 0.85,
    leafScaleContraction: 0.88,
    baseInternodeLen: 22.0,
    internodeLenVar: 8.5,
    pipeAlpha: 2.22,
    leafPipeRadius: 0.76,
    cambiumRate: 0.26,
    lignificationRate: 0.30,
    abscissionWoodiness: 0.62,
    apicalDominanceDecay: 0.70,
    maxTrunkRadius: 38.0
  }
};
