import Phaser from 'phaser';
import { DISTRICT, type TargetDef } from '../../sim/map/district';
import { BOOTH_OF } from '../../sim/services';
import type { Snapshot } from '../../sim/sim';
import type { ServiceKind, SimEvent } from '../../sim/types';
import { DEPTH } from './depth';
import { CALLED_TEXT, REFUSAL_TEXT, blinkOn, boothTextAlpha } from './serviceMath';
import { BOOTH_SPENT, PROP_RISE, TargetsLayer } from './targets';

const FONT = '"Press Start 2P", ui-monospace, monospace';
const KINDS: readonly ServiceKind[] = ['fire', 'police'];
const PILL_COLOR: Readonly<Record<ServiceKind, number>> = { fire: 0xd23b3b, police: 0x3b6fd2 };
const PILL_SPENT = 0x6d6a72;
const INK = 0x14121c;

/**
 * What the phone booths add on top of their TargetView (which draws the cabin, its fire, hp bar and ruin): the
 * call-count pill (grey and the cabin greyed once spent), a blinking « ! » while a call would be useful
 * (Snapshot.services.hint), and the short line under the booth on a call (« Pompiers en route ! ») or a refusal
 * (« Aucun feu à éteindre », …).
 */
class BoothView {
  private readonly pill: Phaser.GameObjects.Graphics;
  private readonly count: Phaser.GameObjects.Text;
  private readonly bang: Phaser.GameObjects.Image;
  private readonly line: Phaser.GameObjects.Text;
  private lineAt = -Infinity;
  private drawn = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly kind: ServiceKind,
    private readonly def: TargetDef,
  ) {
    const f = def.footprint;
    const top = f.y - PROP_RISE.booth;
    const cx = f.x + f.w / 2;
    const depth = DEPTH.overlay - 2;
    // pill on the cabin's upper corner, outward (red on the left of the pair, blue on the right)
    const px = kind === 'fire' ? f.x - 2 : f.x + f.w - 12;
    this.pill = scene.add
      .graphics()
      .setPosition(px, top + 2)
      .setDepth(depth);
    this.count = scene.add
      .text(px + 7, top + 8, '', { fontFamily: FONT, fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5, 0.5)
      .setDepth(depth + 0.1);
    this.bang = scene.add
      .image(cx, top - 10, 'bang')
      .setOrigin(0.5, 1)
      .setScale(2)
      .setDepth(depth)
      .setVisible(false);
    this.line = scene.add
      .text(cx, f.y + f.h + 6, '', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffffff',
        stroke: '#14121c',
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.popup - 1)
      .setVisible(false);
  }

  update(s: Snapshot, nowMs: number, ruined: boolean): void {
    const left = s.services.calls[this.kind];
    const key = left * 2 + (ruined ? 1 : 0);
    if (key !== this.drawn) {
      this.drawn = key;
      const c = left > 0 ? PILL_COLOR[this.kind] : PILL_SPENT;
      this.pill
        .clear()
        .fillStyle(INK, 1)
        .fillRect(0, 0, 14, 12)
        .fillStyle(c, 1)
        .fillRect(2, 2, 10, 8)
        .fillStyle(0xffffff, 0.35)
        .fillRect(2, 2, 10, 2);
      this.count.setText(String(left));
      this.count.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.pill.setVisible(!ruined);
    this.count.setVisible(!ruined);
    this.bang.setVisible(!ruined && s.services.hint[this.kind] && !s.ended && blinkOn(nowMs));
    const a = boothTextAlpha(nowMs - this.lineAt);
    this.line.setVisible(a > 0).setAlpha(a);
  }

  /** A call answered (`ok`) or refused: its line under the booth for BOOTH_TEXT_MS. */
  say(text: string, ok: boolean, nowMs: number): void {
    this.line.setText(text).setColor(ok ? '#a8f5b8' : '#ffd23f');
    this.line.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.lineAt = nowMs;
  }

  get target(): TargetDef {
    return this.def;
  }
}

/** Both booths' overlays; the cabin's grey once spent goes through the TargetsLayer. */
export class BoothsLayer {
  private readonly views = new Map<ServiceKind, BoothView>();
  private readonly spent: Record<ServiceKind, boolean> = { fire: false, police: false };

  constructor(
    scene: Phaser.Scene,
    private readonly targets: TargetsLayer,
  ) {
    for (const kind of KINDS) {
      const def = DISTRICT.targets.find((t) => t.id === BOOTH_OF[kind]);
      if (def) this.views.set(kind, new BoothView(scene, kind, def));
    }
  }

  update(s: Snapshot, nowMs: number): void {
    for (const kind of KINDS) {
      const v = this.views.get(kind);
      if (!v) continue;
      const t = s.targets.find((x) => x.id === v.target.id);
      v.update(s, nowMs, t?.state === 'ruined');
      const spent = s.services.calls[kind] <= 0;
      if (spent !== this.spent[kind]) {
        this.spent[kind] = spent;
        this.targets.setIntact(v.target.id, spent ? BOOTH_SPENT : TargetsLayer.boothIntact(v.target.id));
      }
    }
  }

  onEvents(events: readonly SimEvent[], nowMs: number): void {
    for (const e of events) {
      if (e.type === 'ServiceCalled') this.views.get(e.kind)?.say(CALLED_TEXT[e.kind], true, nowMs);
      else if (e.type === 'ServiceRefused') this.views.get(e.kind)?.say(REFUSAL_TEXT[e.reason], false, nowMs);
    }
  }
}
