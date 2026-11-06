"use client";

/**
 * ProductStage — interactive "View in 3D" viewer for individual products.
 *
 * A fully procedural jewellery stage: geometry is generated from primitives per
 * product category (rings, earrings, necklaces, bangles/bracelets) — no GLB
 * files, no network fetches. Metal + gem colours are derived from the product's
 * own `material` string so every piece gets a bespoke tint.
 *
 * Interaction: OrbitControls — drag to rotate, scroll/pinch to zoom, slow
 * auto-rotation (disabled under prefers-reduced-motion).
 *
 * Resilience contract (mirrors JewelHero):
 *   (a) WebGL unsupported  -> static fallback panel with the product photo
 *   (b) prefers-reduced-motion -> no auto-rotate/float, frameloop "demand"
 *       (dragging still renders via OrbitControls invalidate-on-change)
 *   (c) Runtime errors     -> error boundary shows the same photo fallback
 *   (d) Lazy mount         -> Canvas mounts only when the host is in view
 */

import { Component, Suspense, createElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, OrbitControls, Sparkles, useGLTF } from "@react-three/drei";
import { Box3, DoubleSide, Vector3, type Group, type Mesh, type MeshPhysicalMaterial, type MeshStandardMaterial } from "three";
import { cn } from "@/lib/utils";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#E6C87A";

/* ------------------------------------------------------------------ */
/* Colour derivation from the product's material string                */
/* ------------------------------------------------------------------ */

function metalTone(material: string): { color: string; light: string } {
  const m = (material || "").toLowerCase();
  if (m.includes("rose")) return { color: "#B76E79", light: "#DCA68F" };
  if (m.includes("white") || m.includes("silver") || m.includes("platinum"))
    return { color: "#C9C9CF", light: "#E9E9F0" };
  return { color: GOLD, light: GOLD_LIGHT };
}

function gemTone(material: string): { color: string; emissive: string; pale?: boolean } {
  const m = (material || "").toLowerCase();
  if (m.includes("ruby")) return { color: "#9E1524", emissive: "#5C0A14" };
  if (m.includes("emerald")) return { color: "#0E7C55", emissive: "#064632" };
  if (m.includes("sapphire")) return { color: "#1E3A8A", emissive: "#101F52" };
  if (m.includes("pearl")) return { color: "#EFE7D2", emissive: "#B9AD8F", pale: true };
  if (m.includes("diamond") || m.includes("cz")) return { color: "#D9CBA8", emissive: "#8F7A46", pale: true };
  return { color: "#CBB384", emissive: "#8F6E2A" };
}

/* ------------------------------------------------------------------ */
/* Shared hooks + error boundary                                       */
/* ------------------------------------------------------------------ */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useWebGLAvailable(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const probe = document.createElement("canvas");
        const gl =
          probe.getContext("webgl2") ||
          probe.getContext("webgl") ||
          probe.getContext("experimental-webgl");
        setSupported(!!gl);
      } catch {
        setSupported(false);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  return supported;
}

class StageErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state: { hasError: boolean } = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[ProductStage] 3D scene failed, showing photo fallback:", error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

function GoldMaterial({ tone }: { tone: { color: string } }) {
  return <meshStandardMaterial color={tone.color} metalness={1} roughness={0.2} />;
}

function GemMaterial({ tone }: { tone: { color: string; emissive: string; pale?: boolean } }) {
  return (
    <meshPhysicalMaterial
      color={tone.color}
      metalness={tone.pale ? 0.2 : 0.35}
      roughness={tone.pale ? 0.22 : 0.2}
      clearcoat={tone.pale ? 0.65 : 0.5}
      clearcoatRoughness={0.18}
      reflectivity={tone.pale ? 0.5 : 0.4}
      emissive={tone.emissive}
      emissiveIntensity={tone.pale ? 0.08 : 0.14}
      flatShading
    />
  );
}

/* ------------------------------------------------------------------ */
/* Procedural pieces                                                   */
/* ------------------------------------------------------------------ */

/** Faceted gem with slow spin + emissive pulse. Reused by several models. */
function Gem({
  position,
  scale = 1,
  tone,
  spin = true,
}: {
  position: [number, number, number];
  scale?: number;
  tone: { color: string; emissive: string; pale?: boolean };
  spin?: boolean;
}) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current || !spin) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.5;
    const mat = ref.current.material as MeshPhysicalMaterial;
    mat.emissiveIntensity = 0.12 + Math.sin(state.clock.elapsedTime * 1.7) * 0.06;
  });
  return (
    <mesh ref={ref} position={position} scale={[scale, scale * 1.2, scale]}>
      <icosahedronGeometry args={[0.3, 0]} />
      <GemMaterial tone={tone} />
    </mesh>
  );
}

