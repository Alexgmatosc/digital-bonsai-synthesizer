/* ====================================================================
   MAIN ORCHESTRATOR: DIGITAL BONSAI PROCEDURAL BIO-SIMULATOR
   ==================================================================== */

import { LivingBonsaiOrganism } from './biology/LivingBonsaiOrganism.js';
import { SPECIES_PROFILES } from './biology/SpeciesProfiles.js';
import { AsciiThreeRenderer } from './rendering/AsciiThreeRenderer.js';
import { CameraController } from './interaction/CameraController.js';
import { PruningController } from './interaction/PruningController.js';
import { BonsaiAudioSynth } from './audio/BonsaiAudioSynth.js';

const container = document.getElementById('canvasContainer');
const bonsaiAudio = new BonsaiAudioSynth();

let currentSeed = 0x84A3F2;
let currentSpecies = 'BONSAI_MAPLE';
let currentStartMode = 'SEEDLING_SHOOT'; // 'SEEDLING_SHOOT' | 'TRAINED_TRUNK'
let seasonTheme = 'SPRING'; // 'SPRING' | 'AUTUMN'
let simSpeed = 1.0;
let autoFitFollow = true; // Auto-frame when tree outgrows viewport at high speed

// 1. Initialize Renderer & Camera Controller
const asciiRenderer = new AsciiThreeRenderer(container);
const cameraController = new CameraController(asciiRenderer.getCamera());

// 2. Create Living Bonsai Organism
let bonsai = null;

function createSpecimen(seed, species, startMode, initialAutoFit = true) {
  bonsai = new LivingBonsaiOrganism(seed, species, startMode);

  if (startMode === 'SEEDLING_SHOOT') {
    // Advance slightly so the young shoot displays its first tender leaves & axillary leaf-buds
    for (let i = 0; i < 18; i++) {
      bonsai.stepBiology(0.05);
    }
  }

  updateSpecimenHeaderUI();

  if (initialAutoFit) {
    const bbox =
      typeof bonsai.getBoundingBox === 'function'
        ? bonsai.getBoundingBox()
        : null;
    if (bbox) {
      cameraController.autoFit(
        bbox,
        window.innerWidth,
        window.innerHeight,
        true
      );
      updateZoomLabelUI(cameraController.zoom);
    }
  }
}

// 3. Initialize Interactive Pruning, Bud Pinching & Pan/Zoom Controller
const pruningController = new PruningController({
  renderer: asciiRenderer,
  cameraController,
  getBonsai: () => bonsai,
  audio: bonsaiAudio,
  onZoomChange: (newTargetZoom) => {
    updateZoomLabelUI(newTargetZoom);
  },
  onToolChange: (tool) => {
    updateToolButtonsUI(tool);
  }
});

// 4. UI Helper Functions
function updateZoomLabelUI(zoomVal) {
  const el = document.getElementById('zoomLabel');
  if (el) {
    el.innerText = `${Math.round(zoomVal * 100)}%`;
  }
}

function updateToolButtonsUI(activeTool) {
  const toolPrune = document.getElementById('toolPrune');
  const toolPinch = document.getElementById('toolPinch');
  const toolPan = document.getElementById('toolPan');

  if (toolPrune) toolPrune.classList.toggle('active', activeTool === 'PRUNE');
  if (toolPinch) toolPinch.classList.toggle('active', activeTool === 'PINCH');
  if (toolPan) toolPan.classList.toggle('active', activeTool === 'PAN');
}

function updateStartModeButtonsUI() {
  const btnSeedling = document.getElementById('btnStartSeedling');
  const btnTrained = document.getElementById('btnStartTrained');

  if (btnSeedling) {
    btnSeedling.classList.toggle('active', currentStartMode === 'SEEDLING_SHOOT');
  }
  if (btnTrained) {
    btnTrained.classList.toggle('active', currentStartMode === 'TRAINED_TRUNK');
  }
}

