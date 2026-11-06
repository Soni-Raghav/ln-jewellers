#!/usr/bin/env node
/**
 * LN Jewellers — per-product 3D model builder.
 *
 * Builds a UNIQUE parametric GLB for every catalog product (matched to each
 * design: signet ring with domed face, nine-strand cascade earrings, temple
 * choker with pearl drops, hammered one-of-one pendant …) and writes them to
 * public/models/{slug}.glb.
 *
 * Why not the photo? True photo→3D needs photogrammetry; instead every model
 * here is sculpted from real jewellery geometry (tori, lathes, hammered
 * displacement, prong heads, cable chains) with PBR gold/gem materials, so the
 * "View in 3D" stage shows the actual piece, not a category placeholder.
 *
 * Run:  node scripts/build-models.mjs
 * Out:  public/models/*.glb
 */

import * as THREE from "three";
import { Document, NodeIO, Format } from "@gltf-transform/core";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "models");
const TARGET_SIZE = 3.4; // every model normalized to this max dimension
const STAGE_SIZE = 2.8; // viewer-side normalization — fits the portrait 4:5 stage with margin

/* ------------------------------------------------------------------ */
/* Palette (matches ProductStage tones)                                */
/* ------------------------------------------------------------------ */

const C = {
  gold: [0.831, 0.686, 0.216, 1], // #D4AF37
  goldLight: [0.902, 0.784, 0.478, 1], // #E6C87A
  goldDeep: [0.616, 0.463, 0.114, 1],
  ruby: [0.62, 0.082, 0.141, 1], // #9E1524
  emerald: [0.055, 0.486, 0.333, 1], // #0E7C55
  sapphire: [0.118, 0.227, 0.541, 1],
  pearl: [0.937, 0.906, 0.824, 1], // #EFE7D2
  diamond: [0.851, 0.796, 0.659, 1], // #D9CBA8
};

function gemColorFor(material) {
  const m = (material || "").toLowerCase();
  if (m.includes("ruby")) return C.ruby;
  if (m.includes("emerald")) return C.emerald;
  if (m.includes("sapphire")) return C.sapphire;
  if (m.includes("pearl")) return C.pearl;
  return C.diamond; // diamond / cz / default
}

/* ------------------------------------------------------------------ */
/* glTF document helpers                                               */
/* ------------------------------------------------------------------ */

function newDoc() {
  const doc = new Document();
  const buffer = doc.createBuffer("bin");
  const scene = doc.createScene("Scene");
  return { doc, scene, buffer };
}

function mat(doc, name, baseColor, { metalness = 1, roughness = 0.24 } = {}) {
  return doc
    .createMaterial(name)
    .setBaseColorFactor(baseColor)
    .setMetallicFactor(metalness)
    .setRoughnessFactor(roughness)
    .setDoubleSided(true);
}

/** Flatten a geometry's normals (faceted gem look). */
function faceted(geo) {
  const g = geo.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/** Per-vertex radial noise — the hand-hammered look. */
function hammer(geo, amount = 0.05, seed = 7) {
  const pos = geo.attributes.position;
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647 - 0.5;
  };
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + rand() * amount * 2 - amount * 0.4;
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function part(geo, material, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  return { geo, material, pos, rot, scale };
}

/** Build the document from a list of parts, normalized + centered. */
function assemble(doc, scene, buffer, parts, name) {
  const root = doc.createNode(name);
  scene.addChild(root);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const bbox = new THREE.Box3();

  const meshes = parts.map((p) => {
    const geo = p.geo;
    geo.computeBoundingBox();
    e.set(p.rot[0], p.rot[1], p.rot[2]);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(...p.pos), q, new THREE.Vector3(...p.scale));
    bbox.union(geo.boundingBox.clone().applyMatrix4(m4));

    const posAttr = geo.attributes.position;
    const normAttr = geo.attributes.normal;
    const posArr = new Float32Array(posAttr.array);
    const normArr = new Float32Array(normAttr.array);

    const prim = doc.createPrimitive().setMaterial(p.material);
    prim.setAttribute(
      "POSITION",
      doc.createAccessor("pos").setType("VEC3").setArray(posArr).setBuffer(buffer)
    );
    prim.setAttribute(
      "NORMAL",
      doc.createAccessor("nrm").setType("VEC3").setArray(normArr).setBuffer(buffer)
    );
    if (geo.index) {
      prim.setIndices(
        doc
          .createAccessor("idx")
          .setType("SCALAR")
          .setArray(new Uint32Array(geo.index.array))
          .setBuffer(buffer)
      );
    }
    const mesh = doc.createMesh().addPrimitive(prim);

    const node = doc.createNode().setMesh(mesh).setTranslation(p.pos).setRotation([q.x, q.y, q.z, q.w]).setScale(p.scale);
    root.addChild(node);
    return node;
  });

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bbox.getSize(size);
  bbox.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = TARGET_SIZE / maxDim;

  root.setScale([s, s, s]);
  root.setTranslation([-center.x * s, -center.y * s, -center.z * s]);
  return meshes;
}