/** Classic solitaire: band + head (bezel, gem, prongs) + band accents. */
function RingPiece({ metal, gem }: { metal: { color: string }; gem: { color: string; emissive: string } }) {
  return (
    <group rotation={[0.95, 0, 0.12]}>
      <mesh>
        <torusGeometry args={[1.28, 0.15, 48, 160]} />
        <GoldMaterial tone={metal} />
      </mesh>
      {/* engraved band accents */}
      {[0.45, -0.45].map((a) => (
        <mesh key={a} rotation={[0, 0, a]}>
          <torusGeometry args={[1.28, 0.165, 24, 120, 0.16]} />
          <GoldMaterial tone={metal} />
        </mesh>
      ))}
      <group position={[0, 1.28, 0]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.16, 0.2, 0.1, 32]} />
          <GoldMaterial tone={metal} />
        </mesh>
        <Gem position={[0, 0.34, 0]} scale={0.85} tone={gem} />
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.2, 0.32, Math.sin(a) * 0.2]}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <GoldMaterial tone={metal} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** Jhumka pair: stud + link + flared bell with beaded rim + dangling drops. */
function EarringPiece({ metal, gem }: { metal: { color: string }; gem: { color: string; emissive: string } }) {
  const bell = (x: number, mirror: number) => (
    <group key={x} position={[x, 0.2, 0]} rotation={[0, 0, mirror * -0.08]}>
      {/* stud */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.17, 24, 24]} />
        <GoldMaterial tone={metal} />
      </mesh>
      <Gem position={[0, 1.78, 0]} scale={0.45} tone={gem} spin={false} />
      {/* short chain between stud and link */}
      <mesh position={[0, 1.29, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.42, 12]} />
        <GoldMaterial tone={metal} />
      </mesh>
      {/* connector link — stud hangs from it, bell apex meets it at y=1.05 */}
      <mesh position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.035, 16, 40]} />
        <GoldMaterial tone={metal} />
      </mesh>
      {/* flared bell — apex touches the link, base flares down */}
      <mesh position={[0, 0.55, 0]}>
        <coneGeometry args={[0.8, 1.0, 40, 1, true]} />
        <meshStandardMaterial color={metal.color} metalness={1} roughness={0.22} side={DoubleSide} />
      </mesh>
      {/* rim + beads at the bell mouth */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.06, 20, 64]} />
        <GoldMaterial tone={metal} />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.8, -0.19, Math.sin(a) * 0.8]}>
            <sphereGeometry args={[0.075, 14, 14]} />
            <GoldMaterial tone={metal} />
          </mesh>
        );
      })}
      {/* centre drop */}
      <Gem position={[0, -0.45, 0]} scale={0.5} tone={gem} />
    </group>
  );
  return (
    <group position={[0, 0.35, 0]} rotation={[0.08, 0, 0]}>
      {bell(-1.05, -1)}
      {bell(1.05, 1)}
    </group>
  );
}

/** Pendant necklace: tilted chain loop + bail + faceted drop stone. */
function NecklacePiece({ metal, gem }: { metal: { color: string }; gem: { color: string; emissive: string } }) {
  const chain = useRef<Group>(null);
  useFrame((state) => {
    if (!chain.current) return;
    chain.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.6) * 0.03;
  });
  return (
    <group rotation={[0.55, 0, 0]} position={[0, -0.15, 0]}>
      {/* chain loop */}
      <mesh ref={chain}>
        <torusGeometry args={[1.75, 0.045, 20, 180]} />
        <GoldMaterial tone={metal} />
      </mesh>
      {/* bail + pendant hanging at the front of the loop */}
      <group position={[0, -1.75, 0.02]}>
        <mesh rotation={[Math.PI / 2.2, 0, 0]}>
          <torusGeometry args={[0.14, 0.035, 14, 32]} />
          <GoldMaterial tone={metal} />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.1, 0.16, 0.14, 24]} />
          <GoldMaterial tone={metal} />
        </mesh>
        <Gem position={[0, -0.62, 0]} scale={1.35} tone={gem} />
      </group>
    </group>
  );
}

