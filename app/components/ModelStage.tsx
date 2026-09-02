"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createHeroParkMotion, type ParkAnimator } from "./parkMotion";

type ModelStageProps = {
  onProgress?: (progress: number) => void;
  onReady?: () => void;
};

type ParkHotspot = {
  id: string;
  node: string;
  marker: string;
  label: string;
  kicker: string;
  title: string;
  copy: string;
  accent: string;
  accentInk: string;
  prominent?: boolean;
  featured?: boolean;
  screenOffset?: [number, number];
};

const PARK_HOTSPOTS: ParkHotspot[] = [
  {
    id: "eye",
    node: "Eye_of_Kenya",
    marker: "E",
    label: "Eye of Kenya",
    kicker: "The landmark",
    title: "Nairobi from a new point of view.",
    copy: "Rise above Two Rivers for an open-sky view that changes from bright afternoons to illuminated evenings.",
    accent: "#18b7b4",
    accentInk: "#ffffff",
    prominent: true,
    featured: true,
  },
  {
    id: "water",
    node: "Water_coaster",
    marker: "W",
    label: "Water Adventures",
    kicker: "The splash zone",
    title: "Make a splash.",
    copy: "Water-led rides and playful family attractions bring a cooler kind of energy to the park.",
    accent: "#2a90d8",
    accentInk: "#ffffff",
  },
  {
    id: "drop",
    node: "Drop_tower",
    marker: "D",
    label: "Drop Tower",
    kicker: "17 metres of thrill",
    title: "Go higher. Drop faster.",
    copy: "One of the park’s clearest adrenaline moments—and a landmark you can spot across the grounds.",
    accent: "#c31686",
    accentInk: "#ffffff",
  },
  {
    id: "fireball",
    node: "Bumper_cars",
    marker: "F",
    label: "Fireball",
    kicker: "Gaming · VR · Robotics",
    title: "Step inside Fireball.",
    copy: "PS5 gaming, virtual reality and robotics create an all-weather world built for players.",
    accent: "#653090",
    accentInk: "#ffffff",
    prominent: true,
    screenOffset: [48, 18],
  },
  {
    id: "mickys",
    node: "Micky's",
    marker: "M",
    label: "Micky’s Pizzeria",
    kicker: "Pizza · Food · Drinks",
    title: "Refuel at Micky’s.",
    copy: "Pizza, familiar favourites and an easy place to reset before heading back into the park.",
    accent: "#ffa51f",
    accentInk: "#071a22",
    prominent: true,
    screenOffset: [-14, 5],
  },
  {
    id: "nixx",
    node: "Nixx",
    marker: "N",
    label: "NIXX Premier Clothing",
    kicker: "Fashion & retail",
    title: "Meet NIXX.",
    copy: "The Funscapes fashion label brings clothing and accessories into the wider park experience.",
    accent: "#cbdc18",
    accentInk: "#071a22",
    prominent: true,
    screenOffset: [16, -5],
  },
];

type HotspotRuntime = {
  hotspot: ParkHotspot;
  anchor: THREE.Object3D;
  focus: THREE.Object3D;
};

const BASE_CAMERA = new THREE.Vector3(0, 5.35, 9.6);
const BASE_TARGET = new THREE.Vector3(0, -0.45, 0);
const FOCUS_DIRECTION = BASE_CAMERA.clone().sub(BASE_TARGET).normalize();

function applyWarmParkDetails(model: THREE.Object3D) {
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();

  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const name = object.name;
    let glow: { color: number; intensity: number } | null = null;

    if (/^bulb_lamp$/i.test(name)) glow = { color: 0xffd18a, intensity: 0.82 };
    else if (/^car_\d+_pole_lamp$/i.test(name)) glow = { color: 0xffdaa3, intensity: 0.48 };
    else if (/bulb/i.test(name)) glow = { color: 0xffdaa3, intensity: 0.46 };
    else if (/^(?:window_glass(?:_arch)?(?:_\d+|_(?:left|right))?|lantern_window_\d+)$/i.test(name)) {
      glow = { color: 0xffbd68, intensity: 0.24 };
    } else if (/^(?:sign_face|(?:ring|pond)_sign_face|sign_star|roof_star|star_finial|nixx_sign_board)$/i.test(name)) {
      glow = { color: 0xffd27f, intensity: 0.3 };
    }
    if (!glow) return;

    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const warmed = sourceMaterials.map((source) => {
      if (!(source instanceof THREE.MeshStandardMaterial)) return source;
      const cacheKey = `${source.uuid}:${glow.color}:${glow.intensity}`;
      const cached = materialCache.get(cacheKey);
      if (cached) return cached;

      const material = source.clone();
      material.emissive.set(glow.color);
      material.emissiveIntensity = glow.intensity;
      material.needsUpdate = true;
      materialCache.set(cacheKey, material);
      return material;
    });

    object.material = Array.isArray(object.material) ? warmed : warmed[0];
  });
}

