import assert from 'node:assert/strict';
import { createPRNG, SPECIES_PROFILES } from '../src/biology/SpeciesProfiles.js';
import { LivingBonsaiOrganism } from '../src/biology/LivingBonsaiOrganism.js';

console.log('=== DIGITAL BONSAI SYNTHESIZER: BIOLOGICAL & FRACTAL VERIFICATION SUITE ===\n');

// 1. Verify Deterministic PRNG & Species Profiles
{
  const rng1 = createPRNG(0x84A3F2);
  const rng2 = createPRNG(0x84A3F2);
  for (let i = 0; i < 20; i++) {
    assert.strictEqual(rng1(), rng2(), 'PRNG must be strictly deterministic for identical seeds');
  }

  for (const key of ['BONSAI_MAPLE', 'BONSAI_ULMUS', 'BONSAI_PINE']) {
    const p = SPECIES_PROFILES[key];
    assert.ok(p, `Missing profile ${key}`);
    assert.ok(p.pipeAlpha > 2.0 && p.pipeAlpha < 2.5, `Invalid Pipe Model exponent for ${key}`);
    assert.ok(p.internodeContraction > 0.7 && p.internodeContraction < 0.95);
  }
  console.log('[PASS] 1. Deterministic Mulberry32 PRNG & 3 Parametric Species Profiles verified.');
}

