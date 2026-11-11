# Digital Bonsai Synthesizer // Three.js WebGL ASCII Procedural Bio-Simulator

> Real-time causal botanical morphogenesis, leaf-bud-to-trunk fractal ontogeny, and interactive bonsai cultivation simulator rendered in 60–120 FPS GPU ASCII art via Three.js WebGL shaders.

---

## 🌿 Key Botanical & Technical Features

- **🌱 Complete Ontogenetic Cycle (`SEEDLING_SHOOT` & `TRAINED_TRUNK`):**
  - Start from a single tender herbaceous shoot (**🌱 Brote Joven - Año 0**) or a trained multi-head pre-bonsai (**🪵 Pre-Bonsái - 3月**).
  - As shoots elongate, they form species-accurate nodes with leaves and **Axillary Leaf-Buds (`AXILLARY_LEAF_BUD`)** tucked in the upper axil between stem and petiole.
  - When apical dominance is released (naturally across seasons, by **✂️ Pruning**, or by **🤏 Pinching / *Mekiri* Leaf Defoliation**), those axillary leaf-buds swell and sprout lateral branches across fractal orders (`G0 → G6`).
  - Through **Leonardo da Vinci's Pipe Model** ($R_{\text{parent}}^\alpha = \sum R_{\text{child}}^\alpha + \sum r_{\text{leaf}}^\alpha$) and irreversible vascular cambium ring deposition, the original tender green shoot lignifies (`woodiness: 0.0 → 1.0`), abscises its old nodal leaves (`woodiness > 0.62`), and thickens into a muscular woody trunk (`1.4 mm → 38.0 mm`).
- **🧬 Parametric Species Profiles (`src/biology/SpeciesProfiles.js`):**
  - 🍁 **Acer palmatum (Japanese Maple):** Opposite decussate phyllotaxy (2 palmate leaves + 2 opposite axillary leaf-buds per node), dichotomous Y-branching ($32^\circ\text{–}46^\circ$), Pipe exponent $\alpha = 2.15$.
  - 🌳 **Ulmus parvifolia (Chinese Elm):** Alternate distichous zig-zag phyllotaxy (1 doubly-serrated leaf + 1 alternating axillary leaf-bud per node, $\pm 14^\circ$ stem deflection), $\alpha = 2.08$.
  - 🌲 **Pinus thunbergii (Japanese Black Pine):** Whorled candle shoots, radiating needle fascicles + 2–3 terminal whorl buds, sculptural horizontal branching, $\alpha = 2.22$.
- **🖥️ Three.js WebGL GPU ASCII Post-Processing (`src/rendering/`):**
  - High-capacity `InstancedMesh` pools (`MAX_CYLINDERS = 3500`, `MAX_SPHERES = 2500`, `MAX_LEAVES = 3500`) with zero per-frame garbage collection.
  - Fullscreen GLSL fragment shader sampling a 32-glyph 1024×128 font atlas with Sobel edge detection for directional bark contours and leaf veins `( ) / \ | _`.
- **⚡ Real-Time Biological Time Speed & Camera Framing (`src/interaction/`):**
  - **Biological Speed (`TIEMPO BIO`):** `⏸ PAUSA`, `▶ 1x`, `⏩ 5x`, `🚀 15x`, `⚡ 30x` presets, continuous `0x–30x` slider, and `⏭ +1 ESTACIÓN` step with deterministic `dt = 0.05` internal sub-stepping.
  - **2D Orthographic Camera (`ZOOM / VISTA`):** Cursor-centered mouse wheel zoom (`25%` to `350%`), click-and-drag panning (`🖐️ MOVER VISTA`, `Space + Drag`, or empty background drag), and `⛶ VER COMPLETO (AUTO-FIT)` bounding-box framing.

---

## 📂 Modular Project Structure

```text
digital-bonsai-synthesizer/
├── index.html                           # Self-contained simulator (works via file:// and http://)
├── src/
│   ├── main.js                          # App orchestrator, UI bindings & animation loop
│   ├── biology/
│   │   ├── SpeciesProfiles.js           # Deterministic Mulberry32 PRNG & species parameters
│   │   └── LivingBonsaiOrganism.js      # Auxin/Cytokinin engine, Pipe Model & leaf-bud ontogeny
│   ├── rendering/
│   │   ├── BotanicalGeometries.js       # 3D Maple/Ulmus/Pine geometries & 32-glyph ASCII atlas
│   │   └── AsciiThreeRenderer.js        # Three.js InstancedMesh pools & GLSL ASCII shader pass
│   ├── interaction/
│   │   ├── CameraController.js          # Orthographic zoom, pan, screenToWorld & autoFit
│   │   └── PruningController.js         # World-space hit-testing for pruning, bud pinching & Mekiri
│   └── audio/
│       └── BonsaiAudioSynth.js          # Procedural Web Audio API synthesizer
├── scripts/
│   └── build-bundle.mjs                 # Compiles src/* into index.html for zero-server file:// support
└── tests/
    └── verify-biology.mjs               # Automated Node.js biological & fractal verification suite
```

---

## 🚀 Usage & Verification

1. **Open directly in any browser (no server required):**
   ```bash
   open index.html
   ```
2. **Run the automated biological & fractal verification suite:**
   ```bash
   node tests/verify-biology.mjs
   ```
3. **Rebuild `index.html` after editing modular sources in `src/`:**
   ```bash
   node scripts/build-bundle.mjs
   ```

---

## 📜 License

MIT License.