function updateSpecimenHeaderUI() {
  const seedEl = document.getElementById('seedDisplay');
  if (seedEl) {
    seedEl.innerText = '0x' + (currentSeed >>> 0).toString(16).toUpperCase().padStart(6, '0');
  }

  const headerEl = document.getElementById('specimenHeader');
  if (headerEl) {
    const profile = SPECIES_PROFILES && SPECIES_PROFILES[currentSpecies];
    const codeName = profile && profile.codeName
      ? profile.codeName
      : currentSpecies === 'BONSAI_ULMUS'
      ? 'ULMUS_PARVIFOLIA'
      : currentSpecies === 'BONSAI_PINE'
      ? 'PINUS_THUNBERGII'
      : 'ACER_PALMATUM';
    const idNum = (currentSeed % 900) + 100;
    headerEl.innerText = `${codeName} #${idNum}`;
  }

  const modeBadgeEl = document.getElementById('modeBadge');
  if (modeBadgeEl) {
    modeBadgeEl.innerText =
      currentStartMode === 'SEEDLING_SHOOT'
        ? '🌱 BROTE JOVEN'
        : '🪵 PRE-BONSÁI';
  }
}

function setSimSpeed(spd) {
  simSpeed = Math.max(0, Math.min(30, Number(spd) || 0));

  const slider = document.getElementById('speedSlider');
  if (slider && Math.abs(Number(slider.value) - simSpeed) > 0.01) {
    slider.value = String(simSpeed);
  }

  const label = document.getElementById('speedValueLabel');
  if (label) {
    label.innerText = `${simSpeed.toFixed(1)}x`;
  }

  const speedButtons = [
    { id: 'btnSpeedPause', val: 0 },
    { id: 'btnSpeed1x', val: 1 },
    { id: 'btnSpeed5x', val: 5 },
    { id: 'btnSpeed15x', val: 15 },
    { id: 'btnSpeed30x', val: 30 }
  ];

  for (const btnCfg of speedButtons) {
    const btn = document.getElementById(btnCfg.id);
    if (btn) {
      btn.classList.toggle('active', Math.abs(simSpeed - btnCfg.val) < 0.05);
    }
  }

  const liveDot = document.getElementById('liveDot');
  if (liveDot) {
    liveDot.className =
      simSpeed === 0
        ? 'inline-block w-2 h-2 rounded-full bg-amber-400'
        : 'inline-block w-2 h-2 rounded-full bg-[#37ecc4] animate-pulse';
  }
}

function updateTelemetryHUD(renderStats) {
  if (!bonsai) return;

  let activeBuds = renderStats?.activeBudCount;
  let activeLeaves = renderStats?.activeLeafCount;
  let activeBranches = renderStats?.activeBranchCount;
  let trunkCaliberMm = renderStats?.trunkCaliberMm;

  if (activeBuds === undefined) {
    activeBuds = bonsai.buds.filter(
      (b) => !b.pruned && (b.state === 'SWELLING' || b.state === 'DORMANT')
    ).length;
  }
  if (activeLeaves === undefined) {
    activeLeaves = bonsai.leaves.filter((l) => !l.pruned).length;
  }
  if (activeBranches === undefined) {
    activeBranches = bonsai.segments.filter((s) => !s.pruned).length;
  }

  let maxGen = 0;
  for (const s of bonsai.segments) {
    if (!s.pruned && s.generation > maxGen) {
      maxGen = s.generation;
    }
  }

  const baseTrunk = bonsai.segments[0];
  if (trunkCaliberMm === undefined && baseTrunk) {
    trunkCaliberMm = (baseTrunk.r0 * 1.45).toFixed(1);
  }

  const elBuds = document.getElementById('hudBuds');
  const elLeaves = document.getElementById('hudLeaves');
  const elBranches = document.getElementById('hudBranches');
  const elOrder = document.getElementById('hudOrder');
  const elCaliber = document.getElementById('trunkCaliberLabel');
  const elAge = document.getElementById('simAgeLabel');

  if (elBuds) elBuds.innerText = `${activeBuds}`;
  if (elLeaves) elLeaves.innerText = `${activeLeaves}`;
  if (elBranches) elBranches.innerText = `${activeBranches}`;
  if (elOrder) elOrder.innerText = `G${maxGen}`;
  if (elCaliber && trunkCaliberMm !== undefined) {
    elCaliber.innerText =
      typeof trunkCaliberMm === 'number'
        ? `${trunkCaliberMm.toFixed(1)} mm`
        : `${trunkCaliberMm}`.includes('mm')
        ? `${trunkCaliberMm}`
        : `${trunkCaliberMm} mm`;
  }

  if (elAge) {
    const simDays = bonsai.simDays || 1;
    const yearOffset = currentStartMode === 'SEEDLING_SHOOT' ? 0 : 3;
    const yearNum = Math.floor(simDays / 90) + yearOffset;
    const monthNames = [
      '3月 (MAR)',
      '4月 (ABR)',
      '5月 (MAY)',
      '6月 (JUN)',
      '7月 (JUL)',
      '8月 (AGO)',
      '9月 (SEP)',
      '10月 (OCT)'
    ];
    const mIdx = Math.floor((simDays % 90) / (90 / monthNames.length)) % monthNames.length;
    elAge.innerText = `AÑO ${yearNum} // ${monthNames[mIdx]}`;
  }
}

