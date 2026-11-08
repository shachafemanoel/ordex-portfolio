import {
  cylinder,
  depthOf,
  dotsSvg,
  haloOf,
  insetPlan,
  iso,
  knurl,
  lineOnTop,
  lineSvg,
  planOutline,
  ring,
  sideSeam,
  slabOf,
  solidSvg,
  type Plan,
  type Point3,
} from '@/components/iso/iso-kit';
import { BACK_POST, COIN, CRATE_TOP, FRONT_POST, GATE_X, P, PIN, POST_TOP } from './view';

// Parts that move or change shape, as SVG strings. The server draws the rest pose with them,
// and the live component redraws them while they move.

const at = (point: Point3) => iso(point, P);
const CAR: Plan = { x: -22, y: -22, w: 44, d: 44, r: 3 };
const CRATE: Plan = { x: -15, y: -15, w: 30, d: 30, r: 1.4 };
const BUSHINGS: Array<[number, number]> = [
  [-18.5, -15],
  [18.5, -15],
  [-18.5, 15],
  [18.5, 15],
];

const bushing = ([bx, by]: [number, number]) =>
  solidSvg(slabOf({ x: bx - 2.6, y: by - 3.5, w: 5.2, d: 7, r: 1 }, 8, 2.4, P, 3, 0.4), {
    tone: 'mid',
  }) + dotsSvg([at([bx, by - 1.8, 10.4]), at([bx, by + 1.8, 10.4])], { size: 0.4 });

/** The carriage under the crate: the plate and the bushings that sit behind the crate. */
export function carriageBack(): string {
  return [
    `<path class="iso-halo" d="${haloOf(insetPlan(CAR, 3), 3, 0.1, P)}" style="filter:blur(4px)"/>`,
    solidSvg(slabOf(CAR, 3, 5, P, 5, 0.6), { tone: 'mid' }),
    lineSvg(lineOnTop([CAR.x, -14.5], [CAR.x + CAR.w, -14.5], 8, P), { tone: 'faint' }),
    lineSvg(lineOnTop([CAR.x, 14.5], [CAR.x + CAR.w, 14.5], 8, P), { tone: 'faint' }),
    ...BUSHINGS.filter(([x, y]) => depthOf([x, y, 0], P) < 0).map(bushing),
  ].join('');
}

/** Bushings and rivets in front of the crate. */
export function carriageFront(): string {
  return [
    ...BUSHINGS.filter(([x, y]) => depthOf([x, y, 0], P) >= 0).map(bushing),
    dotsSvg(
      [-18, -12, 10, 16].map((x) => at([x, 20.5, 8])),
      { size: 0.4, tone: 'lo' }
    ),
  ].join('');
}

/** The bracket that carries the hold pin, and the pointer that reads the ruler. */
export function bracket(): string {
  return [
    solidSvg(slabOf({ x: -6, y: 20, w: 12, d: 10, r: 1.2 }, 4, 4, P, 3, 0.4), { tone: 'mid' }),
    dotsSvg([at([-4, 28, 8]), at([4, 28, 8])], { size: 0.4 }),
    solidSvg(slabOf({ x: -0.7, y: 30, w: 1.4, d: 4.6, r: 0.5 }, 4, 1, P, 2), {
      tone: 'hi',
      crease: 'none',
    }),
  ].join('');
}

export type CrateKind = 'manual' | 'store';

/**
 * The order: a crate with a lid and a label. A store order's label carries a seal; a manual one
 * has three written lines. `lit` marks it as the part to watch.
 */
export function crateSvg(kind: CrateKind, lit: boolean): string {
  const band =
    lineSvg(sideSeam(CRATE, 17, P, 4), { tone: 'lo' }) +
    lineSvg(sideSeam(CRATE, 20.5, P, 4), { tone: 'lo' });
  const out = [
    solidSvg(slabOf(CRATE, 8, 23, P, 4, 0.6), { tone: 'hi', crease: 'lo', lit, inner: band }),
  ];
  for (const [gx, gy] of [
    [15, -15],
    [-15, 15],
    [15, 15],
  ] as const) {
    const x = gx > 0 ? 11.8 : -15.6;
    const y = gy > 0 ? 11.8 : -15.6;
    out.push(
      solidSvg(slabOf({ x, y, w: 3.8, d: 3.8, r: 0.8 }, 8, 4.5, P, 3, 0.3), { tone: 'mid' })
    );
  }
  out.push(
    solidSvg(slabOf(insetPlan(CRATE, -0.8), 31, 3, P, 4, 0.6), { tone: 'hi', crease: 'lo', lit })
  );
  const label: Plan = { x: -9, y: -5, w: 18, d: 11, r: 0.8 };
  out.push(solidSvg(slabOf(label, CRATE_TOP - 0.5, 0.5, P, 3), { tone: 'lo', crease: 'none' }));
  out.push(lineSvg(planOutline(insetPlan(label, 1.4), CRATE_TOP, P, 3), { tone: 'faint' }));
  if (kind === 'manual') {
    for (const [y, w] of [
      [-2, 12],
      [0.6, 9],
      [3.2, 6],
    ] as const) {
      out.push(lineSvg(lineOnTop([-6, y], [-6 + w, y], CRATE_TOP, P), { tone: 'lo', free: true }));
    }
  } else {
    for (const [y, w] of [
      [-2, 7],
      [0.6, 5],
    ] as const) {
      out.push(lineSvg(lineOnTop([-6, y], [-6 + w, y], CRATE_TOP, P), { tone: 'lo', free: true }));
    }
    out.push(
      lineSvg(ring(4.2, 0.4, 2.6, CRATE_TOP, P, 20) + ring(4.2, 0.4, 1.4, CRATE_TOP, P, 16), {
        tone: 'mid',
      })
    );
    out.push(dotsSvg([at([4.2, 0.4, CRATE_TOP])], { size: 0.45, tone: 'mid' }));
  }
  return out.join('');
}

