/**
 * Funscapes mini park — assembly layout.
 *
 * Units are metres. x runs left→right, z runs back→front (positive z is
 * nearer the camera), y is up. Every model is auto-grounded (its lowest point
 * sits on y = 0) and auto-centred on its footprint before the transform below
 * is applied, so `position` is always the centre of the piece's footprint.
 *
 * `height` is the real-world height the piece should have; the loader scales
 * each model to match, which normalises the mixed scales of the source GLBs.
 */

export type Animation =
  | "carousel"
  | "ferris-wheel"
  | "drop-tower"
  | "water-coaster"
  | "teacups"
  | "bumper-cars";

export interface Placement {
  /** Human-readable label — also used for the export node name. */
  name: string;
  /** File under /public/models. */
  model: string;
  /** For multi-object models such as trees.glb: pick one named child. */
  child?: string;
  position: [x: number, z: number];
  /** Rotation around the vertical axis, in degrees. */
  rotation?: number;
  height: number;
  animation?: Animation;
}

export interface PathSegment {
  from: [number, number];
  to: [number, number];
  width: number;
}

export const ISLAND = {
  width: 150,
  depth: 108,
  cornerRadius: 20,
  thickness: 7,
};

export const PLAZA = { center: [0, -4] as [number, number], radius: 23 };

/**
 * Structure: a promenade runs from the arch (front, +z) to the plaza; a straight midway crosses
 * the front of the park; the big rides sit at the back so the silhouette rises away from the viewer.
 */
export const PATHS: PathSegment[] = [
  { from: [0, 56], to: [0, -4], width: 14 }, // promenade
  { from: [-62, 24], to: [62, 24], width: 10 }, // midway
  { from: [0, 47], to: [-56, 47], width: 5 }, // along Micky's and Nixx
  { from: [-16, -12], to: [-40, -10], width: 7 }, // to Ferris wheel
  { from: [16, -12], to: [36, -6], width: 7 }, // to water coaster
  { from: [0, -24], to: [4, -40], width: 7 }, // to drop tower
  { from: [-14, -20], to: [-30, -36], width: 6 }, // to teacups
];

export interface Apron {
  center: [number, number];
  /** Circle radius, or a rectangle [width, depth]. */
  radius?: number;
  size?: [number, number];
}

/** Paved pads under rides — less lawn, and each ride gets a clear footprint. */
export const APRONS: Apron[] = [
  { center: [0, 50], size: [34, 8] }, // entry forecourt
  { center: [44, 36], radius: 13 }, // carousel
  { center: [-32, -42], radius: 9.5 }, // teacups
  { center: [-48, -22], size: [42, 16] }, // Ferris wheel base
  { center: [40, 13], size: [42, 9] }, // booths row
  { center: [-36, 38], size: [40, 20] }, // Micky's terrace + Nixx
];

/** Everything with a front faces +z (toward the viewer); the models all have their doors on +z. */
export const RIDES: Placement[] = [
  { name: "Entry arch", model: "entry-arch.glb", position: [0, 46], height: 18 },
  { name: "Hub pavilion", model: "hub.glb", position: [0, -4], rotation: -67, height: 25 },
  { name: "Eye of Kenya", model: "ferris-wheel.glb", position: [-48, -22], rotation: 90, height: 50, animation: "ferris-wheel" },
  { name: "Water coaster", model: "water-coaster.glb", position: [44, -20], rotation: 0, height: 17, animation: "water-coaster" },
  { name: "Drop tower", model: "drop-tower.glb", position: [4, -42], height: 31, animation: "drop-tower" },
  { name: "Teacups", model: "teacups.glb", position: [-32, -42], height: 4, animation: "teacups" },
  { name: "Bumper cars", model: "bumper-cars.glb", position: [-44, 6], height: 10, animation: "bumper-cars" },
  // Front right: carousel on its paved circle south of the midway, booths in a row north of it.
  { name: "Carousel", model: "carousel.glb", position: [44, 36], height: 17, animation: "carousel" },
  { name: "Ring toss", model: "stalls.glb", child: "stall_ring_toss", position: [26, 13], height: 9 },
  { name: "Duck pond", model: "stalls.glb", child: "stall_duck_pond", position: [40, 13], height: 9 },
  { name: "Lemonade", model: "stalls.glb", child: "stall_lemonade", position: [54, 13], height: 9 },
  // Front left: Micky's with Nixx beside it, both facing forward onto a shared path.
  { name: "Micky's", model: "mickys.glb", position: [-42, 36], height: 11 },
  { name: "Nixx", model: "nixx.glb", position: [-22, 39], height: 9.5 },
];

const lampPositions: [number, number][] = [
  [-9.5, 44], [9.5, 44], [-9.5, 16], [9.5, 16], [-24, -18], [24, -18],
];

export const LAMPS: Placement[] = lampPositions.map(([x, z], i) => ({
  name: `Lamp ${i + 1}`,
  model: "lamp-post.glb",
  position: [x, z],
  height: 7,
}));

