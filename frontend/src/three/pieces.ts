/**
 * Procedural chess pieces, modelled for this project (no downloaded models). Turned pieces are lathe profiles
 * with filleted corners; the knight is a horse-head silhouette, extruded with a bevel and then sculpted
 * (thinner at the muzzle and ears, fuller at the neck) on a turned base.
 *
 * Units: base radius ≈ 0.5, king ≈ 1.8 tall. Pure three.js, so the render script and the live hero share it.
 */
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

type Node = [number, number, number?]; // r, y, fillet radius

/** Rounds every corner of a polyline with a quadratic fillet. */
function fillet(nodes: Node[], segments = 6): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const [x, y, r = 0] = nodes[i]!;
    const b = new THREE.Vector2(x, y);
    if (i === 0 || i === nodes.length - 1 || r <= 0) {
      out.push(b);
      continue;
    }
    const a = new THREE.Vector2(nodes[i - 1]![0], nodes[i - 1]![1]);
    const c = new THREE.Vector2(nodes[i + 1]![0], nodes[i + 1]![1]);
    const ba = a.clone().sub(b);
    const bc = c.clone().sub(b);
    const t = Math.min(r, ba.length() * 0.48, bc.length() * 0.48);
    const p1 = b.clone().add(ba.normalize().multiplyScalar(t));
    const p2 = b.clone().add(bc.normalize().multiplyScalar(t));
    for (let s = 0; s <= segments; s++) {
      const u = s / segments;
      // Quadratic Bezier p1 → b → p2.
      out.push(
        new THREE.Vector2(
          (1 - u) * (1 - u) * p1.x + 2 * (1 - u) * u * b.x + u * u * p2.x,
          (1 - u) * (1 - u) * p1.y + 2 * (1 - u) * u * b.y + u * u * p2.y,
        ),
      );
    }
  }
  return out;
}

/** Points on a circle arc (center cy on the axis), from angle a0 to a1 in degrees. */
function arc(cy: number, radius: number, a0: number, a1: number, steps = 18): Node[] {
  const pts: Node[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([Math.max(0, radius * Math.cos(a)), cy + radius * Math.sin(a)]);
  }
  return pts;
}

/** Smooth curve through a few points (Catmull-Rom), returned as nodes without fillets. */
function curve(points: Array<[number, number]>, steps = 24): Node[] {
  const c = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return c.getPoints(steps).map((p) => [p.x, p.y] as Node);
}

function lathe(nodes: Node[], segments = 96): THREE.BufferGeometry {
  const pts = fillet(nodes).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}

/** The turned base all pieces share: a wide foot with a bevel, a bead and a cove. */
function base(r = 0.5): Node[] {
  return [
    [0, 0],
    [r - 0.02, 0, 0.02],
    [r, 0.055, 0.03],
    [r - 0.06, 0.1, 0.02],
    [r - 0.05, 0.13, 0.025],
    [r - 0.12, 0.175, 0.04],
  ];
}

function pawn(): THREE.BufferGeometry {
  return lathe([
    ...base(0.47),
    [0.29, 0.25, 0.12],
    [0.2, 0.4, 0.2],
    [0.155, 0.55, 0.06],
    [0.27, 0.575, 0.03],
    [0.285, 0.615, 0.03],
    [0.15, 0.645, 0.03],
    [0.12, 0.665],
    ...arc(0.81, 0.175, -56, 90, 22),
  ]);
}

function rookBody(): THREE.BufferGeometry {
  return lathe([
    ...base(0.5),
    [0.34, 0.24, 0.1],
    [0.29, 0.38, 0.3],
    [0.285, 0.7, 0.05],
    [0.345, 0.73, 0.02],
    [0.35, 0.77, 0.02],
    [0.315, 0.8, 0.03],
    [0.36, 0.86, 0.04],
    [0.385, 0.99, 0.015],
    [0.27, 0.99, 0.015],
    [0.26, 0.95, 0.02],
    [0, 0.95],
  ]);
}

/** Battlements: five merlons around the rook's rim, each a beveled annular sector. */
function rookMerlons(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = 5;
  const span = (Math.PI * 2) / n;
  const gap = span * 0.34;
  for (let i = 0; i < n; i++) {
    const a0 = i * span + gap / 2;
    const a1 = (i + 1) * span - gap / 2;
    const s = new THREE.Shape();
    const ro = 0.37;
    const ri = 0.275;
    s.absarc(0, 0, ro, a0, a1, false);
    s.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri);
    s.absarc(0, 0, ri, a1, a0, true);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 16 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.975, 0);
    parts.push(g);
  }
  return mergeGeometries(parts)!;
}

