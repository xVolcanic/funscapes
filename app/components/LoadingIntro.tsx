"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import styles from "./LoadingIntro.module.css";

export type LoadingIntroProps = {
  /** Asset-loading progress from 0 to 100. Pass -1 when total size is unknown. */
  progress: number;
  /** The intro only exits after this is true and its minimum display time has elapsed. */
  ready: boolean;
  onComplete?: () => void;
};

const MINIMUM_DISPLAY_MS = 3_200;
const EXIT_DURATION_MS = 680;
const FORMATION_DURATION_MS = 2_400;

type IntroPhase = "visible" | "leaving" | "hidden";

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

export function LoadingIntro({ progress, ready, onComplete }: LoadingIntroProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const mountedAtRef = useRef(0);
  const completionSentRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [phase, setPhase] = useState<IntroPhase>("visible");
  const [canEnter, setCanEnter] = useState(false);
  const [particlesReady, setParticlesReady] = useState(false);
  const active = phase !== "hidden";
  const indeterminate = progress < 0;
  const percent = indeterminate ? 0 : clampPercent(progress);

  const visibleLabel = useMemo(() => {
    if (ready) return canEnter ? "The park is ready" : "Preparing your entrance";
    if (indeterminate) return "Preparing the park";
    if (percent < 35) return "Assembling scene";
    if (percent < 72) return "Loading experiences";
    if (percent < 100) return "Almost there";
    return "Finalising experience";
  }, [canEnter, indeterminate, percent, ready]);

  const accessibleStatus = canEnter
    ? "Funscapes is ready. Select Enter to continue."
    : ready
      ? "Funscapes has loaded. Preparing your entrance."
      : indeterminate
        ? "Loading Funscapes."
        : `Loading Funscapes, ${percent} percent.`;

  useEffect(() => {
    mountedAtRef.current = performance.now();
  }, []);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!ready || phase !== "visible") return;

    const elapsed = performance.now() - mountedAtRef.current;
    const timer = window.setTimeout(
      () => setCanEnter(true),
      Math.max(0, MINIMUM_DISPLAY_MS - elapsed),
    );

    return () => window.clearTimeout(timer);
  }, [phase, ready]);

  const enterPark = () => {
    if (!canEnter || phase !== "visible") return;
    setPhase("leaving");
  };

  useEffect(() => {
    if (phase !== "leaving") return;

    const timer = window.setTimeout(() => {
      setPhase("hidden");
      if (!completionSentRef.current) {
        completionSentRef.current = true;
        onCompleteRef.current?.();
      }
    }, EXIT_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const mount = sceneRef.current;
    if (!mount || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let frameId = 0;
    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.tabIndex = -1;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.08, 3.75);
    const group = new THREE.Group();
    scene.add(group);

    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let spriteTexture: THREE.CanvasTexture | null = null;
    let positions: Float32Array | null = null;
    let starts: Float32Array | null = null;
    let targets: Float32Array | null = null;
    let delays: Float32Array | null = null;
    let formationStartedAt = 0;

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = width / height < 0.9 ? 5.25 : 3.75;
      camera.updateProjectionMatrix();
      if (material) material.uniforms.uScale.value = height * 0.58;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const logo = new window.Image();
    logo.decoding = "async";
    logo.src = "/funscapes-logo.png";

    logo.onload = () => {
      if (disposed) return;

      const sampleWidth = 520;
      const sampleHeight = Math.max(1, Math.round(sampleWidth * logo.naturalHeight / logo.naturalWidth));
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = sampleWidth;
      sampleCanvas.height = sampleHeight;
      const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(logo, 0, 0, sampleWidth, sampleHeight);
      const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
      const step = window.innerWidth < 720 ? 3 : 2;

      type Pixel = [number, number, number, number, number];
      const collectPixels = (includeWhite: boolean) => {
        const collected: Pixel[] = [];
        for (let y = 0; y < sampleHeight; y += step) {
          for (let x = 0; x < sampleWidth; x += step) {
            const index = (y * sampleWidth + x) * 4;
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const alpha = pixels[index + 3];
            if (alpha < 28) continue;
            if (!includeWhite && red > 232 && green > 232 && blue > 232) continue;
            collected.push([x, y, red, green, blue]);
          }
        }
        return collected;
      };

      let sampled = collectPixels(false);
      if (sampled.length < 300) sampled = collectPixels(true);
      if (!sampled.length || disposed) return;

      const particleLimit = window.innerWidth < 720 ? 8_000 : 18_000;
      const keepEvery = Math.max(1, Math.ceil(sampled.length / particleLimit));
      sampled = sampled.filter((_, index) => index % keepEvery === 0);

      const count = sampled.length;
      const worldWidth = 2.72;
      const worldScale = worldWidth / sampleWidth;
      positions = new Float32Array(count * 3);
      starts = new Float32Array(count * 3);
      targets = new Float32Array(count * 3);
      delays = new Float32Array(count);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const color = new THREE.Color();
      let seed = 0x46_55_4e;
      const random = () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return (seed >>> 0) / 4_294_967_296;
      };
      const spread = (amount: number) => (random() - 0.5) * amount;

      sampled.forEach(([x, y, red, green, blue], index) => {
        const offset = index * 3;
        const worldX = (x - sampleWidth / 2) * worldScale + spread(worldScale * step * 0.42);
        const worldY = (sampleHeight / 2 - y) * worldScale + spread(worldScale * step * 0.42);
        const worldZ = 0.12
          * Math.cos((worldX / worldWidth) * Math.PI)
          * Math.cos((worldY / (sampleHeight * worldScale)) * Math.PI * 0.9)
          + spread(0.03);

        targets![offset] = worldX;
        targets![offset + 1] = worldY;
        targets![offset + 2] = worldZ;

        const theta = random() * Math.PI * 2;
        const phi = Math.acos(2 * random() - 1);
        const radius = 2.35 + random() * 2.5;
        starts![offset] = Math.sin(phi) * Math.cos(theta) * radius;
        starts![offset + 1] = Math.sin(phi) * Math.sin(theta) * radius * 0.58;
        starts![offset + 2] = Math.cos(phi) * radius;

        color.setRGB(red / 255, green / 255, blue / 255);
        const brightness = 1 + random() * 0.28;
        colors[offset] = color.r * brightness;
        colors[offset + 1] = color.g * brightness;
        colors[offset + 2] = color.b * brightness;
        sizes[index] = (1 + random() * 0.48) * worldScale * step * 2.9;
        delays![index] = random() * 0.42;
      });
      positions.set(starts);

      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

      const spriteCanvas = document.createElement("canvas");
      spriteCanvas.width = spriteCanvas.height = 64;
      const spriteContext = spriteCanvas.getContext("2d");
      if (!spriteContext) return;
      const gradient = spriteContext.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.34, "rgba(255,255,255,.86)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      spriteContext.fillStyle = gradient;
      spriteContext.fillRect(0, 0, 64, 64);
      spriteTexture = new THREE.CanvasTexture(spriteCanvas);
      spriteTexture.colorSpace = THREE.SRGBColorSpace;

      material = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: spriteTexture },
          uOpacity: { value: 1 },
          uScale: { value: mount.clientHeight * 0.58 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          attribute float aSize;
          attribute vec3 color;
          varying vec3 vColor;
          uniform float uScale;
          void main() {
            vColor = color;
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uScale / -viewPosition.z;
            gl_Position = projectionMatrix * viewPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform float uOpacity;
          varying vec3 vColor;
          void main() {
            vec4 sprite = texture2D(uMap, gl_PointCoord);
            gl_FragColor = vec4(vColor * 1.42, sprite.a * uOpacity);
          }
        `,
      });

      group.add(new THREE.Points(geometry, material));
      formationStartedAt = performance.now();
      setParticlesReady(true);
      resize();
    };

    const animate = (time: number) => {
      if (disposed) return;

      if (geometry && positions && starts && targets && delays && formationStartedAt) {
        const formation = Math.min(1, (time - formationStartedAt) / FORMATION_DURATION_MS);
        const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let index = 0; index < delays.length; index += 1) {
          const offset = index * 3;
          const localProgress = Math.min(
            1,
            Math.max(0, (formation - delays[index]) / (1 - delays[index])),
          );
          const amount = easeOutCubic(localProgress);
          positions[offset] = starts[offset] + (targets[offset] - starts[offset]) * amount;
          positions[offset + 1] = starts[offset + 1] + (targets[offset + 1] - starts[offset + 1]) * amount;
          positions[offset + 2] = starts[offset + 2] + (targets[offset + 2] - starts[offset + 2]) * amount;
        }
        positionAttribute.needsUpdate = true;

        const settledTime = Math.max(0, time - formationStartedAt - FORMATION_DURATION_MS) / 1_000;
        group.rotation.y = Math.sin(settledTime * 0.45) * 0.045;
        group.rotation.x = Math.sin(settledTime * 0.3) * 0.014;
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      logo.onload = null;
      logo.onerror = null;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      geometry?.dispose();
      material?.dispose();
      spriteTexture?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      className={`${styles.overlay} ${phase === "leaving" ? styles.leaving : ""}`}
      aria-busy={!ready}
    >
      <div className={styles.collage} aria-hidden="true">
        <div className={`${styles.collageTile} ${styles.collagePrimary}`}>
          <Image
            src="/funscapes-overview.jpg"
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, 60vw"
            priority
          />
        </div>
        <div className={styles.collageTile}>
          <Image
            src="/funscapes-night.jpg"
            alt=""
            fill
            sizes="(max-width: 700px) 50vw, 40vw"
            priority
          />
        </div>
        <div className={styles.collageTile}>
          <Image
            src="/funscapes-day.jpg"
            alt=""
            fill
            sizes="(max-width: 700px) 50vw, 40vw"
            priority
          />
        </div>
      </div>

      <div
        className={`${styles.staticLogo} ${particlesReady ? styles.staticLogoHidden : ""}`}
        aria-hidden="true"
      >
        <Image
          className={styles.staticLogoImage}
          src="/funscapes-logo.png"
          alt=""
          width={720}
          height={340}
          priority
        />
      </div>
      <div ref={sceneRef} className={styles.scene} aria-hidden="true" />

      <div className={styles.ui}>
        <div
          className={`${styles.loadingDetails} ${canEnter ? styles.loadingDetailsReady : ""}`}
          aria-hidden={canEnter}
        >
          <div
            className={styles.track}
            role="progressbar"
            aria-label="Loading Funscapes"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : percent}
          >
            <span
              className={`${styles.fill} ${indeterminate ? styles.indeterminate : ""}`}
              style={indeterminate ? undefined : { width: `${percent}%` }}
            />
          </div>
          <div className={styles.row}>
            <span>{visibleLabel}</span>
            <span className={styles.percentage}>{indeterminate ? "—" : `${percent}%`}</span>
          </div>
        </div>

        {canEnter ? (
          <button className={styles.enterButton} type="button" onClick={enterPark} autoFocus>
            <span>Enter</span>
            <span className={styles.enterArrow} aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>

      <p className={styles.screenReaderStatus} role="status" aria-live="polite">
        {accessibleStatus}
      </p>
    </div>
  );
}
