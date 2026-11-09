# Digital Bonsai Synthesizer // Procedural ASCII Biomechanical Simulator

> Real-time botanical cellular growth, fractal ramification, and interactive bonsai cultivation simulator rendered in high-density ASCII art via Canvas 2D and Vanilla JavaScript.

Inspired by cybernetic biotelemetry aesthetics and classical Japanese Bonsai horticulture.

---

## 🌿 Overview

**Digital Bonsai Synthesizer** is a real-time, interactive simulation that models the biological principles of plant and tree growth:
- **Cellular & Fractal Ontogeny:** Stems and branches grow continuously from base to apex ($t = 0 \to 1$). Daughter branches and foliage only emerge once the parent node reaches the insertion point—eliminating disjointed or floating parts.
- **Photosynthetic Thickening (Acrotonic Sap Flow):** Active green shoots photosynthesize and direct energy downward, cumulatively thickening all ancestral wood segments, trunk bends, and nebari root flares.
- **Apical Dominance & Pruning:** Removing terminal shoots breaks auxin-mediated apical dominance, stimulating dormant buds (*back-budding*) to generate dense, compact foliage pads.
- **Dynamic Species Models:**
  - 🌳 **Ulmus Parvifolia (Chinese Elm):** *Moyogi* (informal upright) S-curve trunk with alternate fine twigs and serrated elm micro-leaves.
  - 🌲 **Pinus Thunbergii (Japanese Black Pine):** *Chokkan* (formal tiered growth) with horizontal branches and needle tufts.
  - 🍁 **Acer Palmatum (Japanese Maple):** *Hokidachi* (delicate open broom/fan) with autumnal crimson and amber foliage.
  - 🌾 **Juniperus Chinensis (Chinese Juniper):** *Shakan* (windswept/slanting) with scaly foliage.
  - 🌸 **Iris Gece-Mavisi:** Continuous blooming iris flower with opening petals and real-time polar telemetry.

---

## ✂️ Interactive Bonsai Tools

- **✂️ Podar Rama (*Sentei*):** Structural cut that severs a branch and its descendants, creating a healing wood callus (`()`).
- **🤏 Pinzar Brote (*Metsumi*):** Pinches only tender green shoot tips, limiting elongation and promoting interior leaf density.
- **🔬 Inspeccionar:** Inspects branch caliber (mm), depth, active buds, and photosynthetic vigor.
- **⏩ +1 Temporada:** Advances vegetative growth cycles to observe thickening and bud emergence.
- **↺ Deshacer:** Full undo history for experimental pruning.
- **🔊 Zen Audio:** Procedural scissor snips and singing bowl harmonics generated in real time with Web Audio API.

---

## 🚀 Getting Started

No dependencies, bundlers, or build steps required.

1. Clone the repository:
   ```bash
   git clone https://github.com/Alexgmatosc/digital-bonsai-synthesizer.git
   cd digital-bonsai-synthesizer
   ```
2. Open `index.html` in any modern web browser:
   ```bash
   open index.html
   ```

---

## 🛠️ Tech Stack

- **Vanilla JavaScript (ES6+):** Pure mathematical Bézier sub-curve clipping, graph traversal, and PRNG seed genetics.
- **HTML5 Canvas 2D:** Subpixel ASCII glyph rendering supporting high-density Retina displays (`devicePixelRatio`).
- **Tailwind CSS & Web Fonts:** Cyber-HUD retro-futuristic styling (*Share Tech Mono*, *JetBrains Mono*).
- **Web Audio API:** Pure algorithmic synthesizer for sound effects.
- **Open-Meteo API:** Optional live weather telemetry feeding the specimen's metabolic growth factor.

---

## 📜 License

MIT License.
