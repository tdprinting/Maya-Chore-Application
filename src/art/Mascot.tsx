import { motion, type Transition } from 'framer-motion';

export type MascotMood = 'happy' | 'wow' | 'wink' | 'wave' | 'cheer' | 'sleepy' | 'love' | 'dance' | 'surprised';

const C = {
  fur: '#8e93b0', furD: '#767b9c', light: '#e8eaf3', pink: '#ff6fae', pinkL: '#ffb3d9',
  ink: '#2b2d42', yellow: '#ffd84d', sky: '#6ec6f0', navy: '#2f4a8a', mint: '#7ee0c3',
};

/** Pivot helper: framer-motion passes string origins straight through, so with fill-box they're relative to the shape. */
const pv = (x: string, y: string) => ({ transformBox: 'fill-box' as const, originX: x, originY: y });
const loop = (duration: number, t: Transition = {}): Transition => ({ duration, repeat: Infinity, ease: 'easeInOut', ...t });
const star = (cx: number, cy: number, R: number, r = R * 0.48) =>
  'M' + Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2, d = i % 2 ? r : R;
    return `${(cx + d * Math.cos(a)).toFixed(1)} ${(cy + d * Math.sin(a)).toFixed(1)}`;
  }).join(' L') + 'Z';
const spark = (x: number, y: number, r: number) => {
  const c = r * 0.12;
  return `M${x} ${y - r} Q${x + c} ${y - c} ${x + r} ${y} Q${x + c} ${y + c} ${x} ${y + r} Q${x - c} ${y + c} ${x - r} ${y} Q${x - c} ${y - c} ${x} ${y - r}Z`;
};
const HEART = 'M0 6 C-8 0 -9 -6 -5 -8 C-3 -9 -1 -8 0 -6 C1 -8 3 -9 5 -8 C9 -6 8 0 0 6 Z';
const NOTE = 'M-4 0 a4 3.3 0 1 0 8 0 a4 3.3 0 1 0 -8 0Z M1.8 0 V-14 H4 Q11 -12 9.5 -5 Q8.2 -8.8 4 -9 V0 Z';

type EyeKind = 'dot' | 'big' | 'arc' | 'sleep' | 'shock';
type MouthKind = 'w' | 'o' | 'open';
interface MoodCfg {
  eyes: [EyeKind, EyeKind]; mouth: MouthKind;
  bob: number[]; bobT: Transition;
  arms: number[]; armT: Transition; armsR?: number[]; armRT?: Transition;
  tilt: number[]; tiltT?: Transition;
  sway?: number[]; swayRot?: number[]; swayT?: Transition;
  tail: number[]; tailT: Transition; tip: number[]; tipT: Transition;
  look?: boolean; earT?: number;
}

