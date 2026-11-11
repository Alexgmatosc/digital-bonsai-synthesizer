/* ====================================================================
   2D ORTHOGRAPHIC CAMERA CONTROLLER (ZOOM, PAN & AUTO-FIT)
   ==================================================================== */

export class CameraController {
  constructor(orthoCamera) {
    this.orthoCamera = orthoCamera;
    this.baseFrustumH = 380;

    this.minZoom = 0.25;
    this.maxZoom = 3.50;

    this.zoom = 1.0;
    this.targetZoom = 1.0;

    this.panX = 0.0;
    this.panY = 0.0;
    this.targetPanX = 0.0;
    this.targetPanY = 0.0;
  }

  updateProjection(viewW, viewH) {
    if (!this.orthoCamera) return;
    const safeW = Math.max(1, viewW || window.innerWidth || 1024);
    const safeH = Math.max(1, viewH || window.innerHeight || 768);
    const aspect = safeW / safeH;

    const frustumH = this.baseFrustumH / Math.max(0.05, this.zoom);
    const frustumW = frustumH * aspect;

    // Center around (this.panX, this.panY + frustumH * 0.28)
    // so at zoom = 1, pan = 0 the pot sits nicely near the bottom (top = 0.78*H, bottom = -0.22*H)
    const centerX = this.panX;
    const centerY = this.panY + frustumH * 0.28;

    this.orthoCamera.left = centerX - frustumW * 0.5;
    this.orthoCamera.right = centerX + frustumW * 0.5;
    this.orthoCamera.top = centerY + frustumH * 0.5;
    this.orthoCamera.bottom = centerY - frustumH * 0.5;
    this.orthoCamera.updateProjectionMatrix();
  }

