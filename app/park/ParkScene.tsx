"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { APRONS, BENCHES, ISLAND, NIGHT_LIGHTS, PALETTE, PATHS, PLACEMENTS, PLAZA, type Animation, type Placement } from "./layout-data";

/* ------------------------------------------------------------------ */
/* Ground: a floating diorama slab with lawn, promenade and plaza       */
/* ------------------------------------------------------------------ */

function roundedRect(w: number, d: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Procedural canvas textures so the ground isn't flat colour. Tiles are in world metres via texture.repeat. */
function canvasTexture(size: number, paint: (ctx: CanvasRenderingContext2D) => void, metresPerTile: number, anisotropy: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  paint(canvas.getContext("2d")!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / metresPerTile, 1 / metresPerTile);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function grassTexture(anisotropy: number) {
  return canvasTexture(512, (ctx) => {
    ctx.fillStyle = "#a3d190";
    ctx.fillRect(0, 0, 512, 512);
    const tones = ["#97c684", "#add898", "#9fcc8c", "#b7dea3", "#90bd7d"];
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = tones[i % tones.length];
      ctx.globalAlpha = 0.35;
      const r = 6 + Math.random() * 22;
      ctx.beginPath();
      ctx.ellipse(Math.random() * 512, Math.random() * 512, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#86b672";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 1400; i += 1) {
      const x = Math.random() * 512, y = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 3 - Math.random() * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, 14, anisotropy);
}

function paverTexture(anisotropy: number, base = [238, 227, 203], grout = "#d6c7aa") {
  return canvasTexture(512, (ctx) => {
    ctx.fillStyle = grout;
    ctx.fillRect(0, 0, 512, 512);
    const cols = 4, rows = 8, w = 512 / cols, h = 512 / rows, gap = 4;
    for (let r = 0; r < rows; r += 1) {
      const offset = r % 2 ? w / 2 : 0;
      for (let c = -1; c <= cols; c += 1) {
        const k = 1 + (Math.random() - 0.5) * 0.12;
        ctx.fillStyle = `rgb(${Math.round(base[0] * k)}, ${Math.round(base[1] * k)}, ${Math.round(base[2] * k)})`;
        const x = c * w + offset + gap / 2, y = r * h + gap / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w - gap, h - gap, 3);
        ctx.fill();
      }
    }
  }, 6, anisotropy);
}

function buildGround(anisotropy: number) {
  const group = new THREE.Group();
  group.name = "ground";

  // Slab: extruded rounded rectangle, top face at y = 0.
  const slabGeo = new THREE.ExtrudeGeometry(roundedRect(ISLAND.width, ISLAND.depth, ISLAND.cornerRadius), {
    depth: ISLAND.thickness,
    bevelEnabled: true,
    bevelThickness: 0.8,
    bevelSize: 0.8,
    bevelSegments: 3,
    curveSegments: 24,
  });
  slabGeo.rotateX(Math.PI / 2);
  // After rotateX the extrusion runs downward and the bevel adds 0.8 above y = 0; shift so the top face is exactly y = 0.
  slabGeo.translate(0, -0.8, 0);
  const slab = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({ color: PALETTE.slab, roughness: 0.95 }));
  slab.receiveShadow = true;
  slab.name = "slab";
  group.add(slab);

  // Lawn: slightly inset rounded rect just above the slab.
  const lawnGeo = new THREE.ShapeGeometry(roundedRect(ISLAND.width - 6, ISLAND.depth - 6, ISLAND.cornerRadius - 3), 24);
  lawnGeo.rotateX(-Math.PI / 2);
  const lawn = new THREE.Mesh(lawnGeo, new THREE.MeshStandardMaterial({ map: grassTexture(anisotropy), roughness: 1 }));
  lawn.position.y = 0.02;
  lawn.receiveShadow = true;
  lawn.name = "lawn";
  group.add(lawn);

  const pathMat = new THREE.MeshStandardMaterial({ map: paverTexture(anisotropy), roughness: 0.9 });
  const kerbMat = new THREE.MeshStandardMaterial({ color: PALETTE.kerb, roughness: 0.9 });

  // Paths: capsule-shaped strips (rounded ends so joins look tidy).
  for (const seg of PATHS) {
    const dx = seg.to[0] - seg.from[0], dz = seg.to[1] - seg.from[1];
    const len = Math.hypot(dx, dz);
    const strip = (w: number, mat: THREE.Material, y: number) => {
      const shape = new THREE.Shape();
      const r = w / 2;
      shape.absarc(0, 0, r, Math.PI / 2, -Math.PI / 2, false);
      shape.lineTo(len, -r);
      shape.absarc(len, 0, r, -Math.PI / 2, Math.PI / 2, false);
      shape.closePath();
      const geo = new THREE.ShapeGeometry(shape, 12);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(seg.from[0], y, seg.from[1]);
      m.rotation.y = -Math.atan2(dz, dx);
      m.receiveShadow = true;
      return m;
    };
    group.add(strip(seg.width + 1.2, kerbMat, 0.04));
    group.add(strip(seg.width, pathMat, 0.06));
  }

  // Aprons: paved pads under rides.
  for (const apron of APRONS) {
    const make = (grow: number, mat: THREE.Material, y: number) => {
      const geo = apron.radius
        ? new THREE.CircleGeometry(apron.radius + grow, 48)
        : new THREE.ShapeGeometry(roundedRect(apron.size![0] + grow * 2, apron.size![1] + grow * 2, 2.5 + grow), 8);
      if (apron.radius) {
        // CircleGeometry UVs are 0..1: scale to world size.
        const uv = geo.attributes.uv as THREE.BufferAttribute;
        const d = (apron.radius + grow) * 2;
        for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * d, uv.getY(i) * d);
      }
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(apron.center[0], y, apron.center[1]);
      m.receiveShadow = true;
      return m;
    };
    group.add(make(0.6, kerbMat, 0.04), make(0, pathMat, 0.06));
  }

  // Plaza: circle with a kerb ring.
  const plazaKerb = new THREE.Mesh(new THREE.CircleGeometry(PLAZA.radius + 0.7, 64), kerbMat);
  plazaKerb.rotation.x = -Math.PI / 2;
  plazaKerb.position.set(PLAZA.center[0], 0.05, PLAZA.center[1]);
  plazaKerb.receiveShadow = true;
  // CircleGeometry UVs span 0..1, so scale the repeat to the plaza's diameter to keep the pavers at world size.
  const plazaTex = paverTexture(anisotropy, [246, 236, 214], "#dccfb4");
  plazaTex.repeat.set((PLAZA.radius * 2) / 6, (PLAZA.radius * 2) / 6);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA.radius, 64), new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(PLAZA.center[0], 0.07, PLAZA.center[1]);
  plaza.receiveShadow = true;
  // Decorative rings around the pavilion.
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x23beb9, roughness: 0.8 });
  const rings = [PLAZA.radius - 1.6, PLAZA.radius * 0.72].map((r, i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - (i ? 0.5 : 0.35), r, 96), ringMat.clone());
    ring.name = "plaza_ring";
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(PLAZA.center[0], 0.09, PLAZA.center[1]);
    return ring;
  });
  group.add(plazaKerb, plaza, ...rings);

  return group;
}