// 2. Verify 'SEEDLING_SHOOT' Ontogeny:
//    Single tender shoot -> Nodes + AXILLARY_LEAF_BUDs -> Lateral branches across generations 1..4
//    -> Leaf abscission on lignified wood (woodiness > 0.62) -> Trunk thickening > 6x with strict Pipe Model taper!
{
  const bonsai = new LivingBonsaiOrganism(0x84A3F2, 'BONSAI_MAPLE', 'SEEDLING_SHOOT');

  assert.strictEqual(bonsai.segments.length, 1, 'SEEDLING_SHOOT must start with exactly 1 tender shoot segment');
  const rootShoot = bonsai.segments[0];
  const initialR0 = rootShoot.r0;
  const initialNebariR0 = bonsai.nebariRoots[0].r0;

  assert.strictEqual(initialR0, 1.4, 'Initial seedling basal radius r0 must be 1.4');
  assert.strictEqual(rootShoot.woodiness, 0.0, 'Initial seedling shoot must be herbaceous (woodiness = 0.0)');
  assert.strictEqual(rootShoot.generation, 0, 'Initial seedling shoot must be generation 0');
  assert.strictEqual(rootShoot.remainingInternodes, 4, 'Initial seedling shoot must have remainingInternodes = 4');

  // Step through multiple seasonal growth cycles (testing 30x turbo large dt step stability too!)
  for (let cycle = 0; cycle < 6; cycle++) {
    bonsai.stepBiology(3.0); // large dt tested with internal maxStep = 0.05 substepping
    bonsai.advanceSeason();
  }

  const activeSegments = bonsai.segments.filter(s => !s.pruned);
  const axillaryBuds = bonsai.buds.filter(b => b.type === 'AXILLARY_LEAF_BUD');
  const sproutedAxillaryBuds = axillaryBuds.filter(b => b.state === 'SPENT');

  const generationsPresent = new Set(activeSegments.map(s => s.generation));
  const maxGen = Math.max(...generationsPresent);

  console.log(`   -> Active segments grown from 1 shoot: ${activeSegments.length}`);
  console.log(`   -> Total AXILLARY_LEAF_BUDs formed at nodes: ${axillaryBuds.length} (${sproutedAxillaryBuds.length} sprouted into branches)`);
  console.log(`   -> Branching generations present: [${[...generationsPresent].sort().join(', ')}] (max generation = ${maxGen})`);
  console.log(`   -> Basal shoot radius r0 thickened: ${initialR0.toFixed(2)} mm -> ${rootShoot.r0.toFixed(2)} mm (${(rootShoot.r0 / initialR0).toFixed(1)}x), woodiness = ${rootShoot.woodiness.toFixed(2)}`);

  assert.ok(axillaryBuds.length >= 16, 'Seedling must form numerous AXILLARY_LEAF_BUDs at nodes');
  assert.ok(sproutedAxillaryBuds.length >= 6, 'Dormant AXILLARY_LEAF_BUDs must break dormancy and sprout lateral branches');
  for (const g of [0, 1, 2, 3, 4]) {
    assert.ok(generationsPresent.has(g), `Expected branching generation ${g} to develop in SEEDLING_SHOOT mode`);
  }

  // Verify basal shoot thickened by > 6x into a woody trunk
  assert.ok(
    rootShoot.r0 > initialR0 * 6.0,
    `Expected basal trunk radius (${rootShoot.r0.toFixed(2)}) to thicken > 6x initial radius (${initialR0})`
  );
  assert.ok(rootShoot.woodiness > 0.85, `Expected basal trunk woodiness (${rootShoot.woodiness}) > 0.85`);
  assert.ok(
    bonsai.nebariRoots[0].r0 > initialNebariR0 * 4.0,
    'Nebari surface roots must thicken proportionally with the basal trunk'
  );

  // Verify old nodal leaves on lignified basal trunk (woodiness > 0.62) abscised while keeping axillary branches intact
  const trunkLeafIds = rootShoot.nodeLeafIds;
  assert.ok(trunkLeafIds.length >= 2, 'Root shoot must have formed nodal leaves');
  for (const lid of trunkLeafIds) {
    const lf = bonsai.leaves.find(l => l.id === lid);
    assert.ok(lf && lf.pruned && lf.abscised, 'Old nodal leaves on lignified trunk (woodiness > 0.62) must abscise');
  }
  assert.ok(rootShoot.childrenIds.length >= 2, 'Branches sprouted from trunk nodes must remain intact after leaf abscission');

  // Verify strict Pipe Model taper (r_base > r_mid > r_tip) along every parent -> child link
  for (const seg of activeSegments) {
    assert.ok(seg.r0 > seg.r1, `Segment ${seg.id} must taper from base r0 (${seg.r0}) to tip r1 (${seg.r1})`);
    for (const cid of seg.childrenIds) {
      const child = bonsai.SegmentMap.get(cid);
      if (!child || child.pruned) continue;
      assert.ok(
        seg.r0 > child.r0 && seg.r1 >= child.r0,
        `Pipe Model taper violated between parent ${seg.id} (r0=${seg.r0.toFixed(2)}, r1=${seg.r1.toFixed(2)}) and child ${child.id} (r0=${child.r0.toFixed(2)})`
      );
    }
  }

  console.log('[PASS] 2. SEEDLING_SHOOT ontogeny, multi-order leaf-bud branching (gen 0..4+), leaf abscission, and >6x Pipe Model trunk thickening verified.');
}

