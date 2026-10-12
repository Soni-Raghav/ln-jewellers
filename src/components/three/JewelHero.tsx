"use client";

/**
 * JewelHero — an immersive, fully procedural 3D hero scene for LN Jewellers.
 *
 * - A luxury gold ring assembled purely from primitives (torus band, faceted
 *   octahedron gem, prong spheres). No GLB files, no <Environment> presets,
 *   no network fetches of any kind.
 * - Warm analytic lighting (ambient + spot + point lights), drei ContactShadows
 *   and gold-tinted Sparkles for "magic dust".
 * - Slow auto-rotation, gentle <Float>, and lerped mouse parallax on the camera rig.
 *
 * Resilience contract:
 *   (a) WebGL unsupported  -> elegant pure-CSS `HeroFallback` panel.
 *   (b) prefers-reduced-motion -> static scene (no float / rotation / parallax),
 *       frameloop switched to "demand".
 *   (c) Lazy-render -> the Canvas mounts only once the host element enters the viewport.
 *   (d) Runtime errors -> inline React error boundary falls back to `HeroFallback`.
 *
 * `JewelHero` fills its parent (h-full w-full) — position/size it from the parent.
 */

import {
  Component,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float, Sparkles } from "@react-three/drei";
import { MathUtils, type Group, type Mesh, type MeshPhysicalMaterial } from "three";
import { cn } from "@/lib/utils";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#E6C87A";
const IVORY = "#FAF7F0";

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
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

/** null = still detecting (SSR / first paint), true/false = WebGL support. */
function useWebGLAvailable(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    // probe on the next frame so setState never fires synchronously in the effect
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

/* ------------------------------------------------------------------ */
/* Error boundary                                                      */
/* ------------------------------------------------------------------ */

class HeroErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state: { hasError: boolean } = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[JewelHero] 3D scene failed, showing fallback:", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* 3D scene pieces                                                     */
/* ------------------------------------------------------------------ */

/** Procedural gold ring: torus band + bezel + faceted gem + four prong spheres. */
function GoldRing({ reduced }: { reduced: boolean }) {
  const spinner = useRef<Group>(null);
  const gem = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (reduced) return;
    if (spinner.current) {
      spinner.current.rotation.y += delta * 0.28; // slow auto-rotation
    }
    if (gem.current) {
      // slow gem spin + subtle sparkle pulse
      gem.current.rotation.y = state.clock.elapsedTime * 0.55;
      const mat = gem.current.material as MeshPhysicalMaterial;
      mat.emissiveIntensity = 0.12 + Math.sin(state.clock.elapsedTime * 1.6) * 0.07;
    }
  });

  return (
    <group ref={spinner}>
      {/* tilt the whole piece for a classic three-quarter product view */}
      <group rotation={[0.95, 0, 0.12]}>
        {/* band */}
        <mesh>
          <torusGeometry args={[1.28, 0.15, 48, 160]} />
          <meshStandardMaterial color={GOLD} metalness={1} roughness={0.18} />
        </mesh>

        {/* head assembly, sitting on top of the band */}
        <group position={[0, 1.28, 0]}>
          {/* bezel / seat */}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 0.1, 32]} />
            <meshStandardMaterial color={GOLD} metalness={1} roughness={0.22} />
          </mesh>

          {/* faceted gem — champagne diamond, 20-facet brilliant cut */}
          <mesh ref={gem} position={[0, 0.34, 0]} scale={[1, 1.18, 1]}>
            <icosahedronGeometry args={[0.3, 0]} />
            <meshPhysicalMaterial
              color="#CBB384"
              metalness={0.35}
              roughness={0.22}
              clearcoat={0.45}
              clearcoatRoughness={0.3}
              reflectivity={0.35}
              emissive={"#8F6E2A"}
              emissiveIntensity={0.1}
              flatShading
            />
          </mesh>

          {/* prong spheres hugging the gem's equator */}
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.22, 0.34, Math.sin(a) * 0.22]}
              >
                <sphereGeometry args={[0.048, 16, 16]} />
                <meshStandardMaterial color={GOLD} metalness={1} roughness={0.2} />
              </mesh>
            );
          })}
        </group>
      </group>
    </group>
  );
}

/** Lerped mouse parallax rig — gently rotates/shifts the whole composition. */
function CameraRig({
  children,
  reduced,
}: {
  children: ReactNode;
  reduced: boolean;
}) {
  const ref = useRef<Group>(null);

  useFrame((state) => {
    const rig = ref.current;
    if (!rig || reduced) return;
    const px = state.pointer.x;
    const py = state.pointer.y;
    rig.rotation.y = MathUtils.lerp(rig.rotation.y, px * 0.14, 0.045);
    rig.rotation.x = MathUtils.lerp(rig.rotation.x, -py * 0.09, 0.045);
    rig.position.x = MathUtils.lerp(rig.position.x, px * 0.18, 0.045);
    rig.position.y = MathUtils.lerp(rig.position.y, py * 0.1, 0.045);
  });

  return <group ref={ref}>{children}</group>;
}