/* ------------------------------------------------------------------ */
/* Park benches (built in code; swap for a GLB later)                  */
/* ------------------------------------------------------------------ */

function buildBenches() {
  const group = new THREE.Group();
  group.name = "benches";
  const wood = new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x1f6f6c, roughness: 0.6, metalness: 0.2 });
  const slat = new THREE.BoxGeometry(3.2, 0.12, 0.34);
  const leg = new THREE.BoxGeometry(0.16, 0.9, 1.1);
  for (const b of BENCHES) {
    const bench = new THREE.Group();
    for (let i = 0; i < 3; i += 1) { const m = new THREE.Mesh(slat, wood); m.position.set(0, 0.9, -0.4 + i * 0.4); bench.add(m); }
    for (let i = 0; i < 2; i += 1) { const m = new THREE.Mesh(slat, wood); m.position.set(0, 1.35 + i * 0.4, -0.62); m.rotation.x = Math.PI / 2 - 0.2; bench.add(m); }
    for (const x of [-1.35, 1.35]) { const m = new THREE.Mesh(leg, iron); m.position.set(x, 0.45, -0.1); bench.add(m); }
    bench.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    bench.position.set(b.position[0], 0.07, b.position[1]);
    bench.rotation.y = THREE.MathUtils.degToRad(b.rotation);
    group.add(bench);
  }
  return group;
}

