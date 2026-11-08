import { boxCorners, fitProjection, type Plan, type Projection } from '@/components/iso/iso-kit';

// World layout of the order bench, in units of about 1 px. x runs along the rail, y across it, z up.
// The flow reads right to left: RECEIVED sits at +x, next to the store intake belt, COMPLETED at −x.

export const WIDTH = 640;
export const HEIGHT = 300;

export const PLATE: Plan = { x: -134, y: -62, w: 332, d: 124, r: 8 };
export const PLATE_H = 12;
export const FOOT_H = 5;

/** Carriage x at each status, RECEIVED first. */
export const STATIONS = [96, 60, 24, -24, -60, -96] as const;
export const GATE_X = 0;
export const BAR_SHUT = 16;
export const BAR_OPEN = 40;
export const POST_TOP = 54;
export const BACK_POST = [GATE_X, -36] as const;
export const FRONT_POST = [GATE_X, 44] as const;

export const CAR_HALF = 22;
export const CRATE_HALF = 15;
export const CRATE_TOP = 34.5;

export const COIN = { cx: -34, cy: -46, r: 6.4, h: 4, pitch: 4.8, base: 2, drop: 17.6 } as const;
export const PIN = [0, 24] as const;

/** Store intake: a belt at carriage height, and a reader arch the store order passes under. */
export const BELT = { x0: 124, x1: 188, y: 17, top: 8, drumR: 3.4 } as const;
export const ARCH_X = 152;
export const ARCH_POSTS = [
  [ARCH_X, -25],
  [ARCH_X, 25],
] as const;
export const ARCH_TOP = 46;
export const INTAKE_START = 172;

export const P: Projection = fitProjection(
  [
    ...boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [BACK_POST[0], BACK_POST[1], POST_TOP + 2],
    [FRONT_POST[0], FRONT_POST[1], POST_TOP + 2],
    [ARCH_X, -25, ARCH_TOP + 5],
    [STATIONS[5] - CRATE_HALF, -CRATE_HALF, CRATE_TOP + 12],
  ],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 62 }
);