/* Shared reusable geometries ---------------------------------------- */

const G = {
  torus: (r, t, rs = 32, ts = 128, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc),
  sphere: (r, w = 32, h = 24) => new THREE.SphereGeometry(r, w, h),
  cyl: (rt, rb, h, s = 32, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open),
  cone: (r, h, s = 40, open = false) => new THREE.ConeGeometry(r, h, s, 1, open),
  gem: (r = 0.3) => faceted(new THREE.IcosahedronGeometry(r, 1)),
  cab: (r = 0.3) => new THREE.SphereGeometry(r, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2),
};

/** Lathe helper — points from profile (Vector2 list). */
function lathe(points, seg = 48) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}

/* ------------------------------------------------------------------ */
/* Per-product builders                                                */
/* ------------------------------------------------------------------ */

const builders = {
  /* RINGS ----------------------------------------------------------- */
  "surya-solitaire-ring": (doc, M, gem) => {
    const parts = [
      part(G.torus(1.28, 0.14, 36, 140), M.gold),
      part(G.torus(1.28, 0.155, 24, 120, 0.5), M.goldLight, { rot: [0, 0, 0.9] }),
      part(G.torus(1.28, 0.155, 24, 120, 0.5), M.goldLight, { rot: [0, 0, -0.9] }),
      // head
      part(G.cyl(0.17, 0.21, 0.1, 32), M.gold, { pos: [0, 1.28, 0] }),
      part(G.gem(0.34), M.diamondGem, { pos: [0, 1.62, 0] }),
    ];
    // six prongs
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(part(new THREE.CylinderGeometry(0.035, 0.05, 0.42, 10), M.gold, { pos: [Math.cos(a) * 0.3, 1.62, Math.sin(a) * 0.3], rot: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35] }));
    }
    // pavé beads on shoulders
    for (let i = 0; i < 10; i++) {
      const a = 0.55 + i * 0.22;
      const x = Math.sin(a) * 1.28;
      const y = Math.cos(a) * 1.28;
      parts.push(part(G.sphere(0.05, 12, 10), M.diamondGem, { pos: [x, y, 0.14], scale: [1, 1, 0.6] }));
      parts.push(part(G.sphere(0.05, 12, 10), M.diamondGem, { pos: [x, y, -0.14], scale: [1, 1, 0.6] }));
    }
    return parts;
  },

  "meenakari-heritage-ring": (doc, M, gem) => {
    const parts = [
      part(G.torus(1.26, 0.16, 36, 140), M.gold),
      // raised bezel plate + enamel + ruby cabochon
      part(G.cyl(0.42, 0.5, 0.16, 40), M.gold, { pos: [0, 1.3, 0] }),
      part(G.torus(0.44, 0.035, 16, 64), M.emeraldEnamel, { pos: [0, 1.42, 0], rot: [Math.PI / 2, 0, 0] }),
      part(G.cab(0.34), M.rubyCab, { pos: [0, 1.42, 0] }),
    ];
    // gold beads ringing the bezel (meenakari kundan feel)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      parts.push(part(G.sphere(0.06, 12, 10), M.goldLight, { pos: [Math.cos(a) * 0.52, 1.34, Math.sin(a) * 0.52] }));
    }
    return parts;
  },

  "eterna-whisper-band": (doc, M) => {
    return [
      part(G.torus(1.3, 0.11, 40, 160), M.gold),
      part(G.torus(1.3, 0.125, 32, 160), M.brushed, { rot: [0, 0, 0.12] }),
      part(G.torus(1.32, 0.03, 16, 160), M.goldDeep, { rot: [0, 0, 0.12] }),
    ];
  },

  "ln-signet-ring": (doc, M) => {
    const face = new THREE.SphereGeometry(0.62, 40, 28);
    const parts = [
      part(G.torus(1.26, 0.17, 36, 140), M.gold),
      // oval domed face + raised oval rim
      part(face, M.gold, { pos: [0, 1.34, 0], scale: [1.15, 0.58, 0.92] }),
      part(G.torus(0.6, 0.05, 20, 72), M.goldLight, { pos: [0, 1.46, 0], rot: [Math.PI / 2, 0, 0], scale: [1.15, 0.92, 1] }),
      // shoulder pads
      part(G.sphere(0.2, 20, 16), M.gold, { pos: [0.62, 0.98, 0], scale: [1.3, 0.8, 1] }),
      part(G.sphere(0.2, 20, 16), M.gold, { pos: [-0.62, 0.98, 0], scale: [1.3, 0.8, 1] }),
    ];
    return parts;
  },

  /* NECKLACES -------------------------------------------------------- */
  "kalash-emerald-pendant": (doc, M) => {
    const parts = [
      // chain
      part(G.torus(1.72, 0.05, 16, 160), M.goldLight),
      // bail
      part(G.torus(0.13, 0.035, 14, 32), M.gold, { pos: [0, -1.62, 0], rot: [Math.PI / 2.2, 0, 0] }),
      // kalash pot (lathe) with lid + finial
      part(lathe([[0.02, -0.62], [0.34, -0.5], [0.52, -0.2], [0.5, 0.12], [0.36, 0.34], [0.3, 0.42], [0.33, 0.5], [0.2, 0.56], [0.02, 0.58]]), M.gold, { pos: [0, -2.14, 0] }),
      part(G.sphere(0.09, 18, 14), M.goldLight, { pos: [0, -1.52, 0] }),
      // emerald bezel on the belly
      part(G.cab(0.22), M.emeraldCab, { pos: [0, -1.95, 0.42], rot: [-0.5, 0, 0] }),
      part(G.torus(0.24, 0.03, 14, 40), M.goldLight, { pos: [0, -1.97, 0.41], rot: [Math.PI / 2 - 0.5, 0, 0] }),
    ];
    return parts;
  },

  "devi-temple-choker": (doc, M, gem) => {
    const parts = [
      // wide collar — thick partial torus worn around the neck
      part(G.torus(1.5, 0.3, 28, 140, Math.PI * 1.35), M.gold, { rot: [Math.PI / 2.25, 0, Math.PI - Math.PI * 1.35 / 2] }),
    ];
    // temple-jewel studs around the front arc + pearl drops
    for (let i = 0; i < 16; i++) {
      const t = -Math.PI * 0.675 + (i / 15) * Math.PI * 1.35;
      const x = Math.sin(t) * 1.5;
      const z = Math.cos(t) * 1.5;
      const facing = Math.atan2(x, z);
      parts.push(part(G.cone(0.09, 0.2, 12), M.goldLight, { pos: [x, 0.22, z], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1] }));
      // rotate stud to face outward: approximate with rotation around Y
      parts[parts.length - 1].rot = [Math.PI / 2, facing, 0];
      if (i % 2 === 0) {
        parts.push(part(G.sphere(0.11, 16, 12), M.pearl, { pos: [x * 1.02, -0.28, z * 1.02] }));
      }
    }
    // central medallion
    parts.push(part(G.cyl(0.3, 0.36, 0.12, 36), M.gold, { pos: [0, 0.1, 1.52], rot: [Math.PI / 2, 0, 0] }));
    parts.push(part(G.cab(0.2), M.gemCab, { pos: [0, 0.1, 1.6], rot: [Math.PI / 2, 0, 0] }));
    return parts;
  },

  "gauri-bridal-layered-set": (doc, M, gem) => {
    const parts = [
      part(G.torus(1.95, 0.045, 16, 160), M.goldLight, { pos: [0, 0.25, 0] }),
      part(G.torus(1.65, 0.06, 18, 160), M.gold, { pos: [0, 0, 0] }),
      part(G.torus(1.38, 0.05, 16, 160), M.goldLight, { pos: [0, -0.22, 0] }),
      // central medallion cluster
      part(G.cyl(0.34, 0.42, 0.14, 40), M.gold, { pos: [0, -1.6, 0.05], rot: [Math.PI / 2.4, 0, 0] }),
      part(G.cab(0.22), M.gemCab, { pos: [0, -1.66, 0.14], rot: [Math.PI / 2.4, 0, 0] }),
    ];
    // pearls along the innermost loop
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      parts.push(part(G.sphere(0.09, 14, 12), M.pearl, { pos: [Math.cos(a) * 1.38, -0.22 - 0.08, Math.sin(a) * 1.38] }));
    }
    return parts;
  },

  "bhaav-hammered-ruby-pendant": (doc, M) => {
    const disc = hammer(new THREE.SphereGeometry(0.62, 44, 32), 0.07, 13);
    const parts = [
      part(G.torus(1.72, 0.045, 14, 140), M.goldLight, { rot: [0.5, 0, 0] }),
      part(G.torus(0.12, 0.032, 12, 28), M.gold, { pos: [0, -1.55, 0], rot: [Math.PI / 2.2, 0, 0] }),
      part(disc, M.hammered, { pos: [0, -2.05, 0], scale: [1, 0.72, 1] }),
      part(G.cab(0.3), M.rubyCab, { pos: [0, -1.88, 0.32], rot: [-0.4, 0, 0] }),
      part(G.torus(0.32, 0.035, 14, 44), M.gold, { pos: [0, -1.9, 0.3], rot: [Math.PI / 2 - 0.4, 0, 0] }),
    ];
    return parts;
  },

  /* EARRINGS ---------------------------------------------------------- */
  "noor-diamond-studs": (doc, M) => {
    const stud = (x) => {
      const parts = [
        part(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), M.gold, { pos: [x, 0.9, 0] }),
        part(G.cyl(0.3, 0.34, 0.14, 32), M.gold, { pos: [x, 0.7, 0] }),
        part(G.gem(0.3), M.diamondGem, { pos: [x, 0.82, 0] }),
      ];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        parts.push(part(G.sphere(0.045, 10, 8), M.goldLight, { pos: [x + Math.cos(a) * 0.4, 0.76, Math.sin(a) * 0.4] }));
      }
      return parts;
    };
    return [...stud(-0.85), ...stud(0.85)];
  },

  "raag-jhumka-earrings": (doc, M, gem) => {
    const bell = lathe([[0.02, 0.85], [0.3, 0.6], [0.55, 0.2], [0.68, -0.25], [0.72, -0.55], [0.7, -0.6]]);
    const jhumka = (x, sgn) => {
      const parts = [
        part(G.sphere(0.16, 22, 18), M.gold, { pos: [x, 1.55, 0] }),
        part(G.gem(0.14), M.gemCab, { pos: [x, 1.82, 0] }),
        part(new THREE.CylinderGeometry(0.024, 0.024, 0.4, 10), M.gold, { pos: [x, 1.28, 0] }),
        part(G.torus(0.18, 0.032, 14, 36), M.gold, { pos: [x, 1.04, 0], rot: [Math.PI / 2, 0, 0] }),
        part(bell, M.gold, { pos: [x, 0.28, 0] }),
        part(G.torus(0.71, 0.055, 18, 72), M.goldLight, { pos: [x, -0.32, 0], rot: [Math.PI / 2, 0, 0] }),
        part(G.gem(0.2), M.gemCab, { pos: [x, -0.62, 0] }),
      ];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        parts.push(part(G.sphere(0.07, 12, 10), M.pearl, { pos: [x + Math.cos(a) * 0.71, -0.42, Math.sin(a) * 0.71] }));
      }
      return parts;
    };
    return [...jhumka(-1.0, -1), ...jhumka(1.0, 1)];
  },

  "luna-twist-hoops": (doc, M) => {
    const hoop = (x) => [
      // two interlocked arcs suggest the twist
      part(G.torus(0.85, 0.08, 24, 120, Math.PI * 1.25), M.gold, { pos: [x, 0, 0], rot: [0, 0, Math.PI * 0.4] }),
      part(G.torus(0.85, 0.08, 24, 120, Math.PI * 1.25), M.goldLight, { pos: [x, 0, 0], rot: [0, Math.PI, Math.PI * 0.4 - Math.PI * 1.25] }),
    ];
    return [...hoop(-0.95), ...hoop(0.95)];
  },

  "ganga-cascade-earrings": (doc, M) => {
    const ear = (x) => {
      const parts = [
        // sculpted crest
        part(G.torus(0.42, 0.09, 20, 60, Math.PI), M.gold, { pos: [x, 1.35, 0], rot: [0, Math.PI / 2, 0] }),
        part(G.sphere(0.12, 18, 14), M.goldLight, { pos: [x, 1.72, 0] }),
      ];
      // nine cascading strands
      for (let i = 0; i < 9; i++) {
        const off = (i - 4) * 0.13;
        const len = 1.7 + Math.cos((i / 8) * Math.PI) * 0.75;
        parts.push(
          part(new THREE.CylinderGeometry(0.028, 0.028, len, 10), M.gold, {
            pos: [x + off * 0.9, 1.15 - len / 2, off * 0.35],
            rot: [off * 0.18, 0, off * 0.06],
          })
        );
        parts.push(part(G.sphere(0.055, 12, 10), M.goldLight, { pos: [x + off * 0.9, 1.15 - len, off * 0.35] }));
      }
      return parts;
    };
    return [...ear(-0.9), ...ear(0.9)];
  },

  /* BRACELETS ---------------------------------------------------------- */
  "triveni-bangle-trio": (doc, M, gem) => {
    const bangles = [
      { y: 0.62, tilt: 0.1 },
      { y: 0, tilt: -0.05 },
      { y: -0.62, tilt: 0.08 },
    ];
    const parts = [];
    bangles.forEach((b, i) => {
      parts.push(part(G.torus(1.3, 0.11, 28, 140), M.gold, { pos: [0, b.y, 0], rot: [b.tilt, 0, 0] }));
      parts.push(part(G.torus(1.3, 0.13, 18, 140, Math.PI * 0.7), M.goldLight, { pos: [0, b.y, 0], rot: [b.tilt, 0, i % 2 ? -0.6 : 0.6] }));
      if (i === 1) {
        parts.push(part(G.cab(0.18), M.gemCab, { pos: [0, 1.3, 0] }));
        parts.push(part(G.cab(0.18), M.gemCab, { pos: [0, -1.3, 0], rot: [Math.PI, 0, 0] }));
      }
    });
    return parts;
  },

  "sutra-handchain-bracelet": (doc, M) => {
    const parts = [];
    const N = 16;
    const a0 = 1.55, b0 = 1.15; // ellipse radii
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const x = Math.cos(t) * a0;
      const z = Math.sin(t) * b0;
      // links alternate orientation like a real handmade chain
      const alt = i % 2 === 0 ? 0 : Math.PI / 2;
      parts.push(
        part(G.torus(0.16, 0.038, 12, 36), i % 2 ? M.goldLight : M.gold, {
          pos: [x, 0, z],
          rot: [Math.PI / 2, alt, t],
        })
      );
    }
    // S-hook clasp
    parts.push(part(G.torus(0.14, 0.045, 14, 40, Math.PI * 1.5), M.gold, { pos: [a0 + 0.16, 0, 0], rot: [0, Math.PI / 2, 0.4] }));
    return parts;
  },
};

