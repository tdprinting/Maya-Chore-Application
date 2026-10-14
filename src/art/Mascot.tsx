import { motion, type Transition } from 'framer-motion';

export type MascotMood = 'happy' | 'wow' | 'wink' | 'wave' | 'cheer' | 'sleepy' | 'love';

const C = {
  fur: '#8e93b0', furD: '#767b9c', light: '#e8eaf3', pink: '#ff6fae', pinkL: '#ffb3d9',
  ink: '#2b2d42', yellow: '#ffd84d', sky: '#6ec6f0', navy: '#2f4a8a',
};

/** Pivot helper: framer-motion passes string origins straight through, so with fill-box they're relative to the shape. */
const pv = (x: string, y: string) => ({ transformBox: 'fill-box' as const, originX: x, originY: y });
const loop = (duration: number, t: Transition = {}): Transition => ({ duration, repeat: Infinity, ease: 'easeInOut', ...t });
const star = (cx: number, cy: number, R: number, r = R * 0.48) =>
  'M' + Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2, d = i % 2 ? r : R;
    return `${(cx + d * Math.cos(a)).toFixed(1)} ${(cy + d * Math.sin(a)).toFixed(1)}`;
  }).join(' L') + 'Z';
const HEART = 'M0 6 C-8 0 -9 -6 -5 -8 C-3 -9 -1 -8 0 -6 C1 -8 3 -9 5 -8 C9 -6 8 0 0 6 Z';

type EyeKind = 'dot' | 'big' | 'arc' | 'sleep';
type MouthKind = 'w' | 'o' | 'open';
interface MoodCfg { eyes: [EyeKind, EyeKind]; mouth: MouthKind; bob: number[]; bobT: Transition; arms: number[]; armT: Transition; tilt: number[] }

const calm = { bob: [0, -4, 0], bobT: loop(2.2), arms: [8, 12, 8], armT: loop(2.2), tilt: [-3, 3, -3] };
const MOODS: Record<MascotMood, MoodCfg> = {
  happy: { ...calm, eyes: ['dot', 'dot'], mouth: 'w' },
  wink: { ...calm, eyes: ['dot', 'arc'], mouth: 'open' },
  wave: { ...calm, eyes: ['dot', 'dot'], mouth: 'open' },
  love: { ...calm, eyes: ['dot', 'dot'], mouth: 'w', tilt: [-5, 5, -5] },
  wow: { eyes: ['big', 'big'], mouth: 'o', bob: [0, -22, 0], bobT: loop(0.75, { repeatDelay: 0.25 }), arms: [40, 52, 40], armT: loop(0.5, { repeatDelay: 0.5 }), tilt: [0, 0, 0] },
  cheer: { eyes: ['arc', 'arc'], mouth: 'open', bob: [0, -12, 0], bobT: loop(0.6), arms: [135, 165, 135], armT: loop(0.6), tilt: [-4, 4, -4] },
  sleepy: { eyes: ['sleep', 'sleep'], mouth: 'w', bob: [0, 2.5, 0], bobT: loop(3.2), arms: [4, 6, 4], armT: loop(3.2), tilt: [7, 9, 7] },
};

function Eye({ x, kind }: { x: number; kind: EyeKind }) {
  const y = 100;
  if (kind === 'arc' || kind === 'sleep')
    return (
      <path d={kind === 'arc' ? `M${x - 7} ${y + 2} Q${x} ${y - 8} ${x + 7} ${y + 2}` : `M${x - 7} ${y - 1} Q${x} ${y + 6} ${x + 7} ${y - 1}`}
        fill="none" stroke={C.ink} strokeWidth={3.5} strokeLinecap="round" />
    );
  const big = kind === 'big';
  return (
    <motion.g style={pv('50%', '50%')} animate={{ scaleY: [1, 1, 0.1, 1] }}
      transition={{ duration: 3.5, times: [0, 0.93, 0.965, 1], repeat: Infinity, ease: 'linear' }}>
      <ellipse cx={x} cy={y} rx={big ? 9.5 : 6} ry={big ? 10.5 : 8} fill={C.ink} />
      <circle cx={x + (big ? 3 : 2)} cy={y - (big ? 4 : 3)} r={big ? 3.2 : 2} fill="#fff" />
    </motion.g>
  );
}

function Mouth({ kind }: { kind: MouthKind }) {
  if (kind === 'o') return <ellipse cx={100} cy={124} rx={5} ry={6.5} fill={C.ink} />;
  const line = { fill: 'none', stroke: C.ink, strokeWidth: 2.5, strokeLinecap: 'round' as const };
  if (kind === 'open')
    return (
      <>
        <path d="M100 115 V118" {...line} />
        <path d="M91 118 Q100 133 109 118 Z" fill={C.ink} />
        <ellipse cx={100} cy={123.5} rx={4} ry={2.2} fill={C.pink} />
      </>
    );
  return <path d="M100 115 V119 M92 119 Q96 124 100 119 Q104 124 108 119" {...line} />;
}

function Arm({ x, side, rot, t }: { x: number; side: 1 | -1; rot: number[]; t: Transition }) {
  return (
    <motion.g style={pv('50%', '8%')} animate={{ rotate: rot.map((r) => r * side) }} transition={t}>
      <ellipse cx={x} cy={164} rx={10} ry={17} fill={C.fur} />
      <circle cx={x} cy={176} r={8} fill={C.light} />
    </motion.g>
  );
}