function bishop(): THREE.BufferGeometry[] {
  const body = lathe([
    ...base(0.5),
    [0.32, 0.27, 0.12],
    [0.2, 0.46, 0.25],
    [0.15, 0.7, 0.05],
    [0.27, 0.72, 0.02],
    [0.28, 0.76, 0.02],
    [0.17, 0.785, 0.02],
    [0.235, 0.81, 0.02],
    [0.24, 0.84, 0.02],
    [0.14, 0.87, 0.02],
    ...curve([
      [0.14, 0.87],
      [0.22, 0.94],
      [0.245, 1.04],
      [0.215, 1.15],
      [0.14, 1.24],
      [0.05, 1.3],
    ]),
    [0.035, 1.305],
    ...arc(1.36, 0.06, -60, 90, 12),
  ]);
  return [body];
}

function queen(): THREE.BufferGeometry[] {
  const body = lathe([
    ...base(0.52),
    [0.34, 0.27, 0.12],
    [0.22, 0.5, 0.3],
    [0.16, 0.8, 0.06],
    [0.29, 0.83, 0.02],
    [0.3, 0.87, 0.02],
    [0.18, 0.9, 0.02],
    [0.255, 0.925, 0.02],
    [0.26, 0.955, 0.02],
    [0.16, 0.985, 0.03],
    ...curve([
      [0.16, 0.985],
      [0.17, 1.08],
      [0.22, 1.24],
      [0.31, 1.37],
    ]),
    [0.325, 1.4, 0.02],
    [0.25, 1.42, 0.02],
    ...curve([
      [0.25, 1.42],
      [0.17, 1.47],
      [0.08, 1.5],
      [0, 1.51],
    ]),
  ]);
  const balls: THREE.BufferGeometry[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = new THREE.SphereGeometry(0.045, 20, 14);
    g.translate(Math.cos(a) * 0.285, 1.43, Math.sin(a) * 0.285);
    balls.push(g);
  }
  const top = new THREE.SphereGeometry(0.075, 28, 20);
  top.translate(0, 1.58, 0);
  return [body, mergeGeometries(balls)!, top];
}

function king(): THREE.BufferGeometry[] {
  const body = lathe([
    ...base(0.53),
    [0.35, 0.27, 0.12],
    [0.23, 0.52, 0.3],
    [0.17, 0.86, 0.06],
    [0.3, 0.89, 0.02],
    [0.31, 0.93, 0.02],
    [0.19, 0.96, 0.02],
    [0.265, 0.985, 0.02],
    [0.27, 1.015, 0.02],
    [0.17, 1.045, 0.03],
    ...curve([
      [0.17, 1.045],
      [0.18, 1.14],
      [0.23, 1.3],
      [0.31, 1.42],
    ]),
    [0.32, 1.45, 0.02],
    [0.24, 1.47, 0.02],
    ...curve([
      [0.24, 1.47],
      [0.16, 1.52],
      [0.08, 1.545],
      [0, 1.55],
    ]),
  ]);
  const neck = lathe([
    [0, 1.53],
    [0.07, 1.53, 0.02],
    [0.05, 1.6],
    [0, 1.6],
  ]);
  const vertical = new RoundedBoxGeometry(0.075, 0.27, 0.075, 3, 0.022);
  vertical.translate(0, 1.71, 0);
  const horizontal = new RoundedBoxGeometry(0.2, 0.07, 0.075, 3, 0.022);
  horizontal.translate(0, 1.745, 0);
  return [body, neck, vertical, horizontal];
}

/** Horse head silhouette, facing left, before extrusion (x right, y up, base at y = 0). */
const KNIGHT_PROFILE: Array<[number, number]> = [
  [0.34, 0.0],
  [0.41, 0.2],
  [0.435, 0.42],
  [0.4, 0.61],
  [0.33, 0.77],
  [0.27, 0.88],
  [0.235, 0.99],
  [0.175, 1.13],
  [0.115, 1.01],
  [0.07, 0.965],
  [-0.05, 0.955],
  [-0.2, 0.885],
  [-0.34, 0.76],
  [-0.45, 0.6],
  [-0.495, 0.5],
  [-0.475, 0.445],
  [-0.405, 0.435],
  [-0.43, 0.405],
  [-0.33, 0.39],
  [-0.17, 0.44],
  [-0.1, 0.35],
  [-0.17, 0.21],
  [-0.27, 0.08],
  [-0.31, 0.0],
];