/* ------------------------------------------------------------------ */
/* Material kit per product                                            */
/* ------------------------------------------------------------------ */

function buildMaterials(doc, materialString) {
  const gem = gemColorFor(materialString);
  return {
    gold: mat(doc, "gold", C.gold, { roughness: 0.22 }),
    goldLight: mat(doc, "goldLight", C.goldLight, { roughness: 0.2 }),
    goldDeep: mat(doc, "goldDeep", C.goldDeep, { roughness: 0.3 }),
    brushed: mat(doc, "brushed", C.goldLight, { roughness: 0.45 }),
    hammered: mat(doc, "hammered", C.gold, { roughness: 0.34 }),
    diamondGem: mat(doc, "diamond", C.diamond, { metalness: 0.15, roughness: 0.12 }),
    gemCab: mat(doc, "gem", gem, { metalness: 0.25, roughness: 0.18 }),
    rubyCab: mat(doc, "ruby", C.ruby, { metalness: 0.25, roughness: 0.18 }),
    emeraldCab: mat(doc, "emerald", C.emerald, { metalness: 0.25, roughness: 0.18 }),
    emeraldEnamel: mat(doc, "enamel", C.emerald, { metalness: 0.4, roughness: 0.3 }),
    pearl: mat(doc, "pearl", C.pearl, { metalness: 0.3, roughness: 0.25 }),
  };
}