// 5. Wire Up DOM Event Listeners
function bindUIControls() {
  // Tools
  document.getElementById('toolPrune')?.addEventListener('click', () => {
    pruningController.setTool('PRUNE');
  });
  document.getElementById('toolPinch')?.addEventListener('click', () => {
    pruningController.setTool('PINCH');
  });
  document.getElementById('toolPan')?.addEventListener('click', () => {
    pruningController.setTool('PAN');
  });

  document.getElementById('btnUndo')?.addEventListener('click', () => {
    if (bonsai && bonsai.undo()) {
      bonsaiAudio.playBudPop();
    }
  });

  document.getElementById('btnSoundToggle')?.addEventListener('click', (e) => {
    bonsaiAudio.enabled = !bonsaiAudio.enabled;
    e.currentTarget.innerText = bonsaiAudio.enabled ? '🔊' : '🔇';
  });

  // Speed presets + Slider + Advance Season
  document.getElementById('btnSpeedPause')?.addEventListener('click', () => setSimSpeed(0));
  document.getElementById('btnSpeed1x')?.addEventListener('click', () => setSimSpeed(1));
  document.getElementById('btnSpeed5x')?.addEventListener('click', () => setSimSpeed(5));
  document.getElementById('btnSpeed15x')?.addEventListener('click', () => setSimSpeed(15));
  document.getElementById('btnSpeed30x')?.addEventListener('click', () => setSimSpeed(30));

  document.getElementById('speedSlider')?.addEventListener('input', (e) => {
    setSimSpeed( parseFloat(e.target.value) );
  });

  document.getElementById('btnAdvanceSeason')?.addEventListener('click', () => {
    if (!bonsai) return;
    bonsaiAudio.playSeasonChime();
    if (typeof bonsai.advanceSeason === 'function') {
      bonsai.advanceSeason();
    } else if (typeof bonsai.burstSpringFlush === 'function') {
      bonsai.burstSpringFlush();
    } else {
      for (let i = 0; i < 45; i++) bonsai.stepBiology(0.05);
    }
    if (autoFitFollow && typeof bonsai.getBoundingBox === 'function') {
      cameraController.autoFit(
        bonsai.getBoundingBox(),
        window.innerWidth,
        window.innerHeight,
        false
      );
      updateZoomLabelUI(cameraController.targetZoom);
    }
  });

  // Zoom & Framing Controls
  document.getElementById('btnZoomOut')?.addEventListener('click', () => {
    const z = cameraController.zoomOut(1.22);
    updateZoomLabelUI(z);
  });

  document.getElementById('btnZoomIn')?.addEventListener('click', () => {
    const z = cameraController.zoomIn(1.22);
    updateZoomLabelUI(z);
  });

  document.getElementById('zoomLabel')?.addEventListener('click', () => {
    const z = cameraController.setZoom(1.0);
    updateZoomLabelUI(z);
  });

  document.getElementById('btnAutoFit')?.addEventListener('click', () => {
    if (!bonsai || typeof bonsai.getBoundingBox !== 'function') return;
    const z = cameraController.autoFit(
      bonsai.getBoundingBox(),
      window.innerWidth,
      window.innerHeight,
      false
    );
    updateZoomLabelUI(z);
  });

  const btnAutoFitLock = document.getElementById('btnAutoFitLock');
  if (btnAutoFitLock) {
    btnAutoFitLock.classList.toggle('active', autoFitFollow);
    btnAutoFitLock.addEventListener('click', () => {
      autoFitFollow = !autoFitFollow;
      btnAutoFitLock.classList.toggle('active', autoFitFollow);
      if (autoFitFollow && bonsai && typeof bonsai.getBoundingBox === 'function') {
        const z = cameraController.autoFit(
          bonsai.getBoundingBox(),
          window.innerWidth,
          window.innerHeight,
          false
        );
        updateZoomLabelUI(z);
      }
    });
  }

  // Growth Origin Mode Controls ('SEEDLING_SHOOT' vs 'TRAINED_TRUNK')
  document.getElementById('btnStartSeedling')?.addEventListener('click', () => {
    currentStartMode = 'SEEDLING_SHOOT';
    updateStartModeButtonsUI();
    bonsaiAudio.playBudPop();
    createSpecimen(currentSeed, currentSpecies, currentStartMode, true);
  });

  document.getElementById('btnStartTrained')?.addEventListener('click', () => {
    currentStartMode = 'TRAINED_TRUNK';
    updateStartModeButtonsUI();
    bonsaiAudio.playBudPop();
    createSpecimen(currentSeed, currentSpecies, currentStartMode, true);
  });

  // Species & Seed Controls
  document.getElementById('speciesSelect')?.addEventListener('change', (e) => {
    currentSpecies = e.target.value;
    bonsaiAudio.playSeasonChime();
    createSpecimen(currentSeed, currentSpecies, currentStartMode, true);
  });

  document.getElementById('btnMutate')?.addEventListener('click', () => {
    currentSeed = Math.floor(Math.random() * 0xffffff) || 0x84a3f2;
    bonsaiAudio.playSeasonChime();
    createSpecimen(currentSeed, currentSpecies, currentStartMode, true);
  });

  document.getElementById('btnSeasonTheme')?.addEventListener('click', () => {
    seasonTheme = seasonTheme === 'SPRING' ? 'AUTUMN' : 'SPRING';
    const txtEl = document.getElementById('seasonThemeText');
    if (txtEl) {
      txtEl.innerText =
        seasonTheme === 'AUTUMN' ? 'OTOÑO (MOMIJI)' : 'PRIMAVERA / VERANO';
    }
  });

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    cameraController.updateProjection(w, h);
    asciiRenderer.resize(w, h, cameraController);
  });
}

