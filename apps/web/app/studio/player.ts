import { BASE_RATE, advance, isPastDecision } from "./sim-clock";

type Listener = () => void;

/**
 * Playback state for the Studio. Time lives here, not in React state, so a
 * 60 fps clock only re-renders the few components that subscribe to it.
 */
export class Player {
  journeyEnd: number;
  total: number;
  speed = 1;
  /** True once playback has been through the decision point. */
  decided = false;
  private onDecision: (() => void) | null = null;
  setOnDecision(fn: (() => void) | null) {
    this.onDecision = fn;
  }
  private time = 0;
  private isPlaying = false;
  private raf = 0;
  private last = 0;
  private timeListeners = new Set<Listener>();
  private playListeners = new Set<Listener>();

  constructor(journeyEnd: number, total: number) {
    this.journeyEnd = journeyEnd;
    this.total = total;
  }

  subscribeTime = (l: Listener) => {
    this.timeListeners.add(l);
    return () => {
      this.timeListeners.delete(l);
    };
  };
  subscribePlaying = (l: Listener) => {
    this.playListeners.add(l);
    return () => {
      this.playListeners.delete(l);
    };
  };
  getT = () => this.time;
  getPlaying = () => this.isPlaying;

  private emitTime() {
    this.timeListeners.forEach((l) => l());
  }
  private setPlaying(v: boolean) {
    if (this.isPlaying === v) return;
    this.isPlaying = v;
    this.playListeners.forEach((l) => l());
  }

  /** The axis grows or shrinks when delays change or compare mode toggles. */
  setAxis(journeyEnd: number, total: number) {
    if (journeyEnd === this.journeyEnd && total === this.total) return;
    this.journeyEnd = journeyEnd;
    this.total = total;
    if (this.time > total) this.time = total;
    this.emitTime();
  }

  seek(t: number) {
    this.time = Math.min(this.total, Math.max(0, t));
    this.decided = isPastDecision(this.time, this.journeyEnd);
    this.emitTime();
  }

  play() {
    if (this.time >= this.total) this.seek(0);
    this.setPlaying(true);
    this.last = 0;
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  pause() {
    this.setPlaying(false);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  toggle() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.playListeners.forEach((l) => l());
  }

  /** Continue past the decision point (the person has chosen how to proceed). */
  continueFromDecision() {
    this.decided = true;
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (!this.isPlaying) return;
    // A hidden tab or a long stall must not make the truck jump.
    const dt = this.last ? Math.min(100, now - this.last) : 16;
    this.last = now;
    const step = advance(this.time, (dt / 1000) * BASE_RATE * this.speed, {
      journeyEnd: this.journeyEnd,
      total: this.total,
      decided: this.decided,
    });
    this.time = step.t;
    if (step.decisionHit || step.finished) {
      this.setPlaying(false);
      this.emitTime();
      if (step.decisionHit) this.onDecision?.();
      return;
    }
    this.emitTime();
    this.raf = requestAnimationFrame(this.frame);
  };

  dispose() {
    this.pause();
    this.timeListeners.clear();
    this.playListeners.clear();
    this.onDecision = null;
  }
}