  update(dt, viewW, viewH) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt || 0.016));
    const lerpFactor = 1.0 - Math.exp(-safeDt * 14.0);

    this.zoom += (this.targetZoom - this.zoom) * lerpFactor;
    this.panX += (this.targetPanX - this.panX) * lerpFactor;
    this.panY += (this.targetPanY - this.panY) * lerpFactor;

    if (Math.abs(this.targetZoom - this.zoom) < 0.0005) this.zoom = this.targetZoom;
    if (Math.abs(this.targetPanX - this.panX) < 0.01) this.panX = this.targetPanX;
    if (Math.abs(this.targetPanY - this.panY) < 0.01) this.panY = this.targetPanY;

    this.updateProjection(viewW, viewH);
    return this.zoom;
  }

  screenToWorld(clientX, clientY, domElement) {
    const rect = domElement.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    const ndcX = ((clientX - rect.left) / width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / height) * 2 + 1;

    const worldX =
      this.orthoCamera.left +
      (ndcX + 1) * 0.5 * (this.orthoCamera.right - this.orthoCamera.left);
    const worldY =
      this.orthoCamera.bottom +
      (ndcY + 1) * 0.5 * (this.orthoCamera.top - this.orthoCamera.bottom);

    return { worldX, worldY, x: worldX, y: worldY };
  }

  zoomByWheel(deltaY, clientX, clientY, domElement) {
    const rect = domElement.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const aspect = width / height;

    const ndcX = ((clientX - rect.left) / width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / height) * 2 + 1;

    // World point currently targeted under mouse cursor
    const oldZoom = this.targetZoom;
    const oldFrustumH = this.baseFrustumH / oldZoom;
    const oldFrustumW = oldFrustumH * aspect;

    const focalWorldX = this.targetPanX + ndcX * (oldFrustumW * 0.5);
    const focalWorldY =
      this.targetPanY + oldFrustumH * 0.28 + ndcY * (oldFrustumH * 0.5);

    const clampedDelta = Math.max(-160, Math.min(160, deltaY));
    const zoomFactor = Math.exp(-clampedDelta * 0.0016);
    const newZoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, oldZoom * zoomFactor)
    );

    const newFrustumH = this.baseFrustumH / newZoom;
    const newFrustumW = newFrustumH * aspect;

    // Adjust targetPan so focalWorldX/Y remains stationary under the cursor
    this.targetZoom = newZoom;
    this.targetPanX = focalWorldX - ndcX * (newFrustumW * 0.5);
    this.targetPanY =
      focalWorldY - newFrustumH * 0.28 - ndcY * (newFrustumH * 0.5);

    return this.targetZoom;
  }

  setZoom(newZoom, focalWorldX = null, focalWorldY = null) {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    const oldFrustumH = this.baseFrustumH / this.targetZoom;
    const newFrustumH = this.baseFrustumH / clamped;

    if (focalWorldX !== null && focalWorldY !== null) {
      this.targetPanX = focalWorldX;
      this.targetPanY = focalWorldY - newFrustumH * 0.28;
    } else {
      // Preserve current viewport vertical center when zooming via UI buttons
      const currentCenterY = this.targetPanY + oldFrustumH * 0.28;
      this.targetPanY = currentCenterY - newFrustumH * 0.28;
    }

    this.targetZoom = clamped;
    return this.targetZoom;
  }

  zoomIn(step = 1.22) {
    return this.setZoom(this.targetZoom * step);
  }

  zoomOut(step = 1.22) {
    return this.setZoom(this.targetZoom / step);
  }

  panByScreenDelta(dxPx, dyPx, viewW, viewH) {
    const safeW = Math.max(1, viewW || window.innerWidth || 1024);
    const safeH = Math.max(1, viewH || window.innerHeight || 768);
    const aspect = safeW / safeH;

    const frustumH = this.baseFrustumH / Math.max(0.05, this.zoom);
    const frustumW = frustumH * aspect;

    const worldPerPxX = frustumW / safeW;
    const worldPerPxY = frustumH / safeH;

    this.panX -= dxPx * worldPerPxX;
    this.panY += dyPx * worldPerPxY;
    this.targetPanX = this.panX;
    this.targetPanY = this.panY;

    this.updateProjection(safeW, safeH);
  }

  pan(dxPx, dyPx, viewW, viewH) {
    this.panByScreenDelta(dxPx, dyPx, viewW, viewH);
  }

  autoFit(bboxOrBonsai, viewW, viewH, immediate = false) {
    if (!bboxOrBonsai) return this.targetZoom;
    const bbox =
      typeof bboxOrBonsai.getBoundingBox === 'function'
        ? bboxOrBonsai.getBoundingBox()
        : bboxOrBonsai;

    if (!bbox) return this.targetZoom;

    const safeW = Math.max(1, viewW || window.innerWidth || 1024);
    const safeH = Math.max(1, viewH || window.innerHeight || 768);
    const aspect = safeW / safeH;

    const minX = bbox.minX !== undefined ? bbox.minX : -110;
    const maxX = bbox.maxX !== undefined ? bbox.maxX : 110;
    const minY = bbox.minY !== undefined ? bbox.minY : -55;
    const maxY = bbox.maxY !== undefined ? bbox.maxY : 160;

    const rawW = Math.max(120, bbox.width !== undefined ? bbox.width : maxX - minX);
    const rawH = Math.max(120, bbox.height !== undefined ? bbox.height : maxY - minY);

    // Add 18% margin around the tree + pot (plus extra vertical breathing room for top/bottom bars)
    const paddedW = rawW * 1.18;
    const paddedH = rawH * 1.24;

    const requiredFrustumH = Math.max(paddedH, paddedW / Math.max(0.2, aspect));
    const idealZoom = this.baseFrustumH / requiredFrustumH;
    const clampedZoom = Math.max(0.25, Math.min(2.2, idealZoom));

    const centerX =
      bbox.centerX !== undefined ? bbox.centerX : (minX + maxX) * 0.5;
    const centerY =
      bbox.centerY !== undefined ? bbox.centerY : (minY + maxY) * 0.5;

    const newFrustumH = this.baseFrustumH / clampedZoom;

    this.targetZoom = clampedZoom;
    this.targetPanX = centerX;
    this.targetPanY = centerY - newFrustumH * 0.28;

    if (immediate) {
      this.zoom = this.targetZoom;
      this.panX = this.targetPanX;
      this.panY = this.targetPanY;
      this.updateProjection(safeW, safeH);
    }

    return this.targetZoom;
  }

  autoFitBonsai(bonsai, viewW, viewH, immediate = false) {
    return this.autoFit(bonsai, viewW, viewH, immediate);
  }

  resetView(immediate = false, viewW = window.innerWidth, viewH = window.innerHeight) {
    this.targetZoom = 1.0;
    this.targetPanX = 0.0;
    this.targetPanY = 0.0;
    if (immediate) {
      this.zoom = 1.0;
      this.panX = 0.0;
      this.panY = 0.0;
      this.updateProjection(viewW, viewH);
    }
  }
}
