import {
  SHADES,
  cameraOf,
  convexHull,
  corners,
  cylinder,
  depthOf,
  dotsSvg,
  faceTextSvg,
  haloOf,
  insetPlan,
  iso,
  lineOnTop,
  lineSvg,
  pathOf,
  planOutline,
  ring,
  sideSeam,
  slabOf,
  solidSvg,
  topMatrix,
  type Flat,
  type Plan,
  type Point3,
  type SolidPaths,
} from '@/components/iso/iso-kit';
import {
  ARCH_POSTS,
  ARCH_TOP,
  ARCH_X,
  BELT,
  COIN,
  FOOT_H,
  P,
  PLATE,
  PLATE_H,
  STATIONS,
} from './view';

// Static parts of the order bench, built once as SVG strings on the server.

const at = (point: Point3) => iso(point, P);
const byDepth = (points: Array<[number, number]>) =>
  [...points].sort((a, b) => depthOf([a[0], a[1], 0], P) - depthOf([b[0], b[1], 0], P));

/**
 * A prism whose cross-section lies in the x–z plane and runs along y from y0 to y1
 * (a belt drum seen from the side). The kit's own solids only extrude straight up.
 */
export function prismAlongY(section: Array<[number, number]>, y0: number, y1: number): SolidPaths {
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  const view: Point3 = [cosA * cosE, sinA * cosE, sinE];
  const light = [-sinA, cosA, 0.9];
  const lightLength = Math.hypot(light[0]!, light[1]!, light[2]!);
  const area = section.reduce((sum, [x, z], index) => {
    const [nx, nz] = section[(index + 1) % section.length]!;
    return sum + x * nz - nx * z;
  }, 0);
  const ringXZ = area > 0 ? section : [...section].reverse();
  const count = ringXZ.length;
  const low = ringXZ.map(([x, z]) => at([x, y0, z]));
  const high = ringXZ.map(([x, z]) => at([x, y1, z]));
  const shades: string[][] = Array.from({ length: SHADES }, () => []);
  const tops: string[] = [];
  const creases: string[] = [];
  const visible: boolean[] = [];
  const bucket = (normal: Point3) => {
    const lit =
      ((normal[0] * light[0]! + normal[1] * light[1]! + normal[2] * light[2]!) / lightLength + 1) /
      2;
    return Math.min(SHADES - 1, Math.max(0, Math.floor(lit * SHADES)));
  };
  for (let index = 0; index < count; index++) {
    const [ax, az] = ringXZ[index]!;
    const [bx, bz] = ringXZ[(index + 1) % count]!;
    const length = Math.hypot(bx - ax, bz - az) || 1;
    const normal: Point3 = [(bz - az) / length, 0, -(bx - ax) / length];
    const seen = normal[0] * view[0] + normal[2] * view[2] > 1e-9;
    visible.push(seen);
    if (!seen) continue;
    const face = pathOf(
      [low[index]!, low[(index + 1) % count]!, high[(index + 1) % count]!, high[index]!],
      true
    );
    if (normal[2] > 0.7) tops.push(face);
    else shades[bucket(normal)]!.push(face);
  }
  const capSeen = view[1] > 1e-9;
  if (capSeen) shades[bucket([0, 1, 0])]!.push(pathOf(high, true));
  for (let index = 0; index < count; index++) {
    const before = visible[(index + count - 1) % count];
    if (before && visible[index]) creases.push(pathOf([low[index]!, high[index]!]));
  }
  const hull = convexHull([...low, ...high] as Flat[]);
  return {
    fill: pathOf(hull, true),
    outline: pathOf(hull, true),
    crease: creases.join(''),
    top: tops.join(''),
    shades: shades.map((paths) => paths.join('')),
  };
}

