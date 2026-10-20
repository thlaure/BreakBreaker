import type { Sim, Snapshot } from '../../sim/sim';
import type { SimEvent } from '../../sim/types';
import { GameAudio } from '../audio';
import { loadPrefs, loadRecord, saveRecord, savePrefs, type Prefs } from '../storage';
import { formatSummary } from './format';
import { Hud, type CameraView } from './hud';
import { Menus } from './menus';
import './hud.css';

/** What the UI needs from the scene (kept narrow so the scene stays free of UI logic). */
export interface UiHost {
  sim: Sim;
  events: { on(e: string, fn: (...a: never[]) => void): unknown; off(e: string, fn: (...a: never[]) => void): unknown };
  releaseInputs(): void;
  cameraView(): CameraView;
  restart(): void;
}

type Phase = 'start' | 'playing' | 'paused' | 'ending' | 'ended';

const KO_SUMMARY_DELAY_MS = 700;

let sharedAudio: GameAudio | null = null;
function audioFor(prefs: Prefs): GameAudio {
  sharedAudio ??= new GameAudio(prefs.muted);
  return sharedAudio;
}

/**
 * Game flow glue: start screen, pause menu, summary, HUD and audio around a WorldScene.
 * Any open overlay keeps the Sim paused and releases the game inputs.
 */
export class GameUi {
  private phase: Phase = 'start';
  private readonly prefs = loadPrefs();
  private readonly audio = audioFor(this.prefs);
  private readonly hud: Hud;
  private readonly menus: Menus;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastNow = 0;

  private readonly onHud = (s: Snapshot): void => this.frame(s);
  private readonly onEvents = (ev: SimEvent[]): void => this.audio.onEvents(ev, this.lastNow);
  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.audio.suspend();
  };

  constructor(private readonly host: UiHost, autostart: boolean) {
    this.hud = new Hud(document.body, document.getElementById('touch-ui'));
    this.menus = new Menus(
      document.body,
      {
        start: () => this.start(),
        resume: () => this.resume(),
        toggleSound: () => this.toggleSound(),
        stopGame: () => this.stopGame(),
        leave: () => location.assign('/'),
        replay: () => this.host.restart(),
        click: () => this.audio.play('ui_click'),
      },
      this.prefs.muted,
    );
    this.host.events.on('hud', this.onHud as never);
    this.host.events.on('sim-events', this.onEvents as never);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (autostart) {
      this.phase = 'playing';
      this.hud.show(true);
      this.audio.resume();
    } else {
      this.host.sim.pause();
      this.host.releaseInputs();
      this.menus.showStart();
    }
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.host.events.off('hud', this.onHud as never);
    this.host.events.off('sim-events', this.onEvents as never);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.setThreat(0);
    this.hud.destroy();
    this.menus.destroy();
  }

  /** Esc key / touch Pause button. */
  togglePause(): void {
    if (this.phase === 'playing') this.openPause();
    else if (this.phase === 'paused') this.menus.escape();
  }

  /** Also called when the window loses focus or the page is hidden. Never resumes by itself. */
  openPause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.host.sim.pause();
    this.host.releaseInputs();
    this.menus.showPause();
  }

  private start(): void {
    // Commencer is the user gesture that unlocks audio.
    void this.audio.unlock();
    this.phase = 'playing';
    this.menus.close();
    this.hud.show(true);
    this.host.sim.resume();
  }

  private resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.menus.close();
    this.audio.resume();
    this.host.sim.resume();
  }

  private toggleSound(): boolean {
    this.prefs.muted = !this.prefs.muted;
    savePrefs(this.prefs);
    this.audio.setMuted(this.prefs.muted);
    return this.prefs.muted;
  }

  private stopGame(): void {
    this.host.sim.quit();
    this.showSummary();
  }

  private frame(s: Snapshot): void {
    this.lastNow = s.now;
    this.hud.update(s, this.host.cameraView());
    const threatened = s.school.stage === 'firstLine' || s.school.stage === 'reinforcements' || s.school.stage === 'cinematic';
    this.audio.setThreat(threatened && !s.ended ? 0.35 + 0.65 * (1 - s.school.integrity / 100) : 0);
    if (s.ended && this.phase === 'playing') {
      this.phase = 'ending';
      this.host.releaseInputs();
      this.timer = setTimeout(() => this.showSummary(), s.endCause === 'ko' ? KO_SUMMARY_DELAY_MS : 0);
    }
  }

  private showSummary(): void {
    this.timer = null;
    this.phase = 'ended';
    this.host.sim.pause();
    this.host.releaseInputs();
    const s = this.host.sim.snapshot();
    const cause = s.endCause ?? 'quit';
    const record = loadRecord(cause);
    saveRecord(s.score, cause);
    this.audio.setThreat(0);
    this.menus.showSummary(formatSummary(s, record));
  }
}