// 6. Initialize Specimen, UI & Animation Loop
createSpecimen(currentSeed, currentSpecies, currentStartMode, true);
bindUIControls();
updateStartModeButtonsUI();
updateToolButtonsUI(pruningController.activeTool);
setSimSpeed(1.0);

let lastTime = performance.now();
let autoFitTimer = 0;

function animate(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;

  if (bonsai && simSpeed > 0) {
    bonsai.stepBiology(dt * simSpeed);

    // When autoFitFollow is active and running at fast speed, gently keep growing tree framed
    autoFitTimer += dt * Math.min(6, simSpeed);
    if (
      autoFitFollow &&
      !pruningController.isPanning &&
      autoFitTimer > 1.2 &&
      typeof bonsai.getBoundingBox === 'function'
    ) {
      autoFitTimer = 0;
      cameraController.autoFit(
        bonsai.getBoundingBox(),
        window.innerWidth,
        window.innerHeight,
        false
      );
    }
  }

  const currentZoom = cameraController.update(
    dt,
    window.innerWidth,
    window.innerHeight
  );
  updateZoomLabelUI(currentZoom);

  if (typeof asciiRenderer.setCellScale === 'function') {
    asciiRenderer.setCellScale(currentZoom);
  }

  const interactionState = pruningController.getInteractionState(seasonTheme);
  const renderStats = asciiRenderer.syncBiology(
    bonsai,
    now * 0.001,
    interactionState
  );

  updateTelemetryHUD(renderStats);
  asciiRenderer.render();

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
