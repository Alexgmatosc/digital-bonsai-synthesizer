/* ====================================================================
   INTERACTIVE PRUNING, BUD PINCHING / DEFOLIATION & PAN/ZOOM CONTROLLER
   ==================================================================== */

function distToSegment2D(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.001) return Math.hypot(px - x0, py - y0);
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lenSq));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

export class PruningController {
  constructor(rendererOrOptions, cameraController, getBonsai, audio, callbacks = {}) {
    if (
      rendererOrOptions &&
      typeof rendererOrOptions === 'object' &&
      !rendererOrOptions.getDomElement &&
      !rendererOrOptions.domElement &&
      (rendererOrOptions.renderer || rendererOrOptions.cameraController)
    ) {
      this.renderer = rendererOrOptions.renderer;
      this.cameraController = rendererOrOptions.cameraController;
      this.getBonsai =
        typeof rendererOrOptions.getBonsai === 'function'
          ? rendererOrOptions.getBonsai
          : () => rendererOrOptions.bonsai;
      this.audio = rendererOrOptions.audio || null;
      this.onZoomChange = rendererOrOptions.onZoomChange || null;
      this.onAction = rendererOrOptions.onAction || null;
      this.onToolChange = rendererOrOptions.onToolChange || null;
    } else {
      this.renderer = rendererOrOptions;
      this.cameraController = cameraController;
      this.getBonsai =
        typeof getBonsai === 'function' ? getBonsai : () => getBonsai;
      this.audio = audio || null;
      this.onZoomChange = callbacks.onZoomChange || null;
      this.onAction = callbacks.onAction || null;
      this.onToolChange = callbacks.onToolChange || null;
    }

    this.domElement =
      this.renderer && typeof this.renderer.getDomElement === 'function'
        ? this.renderer.getDomElement()
        : this.renderer && this.renderer.domElement
        ? this.renderer.domElement
        : null;

    this.activeTool = 'PRUNE'; // 'PRUNE' | 'PINCH' | 'PAN'
    this.hoveredSegId = null;
    this.hoveredBudId = null;
    this.hoveredLeafId = null;
    this.hoveredDescSet = new Set();

    this.isSpaceDown = false;
    this.isPointerDown = false;
    this.isPanning = false;
    this.dragDistPx = 0;
    this.lastClientX = 0;
    this.lastClientY = 0;

    if (this.domElement) {
      this.bindEvents();
      this.updateCursorClass();
    }
  }

  setTool(tool) {
    this.activeTool = tool;
    this.clearHover();
    this.updateCursorClass();
    if (typeof this.onToolChange === 'function') {
      this.onToolChange(tool);
    }
  }

  clearHover() {
    this.hoveredSegId = null;
    this.hoveredBudId = null;
    this.hoveredLeafId = null;
    this.hoveredDescSet.clear();
  }

  getInteractionState(seasonTheme = 'SPRING') {
    return {
      hoveredSegId: this.hoveredSegId,
      hoveredBudId: this.hoveredBudId,
      hoveredLeafId: this.hoveredLeafId,
      hoveredDescSet: this.hoveredDescSet,
      activeTool: this.activeTool,
      seasonTheme
    };
  }

  updateCursorClass() {
    if (!this.domElement) return;
    this.domElement.classList.remove(
      'canvas-prune',
      'canvas-pinch',
      'canvas-pan',
      'canvas-panning'
    );
    if (this.isPanning) {
      this.domElement.classList.add('canvas-panning');
    } else if (this.isSpaceDown || this.activeTool === 'PAN') {
      this.domElement.classList.add('canvas-pan');
    } else if (this.activeTool === 'PINCH') {
      this.domElement.classList.add('canvas-pinch');
    } else {
      this.domElement.classList.add('canvas-prune');
    }
  }

