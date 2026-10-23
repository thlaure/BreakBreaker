import { onLocaleChange, t } from '../../content/i18n';
import type { Sim, Snapshot } from '../../sim/sim';
import type { SimEvent } from '../../sim/types';
import { GameAudio, threatLevel } from '../audio';
import { SITE_BASE } from '../assets';
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

type Phase = 'start' | 'intro' | 'playing' | 'paused' | 'ending' | 'ended';

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

  private readonly onHud = (s: Snapshot): void => this.frame(s);
  private readonly onEvents = (ev: SimEvent[]): void => {
    this.audio.onEvents(ev);
    this.hud.onEvents(ev);
  };
  /** The page title follows the language (the HUD and the menus re-render themselves). */
  private readonly offLocale = onLocaleChange(() => this.retitle());
  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.audio.suspend();
  };

  constructor(
    private readonly host: UiHost,
    autostart: boolean,
  ) {
    this.hud = new Hud(document.body, document.getElementById('touch-ui'), { onControls: () => this.openControls() });
    this.menus = new Menus(
      document.body,
      {
        start: () => this.start(),
        resume: () => this.resume(),
        toggleSound: () => this.toggleSound(),
        stopGame: () => this.stopGame(),
        leave: () => location.assign(SITE_BASE),
        replay: () => this.host.restart(),
        click: () => this.audio.play('ui_click'),
      },
      this.prefs.muted,
    );
    this.audio.reset();
    this.retitle();
    this.host.events.on('hud', this.onHud as never);
    this.host.events.on('sim-events', this.onEvents as never);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (autostart) {
      // No start screen on this page, but the instructions card blocks the game until a key or tap.
      this.phase = 'intro';
      this.hud.show(true);
      this.host.sim.pause();
      this.host.releaseInputs();
      // No Commencer click on this page: the key or tap that dismisses the card unlocks audio (endIntro).
      this.hud.showIntro(document.getElementById('touch-ui')?.classList.contains('visible') ?? false, () => this.endIntro());
    } else {
      this.host.sim.pause();
      this.host.releaseInputs();
      this.menus.showStart();
    }
  }

  private retitle(): void {
    document.title = t('hud.pageTitle');
  }

  destroy(): void {
    this.offLocale();
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
    this.audio.suspend();
    this.menus.showPause();
  }

  /** HUD "Commandes" button: keys and rules in a modal; the game is paused until it is closed. */
  openControls(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.hud.hideIntro();
    this.host.sim.pause();
    this.host.releaseInputs();
    this.audio.suspend();
    this.menus.showControls();
  }

  /** The key or tap that dismissed the instructions card: the game starts now. */
  private endIntro(): void {
    if (this.phase !== 'intro') return;
    this.phase = 'playing';
    void this.audio.unlock();
    this.audio.resume();
    this.host.releaseInputs();
    this.host.sim.resume();
  }

  private start(): void {
    // Commencer is the user gesture that unlocks audio.
    void this.audio.unlock();
    this.audio.resume();
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
    this.hud.update(s, this.host.cameraView());
    this.audio.setThreat(threatLevel(s));
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
    this.audio.suspend();
    const s = this.host.sim.snapshot();
    const cause = s.endCause ?? 'quit';
    const record = loadRecord(cause);
    saveRecord(s.score, cause);
    this.audio.setThreat(0);
    this.menus.showSummary(() => formatSummary(s, record));
  }
}