/* ------------------------------------------------------------------ */
/* Catalog — slug + material copied from scripts/seed.ts               */
/* ------------------------------------------------------------------ */

const CATALOG = [
  ["surya-solitaire-ring", "22K Yellow Gold · Natural Diamond"],
  ["meenakari-heritage-ring", "22K Yellow Gold · Burma Ruby"],
  ["eterna-whisper-band", "18K Yellow Gold"],
  ["ln-signet-ring", "18K Yellow Gold"],
  ["kalash-emerald-pendant", "22K Yellow Gold · Zambian Emerald"],
  ["devi-temple-choker", "22K Yellow Gold · Pearls"],
  ["gauri-bridal-layered-set", "22K Yellow Gold · Pearls · CZ"],
  ["bhaav-hammered-ruby-pendant", "22K Yellow Gold · Star Ruby"],
  ["noor-diamond-studs", "18K Yellow Gold · Natural Diamonds"],
  ["raag-jhumka-earrings", "22K Yellow Gold · Seed Pearls"],
  ["luna-twist-hoops", "18K Yellow Gold"],
  ["ganga-cascade-earrings", "22K Yellow Gold"],
  ["triveni-bangle-trio", "22K Yellow Gold"],
  ["sutra-handchain-bracelet", "22K Yellow Gold"],
];

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

mkdirSync(OUT_DIR, { recursive: true });
const io = new NodeIO();

let ok = 0;
for (const [slug, material] of CATALOG) {
  const builder = builders[slug];
  if (!builder) {
    console.error(`✗ no builder for ${slug}`);
    continue;
  }
  const { doc, scene, buffer } = newDoc();
  const M = buildMaterials(doc, material);
  assemble(doc, scene, buffer, builder(doc, M), slug);

  const out = join(OUT_DIR, `${slug}.glb`);
  await io.write(out, doc);

  // round-trip validation
  await io.read(out);
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`✓ ${slug}.glb (${kb} KB)`);
  ok++;
}

console.log(`\n🎉 ${ok}/${CATALOG.length} models written to public/models/`);
if (!existsSync(join(OUT_DIR, "surya-solitaire-ring.glb"))) process.exit(1);