  bindEvents() {
    const el = this.domElement;

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        this.isSpaceDown = true;
        this.updateCursorClass();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpaceDown = false;
        this.updateCursorClass();
      }
    });

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!this.cameraController) return;
        this.cameraController.zoomByWheel(e.deltaY, e.clientX, e.clientY, el);
        this.updateHover(e.clientX, e.clientY);
        if (typeof this.onZoomChange === 'function') {
          this.onZoomChange(this.cameraController.targetZoom);
        }
      },
      { passive: false }
    );

    el.addEventListener('mousedown', (e) => {
      if (this.audio) this.audio.init();
      this.isPointerDown = true;
      this.dragDistPx = 0;
      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;

      this.updateHover(e.clientX, e.clientY);
      const nothingHovered =
        !this.hoveredSegId && !this.hoveredBudId && !this.hoveredLeafId;

      if (
        this.activeTool === 'PAN' ||
        this.isSpaceDown ||
        e.button === 1 ||
        e.button === 2 ||
        (e.button === 0 && nothingHovered)
      ) {
        this.isPanning = true;
        this.updateCursorClass();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerDown) {
        const dx = e.clientX - this.lastClientX;
        const dy = e.clientY - this.lastClientY;
        this.lastClientX = e.clientX;
        this.lastClientY = e.clientY;
        this.dragDistPx += Math.hypot(dx, dy);

        if (!this.isPanning && this.dragDistPx > 6) {
          this.isPanning = true;
          this.clearHover();
          this.updateCursorClass();
        }

        if (this.isPanning && this.cameraController) {
          this.cameraController.panByScreenDelta(
            dx,
            dy,
            el.clientWidth || window.innerWidth,
            el.clientHeight || window.innerHeight
          );
          return;
        }
      }

      if (e.target === el) {
        this.updateHover(e.clientX, e.clientY);
      } else {
        this.clearHover();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPointerDown = false;
      if (this.isPanning) {
        this.isPanning = false;
        this.updateCursorClass();
      }
    });

    el.addEventListener('mouseleave', () => {
      if (!this.isPointerDown) {
        this.clearHover();
      }
    });

    el.addEventListener('click', (e) => {
      if (this.dragDistPx > 6) return;
      if (this.activeTool === 'PAN' || this.isSpaceDown) return;

      if (this.audio) this.audio.init();
      const bonsai = this.getBonsai();
      if (!bonsai) return;

      this.updateHover(e.clientX, e.clientY);

      if (this.activeTool === 'PRUNE') {
        if (this.hoveredSegId && bonsai.pruneSegment(this.hoveredSegId)) {
          if (this.audio) this.audio.playSnip();
          this.clearHover();
          if (typeof this.onAction === 'function') this.onAction('PRUNE');
        }
      } else if (this.activeTool === 'PINCH') {
        const targetId =
          this.hoveredBudId || this.hoveredLeafId || this.hoveredSegId;
        if (!targetId) return;

        let acted = bonsai.pinchOrWakeBud(targetId);
        if (!acted && this.hoveredSegId && targetId !== this.hoveredSegId) {
          acted = bonsai.pinchOrWakeBud(this.hoveredSegId);
        }
        if (acted) {
          if (this.audio) this.audio.playBudPop();
          this.clearHover();
          if (typeof this.onAction === 'function') this.onAction('PINCH');
        }
      }
    });
  }

  updateHover(clientX, clientY) {
    this.clearHover();
    if (this.activeTool === 'PAN' || this.isSpaceDown || this.isPanning) {
      return;
    }

    const bonsai = this.getBonsai();
    if (!bonsai || !this.cameraController || !this.domElement) return;

    const { worldX, worldY } = this.cameraController.screenToWorld(
      clientX,
      clientY,
      this.domElement
    );
    const zoomScale = Math.max(0.35, Math.min(3.5, this.cameraController.zoom));
    const rootSegId =
      bonsai.segments && bonsai.segments.length > 0
        ? bonsai.segments[0].id
        : null;

    if (this.activeTool === 'PRUNE') {
      // Find closest pruneable segment (any INTERNODE or thickened branch/trunk above segments[0])
      let bestSeg = null;
      let bestScore = Infinity;
      const baseTol = 15.0 / zoomScale;

      for (const seg of bonsai.segments) {
        if (seg.pruned || seg.id === rootSegId || seg.parentId === null) {
          continue;
        }
        const curX1 = seg.x0 + (seg.x1 - seg.x0) * seg.curT;
        const curY1 = seg.y0 + (seg.y1 - seg.y0) * seg.curT;
        const d = distToSegment2D(worldX, worldY, seg.x0, seg.y0, curX1, curY1);
        const segTol = Math.max(baseTol, (seg.r0 || 2.0) * 1.15);

        if (d < segTol) {
          // Slight preference for internodes over primary trunk heads when overlapping
          const penalty = seg.type === 'TRUNK_HEAD' ? 2.5 : 0.0;
          const score = d + penalty;
          if (score < bestScore) {
            bestScore = score;
            bestSeg = seg;
          }
        }
      }

      if (bestSeg) {
        this.hoveredSegId = bestSeg.id;
        const list = [];
        bonsai.collectDescendants(bestSeg.id, list);
        for (const id of list) {
          this.hoveredDescSet.add(id);
        }
      }
      return;
    }

    if (this.activeTool === 'PINCH') {
      // 1. Check closest dormant or swelling bud (including AXILLARY_LEAF_BUD)
      let bestBud = null;
      let minBudDist = 11.5 / zoomScale;

      for (const bud of bonsai.buds) {
        if (bud.pruned || bud.state === 'SPENT') continue;
        const pSeg = bonsai.SegmentMap.get(bud.parentSegId);
        if (!pSeg || pSeg.pruned) continue;

        const d = Math.hypot(worldX - bud.x, worldY - bud.y);
        if (d < minBudDist) {
          minBudDist = d;
          bestBud = bud;
        }
      }

      if (bestBud) {
        this.hoveredBudId = bestBud.id;
        this.hoveredSegId = bestBud.parentSegId;
        return;
      }

      // 2. Check closest leaf for Mekiri defoliation (waking its axillary bud!)
      let bestLeaf = null;
      let minLeafDist = 13.5 / zoomScale;

      for (const lf of bonsai.leaves) {
        if (lf.pruned) continue;
        const pSeg = bonsai.SegmentMap.get(lf.parentSegId);
        if (!pSeg || pSeg.pruned) continue;

        const curPetiole = (lf.petioleLen || 10) * (0.3 + 0.7 * (lf.age || 1));
        const bladeX = lf.x + Math.sin(lf.angle || 0) * curPetiole;
        const bladeY =
          lf.y + Math.cos(lf.angle || 0) * curPetiole - 2.0 * (lf.age || 1);

        const dBlade = Math.hypot(worldX - bladeX, worldY - bladeY);
        const dBase = Math.hypot(worldX - lf.x, worldY - lf.y);
        const d = Math.min(dBlade, dBase);
        const tol = Math.max(
          minLeafDist,
          (lf.maxRadius || 16) * (0.25 + 0.35 * (lf.age || 1))
        );

        if (d < tol && d < minLeafDist * 1.45) {
          minLeafDist = d;
          bestLeaf = lf;
        }
      }

      if (bestLeaf) {
        this.hoveredLeafId = bestLeaf.id;
        this.hoveredSegId = bestLeaf.parentSegId;
        return;
      }

      // 3. Check closest segment tip / node
      let bestSeg = null;
      let minSegDist = 14.0 / zoomScale;
      for (const seg of bonsai.segments) {
        if (seg.pruned) continue;
        const curX1 = seg.x0 + (seg.x1 - seg.x0) * seg.curT;
        const curY1 = seg.y0 + (seg.y1 - seg.y0) * seg.curT;
        const d = distToSegment2D(worldX, worldY, seg.x0, seg.y0, curX1, curY1);
        if (d < minSegDist) {
          minSegDist = d;
          bestSeg = seg;
        }
      }

      if (bestSeg) {
        this.hoveredSegId = bestSeg.id;
      }
    }
  }
}
