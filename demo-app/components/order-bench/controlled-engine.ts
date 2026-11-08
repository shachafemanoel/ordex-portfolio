import { translateAlong } from '@/components/iso/iso-kit';
import { crateSvg, gateBack, gateBeam, gateFront, pinParts } from './frame';
import { BAR_OPEN, BAR_SHUT, P, STATIONS } from './view';
import type { benchState } from '@/src/journey';

type State = ReturnType<typeof benchState>;

/** Presentation only. Order changes and eligibility always come from the shared domain model. */
export class ControlledBench {
  private frame = 0;
  private observer: IntersectionObserver;
  private motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private visible = true;
  private state: State;
  private x: number;
  private bar: number;
  private parts: Record<string, SVGGElement>;
  private coins: SVGGElement[];
  private decorationKey = '';

  constructor(stage: HTMLElement, state: State) {
    this.state = state;
    this.x = STATIONS[state.station]!;
    this.bar = state.gateOpen ? BAR_OPEN : BAR_SHUT;
    const svg = stage.querySelector('svg')!;
    this.parts = Object.fromEntries(
      [
        'carriage',
        'crate-body',
        'gate-slots',
        'gate-back',
        'gate-beam',
        'gate-front',
        'pin-low',
        'pin-high',
      ].map((name) => [name, svg.querySelector<SVGGElement>(`[data-part="${name}"]`)!]),
    );
    this.coins = [...svg.querySelectorAll<SVGGElement>('[data-coin]')];
    this.observer = new IntersectionObserver((entries) => {
      this.visible = entries[entries.length - 1]!.isIntersecting;
      if (this.visible) this.run();
      else {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
    });
    this.observer.observe(stage);
    this.motion.addEventListener('change', this.run);
    this.draw();
  }

  update(state: State) {
    this.state = state;
    this.run();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.motion.removeEventListener('change', this.run);
  }

  private run = () => {
    if (!this.frame && this.visible) this.frame = requestAnimationFrame(this.tick);
  };

  private tick = () => {
    const targetX = STATIONS[this.state.station]!;
    const targetBar = this.state.gateOpen ? BAR_OPEN : BAR_SHUT;
    const ease = (value: number, target: number) =>
      this.motion.matches || Math.abs(value - target) < 0.1
        ? target
        : value + (target - value) * 0.18;
    this.x = ease(this.x, targetX);
    this.bar = ease(this.bar, targetBar);
    this.draw();
    this.frame =
      this.visible && (this.x !== targetX || this.bar !== targetBar)
        ? requestAnimationFrame(this.tick)
        : 0;
  };

  private draw() {
    const p = this.parts;
    p.carriage!.setAttribute('transform', translateAlong(P, [this.x, 0, 0]));
    p.carriage!.style.opacity = this.state.cancelled ? '0.35' : '1';
    const decorationKey = `${this.state.held}:${this.state.cancelled}`;
    if (decorationKey !== this.decorationKey) {
      this.decorationKey = decorationKey;
      p['crate-body']!.innerHTML = crateSvg('manual', !this.state.held && !this.state.cancelled);
      const pin = pinParts(this.state.held ? 0 : 1, this.state.held);
      p['pin-low']!.innerHTML = pin.low;
      p['pin-high']!.innerHTML = pin.high;
    }
    p['gate-back']!.innerHTML = gateBack(this.bar);
    p['gate-front']!.innerHTML = gateFront(this.bar);
    p['gate-beam']!.innerHTML = gateBeam(this.bar, !this.state.gateOpen);
    const gateParts = [p['gate-back']!, p['gate-beam']!, p['gate-front']!];
    const ordered = this.x > 0 ? [p.carriage!, ...gateParts] : [...gateParts, p.carriage!];
    ordered.forEach((part) => p['gate-slots']!.appendChild(part));
    this.coins.forEach((coin, i) => {
      coin.style.opacity = String(
        Math.max(0, Math.min(1, this.state.paidFraction * this.coins.length - i)),
      );
    });
  }
}