/** Park benches (built in code). Rotation 0 faces +z. */
export const BENCHES: { position: [number, number]; rotation: number }[] = [
  { position: [-10, 32], rotation: 90 }, // promenade, facing the path
  { position: [10, 32], rotation: -90 },
  { position: [-16, -4], rotation: 90 }, // plaza edge
];

/** Point lights for night mode: [x, y, z], colour, intensity (candela). */
export const NIGHT_LIGHTS: { position: [number, number, number]; color: number; intensity: number; distance?: number }[] = [
  ...lampPositions.map(([x, z]) => ({ position: [x, 6.4, z] as [number, number, number], color: 0xffd9a0, intensity: 160, distance: 34 })),
  { position: [0, 13, 46], color: 0xff6fb0, intensity: 260 }, // entry arch
  { position: [0, 16, -4], color: 0xffd6a8, intensity: 420 }, // hub pavilion
  { position: [44, 11, 36], color: 0xffe3b0, intensity: 320 }, // carousel
  { position: [40, 7, 17], color: 0xfff0c8, intensity: 200 }, // booths
  { position: [-42, 8, 46], color: 0xffd08a, intensity: 220 }, // Micky's terrace
  { position: [-22, 7, 46], color: 0xfff3c0, intensity: 120 }, // Nixx
  { position: [-44, 8, 8], color: 0x5ff2ec, intensity: 260 }, // bumper cars
  { position: [-48, 26, -22], color: 0xa8d8ff, intensity: 600, distance: 70 }, // Ferris wheel hub
  { position: [4, 30, -42], color: 0xffc27a, intensity: 260, distance: 50 }, // drop tower crown
  { position: [44, 9, -20], color: 0x4fa3ff, intensity: 260, distance: 50 }, // water coaster
  { position: [-32, 5, -42], color: 0xffb0e0, intensity: 160 }, // teacups
  { position: [-48, 5, -22], color: 0xc08bff, intensity: 220, distance: 40 }, // Ferris wheel base wash
  { position: [28, 6, -30], color: 0x4fa3ff, intensity: 160 }, // coaster lift
  { position: [62, 6, -28], color: 0x4fa3ff, intensity: 160 }, // coaster turn
  // uplights under the front round trees
  { position: [-66, 1, 46], color: 0x8dff9c, intensity: 90, distance: 22 },
  { position: [64, 1, 48], color: 0x8dff9c, intensity: 90, distance: 22 },
  { position: [-26, 1, 8], color: 0x8dff9c, intensity: 90, distance: 22 },
  { position: [24, 1, 4], color: 0x8dff9c, intensity: 90, distance: 22 },
];

type TreeKind = "fir_1" | "round_2" | "topiary_3" | "palm_4" | "bush_5";
const tree = (kind: TreeKind, x: number, z: number, height: number, rotation = 0): Placement => ({
  name: kind,
  model: "trees.glb",
  child: kind,
  position: [x, z],
  rotation,
  height,
});

/** Planting is kept to the perimeter and a few accents so the paving and rides read clearly. */
export const TREES: Placement[] = [
  // palms flanking the entrance
  tree("palm_4", -58, 50, 9.5, 20), tree("palm_4", 21, 52, 9.8, -35),
  // firs along the back edge and the sides
  tree("fir_1", -66, -46, 11, 0), tree("fir_1", -54, -50, 10, 0), tree("fir_1", -18, -50, 10.5, 0),
  tree("fir_1", 20, -50, 10, 0), tree("fir_1", 32, -46, 9, 0), tree("fir_1", 66, -46, 11, 0),
  tree("fir_1", -70, -6, 10.4, 0), tree("fir_1", 70, 0, 10, 0), tree("fir_1", 70, 12, 10.4, 0),
  // round trees at the front corners and between plaza and midway
  tree("round_2", -66, 46, 9, 0), tree("round_2", -68, 30, 8.4, 40), tree("round_2", 64, 48, 8.8, 90), tree("round_2", 64, 30, 8.2, 10),
  tree("round_2", -26, 8, 8.4, 30), tree("round_2", 24, 4, 8.4, 0),
  // topiaries marking the plaza
  tree("topiary_3", -19, 14, 5), tree("topiary_3", 19, 14, 5), tree("topiary_3", -19, -22, 5), tree("topiary_3", 19, -22, 5),
  // a few bushes at path corners
  tree("bush_5", -13, 37, 2.6, 0), tree("bush_5", 13, 37, 2.6, 90), tree("bush_5", 12, 2, 2.4, 0), tree("bush_5", -62, 16, 2.6, 30),
];

export const PLACEMENTS: Placement[] = [...RIDES, ...LAMPS, ...TREES];

export const PALETTE = {
  sky: 0xe9f4f7,
  lawn: 0x9fd08c,
  lawnDark: 0x8fbf7a,
  path: 0xf1e6cf,
  plaza: 0xf6ecd6,
  kerb: 0xfdf8ee,
  slab: 0xefe6d6,
  slabSide: 0xe3d6c1,
};