const idleTail = { tail: [-7, 9, -7], tailT: loop(2.6), tip: [0, 22, -8, 30, 4, 0], tipT: loop(5.5, { times: [0, 0.2, 0.42, 0.6, 0.8, 1] }) };
const calm = { bob: [0, -4, 0], bobT: loop(2.2), arms: [8, 12, 8], armT: loop(2.2), tilt: [-3, 3, -3], ...idleTail };
const BEAT = 0.9;
const MOODS: Record<MascotMood, MoodCfg> = {
  happy: { ...calm, eyes: ['dot', 'dot'], mouth: 'w', look: true },
  wink: { ...calm, eyes: ['dot', 'arc'], mouth: 'open' },
  wave: { ...calm, eyes: ['dot', 'dot'], mouth: 'open', look: true, armsR: [125, 165, 125], armRT: loop(0.55) },
  love: { ...calm, eyes: ['dot', 'dot'], mouth: 'w', tilt: [-5, 5, -5] },
  wow: {
    ...idleTail, eyes: ['big', 'big'], mouth: 'o', bob: [0, -22, 0], bobT: loop(0.75, { repeatDelay: 0.25 }),
    arms: [40, 52, 40], armT: loop(0.5, { repeatDelay: 0.5 }), tilt: [0, 0, 0],
  },
  cheer: {
    eyes: ['arc', 'arc'], mouth: 'open', bob: [0, -12, 0], bobT: loop(0.6), arms: [135, 165, 135], armT: loop(0.6), tilt: [-4, 4, -4],
    tail: [-12, 14, -12], tailT: loop(0.8), tip: [0, 25, 0], tipT: loop(0.8, { delay: 0.15 }),
  },
  sleepy: {
    eyes: ['sleep', 'sleep'], mouth: 'w', bob: [0, 2.5, 0], bobT: loop(3.2), arms: [4, 6, 4], armT: loop(3.2), tilt: [7, 9, 7],
    tail: [-3, 2, -3], tailT: loop(3.2), tip: [0, 8, 0], tipT: loop(4), earT: 9,
  },
  dance: {
    eyes: ['arc', 'arc'], mouth: 'open',
    bob: [0, -9, 0, -9, 0], bobT: loop(BEAT, { ease: 'easeOut' }),
    arms: [25, 140, 25], armT: loop(BEAT), armsR: [140, 25, 140], armRT: loop(BEAT),
    tilt: [-9, 9, -9], tiltT: loop(BEAT),
    sway: [-7, 7, -7], swayRot: [-5, 5, -5], swayT: loop(BEAT),
    tail: [-16, 16, -16], tailT: loop(BEAT / 2), tip: [-10, 28, -10], tipT: loop(BEAT / 2, { delay: 0.12 }),
  },
  surprised: {
    eyes: ['shock', 'shock'], mouth: 'o',
    bob: [0, -18, 0, -3, 0, 0], bobT: loop(1.8, { times: [0, 0.12, 0.3, 0.38, 0.46, 1], ease: 'easeOut' }),
    arms: [10, 70, 58, 62, 58, 10], armT: loop(1.8, { times: [0, 0.12, 0.3, 0.45, 0.7, 1] }),
    tilt: [0, -6, 0, 0], tiltT: loop(1.8, { times: [0, 0.12, 0.35, 1] }),
    tail: [0, -20, 10, 0], tailT: loop(1.8, { times: [0, 0.12, 0.35, 1] }), tip: [0, 35, -10, 0], tipT: loop(1.8, { times: [0, 0.15, 0.4, 1] }),
    earT: 1.8,
  },
};

/** Occasional glance left, then right — makes idle Lilo feel alive. */
const LOOK = { x: [0, 0, 5, 5, 0, 0, -5, -5, 0, 0], y: [0, 0, -1, -1, 0, 0, 1, 1, 0, 0] };
const LOOK_T = loop(9, { times: [0, 0.28, 0.31, 0.43, 0.46, 0.66, 0.69, 0.82, 0.85, 1] });

function Eye({ x, kind, look }: { x: number; kind: EyeKind; look?: boolean }) {
  const y = 100;
  if (kind === 'arc' || kind === 'sleep')
    return (
      <path d={kind === 'arc' ? `M${x - 7} ${y + 2} Q${x} ${y - 8} ${x + 7} ${y + 2}` : `M${x - 7} ${y - 1} Q${x} ${y + 6} ${x + 7} ${y - 1}`}
        fill="none" stroke={C.ink} strokeWidth={3.5} strokeLinecap="round" />
    );
  if (kind === 'shock')
    return (
      <motion.g style={pv('50%', '50%')} animate={{ scale: [1, 1.18, 1, 1] }} transition={loop(1.8, { times: [0, 0.12, 0.35, 1] })}>
        <circle cx={x} cy={y} r={10.5} fill={C.ink} />
        <circle cx={x} cy={y} r={8.2} fill="#fff" />
        <circle cx={x} cy={y + 0.5} r={3.6} fill={C.ink} />
        <circle cx={x + 1.2} cy={y - 0.8} r={1.2} fill="#fff" />
      </motion.g>
    );
  const big = kind === 'big';
  return (
    <motion.g style={pv('50%', '50%')} animate={{ scaleY: [1, 1, 0.1, 1] }}
      transition={{ duration: 3.5, times: [0, 0.93, 0.965, 1], repeat: Infinity, ease: 'linear' }}>
      <motion.g animate={look ? LOOK : { x: 0, y: 0 }} transition={look ? LOOK_T : { duration: 0.3 }}>
        <ellipse cx={x} cy={y} rx={big ? 9.5 : 6} ry={big ? 10.5 : 8} fill={C.ink} />
        <circle cx={x + (big ? 3 : 2)} cy={y - (big ? 4 : 3)} r={big ? 3.2 : 2} fill="#fff" />
        {big && <circle cx={x - 3} cy={y + 4} r={1.4} fill="#fff" />}
      </motion.g>
    </motion.g>
  );
}