/** Bangle trio: three stacked bands with filigree overlays. */
function BanglePiece({ metal, gem }: { metal: { color: string }; gem: { color: string; emissive: string } }) {
  const bangles = [
    { y: 0.62, tilt: 0.1 },
    { y: 0, tilt: -0.05 },
    { y: -0.62, tilt: 0.08 },
  ];
  return (
    <group rotation={[0.5, 0, 0.12]}>
      {bangles.map((b, i) => (
        <group key={i} position={[0, b.y, 0]} rotation={[b.tilt, 0, 0]}>
          <mesh>
            <torusGeometry args={[1.3, 0.11, 32, 140]} />
            <GoldMaterial tone={metal} />
          </mesh>
          {/* filigree overlay — a thin raised ribbon weaving around the band */}
          <mesh rotation={[0, 0, i % 2 === 0 ? 0.6 : -0.6]}>
            <torusGeometry args={[1.3, 0.135, 18, 140, Math.PI * 0.7]} />
            <GoldMaterial tone={metal} />
          </mesh>
          {i === 1 && (
            <>
              <Gem position={[0, 1.3, 0]} scale={0.6} tone={gem} />
              <Gem position={[0, -1.3, 0]} scale={0.6} tone={gem} spin={false} />
            </>
          )}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Real GLB model — the actual product piece                           */
/* ------------------------------------------------------------------ */

/**
 * GltfPiece — loads the product's bespoke GLB (built by scripts/build-models.mjs
 * or supplied by the atelier later), normalizes it into the stage's frame and
 * tunes the baked PBR materials for the studio environment.
 */
function GltfPiece({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const normalized = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as MeshStandardMaterial;
          if (std && "envMapIntensity" in std) {
            std.envMapIntensity = 1.35;
            std.needsUpdate = true;
          }
        }
      }
    });
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 2.8 / maxDim;
    clone.scale.setScalar(s);
    clone.position.set(-center.x * s, -center.y * s, -center.z * s);
    return clone;
  }, [scene]);
  return <primitive object={normalized} />;
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function pickModel(categorySlug: string) {
  switch (categorySlug) {
    case "rings":
      return RingPiece;
    case "earrings":
      return EarringPiece;
    case "necklaces":
      return NecklacePiece;
    case "bracelets-bangles":
    case "bracelets":
      return BanglePiece;
    default:
      return RingPiece;
  }
}

/** Per-category camera distance, orbit target height and shadow-floor height. */
function framingFor(categorySlug: string): { z: number; ty: number; sy: number } {
  switch (categorySlug) {
    case "earrings":
      return { z: 8.2, ty: 1.05, sy: 1.6 };
    case "necklaces":
      return { z: 7.2, ty: -0.45, sy: 3.0 };
    case "bracelets-bangles":
    case "bracelets":
      return { z: 6.8, ty: 0, sy: 2.5 };
    default:
      return { z: 6.4, ty: 0, sy: 2.2 };
  }
}

function Scene({
  categorySlug,
  material,
  modelUrl,
  reduced,
  spin,
}: {
  categorySlug: string;
  material: string;
  modelUrl?: string;
  reduced: boolean;
  spin: boolean;
}) {
  const metal = metalTone(material);
  const gem = gemTone(material);
  const proceduralPiece = createElement(pickModel(categorySlug) as unknown as (p: { metal: typeof metal; gem: typeof gem }) => ReactNode, { metal, gem });
  const piece = modelUrl ? (
    <StageErrorBoundary fallback={proceduralPiece}>
      <Suspense fallback={null}>
        <GltfPiece url={modelUrl} />
      </Suspense>
    </StageErrorBoundary>
  ) : (
    proceduralPiece
  );
  const framing = framingFor(categorySlug);
  const spinner = useRef<Group>(null);

  useFrame((_, delta) => {
    if (reduced || !spinner.current) return;
    spinner.current.rotation.y += delta * 0.22;
  });

  return (
    <>
      <ambientLight intensity={0.65} color="#FFF6E8" />
      <spotLight position={[5, 7, 4]} angle={0.45} penumbra={1} intensity={170} color="#FFE9C0" />
      <pointLight position={[-5, 2, 3]} intensity={60} color={metal.light} />
      <pointLight position={[0, 1, 5]} intensity={50} color="#FFF2DC" />
      <pointLight position={[0, 4, -6]} intensity={85} color={GOLD_LIGHT} />

      {/* Generated studio environment — crisp PBR reflections with zero network fetches. */}
      <Environment resolution={64} frames={1} background={false}>
        <color attach="background" args={["#1A1204"]} />
        <Lightformer intensity={4} position={[0, 5, 2]} rotation={[Math.PI / 2, 0, 0]} scale={[9, 9, 1]} color="#FFF6E4" />
        <Lightformer intensity={2.4} position={[-5, 1.5, 2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3.5, 1]} color="#FFE9C0" />
        <Lightformer intensity={2.4} position={[5, 1.5, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 3.5, 1]} color="#F3D896" />
        <Lightformer intensity={1.6} position={[0, 1, -6]} scale={[8, 4, 1]} color={GOLD_LIGHT} />
        <Lightformer form="ring" intensity={2.2} position={[2.5, 3, 4]} scale={2.5} color="#FFFFFF" />
      </Environment>

      <group ref={spinner}>
        {reduced ? (
          piece
        ) : (
          <Floatish speed={1.3} rotationIntensity={0.2} floatIntensity={0.5}>
            {piece}
          </Floatish>
        )}
      </group>

      {!reduced && (
        <Sparkles count={40} scale={[6, 4.5, 4]} position={[0, 0.3, 0]} size={2.2} speed={0.3} color={GOLD_LIGHT} opacity={0.5} />
      )}

      <ContactShadows
        position={[0, -framing.sy, 0]}
        opacity={0.4}
        scale={9}
        blur={2.6}
        far={4.5}
        resolution={256}
        color="#241A04"
        frames={reduced ? 1 : Infinity}
      />

      <OrbitControls
        makeDefault
        target={[0, framing.ty, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.4}
        maxDistance={11.5}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.85}
        autoRotate={!reduced}
        autoRotateSpeed={spin && !reduced ? 6.5 : 1.1}
      />
    </>
  );
}

/** Small Float wrapper kept separate so Scene stays declarative. */
function Floatish({
  children,
  speed,
  rotationIntensity,
  floatIntensity,
}: {
  children: ReactNode;
  speed: number;
  rotationIntensity: number;
  floatIntensity: number;
}) {
  return (
    <Float speed={speed} rotationIntensity={rotationIntensity} floatIntensity={floatIntensity} floatingRange={[-0.06, 0.08]}>
      {children}
    </Float>
  );
}

/**
 * CaptureBridge — registers a snapshot function on the host's ref so the
 * product page can export the current orbit pose as a PNG. Renders a fresh
 * frame before reading the buffer so it works even in "demand" frameloop.
 */
function CaptureBridge({ captureRef }: { captureRef: React.RefObject<(() => string) | null> }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    captureRef.current = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    };
    return () => {
      captureRef.current = null;
    };
  }, [gl, scene, camera, captureRef]);
  return null;
}