export function baseArt(): string {
  const out = [`<path class="iso-halo" d="${haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(corners(PLATE, 22))) {
    out.push(solidSvg(cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: 'lo' }));
    out.push(
      solidSvg(cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: 'mid' })
    );
  }
  out.push(
    solidSvg(slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), {
      tone: 'mid',
      inner: lineSvg(sideSeam(PLATE, -5, P, 8), { tone: 'faint' }),
    })
  );
  out.push(lineSvg(planOutline(insetPlan(PLATE, 5), 0, P), { tone: 'lo' }));
  const screws = corners(PLATE, 10);
  out.push(lineSvg(screws.map(([x, y]) => ring(x, y, 2.2, 0, P, 16)).join(''), { tone: 'lo' }));
  out.push(
    dotsSvg(
      screws.map(([x, y]) => at([x, y, 0])),
      { size: 0.5 }
    )
  );
  // the label plate carries the one engraved word
  const label: Plan = { x: -126, y: -56, w: 46, d: 17, r: 1.2 };
  out.push(solidSvg(slabOf(label, 0, 0.8, P, 4), { tone: 'lo', crease: 'none' }));
  out.push(lineSvg(planOutline(insetPlan(label, 1.6), 0.8, P, 4), { tone: 'faint' }));
  out.push(
    faceTextSvg(topMatrix([label.x + label.w / 2, label.y + 7.6], 0.8, P, 'x'), 'RETZEF', {
      size: 4.2,
      tone: 'mid',
      anchor: 'middle',
    })
  );
  for (const [y, w] of [
    [label.y + 10.6, 30],
    [label.y + 13, 20],
  ] as const) {
    const x0 = label.x + (label.w - w) / 2;
    out.push(lineSvg(lineOnTop([x0, y], [x0 + w, y], 0.8, P), { tone: 'lo', free: true }));
  }
  out.push(
    dotsSvg([at([label.x + 4, label.y + 4, 0.8]), at([label.x + 4, label.y + label.d - 4, 0.8])], {
      size: 0.45,
    })
  );
  return out.join('');
}

export function coinColumnBack(): string {
  const { cx, cy } = COIN;
  const out = [solidSvg(cylinder(cx, cy, 10.5, 0, 2, P, 44, 0.4), { tone: 'mid' })];
  const back: Plan = { x: cx - 9.5, y: cy - 11.5, w: 19, d: 3, r: 0.8 };
  const levels: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const z = COIN.base + i * COIN.pitch;
    levels.push(lineSvg(sideSeam(back, z, P, 3), { tone: i === 4 ? 'hi' : 'lo' }));
  }
  out.push(solidSvg(slabOf(back, 2, 22, P, 3, 0.4), { tone: 'mid', inner: levels.join('') }));
  return out.join('');
}

export function coinColumnFront(): string {
  const { cx, cy } = COIN;
  const out: string[] = [];
  for (const ux of [cx - 8.4, cx + 8.4])
    out.push(solidSvg(cylinder(ux, cy + 6, 1.2, 2, 22, P, 14), { tone: 'mid', crease: 'none' }));
  const cap: Plan = { x: cx - 10.5, y: cy - 12, w: 21, d: 20, r: 2 };
  out.push(solidSvg(slabOf(cap, 24, 3, P, 4, 0.5), { tone: 'mid' }));
  out.push(
    lineSvg(planOutline({ x: cx - 7, y: cy - 1.2, w: 14, d: 2.4, r: 1.2 }, 27, P, 3), {
      tone: 'lo',
    })
  );
  out.push(
    dotsSvg([at([cap.x + 2.5, cap.y + 2.5, 27]), at([cap.x + cap.w - 2.5, cap.y + 2.5, 27])], {
      size: 0.4,
    })
  );
  return out.join('');
}

export function trackArt(): string {
  const out: string[] = [];
  // index stops behind the rail, one per status
  for (const x of STATIONS) {
    out.push(
      solidSvg(slabOf({ x: x - 3.5, y: -30, w: 7, d: 5, r: 1 }, 0, 4, P, 3, 0.4), { tone: 'mid' })
    );
    out.push(dotsSvg([at([x, -27.5, 4])], { size: 0.45 }));
  }
  for (const y of [-17, 12]) {
    out.push(
      solidSvg(slabOf({ x: -122, y, w: 241, d: 5, r: 1 }, 0, 3, P, 3, 0.4), { tone: 'mid' })
    );
    out.push(
      dotsSvg(
        [-114, -40, 40, 112].map((x) => at([x, y + 2.5, 3])),
        { size: 0.4 }
      )
    );
  }
  for (const x of [-127, 119]) {
    out.push(
      solidSvg(slabOf({ x, y: -21, w: 4.5, d: 42, r: 1.2 }, 0, 7, P, 3, 0.5), { tone: 'mid' })
    );
    out.push(dotsSvg([at([x + 2.25, -17, 7]), at([x + 2.25, 17, 7])], { size: 0.45 }));
  }
  // detent bar: one hole per status; the hold pin drops into the hole under the carriage
  out.push(
    solidSvg(slabOf({ x: -120, y: 21, w: 240, d: 6, r: 1 }, 0, 2.5, P, 3, 0.3), { tone: 'mid' })
  );
  out.push(lineSvg(STATIONS.map((x) => ring(x, 24, 1.7, 2.5, P, 18)).join(''), { tone: 'lo' }));
  out.push(
    dotsSvg(
      STATIONS.map((x) => at([x, 24, 2.5])),
      { size: 0.35, tone: 'lo' }
    )
  );
  // ruler strip with a major tick at each status
  const strip: Plan = { x: -120, y: 30, w: 240, d: 7, r: 1 };
  out.push(solidSvg(slabOf(strip, 0, 0.6, P, 3), { tone: 'lo', crease: 'none' }));
  const minor: string[] = [];
  const major: string[] = [];
  for (let x = -114; x <= 114; x += 6) {
    const isStation = (STATIONS as readonly number[]).includes(x);
    (isStation ? major : minor).push(lineOnTop([x, 30], [x, 30 + (isStation ? 4.4 : 2)], 0.6, P));
  }
  out.push(lineSvg(minor.join(''), { tone: 'lo' }), lineSvg(major.join(''), { tone: 'mid' }));
  out.push(
    dotsSvg(
      [at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])],
      { size: 0.45 }
    )
  );
  return out.join('');
}

const drum = (cx: number) => {
  const section: Array<[number, number]> = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    return [
      cx + Math.cos(angle) * BELT.drumR,
      BELT.top - BELT.drumR + Math.sin(angle) * BELT.drumR,
    ];
  });
  return solidSvg(prismAlongY(section, -BELT.y, BELT.y), { tone: 'mid', crease: 'none' });
};

/** The intake belt: legs, side frames, drums and the belt itself, at carriage height. */
export function beltArt(): string {
  const { x0, x1, y, top, drumR } = BELT;
  const out: string[] = [];
  for (const [lx, ly] of byDepth([
    [x0 + 6, -y - 2],
    [x1 - 6, -y - 2],
    [x0 + 6, y + 2],
    [x1 - 6, y + 2],
  ])) {
    out.push(
      solidSvg(slabOf({ x: lx - 1.6, y: ly - 1.6, w: 3.2, d: 3.2, r: 0.6 }, 0, 3.2, P, 2), {
        tone: 'lo',
      })
    );
  }
  const frame = (fy: number) => ({ x: x0, y: fy, w: x1 - x0, d: 3, r: 0.8 });
  out.push(solidSvg(slabOf(frame(-y - 3), 3.2, 6.8, P, 3, 0.4), { tone: 'mid' }));
  out.push(drum(x0 + drumR + 0.4), drum(x1 - drumR - 0.4));
  const belt: Plan = { x: x0 + drumR + 0.4, y: -y, w: x1 - x0 - 2 * drumR - 0.8, d: 2 * y, r: 0 };
  out.push(solidSvg(slabOf(belt, top - 1.2, 1.2, P, 2), { tone: 'lo', crease: 'faint' }));
  const seams: string[] = [];
  for (let sx = belt.x + 6; sx < belt.x + belt.w - 2; sx += 8)
    seams.push(lineOnTop([sx, -y], [sx, y], top, P));
  out.push(lineSvg(seams.join(''), { tone: 'faint' }));
  out.push(solidSvg(slabOf(frame(y), 3.2, 6.8, P, 3, 0.4), { tone: 'mid' }));
  out.push(
    dotsSvg(
      [x0 + drumR + 0.4, x1 - drumR - 0.4].map((dx) => at([dx, y + 3, top - drumR])),
      { size: 0.55 }
    )
  );
  return out.join('');
}

/** One post of the reader arch, with its collar. */
export function archPost(index: 0 | 1): string {
  const [px, py] = ARCH_POSTS[index];
  return [
    solidSvg(cylinder(px, py, 4.4, 0, 2.6, P, 24, 0.3), { tone: 'lo' }),
    solidSvg(cylinder(px, py, 2.4, 2.6, ARCH_TOP - 2.6, P, 20), { tone: 'mid', crease: 'none' }),
  ].join('');
}

/** The arch's cross beam and the reader head under it; the lamp on top lights while a store order is checked. */
export function archBeam(): string {
  const beam: Plan = { x: ARCH_X - 3, y: -28, w: 6, d: 56, r: 1 };
  const head: Plan = { x: ARCH_X - 4.5, y: -9, w: 9, d: 18, r: 1.2 };
  return [
    solidSvg(slabOf(head, ARCH_TOP - 5, 5, P, 3, 0.4), {
      tone: 'mid',
      inner: lineSvg(sideSeam(head, ARCH_TOP - 2.5, P, 3), { tone: 'faint' }),
    }),
    solidSvg(slabOf(beam, ARCH_TOP, 4, P, 3, 0.5), { tone: 'mid' }),
    dotsSvg(
      [at([ARCH_X, beam.y + 3, ARCH_TOP + 4]), at([ARCH_X, beam.y + beam.d - 3, ARCH_TOP + 4])],
      { size: 0.45 }
    ),
    `<g data-part="lamp" class="ob-lamp">${solidSvg(cylinder(ARCH_X, 0, 1.8, ARCH_TOP + 4, 1.4, P, 18, 0.2), { tone: 'hi' })}</g>`,
  ].join('');
}
