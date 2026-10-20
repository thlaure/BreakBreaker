// Sim step cost in Node: 40 hostiles (30 % throwers, 10 % firebombers) + 24 rocks in flight, 10 simulated minutes.
// Usage: npm run bench   (loads TS sources through Vite's SSR loader)
import { createServer } from 'vite';

const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { Sim } = await server.ssrLoadModule('/src/sim/sim.ts');
  const { topUp } = await server.ssrLoadModule('/src/sim/stress.ts');
  const MIN = Number(process.env.BENCH_MINUTES ?? 10);
  const STEPS = MIN * 60 * 60;
  const sim = new Sim(12345, { invulnerable: true });
  const st = { n: 0 };
  const idle = { move: { x: 0, y: 0 }, aim: null, run: false, strike: false, throwRock: false, act: false };
  const times = new Float64Array(STEPS);
  let maxHostiles = 0;
  let maxFly = 0;
  let maxGround = 0;
  for (let i = 0; i < STEPS; i++) {
    // Paul wanders in a slow loop and swings every 1.5 s (strikes rarely connect, so the crowd stays at 40).
    const a = (i / 60) * 0.5;
    const input = { ...idle, move: { x: Math.cos(a), y: Math.sin(a) }, strike: i % 90 === 0, throwRock: i % 120 === 0, act: false };
    topUp(sim, 40, st);
    const t0 = performance.now();
    sim.step(input);
    times[i] = performance.now() - t0;
    if (i % 60 === 0) {
      maxHostiles = Math.max(maxHostiles, sim.horde.active().length);
      maxFly = Math.max(maxFly, sim.rocks.flying().length);
      maxGround = Math.max(maxGround, sim.rocks.ground().length);
    }
  }
  const stats = (arr) => {
    const s = Float64Array.from(arr).sort();
    const mean = s.reduce((x, y) => x + y, 0) / s.length;
    return { mean, p50: s[Math.floor(s.length * 0.5)], p95: s[Math.floor(s.length * 0.95)], p99: s[Math.floor(s.length * 0.99)], max: s[s.length - 1] };
  };
  const frames = [];
  for (let i = 0; i + 60 <= STEPS; i += 60) {
    let sum = 0;
    for (let j = 0; j < 60; j++) sum += times[i + j];
    frames.push(sum);
  }
  const f = (n) => n.toFixed(4);
  const row = (name, s) => console.log(`${name.padEnd(18)} mean ${f(s.mean)}  p50 ${f(s.p50)}  p95 ${f(s.p95)}  p99 ${f(s.p99)}  max ${f(s.max)}  (ms)`);
  console.log(`Simulated ${MIN} min = ${STEPS} steps; peak active hostiles ${maxHostiles}, flying rocks ${maxFly}, ground rocks ${maxGround}; KOs ${sim.rules.kos}, ended=${sim.rules.ended}`);
  row('per step', stats(times));
  row('per 60-step frame', stats(frames));
} finally {
  await server.close();
}
