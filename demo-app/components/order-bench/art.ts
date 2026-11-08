import { figureSvg, translateAlong } from '@/components/iso/iso-kit';
import {
  bracket,
  carriageBack,
  carriageFront,
  coinSvg,
  crateSvg,
  flagSvg,
  gateBack,
  gateBeam,
  gateFront,
  pinParts,
} from './frame';
import {
  archBeam,
  archPost,
  baseArt,
  beltArt,
  coinColumnBack,
  coinColumnFront,
  trackArt,
} from './geometry';
const COINS = 4;
import { BAR_SHUT, HEIGHT, INTAKE_START, P, STATIONS, WIDTH } from './view';

/**
 * The bench at rest; the controlled renderer applies the selected order state. Painter's order is fixed
 * except inside the two slot groups, whose children the live component reorders as things pass.
 */
export function benchSvg(): string {
  const pin = pinParts(1, false);
  const carriage = [
    `<g data-part="carriage" transform="${translateAlong(P, [STATIONS[0], 0, 0])}">`,
    carriageBack(),
    `<g data-part="crate"><g data-part="crate-body">${crateSvg('manual', true)}</g>`,
    `<g data-part="flag" style="opacity:0">${flagSvg()}</g></g>`,
    carriageFront(),
    `<g data-part="pin-low">${pin.low}</g>${bracket()}<g data-part="pin-high">${pin.high}</g>`,
    '</g>',
  ].join('');
  const coins = Array.from(
    { length: COINS },
    (_, i) => `<g data-coin="${i}" style="opacity:${0}">${coinSvg(i)}</g>`
  ).join('');
  const loose = `<g data-part="loose" style="opacity:0" transform="${translateAlong(P, [INTAKE_START, 0, 0])}">${crateSvg('store', true)}</g>`;
  return figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      'מסוע הזמנות: ארגז, שהוא ההזמנה, נוסע על עגלה לאורך מסילה בין שש תחנות, מימין לשמאל: התקבל, בטיפול, מוכן, בדרך, בהתקנה והושלם. בין התחנה מוכן ליציאה מחסום נפתח רק כשעמודת המטבעות, התשלומים, מלאה ונקבע מועד אספקה. פין נעילה על העגלה משהה את ההזמנה.',
    body: [
      baseArt(),
      coinColumnBack(),
      `<g data-part="coins">${coins}</g>`,
      coinColumnFront(),
      trackArt(),
      `<g data-part="gate-slots">${carriage}<g data-part="gate-back">${gateBack(BAR_SHUT)}</g><g data-part="gate-beam">${gateBeam(BAR_SHUT, false)}</g><g data-part="gate-front">${gateFront(BAR_SHUT)}</g></g>`,
      `<g data-part="intake-slots">${beltArt()}<g data-part="arch-back">${archPost(0)}</g>${loose}<g data-part="arch-beam">${archBeam()}</g><g data-part="arch-front">${archPost(1)}</g></g>`,
    ],
  });
}