/* ------------------------------------------------------------------ */
/* Fallback panel                                                      */
/* ------------------------------------------------------------------ */

export function StageFallback({ image, name }: { image?: string; name: string }) {
  return (
    <div
      aria-hidden
      className="relative grid h-full w-full place-items-center overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 40%, rgba(212,175,55,0.28) 0%, rgba(212,175,55,0.08) 42%, rgba(212,175,55,0) 68%), linear-gradient(165deg, #FFFFFF 0%, #F7F0DC 60%, #EAD9A8 100%)",
      }}
    >
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover opacity-90" />
      ) : (
        <span className="font-serif text-6xl text-[#8A6D1F]/50">{name.charAt(0)}</span>
      )}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 60%, rgba(138,109,31,0.12) 100%)" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main export                                                         */
/* ------------------------------------------------------------------ */

export function ProductStage({
  categorySlug,
  material,
  modelUrl,
  image,
  name,
  captureRef,
  spin = false,
  className,
}: {
  categorySlug: string;
  material: string;
  /** URL of the product's bespoke GLB — falls back to the procedural stage when absent. */
  modelUrl?: string;
  image?: string;
  name: string;
  /** When provided, the parent can call `.current()` to snapshot the canvas as a PNG data URL. */
  captureRef?: React.RefObject<(() => string) | null>;
  /** 360° showcase mode — the turntable spins briskly for a full view of the piece. */
  spin?: boolean;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const webgl = useWebGLAvailable();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const showCanvas = webgl === true && inView;
  const fallback = <StageFallback image={image} name={name} />;

  return (
    <div ref={holder} data-product-stage="" className={cn("relative h-full w-full", className)}>
      {showCanvas ? (
        <StageErrorBoundary fallback={fallback}>
          <Canvas
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
            camera={{ position: [0, 0.7, framingFor(categorySlug).z], fov: 36 }}
            frameloop={reduced ? "demand" : "always"}
            style={{ background: "transparent", touchAction: "none" }}
          >
            <Scene categorySlug={categorySlug} material={material} modelUrl={modelUrl} reduced={reduced} spin={spin} />
            {captureRef && <CaptureBridge captureRef={captureRef} />}
          </Canvas>
        </StageErrorBoundary>
      ) : webgl === false ? (
        fallback
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0) 60%)",
          }}
        />
      )}
      {/* gold vignette frame */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 64px rgba(212,175,55,0.14)" }} />
    </div>
  );
}

export default ProductStage;