function createFireballTexture(image: HTMLImageElement, renderer: THREE.WebGLRenderer) {
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height);
  const { data, width, height } = pixels;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueueBackground = (index: number) => {
    if (visited[index]) return;
    const offset = index * 4;
    if (data[offset] < 240 || data[offset + 1] < 240 || data[offset + 2] < 240) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueueBackground(x);
    enqueueBackground((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueueBackground(y * width);
    enqueueBackground(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    data[index * 4 + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueueBackground(index - 1);
    if (x + 1 < width) enqueueBackground(index + 1);
    if (y > 0) enqueueBackground(index - width);
    if (y + 1 < height) enqueueBackground(index + width);
  }
  context.putImageData(pixels, 0, 0);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (minX > maxX || minY > maxY) return null;

  const padding = Math.max(4, Math.round(Math.min(width, height) * 0.015));
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropped = document.createElement("canvas");
  cropped.width = maxX - minX + 1;
  cropped.height = maxY - minY + 1;
  const croppedContext = cropped.getContext("2d");
  if (!croppedContext) return null;
  croppedContext.drawImage(
    source,
    minX,
    minY,
    cropped.width,
    cropped.height,
    0,
    0,
    cropped.width,
    cropped.height,
  );

  const texture = new THREE.CanvasTexture(cropped);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function ModelStage({ onProgress, onReady }: ModelStageProps) {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeIdRef = useRef<string | null>(null);
  const onProgressRef = useRef(onProgress);
  const onReadyRef = useRef(onReady);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onReadyRef.current = onReady;
  }, [onProgress, onReady]);

  const selectHotspot = (id: string) => {
    activeIdRef.current = id;
    setActiveId(id);
  };

  const returnToOverview = () => {
    activeIdRef.current = null;
    setActiveId(null);
  };

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    // Always animate the 3D scene, regardless of the visitor's OS-level reduced-motion setting.
    const reducedMotion = false;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    let alive = true;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
    camera.position.copy(BASE_CAMERA);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !coarsePointer,
        powerPreference: "high-performance",
      });
    } catch {
      const failureFrame = window.requestAnimationFrame(() => {
        setFailed(true);
        onProgressRef.current?.(100);
        onReadyRef.current?.();
      });
      return () => window.cancelAnimationFrame(failureFrame);
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.1 : 1.35));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.tabIndex = -1;
    renderer.domElement.style.touchAction = coarsePointer ? "pan-y" : "none";
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enabled = !coarsePointer;
    controls.minDistance = 4.2;
    controls.maxDistance = 30;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minAzimuthAngle = -0.24;
    controls.maxAzimuthAngle = 0.24;
    controls.target.copy(BASE_TARGET);

    scene.add(new THREE.HemisphereLight(0xfffbef, 0x587069, 1.7));
    const key = new THREE.DirectionalLight(0xffe8c2, 2.25);
    key.position.set(6, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(coarsePointer ? 1024 : 2048, coarsePointer ? 1024 : 2048);
    key.shadow.camera.left = -4.35;
    key.shadow.camera.right = 4.15;
    key.shadow.camera.top = 3.1;
    key.shadow.camera.bottom = -4.3;
    key.shadow.camera.near = 9;
    key.shadow.camera.far = 18;
    key.shadow.bias = -0.00035;
    key.shadow.normalBias = 0.035;
    key.shadow.radius = 3;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd9eee5, 0.48);
    rim.position.set(-8, 4, -6);
    scene.add(rim);
    const midwayGlow = new THREE.PointLight(0xffc36f, 5.5, 6.5, 2);
    midwayGlow.position.set(-1.7, 1.8, 0.8);
    const carouselGlow = new THREE.PointLight(0xffa85e, 4.2, 5.5, 2);
    carouselGlow.position.set(1.8, 1.6, 1.1);
    scene.add(midwayGlow, carouselGlow);

    const root = new THREE.Group();
    root.rotation.y = 0;
    root.rotation.x = -0.03;
    scene.add(root);

    let targetRotation = root.rotation.y;
    let frame = 0;
    let visible = false;
    let previousTime = 0;
    let previousRenderTime = 0;
    let shadowElapsed = 0;
    let rideTime = 0;
    let fireballLogoImage: HTMLImageElement | null = null;
    let parkMotion: ParkAnimator | null = null;
    let previousActiveId: string | null = null;
    let returningToOverview = false;
    let hotspotRuntimes: HotspotRuntime[] = [];
    const worldPosition = new THREE.Vector3();
    const projectedPosition = new THREE.Vector3();
    const desiredTarget = new THREE.Vector3();
    const desiredCamera = new THREE.Vector3();
    const overviewCamera = BASE_CAMERA.clone();
    const overviewOffset = BASE_CAMERA.clone().sub(BASE_TARGET);
    const focusDistance = coarsePointer ? 5.7 : 4.8;
    const minimumFrameGap = 1_000 / (coarsePointer ? 24 : 40);

    const disposeObject = (object: THREE.Object3D) => {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        geometries.add(child.geometry);
        const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
        childMaterials.forEach((material) => {
          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
        });
      });
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
    };

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      // Preserve the authored full-park composition on narrow portrait screens.
      // A perspective camera framed for desktop otherwise crops both park edges.
      const overviewScale = THREE.MathUtils.clamp(1.12 / camera.aspect, 1, 2.35);
      overviewCamera.copy(BASE_TARGET).addScaledVector(overviewOffset, overviewScale);
      if (!activeIdRef.current) {
        camera.position.copy(overviewCamera);
        controls.target.copy(BASE_TARGET);
      }
    };

    const updateHotspots = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;

      hotspotRuntimes.forEach(({ hotspot, anchor }) => {
        const button = buttonRefs.current[hotspot.id];
        if (!button) return;
        anchor.getWorldPosition(worldPosition);
        projectedPosition.copy(worldPosition).project(camera);
        const onScreen =
          projectedPosition.z > -1 &&
          projectedPosition.z < 1 &&
          projectedPosition.x > -1.08 &&
          projectedPosition.x < 1.08 &&
          projectedPosition.y > -1.08 &&
          projectedPosition.y < 1.08;

        button.style.visibility = onScreen ? "visible" : "hidden";
        button.style.pointerEvents = onScreen ? "auto" : "none";
        if (!onScreen) return;

        const offsetScale = coarsePointer ? 0.65 : 1;
        const x = (projectedPosition.x * 0.5 + 0.5) * width + (hotspot.screenOffset?.[0] ?? 0) * offsetScale;
        const y = (-projectedPosition.y * 0.5 + 0.5) * height + (hotspot.screenOffset?.[1] ?? 0) * offsetScale;
        button.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      });
    };

    const loader = new GLTFLoader();
    loader.load(
      "/funscapes-hero.glb",
      (gltf) => {
        const model = gltf.scene;
        if (!alive) {
          disposeObject(model);
          return;
        }

        const embeddedLights: THREE.Light[] = [];
        model.traverse((object) => {
          if (object instanceof THREE.Light) embeddedLights.push(object);
        });
        embeddedLights.forEach((light) => light.parent?.remove(light));

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 7.2 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -center.y * scale - 0.08, -center.z * scale);
        model.updateMatrixWorld(true);
        const groundMeshes = new Set<THREE.Mesh>();
        const meshSize = new THREE.Vector3();
        const meshWorldScale = new THREE.Vector3();
        model.getObjectByName("ground")?.traverse((object) => {
          if (object instanceof THREE.Mesh) groundMeshes.add(object);
        });
        model.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            const isLightOrWater = /bulb|window_glass|lantern_window|pole_lamp|water_surface|_water$/i.test(object.name);
            object.geometry.computeBoundingBox();
            const bounds = object.geometry.boundingBox;
            let visibleShadowSize = true;
            if (bounds) {
              bounds.getSize(meshSize);
              object.getWorldScale(meshWorldScale);
              visibleShadowSize = Math.hypot(
                meshSize.x * Math.abs(meshWorldScale.x),
                meshSize.y * Math.abs(meshWorldScale.y),
                meshSize.z * Math.abs(meshWorldScale.z),
              ) >= 0.05;
            }
            object.castShadow = !groundMeshes.has(object) && !isLightOrWater && visibleShadowSize;
            object.receiveShadow = true;
          }
        });
        applyWarmParkDetails(model);

        const fireballRoof = model.getObjectByName("roof_ridge_cap");
        if (fireballRoof) {
          fireballLogoImage = new window.Image();
          fireballLogoImage.decoding = "async";
          fireballLogoImage.onload = () => {
            if (!alive || !fireballLogoImage) return;
            const texture = createFireballTexture(fireballLogoImage, renderer);
            if (!texture) return;
            if (!alive) {
              texture.dispose();
              return;
            }

            const decalWidth = 7.4;
            const decalHeight = Math.min(3.25, decalWidth / (texture.image.width / texture.image.height));
            const decal = new THREE.Mesh(
              new THREE.PlaneGeometry(decalWidth, decalHeight),
              new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.08,
                depthWrite: false,
                side: THREE.DoubleSide,
                toneMapped: false,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits: -2,
              }),
            );
            decal.name = "fireball_roof_decal";
            decal.position.set(0, 1.85, -2.2);
            decal.castShadow = false;
            decal.receiveShadow = false;
            decal.renderOrder = 3;
            fireballRoof.add(decal);
          };
          fireballLogoImage.src = "/fireball-logo.png";
        }

        root.add(model);
        scene.updateMatrixWorld(true);
        parkMotion = createHeroParkMotion(model);
        renderer.shadowMap.needsUpdate = true;

        hotspotRuntimes = PARK_HOTSPOTS.flatMap((hotspot) => {
          const attraction = model.getObjectByName(hotspot.node);
          if (!attraction) {
            console.warn(`Hotspot anchor not found: ${hotspot.node}`);
            return [];
          }

          const attractionBox = new THREE.Box3().setFromObject(attraction);
          if (attractionBox.isEmpty()) return [];
          const focusWorld = attractionBox.getCenter(new THREE.Vector3());
          const anchorWorld = focusWorld.clone();
          anchorWorld.y = attractionBox.max.y + 0.1;

          const anchor = new THREE.Object3D();
          anchor.name = `hotspot_${hotspot.id}`;
          anchor.position.copy(root.worldToLocal(anchorWorld.clone()));
          root.add(anchor);

          const focus = new THREE.Object3D();
          focus.name = `focus_${hotspot.id}`;
          focus.position.copy(root.worldToLocal(focusWorld.clone()));
          root.add(focus);

          return [{ hotspot, anchor, focus }];
        });

        setReady(true);
        onProgressRef.current?.(100);
        onReadyRef.current?.();
      },
      (event) => {
        if (!alive) return;
        const nextProgress = event.total
          ? Math.round((event.loaded / event.total) * 100)
          : -1;
        onProgressRef.current?.(nextProgress);
      },
      (error) => {
        if (!alive) return;
        console.error("Unable to load the Funscapes 3D model", error);
        setFailed(true);
        onProgressRef.current?.(100);
        onReadyRef.current?.();
      },
    );

    const onScroll = () => {
      if (reducedMotion || activeIdRef.current) return;
      const hero = mount.closest(".hero");
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const amount = THREE.MathUtils.clamp(-rect.top / Math.max(rect.height, 1), 0, 1);
      targetRotation = amount * 0.06;
    };

    const animate = (time: number) => {
      if (!visible) return;
      frame = window.requestAnimationFrame(animate);
      if (time - previousRenderTime < minimumFrameGap) return;

      const dt = previousTime ? Math.min((time - previousTime) / 1_000, 0.05) : 0;
      previousTime = time;
      previousRenderTime = time;
      const selectedId = activeIdRef.current;

      if (previousActiveId && !selectedId) returningToOverview = true;
      if (selectedId) returningToOverview = false;

      root.rotation.y = THREE.MathUtils.damp(root.rotation.y, targetRotation, 3.1, dt);

      const selected = selectedId
        ? hotspotRuntimes.find(({ hotspot }) => hotspot.id === selectedId)
        : undefined;

      if (selected) {
        selected.focus.getWorldPosition(desiredTarget);
        desiredCamera.copy(desiredTarget).addScaledVector(FOCUS_DIRECTION, focusDistance);
        if (reducedMotion) {
          controls.target.copy(desiredTarget);
          camera.position.copy(desiredCamera);
        } else {
          controls.target.x = THREE.MathUtils.damp(controls.target.x, desiredTarget.x, 4.3, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, desiredTarget.y, 4.3, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, desiredTarget.z, 4.3, dt);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamera.x, 4.1, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamera.y, 4.1, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamera.z, 4.1, dt);
        }
        controls.enabled = false;
      } else if (returningToOverview) {
        controls.target.x = THREE.MathUtils.damp(controls.target.x, BASE_TARGET.x, 4.3, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, BASE_TARGET.y, 4.3, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, BASE_TARGET.z, 4.3, dt);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, overviewCamera.x, 4.1, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, overviewCamera.y, 4.1, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, overviewCamera.z, 4.1, dt);
        controls.enabled = false;
        if (
          camera.position.distanceToSquared(overviewCamera) < 0.002 &&
          controls.target.distanceToSquared(BASE_TARGET) < 0.002
        ) {
          camera.position.copy(overviewCamera);
          controls.target.copy(BASE_TARGET);
          returningToOverview = false;
          controls.enabled = !coarsePointer;
        }
      } else {
        controls.enabled = !coarsePointer;
      }

      if (!reducedMotion && parkMotion) {
        rideTime += dt;
        parkMotion.update(rideTime, dt);
      }

      shadowElapsed += dt;
      const shadowInterval = coarsePointer ? 1 / 6 : 1 / 12;
      if (shadowElapsed >= shadowInterval) {
        renderer.shadowMap.needsUpdate = true;
        shadowElapsed = 0;
      }

      controls.update();
      updateHotspots();
      renderer.render(scene, camera);
      previousActiveId = selectedId;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && !document.hidden;
        previousTime = 0;
        previousRenderTime = 0;
        window.cancelAnimationFrame(frame);
        if (visible) frame = window.requestAnimationFrame(animate);
      },
      { threshold: 0.01 },
    );
    visibilityObserver.observe(mount);
    const onVisibilityChange = () => {
      visible = !document.hidden && mount.getBoundingClientRect().bottom > 0;
      previousTime = 0;
      previousRenderTime = 0;
      window.cancelAnimationFrame(frame);
      if (visible) frame = window.requestAnimationFrame(animate);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    resize();
    renderer.render(scene, camera);

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      observer.disconnect();
      visibilityObserver.disconnect();
      controls.dispose();
      if (fireballLogoImage) {
        fireballLogoImage.onload = null;
        fireballLogoImage.onerror = null;
      }
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  const activeHotspot = PARK_HOTSPOTS.find(({ id }) => id === activeId);

  return (
    <div className="model-stage">
      <div className="model-canvas" ref={canvasMountRef} />
      <Image
        className={`model-poster ${ready ? "is-hidden" : ""}`}
        src="/funscapes-overview.jpg"
        alt=""
        aria-hidden="true"
        width={1600}
        height={960}
        priority
      />

      {!failed && (
        <nav className="park-hotspots" aria-label="Explore the Funscapes park">
          {PARK_HOTSPOTS.map((hotspot) => {
            const isActive = activeId === hotspot.id;
            const isDimmed = Boolean(activeId && !isActive);
            return (
              <button
                key={hotspot.id}
                ref={(node) => { buttonRefs.current[hotspot.id] = node; }}
                type="button"
                className={`park-hotspot${hotspot.prominent ? " is-prominent" : ""}${hotspot.featured ? " is-featured" : ""}${isActive ? " is-active" : ""}${isDimmed ? " is-dimmed" : ""}`}
                style={{
                  visibility: "hidden",
                  "--hotspot-accent": hotspot.accent,
                  "--hotspot-ink": hotspot.accentInk,
                } as CSSProperties}
                onClick={() => selectHotspot(hotspot.id)}
                aria-label={hotspot.label}
                aria-expanded={isActive}
                aria-controls={isActive ? "park-hotspot-panel" : undefined}
              >
                <span className="park-hotspot-marker" aria-hidden="true">{hotspot.marker}</span>
                <span className="park-hotspot-label">{hotspot.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {activeHotspot && (
        <aside
          className="park-hotspot-panel"
          id="park-hotspot-panel"
          aria-labelledby="park-hotspot-panel-title"
          style={{ "--hotspot-accent": activeHotspot.accent } as CSSProperties}
        >
          <button
            className="park-hotspot-panel-close"
            type="button"
            onClick={returnToOverview}
            aria-label="Return to the full park overview"
          >
            <span aria-hidden="true">×</span>
          </button>
          <p className="park-hotspot-panel-kicker">{activeHotspot.kicker}</p>
          <h2 className="park-hotspot-panel-title" id="park-hotspot-panel-title">
            {activeHotspot.title}
          </h2>
          <p className="park-hotspot-panel-copy">{activeHotspot.copy}</p>
          <div className="park-hotspot-panel-actions">
            <button className="park-overview-button" type="button" onClick={returnToOverview}>
              Back to park overview
            </button>
          </div>
        </aside>
      )}

      {failed && <p className="model-error">The park preview could not load. The rest of the experience is still available below.</p>}
    </div>
  );
}