/** The store-review flag on the lid's back corner, drawn at full height. */
export function flagSvg(): string {
  const pole: [number, number] = [11, -11];
  const top = CRATE_TOP + 13;
  return [
    solidSvg(cylinder(pole[0], pole[1], 1.4, CRATE_TOP, 1, P, 14), { tone: 'mid' }),
    solidSvg(cylinder(pole[0], pole[1], 0.55, CRATE_TOP + 1, top - CRATE_TOP - 1, P, 10), {
      tone: 'mid',
      crease: 'none',
    }),
    solidSvg(
      slabOf({ x: pole[0] - 8.6, y: pole[1] - 0.4, w: 8, d: 0.8, r: 0.2 }, top - 6, 6, P, 2),
      {
        tone: 'hi',
        crease: 'none',
        className: 'ob-warn',
      }
    ),
  ].join('');
}

/** The hold pin: `lift` 1 is up (free), 0 is down in the detent (held). */
export function pinParts(lift: number, held: boolean) {
  const [x, y] = PIN;
  const knobZ = 10 + 4 * lift;
  const tipZ = knobZ - 7.5;
  const low =
    tipZ < 3.9
      ? solidSvg(cylinder(x, y, 1.2, tipZ, 4.4 - tipZ, P, 16), { tone: 'mid', crease: 'none' })
      : '';
  const high = [
    solidSvg(cylinder(x, y, 1.2, 8, knobZ - 8, P, 16), { tone: 'mid', crease: 'none' }),
    solidSvg(cylinder(x, y, 2.9, knobZ, 3.2, P, 28, 0.3), { tone: 'hi', crease: 'lo', lit: held }),
    lineSvg(knurl(x, y, 2.9, knobZ, knobZ + 3.2, 22, P), { tone: 'lo' }),
  ].join('');
  return { low, high };
}

function postWithSleeve([px, py]: readonly [number, number], barZ: number) {
  const sleeve: Plan = { x: px - 5, y: py - 5, w: 10, d: 10, r: 1.6 };
  const z0 = barZ - 2;
  const z1 = barZ + 7;
  return [
    solidSvg(cylinder(px, py, 5.2, 0, 3, P, 28, 0.4), { tone: 'lo' }),
    lineSvg(ring(px, py, 4, 3, P, 24), { tone: 'faint' }),
    solidSvg(cylinder(px, py, 3, 3, z0 - 3, P, 24), { tone: 'mid', crease: 'none' }),
    solidSvg(slabOf(sleeve, z0, z1 - z0, P, 3, 0.5), {
      tone: 'mid',
      inner: lineSvg(sideSeam(sleeve, z0 + 4.5, P, 3), { tone: 'faint' }),
    }),
    solidSvg(cylinder(px, py, 3, z1, POST_TOP - z1, P, 24), { tone: 'mid', crease: 'none' }),
    solidSvg(cylinder(px, py, 3.8, POST_TOP, 2, P, 24, 0.3), { tone: 'mid' }),
    dotsSvg([at([px, py, POST_TOP + 2])], { size: 0.5, tone: 'mid' }),
  ].join('');
}

export const gateBack = (barZ: number) => postWithSleeve(BACK_POST, barZ);
export const gateFront = (barZ: number) => postWithSleeve(FRONT_POST, barZ);

/** The gate bar. While it blocks, it takes the warning accent. */
export function gateBeam(barZ: number, blocking: boolean): string {
  const beam: Plan = {
    x: GATE_X - 3,
    y: BACK_POST[1] + 5,
    w: 6,
    d: FRONT_POST[1] - BACK_POST[1] - 10,
    r: 0.8,
  };
  const top = barZ + 5;
  return [
    solidSvg(slabOf(beam, barZ, 5, P, 3, 0.5), {
      tone: 'hi',
      crease: 'lo',
      className: blocking ? 'ob-warn' : undefined,
      inner: lineSvg(sideSeam(beam, barZ + 2.5, P, 3), { tone: 'faint' }),
    }),
    lineSvg(lineOnTop([GATE_X, beam.y], [GATE_X, beam.y + beam.d], top, P), { tone: 'faint' }),
    dotsSvg(
      [beam.y + 3, beam.y + beam.d - 3].map((y) => at([GATE_X, y, top])),
      { size: 0.45 }
    ),
  ].join('');
}

export function coinSvg(index: number): string {
  const z = COIN.base + index * COIN.pitch;
  return (
    solidSvg(cylinder(COIN.cx, COIN.cy, COIN.r, z, COIN.h, P, 40, 0.4), {
      tone: 'hi',
      crease: 'lo',
    }) +
    lineSvg(knurl(COIN.cx, COIN.cy, COIN.r, z + 0.5, z + COIN.h - 0.5, 40, P, 0.2), {
      tone: 'lo',
    }) +
    lineSvg(ring(COIN.cx, COIN.cy, COIN.r - 1.4, z + COIN.h, P, 32), { tone: 'lo' })
  );
}