/* ------------------------------------------------------------------ */
/* Placeholder hot air balloons (swap for a GLB later)                  */
/* ------------------------------------------------------------------ */

function buildBalloons(): { group: THREE.Group; animator: Animator } {
  const group = new THREE.Group();
  group.name = "balloons";
  const profile: THREE.Vector2[] = [];
  // Balloon envelope profile: rounded top, tapering to the mouth.
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    const r = Math.sin(t * Math.PI) * (1 - t * 0.35) * (t < 0.15 ? t / 0.15 : 1);
    profile.push(new THREE.Vector2(Math.max(r, 0.001) * 6.5, 13 - t * 13));
  }
  const envelope = new THREE.LatheGeometry(profile, 24);
  const basketGeo = new THREE.BoxGeometry(2.6, 2, 2.6);
  const basketMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
  const specs = [
    { x: 62, y: 24, z: -44, color: 0xff3d8a, phase: 0 },
    { x: 78, y: 32, z: -24, color: 0xffa51f, phase: 2.1 },
    { x: 46, y: 38, z: -58, color: 0x23beb9, phase: 4.2 },
    { x: -74, y: 30, z: 30, color: 0xffd23f, phase: 1.2 },
  ];
  const items = specs.map((spec) => {
    const b = new THREE.Group();
    const env = new THREE.Mesh(envelope, new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.6 }));
    env.name = "balloon_envelope";
    env.position.y = 4.2;
    env.castShadow = true;
    const basket = new THREE.Mesh(basketGeo, basketMat);
    basket.castShadow = true;
    const ropes = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 1.0, 4.2, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0x555555, wireframe: true }));
    ropes.position.y = 2.6;
    // Burner glow for night mode; the rig switches it on by userData.intensity.
    const burner = new THREE.PointLight(0xffb060, 0, 40, 2);
    burner.position.y = 3.2;
    burner.userData.intensity = 140;
    b.add(env, basket, ropes, burner);
    b.position.set(spec.x, spec.y, spec.z);
    group.add(b);
    return { b, spec };
  });
  return {
    group,
    animator: {
      update(t) {
        for (const { b, spec } of items) {
          b.position.y = spec.y + Math.sin(t * 0.35 + spec.phase) * 1.6;
          b.position.x = spec.x + Math.sin(t * 0.18 + spec.phase) * 3;
          b.rotation.z = Math.sin(t * 0.3 + spec.phase) * 0.04;
        }
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Model loading + normalisation                                        */
/* ------------------------------------------------------------------ */

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Group>>();

function loadModel(file: string) {
  if (!cache.has(file)) {
    cache.set(
      file,
      new Promise((resolve, reject) => {
        loader.load(`/models/${file}`, (gltf) => resolve(gltf.scene), undefined, reject);
      }),
    );
  }
  return cache.get(file)!;
}

/** Wrap `object` so that its footprint is centred on the origin and its base rests on y = 0, then scale to `height`. */
function normalise(object: THREE.Object3D, height: number) {
  const pivot = new THREE.Group();
  pivot.add(object);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  object.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z));
  const scale = height / size.y;
  pivot.scale.setScalar(scale);
  return { pivot, scale, size };
}

interface Animator {
  update(t: number, dt: number): void;
}

function findAll(root: THREE.Object3D, test: RegExp) {
  const out: THREE.Object3D[] = [];
  root.traverse((o) => { if (test.test(o.name)) out.push(o); });
  return out;
}

function makeAnimator(kind: Animation, model: THREE.Object3D, size: THREE.Vector3, scale: number): Animator | null {
  switch (kind) {
    case "carousel": {
      const rotor = model.getObjectByName("rotor");
      if (!rotor) return null;
      const horses = findAll(rotor, /^horse_\d+$/).map((h, i) => ({ h, y: h.position.y, phase: i * 1.1 }));
      return {
        update(t, dt) {
          rotor.rotation.y += dt * 0.45;
          for (const { h, y, phase } of horses) h.position.y = y + Math.sin(t * 2.4 + phase) * 0.14;
        },
      };
    }
    case "ferris-wheel": {
      const rotor = model.getObjectByName("wheel_rotor");
      if (!rotor) return null;
      const baseZ = rotor.rotation.z;
      const cabins = findAll(model, /^cabin_pivot_\d+$/).map((c) => ({ c, z: c.rotation.z }));
      let phase = 0;
      return {
        update(_t, dt) {
          phase += dt * 0.12;
          rotor.rotation.z = baseZ + phase;
          for (const { c, z } of cabins) c.rotation.z = z - phase;
        },
      };
    }
    case "drop-tower": {
      // The car is made of loose root-level parts: group them under one pivot.
      const parts = findAll(model, /^(gondola_ring|carriage_hub|seat_pad_\d+|seat_back_\d+)$/);
      if (!parts.length) return null;
      const car = new THREE.Group();
      car.name = "drop_car";
      const parent = parts[0].parent!;
      parent.add(car);
      for (const p of parts) car.attach(p);
      // Boxes come back in world units (the pivot is already scaled); convert to the car's local units.
      const carBox = new THREE.Box3().setFromObject(car);
      const crown = model.getObjectByName("crown_deck");
      const crownBox = crown ? new THREE.Box3().setFromObject(crown) : null;
      const top = ((crownBox ? crownBox.min.y : size.y * scale * 0.9) - carBox.max.y) / scale - size.y * 0.02;
      const travel = Math.max(top, size.y * 0.5);
      // Cycle: climb (6 s) → hold (2 s) → drop (0.75 s) → bounce/settle (1.5 s) → wait (2.5 s)
      const cycle = 12.75;
      return {
        update(t) {
          const s = t % cycle;
          let y = 0;
          if (s < 6) { const k = s / 6; y = travel * (1 - Math.pow(1 - k, 2)); }
          else if (s < 8) y = travel;
          else if (s < 8.75) { const k = (s - 8) / 0.75; y = travel * (1 - k * k); }
          else if (s < 10.25) { const k = (s - 8.75) / 1.5; y = Math.abs(Math.sin(k * Math.PI * 2)) * travel * 0.08 * (1 - k); }
          car.position.y = y;
        },
      };
    }
    case "water-coaster": {
      const rafts = findAll(model, /^raft_[ab]$/).map((r, i) => ({ r, y: r.position.y, rz: r.rotation.z, phase: i * 2 }));
      if (!rafts.length) return null;
      return {
        update(t) {
          for (const { r, y, rz, phase } of rafts) {
            r.position.y = y + Math.sin(t * 1.6 + phase) * 0.06;
            r.rotation.z = rz + Math.sin(t * 1.1 + phase) * 0.03;
          }
        },
      };
    }
    case "bumper-cars": {
      const cars = findAll(model, /^bumper_car_\d+$/).map((c, i) => ({ c, x: c.position.x, z: c.position.z, ry: c.rotation.y, phase: i * 0.9, r: 0.5 + (i % 3) * 0.25 }));
      if (!cars.length) return null;
      return {
        update(t, dt) {
          for (const { c, x, z, ry, phase, r } of cars) {
            c.position.x = x + Math.cos(t * 0.7 + phase) * r;
            c.position.z = z + Math.sin(t * 0.9 + phase) * r;
            c.rotation.y = ry + Math.sin(t * 0.5 + phase) * 0.8;
          }
          void dt;
        },
      };
    }
    case "teacups": {
      const cups = findAll(model, /cup/i).filter((c) => c.children.length > 0 || c instanceof THREE.Mesh);
      const platter = model.children[0];
      return {
        update(_t, dt) {
          if (platter) platter.rotation.y += dt * 0.3;
          for (const c of cups) c.rotation.y += dt * 1.2;
        },
      };
    }
  }
  return null;
}

const FAIRY_COLOURS = [0xffd27a, 0xff6fb0, 0x5ff2ec, 0xfff3c0, 0xa8ff7a, 0xffa51f];
const fairyGeo = new THREE.SphereGeometry(0.045, 6, 5);
const fairyMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

/** String of little unlit bulbs around a tree canopy. Hidden by day; night mode shows it. */
function addFairyLights(pivot: THREE.Group, object: THREE.Object3D, scale: number, count: number) {
  const box = new THREE.Box3().setFromObject(object); // world units (pivot is scaled)
  const min = box.min.clone().divideScalar(scale), max = box.max.clone().divideScalar(scale);
  const size = max.clone().sub(min);
  const centre = new THREE.Vector3((min.x + max.x) / 2, min.y + size.y * 0.62, (min.z + max.z) / 2);
  const radii = new THREE.Vector3(size.x * 0.48, size.y * 0.34, size.z * 0.48);
  const mesh = new THREE.InstancedMesh(fairyGeo, fairyMat, count);
  mesh.name = "fairy_lights";
  const m = new THREE.Matrix4();
  const colour = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const y = -0.35 + Math.random() * 1.3; // bias to the upper canopy
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    m.makeTranslation(centre.x + Math.cos(theta) * r * radii.x, centre.y + y * radii.y, centre.z + Math.sin(theta) * r * radii.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, colour.set(FAIRY_COLOURS[i % FAIRY_COLOURS.length]));
  }
  mesh.visible = false;
  pivot.add(mesh);
}