function Mouth({ kind }: { kind: MouthKind }) {
  if (kind === 'o')
    return (
      <motion.ellipse cx={100} cy={124} rx={5} ry={6.5} fill={C.ink} style={pv('50%', '0%')}
        animate={{ scaleY: [1, 1.2, 0.9, 1] }} transition={loop(1.2)} />
    );
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
      <path d={`M${x - 7} 160 Q${x} 157 ${x + 7} 160`} fill="none" stroke={C.furD} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <circle cx={x} cy={176} r={8} fill={C.light} />
      <circle cx={x} cy={178} r={2.6} fill={C.pinkL} />
    </motion.g>
  );
}

function Ear({ delay, period = 4.5 }: { delay: number; period?: number }) {
  return (
    <motion.g style={pv('55%', '80%')} animate={{ rotate: [0, 0, -14, 5, 0] }}
      transition={{ duration: period, times: [0, 0.8, 0.86, 0.92, 1], repeat: Infinity, delay }}>
      <path d="M36 80 Q28 34 46 24 Q60 20 86 46 Z" fill={C.fur} />
      <path d="M45 64 Q40 38 50 32 Q60 30 74 44 Z" fill={C.pinkL} />
    </motion.g>
  );
}

const STARS: [number, number, string][] = [[28, 62, C.yellow], [174, 52, C.pink], [16, 132, C.sky], [186, 128, C.yellow], [100, 10, C.pink]];
const SPARKS: [number, number, string, number][] = [[52, 18, C.sky, 7], [150, 8, C.yellow, 9], [8, 96, C.pink, 6], [196, 92, C.mint, 7], [40, 196, C.yellow, 6], [166, 196, C.pinkL, 7]];
const HEARTS: [number, number, string][] = [[40, 1.4, C.pink], [162, 1.1, C.pinkL], [58, 0.9, C.pinkL], [146, 1.5, C.pink]];
const NOTES: [number, number, string][] = [[24, 70, C.pink], [178, 64, C.sky], [12, 130, C.yellow], [190, 120, C.pink]];

