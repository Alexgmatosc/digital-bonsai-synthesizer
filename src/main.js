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
let currentSpecies = 'BONSAI_MAPLE'; // Strict focus on Acer palmatum (Arce Japonés // Yamamomiji)
let currentStartMode = 'SEEDLING_SHOOT'; // 'SEEDLING_SHOOT' | 'TRAINED_TRUNK'
let simSpeed = 1.0;
let autoFitFollow = true; // Auto-frame when tree outgrows viewport at high speed

// 1. Initialize Renderer & Camera Controller
const asciiRenderer = new AsciiThreeRenderer(container);
const cameraController = new CameraController(asciiRenderer.getCamera());

// 2. Create Living Bonsai Organism
let bonsai = null;

function createSpecimen(seed, species = 'BONSAI_MAPLE', startMode = 'SEEDLING_SHOOT', initialAutoFit = true) {
  currentSpecies = 'BONSAI_MAPLE';
  bonsai = new LivingBonsaiOrganism(seed, currentSpecies, startMode);

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
    const idNum = (currentSeed % 900) + 100;
    headerEl.innerText = `🍁 ACER_PALMATUM #${idNum}`;
  }

  const modeBadgeEl = document.getElementById('modeBadge');
  if (modeBadgeEl) {
    modeBadgeEl.innerText =
      currentStartMode === 'SEEDLING_SHOOT'
        ? '🌱 BROTE JOVEN'
        : '🪵 PRE-BONSÁI';
  }
}

/**
 * Normalizes season and calendar info from the bonsai organism or internal phenological calendar.
 */
function getBonsaiSeasonInfo(bonsaiInstance) {
  if (bonsaiInstance && typeof bonsaiInstance.getSeasonInfo === 'function') {
    const info = bonsaiInstance.getSeasonInfo();
    if (info && info.seasonName && info.seasonIcon) {
      return info;
    }
  }

  const simDays = bonsaiInstance?.simDays || 0;
  const baseYear = currentStartMode === 'SEEDLING_SHOOT' ? 1 : 3;
  const year = Math.max(1, Math.floor(simDays / 360) + baseYear);
  const dayInYear = Math.floor(((simDays % 360) + 360) % 360);
  const seasonIndex = Math.floor(dayInYear / 90) % 4; // 0: Spring, 1: Summer, 2: Autumn, 3: Winter

  const seasonNames = ['PRIMAVERA', 'VERANO', 'OTOÑO', 'INVIERNO'];
  const seasonIcons = ['🌸', '☀️', '🍁', '❄️'];
  const monthNames = [
    '3月 MAR', '4月 ABR', '5月 MAY',   // Spring (Days 0-89)
    '6月 JUN', '7月 JUL', '8月 AGO',   // Summer (Days 90-179)
    '9月 SEP', '10月 OCT', '11月 NOV', // Autumn (Days 180-269)
    '12月 DIC', '1月 ENE', '2月 FEB'   // Winter (Days 270-359)
  ];
  const monthIndex = Math.floor(dayInYear / 30) % 12;
  const progressInSeason = (dayInYear % 90) / 90;

  return {
    year,
    seasonIndex,
    seasonName: seasonNames[seasonIndex],
    seasonIcon: seasonIcons[seasonIndex],
    monthIndex,
    monthName: monthNames[monthIndex],
    dayInYear,
    progressInSeason,
    isWinter: seasonIndex === 3
  };
}

/**
 * Updates the visual styling and badge for the 4 seasons.
 */
function updateSeasonBadge(seasonInfo) {
  const badgeEl = document.getElementById('hudSeasonBadge');
  if (!badgeEl) return;

  const name = seasonInfo.seasonName || 'PRIMAVERA';
  const icon = seasonInfo.seasonIcon || '🌸';
  badgeEl.innerText = `${icon} ${name}`;

  if (name === 'PRIMAVERA') {
    badgeEl.className = 'px-2 py-0.5 rounded font-bold bg-[#281523] border border-[#f472b6] text-[#f472b6] shadow-[0_0_8px_rgba(244,114,182,0.3)] transition-all duration-300';
  } else if (name === 'VERANO') {
    badgeEl.className = 'px-2 py-0.5 rounded font-bold bg-[#0c2415] border border-[#4ade80] text-[#4ade80] shadow-[0_0_8px_rgba(74,222,128,0.3)] transition-all duration-300';
  } else if (name === 'OTOÑO') {
    badgeEl.className = 'px-2 py-0.5 rounded font-bold bg-[#2a1306] border border-[#fb923c] text-[#fb923c] shadow-[0_0_8px_rgba(251,146,60,0.35)] transition-all duration-300';
  } else if (name === 'INVIERNO') {
    badgeEl.className = 'px-2 py-0.5 rounded font-bold bg-[#091e30] border border-[#38bdf8] text-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.3)] transition-all duration-300';
  }
}