async function place(p: Placement, animators: Animator[]) {
  const source = await loadModel(p.model);
  let object: THREE.Object3D;
  if (p.child) {
    const child = source.getObjectByName(p.child);
    if (!child) throw new Error(`${p.model} has no child named ${p.child}`);
    object = child.clone(true);
  } else {
    object = source.clone(true);
  }
  const { pivot, size, scale } = normalise(object, p.height);
  pivot.name = p.name;
  pivot.position.set(p.position[0], 0, p.position[1]);
  pivot.rotation.y = THREE.MathUtils.degToRad(p.rotation ?? 0);
  pivot.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  if (p.animation) {
    const a = makeAnimator(p.animation, object, size, scale);
    if (a) animators.push(a);
  }
  if (p.model === "trees.glb") addFairyLights(pivot, object, scale, /bush|topiary/.test(p.child ?? "") ? 9 : 22);
  return pivot;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export interface ParkSceneProps {
  /** Show a metre grid and axes to help with layout work. */
  debug?: boolean;
  /** Freeze all ride animations. */
  still?: boolean;
  /** Start in night mode. */
  night?: boolean;
}

/* ------------------------------------------------------------------ */
/* Night mode: bulbs glow, sky darkens, point lights come on            */
/* ------------------------------------------------------------------ */

const GLOW = /bulb|lantern|window_glass|sign_face|glow|^star|finial|lamp_head|balloon_envelope|plaza_ring|mickys_sign|nixx_sign_board|nixx_sign_bar|wheel_rim|cabin_shell|cabin_roof|teacup_body|teacup_lip|^rung_[xz]_[ab]\d+$|crown_cone|^spire$|gondola_ring|canopy_panel|valance|flume_main_water|flume_lift_water|pool_water_surface|station_canopy|raft_[ab]_hull|awning|arch_band|arch_trim/i;

interface Twinkler {
  mat: THREE.MeshStandardMaterial;
  base: number;
  index: number;
  kind: "chase" | "climb" | "pulse" | "twinkle";
}

interface NightRig {
  apply(on: boolean): void;
  update(t: number): void;
}

/** Name of the top-level placement a mesh belongs to (the pivot directly under the park group). */
function placementName(o: THREE.Object3D, park: THREE.Group) {
  let n: THREE.Object3D | null = o;
  while (n && n.parent && n.parent !== park) n = n.parent;
  return n?.name ?? "";
}

function buildNightRig(scene: THREE.Scene, park: THREE.Group, renderer: THREE.WebGLRenderer, hemi: THREE.HemisphereLight, key: THREE.DirectionalLight, fill: THREE.DirectionalLight): NightRig {
  for (const l of NIGHT_LIGHTS) {
    const light = new THREE.PointLight(l.color, 0, l.distance ?? 40, 2);
    light.position.set(...l.position);
    light.userData.intensity = l.intensity;
    scene.add(light);
  }
  const twinklers: Twinkler[] = [];
  let counter = 0;
  let nightOn = false;
  const isSaturated = (c: THREE.Color) => { const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl); return hsl.s > 0.35 && hsl.l < 0.85; };
  const prepare = (mesh: THREE.Mesh) => {
    if (mesh.userData.day) return;
    const day = mesh.material as THREE.MeshStandardMaterial;
    if (!(day instanceof THREE.MeshStandardMaterial)) return;
    const night = day.clone();
    const name = mesh.name;
    const owner = placementName(mesh, park);
    let kind: Twinkler["kind"] | null = null;
    const set = (hex: number | THREE.Color, k: number) => { night.emissive.set(hex); night.emissiveIntensity = k; };
    if (/window_glass/i.test(name)) set(0xffc46a, 1.4);
    else if (/plaza_ring/.test(name)) set(0x23beb9, 1.8);
    else if (/balloon_envelope/.test(name)) set(day.color, 1.3);
    else if (/^star/i.test(name)) { set(0xffe066, 4.5); kind = "pulse"; }
    else if (/^rung_/.test(name)) { set(0xffb347, 1.8); kind = "climb"; }
    else if (/crown_cone|^spire$/.test(name)) set(0xffd27a, 2.4);
    else if (/gondola_ring/.test(name)) set(0x5ff2ec, 2);
    else if (/wheel_rim/.test(name)) set(0x9ad7ff, 1.5);
    else if (/cabin_shell|cabin_roof|teacup_body|teacup_lip|raft_[ab]_hull|station_canopy|awning|arch_band|arch_trim|canopy_panel|valance/.test(name)) set(isSaturated(day.color) ? day.color : new THREE.Color(0xfff0d0), /canopy_panel/.test(name) ? 0.55 : 1.0);
    else if (/water/.test(name)) set(0x3fa9ff, 0.9);
    else if (/bulb/i.test(name)) {
      set(isSaturated(day.color) ? day.color : new THREE.Color(0xffe2a0), isSaturated(day.color) ? 2.2 : 2.8);
      kind = owner === "Entry arch" ? "chase" : "twinkle";
    }
    else if (isSaturated(day.color)) set(day.color, 2.2);
    else set(0xffe2a0, 2.6);
    mesh.userData.day = day;
    mesh.userData.night = night;
    if (kind) {
      const m = name.match(/(\d+)(?!.*\d)/);
      twinklers.push({ mat: night, base: night.emissiveIntensity, index: kind === "climb" && m ? Number(m[1]) : counter++, kind });
    }
  };
  return {
    apply(on) {
      nightOn = on;
      park.traverse((o) => {
        if (o instanceof THREE.PointLight && o.userData.intensity != null) o.intensity = on ? o.userData.intensity : 0;
        if (o.name === "fairy_lights") o.visible = on;
        if (!(o instanceof THREE.Mesh) || !GLOW.test(o.name)) return;
        prepare(o);
        if (o.userData.night) o.material = on ? o.userData.night : o.userData.day;
      });
      scene.traverse((o) => { if (o instanceof THREE.PointLight && o.userData.intensity != null) o.intensity = on ? o.userData.intensity : 0; });
      const sky = on ? 0x0b1728 : PALETTE.sky;
      (scene.background as THREE.Color).set(sky);
      hemi.color.set(on ? 0x2f3f6e : 0xffffff);
      hemi.groundColor.set(on ? 0x0a0e18 : 0xb9d6a6);
      hemi.intensity = on ? 0.45 : 1.1;
      key.color.set(on ? 0x8aa6ff : 0xfff3e0);
      key.intensity = on ? 0.5 : 2.4;
      fill.intensity = on ? 0.08 : 0.7;
      renderer.toneMappingExposure = on ? 0.95 : 1.0;
    },
    update(t) {
      if (!nightOn) return;
      const step = Math.floor(t * 3);
      const climb = Math.floor(t * 7);
      for (const tw of twinklers) {
        switch (tw.kind) {
          case "chase": tw.mat.emissiveIntensity = tw.base * ((tw.index + step) % 2 === 0 ? 1 : 0.12); break; // alternating arch bulbs
          case "climb": tw.mat.emissiveIntensity = tw.base * ((((tw.index - climb) % 6) + 6) % 6 === 0 ? 1 : 0.2); break; // light climbing the mast
          case "pulse": tw.mat.emissiveIntensity = tw.base * (0.7 + 0.3 * Math.sin(t * 3)); break;
          default: tw.mat.emissiveIntensity = tw.base * (0.8 + 0.2 * Math.sin(t * 2.5 + tw.index * 1.7));
        }
      }
    },
  };
}