function Particles({ mood }: { mood: MascotMood }) {
  return (
    <>
      {mood === 'cheer' && STARS.map(([x, y, c], i) => (
        <motion.path key={'s' + i} d={star(x, y, 8)} fill={c} style={pv('50%', '50%')}
          animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0], rotate: [0, 90] }} transition={loop(1.2, { delay: i * 0.24, ease: 'easeOut' })} />
      ))}
      {(mood === 'cheer' || mood === 'love' || mood === 'dance') && SPARKS.map(([x, y, c, r], i) => (
        <motion.path key={'k' + i} d={spark(x, y, r)} fill={c} style={pv('50%', '50%')}
          animate={{ scale: [0, 1.3, 0], opacity: [0, 1, 0], rotate: [0, 45, 90] }}
          transition={loop(mood === 'love' ? 1.8 : 1.1, { delay: 0.15 + i * 0.31, ease: 'easeOut', repeatDelay: 0.3 })} />
      ))}
      {mood === 'cheer' && [[70, C.pink], [132, C.pinkL]].map(([x, c], i) => (
        <g key={'h' + i} transform={`translate(${x} 40)`}>
          <motion.path d={HEART} fill={c as string} style={pv('50%', '50%')}
            animate={{ y: [0, -40], x: [0, i ? 8 : -8], opacity: [0, 1, 0], scale: [0.4, 1, 0.8] }} transition={loop(1.4, { delay: 0.3 + i * 0.7, ease: 'easeOut' })} />
        </g>
      ))}
      {mood === 'sleepy' && [0, 1, 2].map((i) => (
        <g key={'z' + i} transform="translate(172 36)">
          <motion.text fontSize={16 + i * 5} fontWeight={800} fill={C.navy} fontFamily="inherit"
            animate={{ x: [0, 14, 24], y: [0, -22, -44], opacity: [0, 1, 0] }} transition={loop(3, { delay: i, ease: 'easeOut' })}>z</motion.text>
        </g>
      ))}
      {mood === 'love' && HEARTS.map(([x, s, c], i) => (
        <g key={'l' + i} transform={`translate(${x} 72) scale(${s})`}>
          <motion.path d={HEART} fill={c} style={pv('50%', '50%')}
            animate={{ y: [0, -50], x: [0, i % 2 ? 6 : -6, 0], opacity: [0, 1, 0], scale: [0.6, 1, 0.9], rotate: [-10, 10, -6] }}
            transition={loop(2.4, { delay: i * 0.6, ease: 'easeOut' })} />
        </g>
      ))}
      {mood === 'dance' && NOTES.map(([x, y, c], i) => (
        <g key={'n' + i} transform={`translate(${x} ${y})`}>
          <motion.path d={NOTE} fill={c} style={pv('50%', '50%')}
            animate={{ y: [0, -36], x: [0, i % 2 ? 8 : -8], rotate: [-15, 15, -10], opacity: [0, 1, 1, 0], scale: [0.5, 1.15, 1] }}
            transition={loop(1.8, { delay: i * 0.45, ease: 'easeOut' })} />
        </g>
      ))}
      {mood === 'surprised' && (
        <>
          <motion.g style={pv('50%', '100%')} animate={{ scale: [0, 1.3, 1, 1, 0], rotate: [0, 12, -6, 0, 0], opacity: [0, 1, 1, 1, 0] }}
            transition={loop(1.8, { times: [0, 0.12, 0.25, 0.8, 1] })}>
            <rect x={177} y={-4} width={11} height={26} rx={5.5} fill={C.yellow} />
            <circle cx={182.5} cy={31} r={5.5} fill={C.yellow} />
          </motion.g>
          {[[-30, 0], [0, 1], [30, 2]].map(([a, i]) => (
            <g key={i} transform={`rotate(${a} 34 52)`}>
              <motion.rect x={14} y={20} width={6} height={14} rx={3} fill={C.navy} style={pv('50%', '100%')}
                animate={{ scaleY: [0, 1, 0, 0], opacity: [0, 1, 0, 0], y: [6, 0, -4, -4] }} transition={loop(1.8, { times: [0, 0.14, 0.35, 1], ease: 'easeOut' })} />
            </g>
          ))}
        </>
      )}
    </>
  );
}