// 3. Verify Causal Pruning, Trunk Chop, Mekiri Defoliation, Undo, and BoundingBox
{
  const bonsai = new LivingBonsaiOrganism(0x84A3F2, 'BONSAI_MAPLE', 'SEEDLING_SHOOT');
  bonsai.stepBiology(4.0);
  bonsai.advanceSeason();

  // Find an active branch segment with a parent that has or can wake axillary buds
  const candidateSeg = bonsai.segments.find(s => !s.pruned && s.generation >= 1 && s.parentId);
  assert.ok(candidateSeg, 'Must have a pruneable branch segment');

  const parentSeg = bonsai.SegmentMap.get(candidateSeg.parentId);
  const prunedOk = bonsai.pruneSegment(candidateSeg.id);
  assert.strictEqual(prunedOk, true, 'pruneSegment must succeed on branch segment');
  assert.strictEqual(candidateSeg.pruned, true, 'Pruned segment must be marked pruned = true');
  assert.strictEqual(parentSeg.hasChopScar, true, 'Parent stub must record chop scar');

  const swellingBudsAfterPrune = bonsai.buds.filter(b => !b.pruned && b.state === 'SWELLING');
  assert.ok(
    swellingBudsAfterPrune.length >= 2,
    'Pruning a branch must immediately wake dormant axillary buds into SWELLING state'
  );

  // Test undo()
  const undoOk = bonsai.undo();
  assert.strictEqual(undoOk, true, 'undo() must restore pruned branch');
  assert.strictEqual(candidateSeg.pruned, false, 'Restored segment must have pruned = false');

  // Test Trunk Chop on thickened seedling trunk (segments[1], right above segments[0])
  const upperTrunkSeg = bonsai.segments.find(
    s => !s.pruned && s.parentId === bonsai.segments[0].id && s.generation === 0
  );
  if (upperTrunkSeg) {
    assert.strictEqual(
      bonsai.pruneSegment(bonsai.segments[0].id),
      false,
      'Root base segments[0] must be protected from pruning'
    );
    const chopOk = bonsai.pruneSegment(upperTrunkSeg.id);
    assert.strictEqual(chopOk, true, 'Trunk-chopping above segments[0] must succeed');
    const baseSwelling = bonsai.buds.filter(
      b => b.parentSegId === bonsai.segments[0].id && !b.pruned && b.state === 'SWELLING'
    );
    assert.ok(baseSwelling.length >= 1, 'Trunk chop must wake or spawn swelling buds on basal trunk');
    bonsai.undo();
  }

  // Test pinchOrWakeBud with a leafId (Mekiri defoliation) and budId
  const activeLeaf = bonsai.leaves.find(l => !l.pruned);
  assert.ok(activeLeaf, 'Should have an active leaf for Mekiri defoliation test');
  const mekiriOk = bonsai.pinchOrWakeBud(activeLeaf.id);
  assert.strictEqual(mekiriOk, true, 'pinchOrWakeBud(leafId) must defoliate leaf and stimulate axillary bud');
  assert.strictEqual(activeLeaf.pruned, true, 'Defoliated leaf must be marked pruned');

  // Test getBoundingBox()
  const bbox = bonsai.getBoundingBox();
  assert.ok(bbox.width > 100 && bbox.height > 80 && bbox.minY <= -55, 'getBoundingBox() must return valid framing bounds');

  console.log('[PASS] 3. Causal pruning, trunk chop, Mekiri leaf defoliation, undo(), and getBoundingBox() verified.');
}

// 4. Verify All 3 Species (BONSAI_MAPLE, BONSAI_ULMUS, BONSAI_PINE) & TRAINED_TRUNK mode
{
  for (const sp of ['BONSAI_MAPLE', 'BONSAI_ULMUS', 'BONSAI_PINE']) {
    const seedling = new LivingBonsaiOrganism(0x123456, sp, 'SEEDLING_SHOOT');
    seedling.stepBiology(3.5);
    seedling.advanceSeason();
    assert.ok(seedling.segments.length > 10, `${sp} seedling must grow > 10 segments`);
    assert.ok(seedling.leaves.length > 5, `${sp} seedling must grow leaves`);
  }

  const trained = new LivingBonsaiOrganism(0x84A3F2, 'BONSAI_MAPLE', 'TRAINED_TRUNK');
  assert.strictEqual(trained.segments[0].type, 'TRUNK', 'TRAINED_TRUNK must start with muscular TRUNK base');
  assert.ok(trained.segments.length > 12, 'TRAINED_TRUNK must pre-grow initial spring shoots');
  console.log('[PASS] 4. All 3 species (Maple, Ulmus, Pine) and TRAINED_TRUNK mode verified.');
}

console.log('\nALL BIOLOGICAL & FRACTAL TESTS PASSED SUCCESSFULLY!');