export function ParkScene({ debug = false, still = false, night: initialNight = false }: ParkSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<(() => void) | null>(null);
  const nightRef = useRef<((on: boolean) => void) | null>(null);
  const [night, setNight] = useState(initialNight);
  const [status, setStatus] = useState<string>("Loading models…");
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let alive = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTE.sky);

    const camera = new THREE.PerspectiveCamera(32, 1, 1, 1000);
    // Viewing direction for the opening shot; the distance is fitted to the viewport in resize().
    const viewDirection = new THREE.Vector3(0.5, 0.42, 0.8).normalize();
    const lookAt = new THREE.Vector3(0, 6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(lookAt);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 60;
    controls.maxDistance = 600;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minPolarAngle = Math.PI * 0.12;

    // Lighting: soft sky dome + warm key with shadows + cool fill.
    const hemi = new THREE.HemisphereLight(0xffffff, 0xb9d6a6, 1.1);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff3e0, 2.4);
    key.position.set(80, 120, 60);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.camera.left = -110;
    key.shadow.camera.right = 110;
    key.shadow.camera.top = 110;
    key.shadow.camera.bottom = -110;
    key.shadow.camera.near = 20;
    key.shadow.camera.far = 400;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.05;
    key.shadow.radius = 4;
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xcfe9ff, 0.7);
    fill.position.set(-90, 50, -40);
    scene.add(fill);

    const park = new THREE.Group();
    park.name = "funscapes_mini_park";
    scene.add(park);
    park.add(buildGround(renderer.capabilities.getMaxAnisotropy()));
    const nightRig = buildNightRig(scene, park, renderer, hemi, key, fill);
    let nightOn = initialNight;
    nightRef.current = (on) => { nightOn = on; nightRig.apply(on); };
    nightRig.apply(nightOn);

    if (debug) {
      const grid = new THREE.GridHelper(200, 20, 0x336699, 0x99bbcc);
      grid.position.y = 0.1;
      scene.add(grid, new THREE.AxesHelper(30));
    }

    const animators: Animator[] = [];
    const balloons = buildBalloons();
    park.add(balloons.group, buildBenches());
    animators.push(balloons.animator);
    let count = 0;
    Promise.allSettled(
      PLACEMENTS.map((p) =>
        place(p, animators).then((pivot) => {
          if (!alive) return;
          park.add(pivot);
          if (nightOn) nightRig.apply(true);
          count += 1;
          setLoaded(count);
        }),
      ),
    ).then((results) => {
      if (!alive) return;
      const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      failed.forEach((f) => console.error("Placement failed", f.reason));
      setStatus(failed.length ? `${failed.length} piece(s) failed to load — see console` : "");
    });

    const exportPark = () =>
      new Promise<ArrayBuffer>((resolve, reject) => {
        new GLTFExporter().parse(park, (r) => resolve(r as ArrayBuffer), reject, { binary: true, onlyVisible: true });
      });
    exportRef.current = () => {
      exportPark()
        .then((buffer) => {
          const blob = new Blob([buffer], { type: "model/gltf-binary" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "funscapes-mini-park.glb";
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        })
        .catch((err) => console.error("Export failed", err));
    };

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (!userMoved) {
        const distance = fitDistance(); // moves the camera while probing, so compute it first
        camera.position.copy(lookAt).addScaledVector(viewDirection, distance);
      }
      controls.update();
    };
    // Keep auto-fitting on resize until a real person takes over the camera.
    let userMoved = false;
    const takeOver = (e: Event) => { if (e.isTrusted) userMoved = true; };
    renderer.domElement.addEventListener("pointerdown", takeOver);
    renderer.domElement.addEventListener("wheel", takeOver, { passive: true });

    /** Distance along viewDirection at which the island (plus its tallest ride) fits the viewport with a margin. */
    const fitDistance = () => {
      const hw = ISLAND.width / 2 + 4, hd = ISLAND.depth / 2 + 4, top = 52;
      const corners: THREE.Vector3[] = [];
      for (const x of [-hw, hw]) for (const z of [-hd, hd]) for (const y of [-ISLAND.thickness, top]) corners.push(new THREE.Vector3(x, y, z));
      const margin = 0.9;
      const fits = (d: number) => {
        camera.position.copy(lookAt).addScaledVector(viewDirection, d);
        camera.lookAt(lookAt);
        camera.updateMatrixWorld(true);
        const v = new THREE.Vector3();
        return corners.every((c) => {
          v.copy(c).project(camera);
          return Math.abs(v.x) <= margin && Math.abs(v.y) <= margin;
        });
      };
      let lo = 40, hi = 800;
      for (let i = 0; i < 24; i += 1) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) hi = mid; else lo = mid;
      }
      return hi;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const clock = new THREE.Clock();
    let frame = 0;
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      if (!still) for (const a of animators) a.update(t, dt);
      nightRig.update(t);
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Handy for layout work from the browser console (and for automated captures).
    (window as unknown as { __park: unknown }).__park = { camera, controls, scene, park, renderer, exportPark, fitDistance, resize, refit: () => { userMoved = false; resize(); }, setNight: (on: boolean) => nightRef.current?.(on) };

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", takeOver);
      renderer.domElement.removeEventListener("wheel", takeOver);
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialNight only seeds the scene; later toggles go through nightRef
  }, [debug, still]);

  useEffect(() => { nightRef.current?.(night); }, [night]);

  return (
    <div className="park-stage" ref={mountRef}>
      <div className="park-hud">
        <strong>Funscapes mini park</strong>
        <span>{status || `${loaded} / ${PLACEMENTS.length} pieces placed · drag to orbit, scroll to zoom`}</span>
        <div className="park-hud-actions">
          <button type="button" onClick={() => setNight((n) => !n)} aria-pressed={night}>{night ? "☀ Day mode" : "☾ Night mode"}</button>
          <button type="button" className="quiet" onClick={() => exportRef.current?.()}>Export park .glb</button>
        </div>
      </div>
    </div>
  );
}