function setSimSpeed(spd) {
  simSpeed = Math.max(0, Math.min(25, Number(spd) || 0));

  const slider = document.getElementById('speedSlider');
  if (slider && Math.abs(Number(slider.value) - simSpeed) > 0.01) {
    slider.value = String(simSpeed);
  }

  const label = document.getElementById('speedValueLabel');
  if (label) {
    if (simSpeed === 0) {
      label.innerText = '0.0x (PAUSA)';
    } else if (Math.abs(simSpeed - 1.0) < 0.05) {
      label.innerText = '1.0x ZEN';
    } else {
      label.innerText = `${simSpeed.toFixed(1)}x`;
    }
  }

  const speedButtons = [
    { id: 'btnSpeedPause', val: 0 },
    { id: 'btnSpeed1x', val: 1 },
    { id: 'btnSpeed4x', val: 4 },
    { id: 'btnSpeed12x', val: 12 },
    { id: 'btnSpeed25x', val: 25 }
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

  const seasonInfo = getBonsaiSeasonInfo(bonsai);
  updateSeasonBadge(seasonInfo);

  const elYear = document.getElementById('hudYearBadge');
  if (elYear) {
    elYear.innerText = `AÑO ${seasonInfo.year}`;
  }

  const elMonth = document.getElementById('hudMonthBadge');
  if (elMonth) {
    elMonth.innerText = seasonInfo.monthName;
  }

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
    elAge.innerText = `AÑO ${seasonInfo.year} // ${seasonInfo.seasonIcon} ${seasonInfo.seasonName} (${seasonInfo.monthName})`;
  }
}

function advanceSeasonAction() {
  if (!bonsai) return;
  bonsaiAudio.playSeasonChime();

  if (typeof bonsai.advanceSeason === 'function') {
    bonsai.advanceSeason();
  } else if (typeof bonsai.burstSpringFlush === 'function') {
    bonsai.burstSpringFlush();
  } else {
    const currentDays = bonsai.simDays || 0;
    const remainder = ((currentDays % 90) + 90) % 90;
    const toNextBoundary = remainder < 5 ? 90 : 90 - remainder;
    bonsai.stepBiology(toNextBoundary / 4.5);
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

  updateTelemetryHUD();
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
  document.getElementById('btnSpeed4x')?.addEventListener('click', () => setSimSpeed(4));
  document.getElementById('btnSpeed12x')?.addEventListener('click', () => setSimSpeed(12));
  document.getElementById('btnSpeed25x')?.addEventListener('click', () => setSimSpeed(25));

  document.getElementById('speedSlider')?.addEventListener('input', (e) => {
    setSimSpeed(parseFloat(e.target.value));
  });

  document.getElementById('btnAdvanceSeason')?.addEventListener('click', advanceSeasonAction);
  document.getElementById('btnHeaderAdvanceSeason')?.addEventListener('click', advanceSeasonAction);

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

  // Seed Mutation (Species is locked to Acer palmatum)
  document.getElementById('btnMutate')?.addEventListener('click', () => {
    currentSeed = Math.floor(Math.random() * 0xffffff) || 0x84a3f2;
    bonsaiAudio.playSeasonChime();
    createSpecimen(currentSeed, currentSpecies, currentStartMode, true);
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
    bonsai.stepBiology(dt * simSpeed * ZEN_SPEED_SCALE);

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

  const seasonInfo = getBonsaiSeasonInfo(bonsai);
  const theme =
    seasonInfo.seasonName === 'OTOÑO'
      ? 'AUTUMN'
      : seasonInfo.seasonName === 'INVIERNO'
      ? 'WINTER'
      : seasonInfo.seasonName === 'VERANO'
      ? 'SUMMER'
      : 'SPRING';

  const interactionState = {
    ...pruningController.getInteractionState(theme),
    seasonInfo,
    seasonTheme: theme
  };

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