export function Mascot({ size = 120, mood = 'happy' }: { size?: number; mood?: MascotMood }) {
  const m = MOODS[mood] ?? MOODS.happy;
  const whisker = { stroke: C.ink, strokeWidth: 2.5, strokeLinecap: 'round' as const, opacity: 0.75 };
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 200 220" role="img" aria-label="Lilo the cat"
      style={{ display: 'inline-block', overflow: 'visible' }}>
      <motion.g style={pv('50%', '100%')} animate={{ x: m.sway ?? 0, rotate: m.swayRot ?? 0 }} transition={m.sway ? m.swayT : { duration: 0.4 }}>
        <motion.g animate={{ y: m.bob }} transition={m.bobT}>
          {/* tail: base sways, tip curls on its own rhythm (secondary motion) */}
          <motion.g style={pv('0%', '92%')} animate={{ rotate: m.tail }} transition={m.tailT}>
            <path d="M132 186 C160 192 176 176 170 150" fill="none" stroke={C.fur} strokeWidth={13} strokeLinecap="round" />
            <motion.g style={pv('4%', '100%')} animate={{ rotate: m.tip }} transition={m.tipT}>
              <path d="M170 150 C166 134 176 122 186 126" fill="none" stroke={C.fur} strokeWidth={13} strokeLinecap="round" />
              <path d="M168.5 140 L176.5 138" stroke={C.furD} strokeWidth={4} strokeLinecap="round" />
            </motion.g>
          </motion.g>
          {/* body (breathing) */}
          <motion.g style={pv('50%', '100%')} animate={{ scaleY: [1, 1.035, 1], scaleX: [1, 0.99, 1] }} transition={loop(mood === 'sleepy' ? 3.2 : 2.4)}>
            <ellipse cx={100} cy={168} rx={40} ry={34} fill={C.fur} />
            <ellipse cx={100} cy={176} rx={24} ry={20} fill={C.light} />
            <path d="M66 156 Q72 158 74 152 M64 170 Q71 172 73 166 M134 156 Q128 158 126 152 M136 170 Q129 172 127 166"
              fill="none" stroke={C.furD} strokeWidth={3.5} strokeLinecap="round" opacity={0.8} />
          </motion.g>
          <ellipse cx={80} cy={202} rx={15} ry={9} fill={C.light} />
          <ellipse cx={120} cy={202} rx={15} ry={9} fill={C.light} />
          {/* head */}
          <motion.g style={pv('50%', '90%')} animate={{ rotate: m.tilt }} transition={m.tiltT ?? loop(4)}>
            <Ear delay={0} period={m.earT} />
            <g transform="matrix(-1 0 0 1 200 0)"><Ear delay={m.earT ? 0.1 : 1.7} period={m.earT} /></g>
            <ellipse cx={100} cy={94} rx={68} ry={54} fill={C.fur} />
            <path d="M88 46 V54 M100 43 V54 M112 46 V54" stroke={C.furD} strokeWidth={5} strokeLinecap="round" />
            <ellipse cx={100} cy={118} rx={21} ry={13} fill={C.light} />
            <ellipse cx={62} cy={70} rx={9} ry={5} fill="#fff" opacity={0.18} transform="rotate(-30 62 70)" />
            <motion.g animate={{ opacity: mood === 'love' || mood === 'dance' ? 1 : mood === 'surprised' ? 0.3 : 0.55 }}>
              <ellipse cx={60} cy={120} rx={9} ry={5.5} fill={C.pinkL} />
              <ellipse cx={140} cy={120} rx={9} ry={5.5} fill={C.pinkL} />
            </motion.g>
            <Eye x={68} kind={m.eyes[0]} look={m.look} />
            <Eye x={132} kind={m.eyes[1]} look={m.look} />
            <path d="M95 110 Q100 107 105 110 Q102.5 115 100 115 Q97.5 115 95 110 Z" fill={C.pink} />
            <Mouth kind={m.mouth} />
            <path d="M24 108 L46 112 M24 122 L46 119 M176 108 L154 112 M176 122 L154 119" {...whisker} />
            {/* hibiscus */}
            <g transform="translate(150 50)">
              <motion.g style={pv('50%', '50%')} animate={{ rotate: mood === 'dance' ? [-20, 20, -20] : [-8, 8, -8] }} transition={loop(mood === 'dance' ? BEAT : 3.4)}>
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
          <Arm x={134} side={-1} rot={m.armsR ?? m.arms} t={m.armRT ?? m.armT} />
        </motion.g>
      </motion.g>
      <Particles mood={mood} />
    </svg>
  );
}
