"use client";
/**
 * Shared React Three Fiber parts: a studio environment for reflections (three's RoomEnvironment, so no HDRI
 * download), studio lights, and the glossy pieces. Used by the offline render lab and the live hero scene.
 */
import { useThree, type ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { pieceGeometry, pieceMaterial, type PieceType } from "./pieces";

export type Theme = "light" | "dark";

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

/**
 * Reflections from a softbox-lit room, prefiltered once per renderer. Materials get the texture directly
 * (material.envMap), because three ignores a material's envMapIntensity when it only reads scene.environment.
 */
export function useStudioEnv(): THREE.Texture {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    let env = envCache.get(gl);
    if (!env) {
      const pmrem = new THREE.PMREMGenerator(gl);
      env = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
      pmrem.dispose();
      envCache.set(gl, env);
    }
    return env;
  }, [gl]);
}

/** Puts the studio environment on the scene (for materials without their own envMap). */
export function StudioEnvironment({ intensity = 1 }: { intensity?: number }) {
  const scene = useThree((s) => s.scene);
  const env = useStudioEnv();
  useEffect(() => {
    scene.environment = env;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
    };
  }, [scene, env, intensity]);
  return null;
}

/** Key light from the upper left, a cool rim from behind, a soft fill. */
export function StudioLights({
  theme = "light",
  shadows = false,
  keyPosition = [-5, 5.2, 2.2],
}: {
  theme?: Theme;
  shadows?: boolean;
  keyPosition?: [number, number, number];
}) {
  return (
    <>
      <ambientLight intensity={theme === "light" ? 0.06 : 0.05} />
      <directionalLight
        position={keyPosition}
        intensity={theme === "light" ? 2.3 : 2.1}
        castShadow={shadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-radius={9}
        shadow-blurSamples={16}
        shadow-bias={-0.0008}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <directionalLight position={[3, 3, -4.5]} intensity={theme === "light" ? 1.1 : 1.8} />
      <directionalLight position={[4, 1.5, 3]} intensity={theme === "light" ? 0.14 : 0.14} />
    </>
  );
}

type PieceProps = ThreeElements["group"] & {
  type: PieceType | "token";
  color: "w" | "b";
  theme?: Theme;
  opacity?: number;
  castShadow?: boolean;
  /** Scales the material's reflections (e.g. darker lacquer for out-of-focus pieces). */
  envScale?: number;
};

/** A glossy piece: porcelain for White, black lacquer for Black, a gray pebble for the silhouette token. */
export function Piece({ type, color, theme = "light", opacity = 1, castShadow = false, envScale = 1, ...group }: PieceProps) {
  const parts = useMemo(() => pieceGeometry(type), [type]);
  const env = useStudioEnv();
  const material = useMemo(() => {
    const m = pieceMaterial(type === "token" ? "token" : color === "w" ? "porcelain" : "lacquer", theme);
    m.envMap = env;
    m.envMapIntensity *= envScale;
    return m;
  }, [type, color, theme, env, envScale]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.transparent = opacity < 1;
    material.opacity = opacity;
    material.depthWrite = opacity > 0.5;
    material.needsUpdate = true;
  }, [material, opacity]);
  return (
    <group {...group}>
      {parts.map((g, i) => (
        <mesh key={i} geometry={g} material={material} castShadow={castShadow} />
      ))}
    </group>
  );
}