function Ear({ delay }: { delay: number }) {
  return (
    <motion.g style={pv('55%', '80%')} animate={{ rotate: [0, 0, -14, 5, 0] }}
      transition={{ duration: 4.5, times: [0, 0.8, 0.86, 0.92, 1], repeat: Infinity, delay }}>
      <path d="M36 80 Q28 34 46 24 Q60 20 86 46 Z" fill={C.fur} />
      <path d="M45 64 Q40 38 50 32 Q60 30 74 44 Z" fill={C.pinkL} />
    </motion.g>
  );
}

const STARS: [number, number, string][] = [[28, 62, C.yellow], [174, 52, C.pink], [16, 132, C.sky], [186, 128, C.yellow], [100, 10, C.pink]];
const HEARTS: [number, number, string][] = [[40, 1.4, C.pink], [162, 1.1, C.pinkL], [58, 0.9, C.pinkL], [146, 1.5, C.pink]];

export function Mascot({ size = 120, mood = 'happy' }: { size?: number; mood?: MascotMood }) {
  const m = MOODS[mood];
  const whisker = { stroke: C.ink, strokeWidth: 2.5, strokeLinecap: 'round' as const, opacity: 0.75 };
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 200 220" role="img" aria-label="Lilo the cat"
      style={{ display: 'inline-block', overflow: 'visible' }}>
      <motion.g animate={{ y: m.bob }} transition={m.bobT}>
        {/* tail */}
        <motion.path d="M132 186 C160 192 176 176 170 150 C166 134 176 122 186 126" fill="none" stroke={C.fur}
          strokeWidth={13} strokeLinecap="round" style={pv('0%', '95%')}
          animate={{ rotate: mood === 'sleepy' ? [-3, 2, -3] : [-7, 9, -7] }} transition={loop(mood === 'cheer' ? 0.8 : 2.6)} />
        {/* body */}
        <ellipse cx={100} cy={168} rx={40} ry={34} fill={C.fur} />
        <ellipse cx={100} cy={176} rx={24} ry={20} fill={C.light} />
        <ellipse cx={80} cy={202} rx={15} ry={9} fill={C.light} />
        <ellipse cx={120} cy={202} rx={15} ry={9} fill={C.light} />
        {/* head */}
        <motion.g style={pv('50%', '90%')} animate={{ rotate: m.tilt }} transition={loop(4)}>
          <Ear delay={0} />
          <g transform="matrix(-1 0 0 1 200 0)"><Ear delay={1.7} /></g>
          <ellipse cx={100} cy={94} rx={68} ry={54} fill={C.fur} />
          <path d="M88 46 V54 M100 43 V54 M112 46 V54" stroke={C.furD} strokeWidth={5} strokeLinecap="round" />
          <ellipse cx={100} cy={118} rx={21} ry={13} fill={C.light} />
          <motion.g animate={{ opacity: mood === 'love' ? 1 : 0.55 }}>
            <ellipse cx={60} cy={120} rx={9} ry={5.5} fill={C.pinkL} />
            <ellipse cx={140} cy={120} rx={9} ry={5.5} fill={C.pinkL} />
          </motion.g>
          <Eye x={68} kind={m.eyes[0]} />
          <Eye x={132} kind={m.eyes[1]} />
          <path d="M95 110 Q100 107 105 110 Q102.5 115 100 115 Q97.5 115 95 110 Z" fill={C.pink} />
          <Mouth kind={m.mouth} />
          <path d="M24 108 L46 112 M24 122 L46 119 M176 108 L154 112 M176 122 L154 119" {...whisker} />
          {/* hibiscus */}
          <g transform="translate(150 50)">
            <motion.g style={pv('50%', '50%')} animate={{ rotate: [-8, 8, -8] }} transition={loop(3.4)}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx={0} cy={-8} rx={7} ry={8.5} fill={C.pink} transform={`rotate(${a})`} />
              ))}
              <circle r={5} fill={C.pinkL} />
              <circle r={2.8} fill={C.yellow} />
            </motion.g>
          </g>
        </motion.g>
        {/* paws */}
        <Arm x={66} side={1} rot={m.arms} t={m.armT} />
        <Arm x={134} side={-1} rot={mood === 'wave' ? [125, 165, 125] : m.arms} t={mood === 'wave' ? loop(0.55) : m.armT} />
      </motion.g>

      {mood === 'cheer' && STARS.map(([x, y, c], i) => (
        <motion.path key={i} d={star(x, y, 8)} fill={c} style={pv('50%', '50%')}
          animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0], rotate: [0, 90] }} transition={loop(1.2, { delay: i * 0.24, ease: 'easeOut' })} />
      ))}
      {mood === 'sleepy' && [0, 1, 2].map((i) => (
        <g key={i} transform="translate(172 36)">
          <motion.text fontSize={16 + i * 5} fontWeight={800} fill={C.navy} fontFamily="inherit"
            animate={{ x: [0, 14, 24], y: [0, -22, -44], opacity: [0, 1, 0] }} transition={loop(3, { delay: i, ease: 'easeOut' })}>z</motion.text>
        </g>
      ))}
      {mood === 'love' && HEARTS.map(([x, s, c], i) => (
        <g key={i} transform={`translate(${x} 72) scale(${s})`}>
          <motion.path d={HEART} fill={c} style={pv('50%', '50%')}
            animate={{ y: [0, -50], opacity: [0, 1, 0], scale: [0.6, 1, 0.9] }} transition={loop(2.4, { delay: i * 0.6, ease: 'easeOut' })} />
        </g>
      ))}
    </svg>
  );
}