function JewelScene({ reduced }: { reduced: boolean }) {
  return (
    <>
      {/* warm analytic lighting — no env maps, no HDRIs */}
      <ambientLight intensity={0.65} color="#FFF6E8" />
      <spotLight
        position={[5, 7, 4]}
        angle={0.45}
        penumbra={1}
        intensity={190}
        color="#FFE9C0"
      />
      <pointLight position={[-5, 2, 3]} intensity={70} color={GOLD_LIGHT} />
      <pointLight position={[0, 1, 5]} intensity={55} color="#FFF2DC" />
      <pointLight position={[0, -3, -4]} intensity={34} color={GOLD} />
      {/* rim light separates the silhouette from the black backdrop */}
      <pointLight position={[0, 4, -6]} intensity={90} color="#E6C87A" />

      <CameraRig reduced={reduced}>
        {reduced ? (
          <GoldRing reduced />
        ) : (
          <Float
            speed={1.4}
            rotationIntensity={0.25}
            floatIntensity={0.7}
            floatingRange={[-0.07, 0.09]}
          >
            <GoldRing reduced={false} />
          </Float>
        )}
        {!reduced && (
          <Sparkles
            count={70}
            scale={[7, 5, 4]}
            position={[0, 0.4, 0]}
            size={2.4}
            speed={0.35}
            color={GOLD_LIGHT}
            opacity={0.55}
          />
        )}
      </CameraRig>

      <ContactShadows
        position={[0, -1.95, 0]}
        opacity={0.42}
        scale={9}
        blur={2.6}
        far={4.5}
        resolution={256}
        color="#241A04"
        frames={reduced ? 1 : Infinity}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* CSS fallback                                                        */
/* ------------------------------------------------------------------ */

/**
 * Pure-CSS luxury fallback panel: ivory/gold gradient, soft radial gold glow
 * and a large serif monogram "A". Used for no-WebGL, error boundary, and the
 * pre-mount placeholder.
 */
export function HeroFallback({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      data-jewel-fallback=""
      className={cn(
        "relative flex h-full w-full select-none items-center justify-center overflow-hidden",
        className
      )}
      style={{
        background:
          "radial-gradient(circle at 50% 42%, rgba(212,175,55,0.38) 0%, rgba(212,175,55,0.14) 34%, rgba(212,175,55,0) 64%), linear-gradient(160deg, " +
          IVORY +
          " 0%, #F3EAD6 48%, #E6C87A 100%)",
      }}
    >
      {/* thin inner frame */}
      <div
        className="pointer-events-none absolute inset-4 border border-[#D4AF37]/40 md:inset-6"
        style={{ boxShadow: "inset 0 0 60px rgba(212,175,55,0.18)" }}
      />
      <div className="relative flex flex-col items-center">
        <span
          className="font-serif leading-none text-[#8A6D1F]"
          style={{
            fontSize: "clamp(7rem, 22vw, 13rem)",
            textShadow: "0 2px 24px rgba(138,109,31,0.25)",
          }}
        >
          LN
        </span>
        <span className="mt-2 text-[10px] uppercase tracking-[0.5em] text-[#8A6D1F]/80 md:text-xs">
          LN Jewellers
        </span>
      </div>
      {/* soft vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 58%, rgba(138,109,31,0.14) 100%)",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main export                                                         */
/* ------------------------------------------------------------------ */

/**
 * The canvas scene. Fills its parent (`h-full w-full`) — the parent decides
 * size/position (e.g. `absolute inset-0`). Mounts the WebGL canvas lazily via
 * IntersectionObserver and degrades gracefully per the contract above.
 */
export function JewelHero({ className }: { className?: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const webgl = useWebGLAvailable();
  const reduced = usePrefersReducedMotion();

  // (c) lazy-render: mount the Canvas only when scrolled near/into view
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
      { rootMargin: "250px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const showCanvas = webgl === true && inView;

  return (
    <div
      ref={holder}
      data-jewel-hero=""
      className={cn("relative h-full w-full", className)}
      aria-hidden // purely decorative scene; all real content lives beside it
    >
      {showCanvas ? (
        <HeroErrorBoundary fallback={<HeroFallback />}>
          <Canvas
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [0, 0.55, 6.2], fov: 38 }}
            frameloop={reduced ? "demand" : "always"}
            style={{ background: "transparent" }}
          >
            <JewelScene reduced={reduced} />
          </Canvas>
        </HeroErrorBoundary>
      ) : webgl === false ? (
        // (a) WebGL unsupported -> static CSS panel
        <HeroFallback />
      ) : (
        // pre-detection / pre-intersection placeholder (keeps layout stable)
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0) 60%)",
          }}
        />
      )}
    </div>
  );
}

export default JewelHero;