function knight(): THREE.BufferGeometry[] {
  const pedestal = lathe([
    ...base(0.5),
    [0.36, 0.22, 0.04],
    [0.34, 0.27, 0.02],
    [0, 0.27],
  ]);

  const shape = new THREE.Shape();
  const pts = new THREE.SplineCurve(KNIGHT_PROFILE.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(140);
  shape.setFromPoints(pts);
  const depth = 0.3;
  const head = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.065,
    bevelSegments: 10,
    curveSegments: 64,
    steps: 1,
  });
  head.translate(0, 0, -depth / 2);
  // Sculpt: thinner muzzle and ears, a fuller neck.
  const pos = head.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let k = 1;
    k *= 1 - 0.34 * THREE.MathUtils.smoothstep(-x, 0.12, 0.5); // muzzle
    k *= 1 - 0.5 * THREE.MathUtils.smoothstep(y, 0.92, 1.12); // ears
    k *= 1 + 0.12 * THREE.MathUtils.smoothstep(x, 0.15, 0.4) * (1 - THREE.MathUtils.smoothstep(y, 0.6, 0.95)); // jowl
    k *= 1 + 0.2 * (1 - THREE.MathUtils.smoothstep(y, 0.0, 0.35)); // neck meets the base
    pos.setZ(i, pos.getZ(i) * k);
  }
  head.deleteAttribute("normal");
  const merged = mergeVertices(head, 1e-4);
  merged.computeVertexNormals();
  merged.translate(0, 0.25, 0);
  // Three-quarter view: the face turns toward the viewer's left.
  merged.rotateY(-0.16);
  return [pedestal, merged];
}

/** Silhouette-mode token: a glossy pebble that says "something is here" and nothing else. */
function token(): THREE.BufferGeometry {
  return lathe([
    [0, 0],
    [0.44, 0, 0.03],
    [0.53, 0.1, 0.1],
    [0.5, 0.26, 0.12],
    [0.3, 0.4, 0.15],
    [0, 0.44],
  ]);
}

const cache = new Map<string, THREE.BufferGeometry[]>();

/** Geometry parts for a piece (cached). */
export function pieceGeometry(type: PieceType | "token"): THREE.BufferGeometry[] {
  const hit = cache.get(type);
  if (hit) return hit;
  let parts: THREE.BufferGeometry[];
  switch (type) {
    case "p":
      parts = [pawn()];
      break;
    case "r":
      parts = [rookBody(), rookMerlons()];
      break;
    case "b":
      parts = bishop();
      break;
    case "q":
      parts = queen();
      break;
    case "k":
      parts = king();
      break;
    case "n":
      parts = knight();
      break;
    default:
      parts = [token()];
  }
  cache.set(type, parts);
  return parts;
}

/** Height of each piece, for framing. */
export const PIECE_HEIGHT: Record<PieceType | "token", number> = { p: 0.99, r: 1.08, b: 1.42, q: 1.66, k: 1.85, n: 1.33, token: 0.44 };

/* ------------------------------------------------------------------------------------------ */
/* Materials                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export type Finish = "porcelain" | "lacquer" | "token";

export function pieceMaterial(finish: Finish, theme: "light" | "dark" = "light"): THREE.MeshPhysicalMaterial {
  if (finish === "porcelain") {
    return new THREE.MeshPhysicalMaterial({
      color: theme === "light" ? 0xf4f3ef : 0xe8e7e3,
      roughness: 0.36,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: theme === "light" ? 0.3 : 0.32,
    });
  }
  if (finish === "lacquer") {
    return new THREE.MeshPhysicalMaterial({
      color: theme === "light" ? 0x0c0c0c : 0x141414,
      roughness: 0.2,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      envMapIntensity: theme === "light" ? 1.25 : 1.35,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color: theme === "light" ? 0x5e5e5e : 0x5a5a5a,
    roughness: 0.2,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.1,
  });
}
