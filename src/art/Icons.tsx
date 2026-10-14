import { motion, type Easing, type TargetAndTransition, type Variants } from 'framer-motion';
import { useId, type ReactElement, type ReactNode } from 'react';

export type IconName =
  | 'home' | 'chores' | 'bonus' | 'school' | 'prizes' | 'trophies' | 'inbox' | 'schedule' | 'catalog'
  | 'family' | 'star' | 'camera' | 'gift' | 'lock' | 'heart' | 'fire' | 'check' | 'chat' | 'draw'
  | 'spin' | 'album' | 'mood' | 'sound' | 'paw' | 'sparkle';

const P = '#ff6fae', LP = '#ffb3d9', B = '#6ec6f0', N = '#2f4a8a', Y = '#ffd84d', W = '#ffffff', MT = '#7ee0c3', FUR = '#8e93b0';

const f1 = (n: number) => +n.toFixed(1);
const star = (cx: number, cy: number, R: number, r = R * 0.48) =>
  'M' + Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2, d = i % 2 ? r : R;
    return `${f1(cx + d * Math.cos(a))} ${f1(cy + d * Math.sin(a))}`;
  }).join(' L') + 'Z';
/** 4-point twinkle. `f` > 0 makes it chubbier (control points pushed out from the centre). */
const spark = (x: number, y: number, r: number, f = 0) => {
  const c = f * r;
  return `M${x} ${y - r} Q${x + c} ${y - c} ${x + r} ${y} Q${x + c} ${y + c} ${x} ${y + r} Q${x - c} ${y + c} ${x - r} ${y} Q${x - c} ${y - c} ${x} ${y - r}Z`;
};
/** Chubby heart centred on (x, y); `s` = 1 is about 10 units wide. */
const heart = (x: number, y: number, s = 1) => {
  const p = (dx: number, dy: number) => `${f1(x + dx * s)} ${f1(y + dy * s)}`;
  return `M${p(0, 4)} C${p(-6, 0)} ${p(-6, -3.5)} ${p(-3.6, -4.5)} C${p(-1.8, -5.2)} ${p(-0.5, -4)} ${p(0, -3)} C${p(0.5, -4)} ${p(1.8, -5.2)} ${p(3.6, -4.5)} C${p(6, -3.5)} ${p(6, 0)} ${p(0, 4)}Z`;
};
/** Eighth note whose head is centred on (x, y). */
const note = (x: number, y: number) =>
  `M${x - 3.3} ${y} a3.3 2.7 0 1 0 6.6 0 a3.3 2.7 0 1 0 -6.6 0Z ` +
  `M${x + 1.4} ${y} V${y - 10.5} H${x + 3.3} Q${x + 8.2} ${y - 9} ${x + 7.2} ${y - 4} Q${x + 6.2} ${y - 6.6} ${x + 3.3} ${y - 6.8} V${y} Z`;

/** Animated group: loops keyframes `k` while `on`, otherwise rests on each first keyframe. `o` = pivot within the shape (fill-box). */
function M({ on, k, d = 1.2, o = '50% 50%', delay = 0, rd = 0, t, ease = 'easeInOut', children }: {
  on: boolean; k: Record<string, number[]>; d?: number; o?: string; delay?: number; rd?: number; t?: number[]; ease?: Easing; children: ReactNode;
}) {
  const [originX, originY] = o.split(' ');
  const rest = Object.fromEntries(Object.entries(k).map(([p, v]) => [p, v[0]]));
  const variants: Variants = {
    rest: { ...rest, transition: { duration: 0.3 } } as TargetAndTransition,
    on: { ...k, transition: { duration: d, delay, repeat: Infinity, repeatDelay: rd, ease, times: t } } as TargetAndTransition,
  };
  return (
    <motion.g style={{ transformBox: 'fill-box', originX, originY }} variants={variants} initial="rest" animate={on ? 'on' : 'rest'}>
      {children}
    </motion.g>
  );
}

/** A sparkle (or heart) that pops out, drifts by (dx, dy) and fades — hidden at rest. */
function Pop({ on, x, y, r = 4, c = Y, d = 1.2, delay = 0, rd = 0.4, dx = 0, dy = -4, kind = 'spark', t }: {
  on: boolean; x: number; y: number; r?: number; c?: string; d?: number; delay?: number; rd?: number; dx?: number; dy?: number;
  kind?: 'spark' | 'heart' | 'dot' | 'note'; t?: number[];
}) {
  const shape = kind === 'heart' ? <path d={heart(x, y, r / 5)} fill={c} />
    : kind === 'dot' ? <circle cx={x} cy={y} r={r} fill={c} />
    : kind === 'note' ? <path d={note(x, y)} fill={c} />
    : <path d={spark(x, y, r, 0.12)} fill={c} />;
  return (
    <M on={on} d={d} delay={delay} rd={rd} t={t ?? [0, 0.35, 1]} ease="easeOut"
      k={{ scale: [0, 1.25, 0.2], opacity: [0, 1, 0], x: [0, dx * 0.55, dx], y: [0, dy * 0.55, dy], rotate: kind === 'spark' ? [0, 45, 90] : [0, -12, 10] }}>
      {shape}
    </M>
  );
}

/** Tiny kawaii face: dot eyes that blink while active, blush, and a little open smile. */
function Face({ on, x, y, gap = 9, s = 1, eye = N, blush = P, blushO = 0.5, mouth = true, glint = false }: {
  on: boolean; x: number; y: number; gap?: number; s?: number; eye?: string; blush?: string; blushO?: number; mouth?: boolean; glint?: boolean;
}) {
  const ex = gap / 2;
  return (
    <>
      <ellipse cx={x - ex - 2.6 * s} cy={y + 3.2 * s} rx={2.5 * s} ry={1.5 * s} fill={blush} opacity={blushO} />
      <ellipse cx={x + ex + 2.6 * s} cy={y + 3.2 * s} rx={2.5 * s} ry={1.5 * s} fill={blush} opacity={blushO} />
      <M on={on} k={{ scaleY: [1, 1, 0.12, 1, 1] }} t={[0, 0.55, 0.62, 0.7, 1]} d={2.6} ease="linear">
        <ellipse cx={x - ex} cy={y} rx={1.9 * s} ry={2.2 * s} fill={eye} />
        <ellipse cx={x + ex} cy={y} rx={1.9 * s} ry={2.2 * s} fill={eye} />
        {glint && <>
          <circle cx={x - ex + 0.7 * s} cy={y - 0.8 * s} r={0.7 * s} fill={W} />
          <circle cx={x + ex + 0.7 * s} cy={y - 0.8 * s} r={0.7 * s} fill={W} />
        </>}
      </M>
      {mouth && <path d={`M${x - 2 * s} ${y + 1.6 * s} Q${x} ${y + 5 * s} ${x + 2 * s} ${y + 1.6 * s} Z`} fill={eye} />}
    </>
  );
}

/** Stroke that draws itself in (looping) while `on`; fully drawn otherwise. */
function Draw({ on, d, c, w, delay = 0, dur = 1.8 }: { on: boolean; d: string; c: string; w: number; delay?: number; dur?: number }) {
  return (
    <motion.path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
      initial={{ pathLength: 1 }} animate={{ pathLength: on ? [0, 1, 1] : 1 }}
      transition={on ? { duration: dur, times: [0, 0.3, 1], delay, repeat: Infinity, ease: 'easeOut' } : { duration: 0.2 }} />
  );
}

/** Soft flat highlight blob. */
const Shine = ({ x, y, rx = 3, ry = 1.8, a = -35, o = 0.7 }: { x: number; y: number; rx?: number; ry?: number; a?: number; o?: number }) => (
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={W} opacity={o} transform={`rotate(${a} ${x} ${y})`} />
);

/** Bouncy squash & stretch on a ground line (pivot at the bottom). */
const SQUASH = { scaleY: [1, 0.86, 1.1, 0.96, 1], scaleX: [1, 1.1, 0.93, 1.03, 1] };
const SQUASH_T = [0, 0.18, 0.42, 0.68, 1];

const Board = ({ board }: { board: string }) => (
  <>
    <rect x={9} y={8} width={30} height={35} rx={7} fill={board} />
    <rect x={13} y={13} width={22} height={26} rx={4} fill={W} />
    <rect x={18} y={5} width={12} height={7.5} rx={3.75} fill={N} />
    <circle cx={21} cy={7.5} r={1.1} fill={W} opacity={0.6} />
  </>
);

const gift = (box: string, lid: string, rib: string, eye: string) => (on: boolean) => {
  const T = [0, 0.14, 0.34, 0.56, 0.7, 1];
  return (
    <>
      <M on={on} k={{ scaleY: [1, 0.88, 1.07, 1, 0.95, 1], scaleX: [1, 1.08, 0.95, 1, 1.03, 1] }} t={T} o="50% 100%" d={1.5} rd={0.4}>
        <rect x={9} y={22} width={30} height={20} rx={4} fill={box} />
        <rect x={21.5} y={22} width={5} height={20} fill={rib} />
        <Face on={on} x={24} y={30} gap={13} s={0.95} eye={eye} blush={P} blushO={box === P ? 0 : 0.5} mouth={false} />
        <path d="M22.5 33.2 Q24 35.4 25.5 33.2 Z" fill={eye} />
        <rect x={11.5} y={37.5} width={4} height={2} rx={1} fill={W} opacity={0.55} />
      </M>
      {[[15, 10, Y, -5], [33, 9, B, 5], [24, 4, P, 0]].map(([x, y, c, dx], i) => (
        <Pop key={i} on={on} x={x as number} y={y as number} r={i === 2 ? 3.6 : 4.2} c={c as string} dx={dx as number} dy={-6}
          d={0.9} rd={1.0} delay={0.4 + i * 0.05} />
      ))}
      <M on={on} k={{ y: [0, 1.5, -9, 0, 0.6, 0], rotate: [0, 0, -9, 0, 0, 0] }} t={T} o="50% 100%" d={1.5} rd={0.4}>
        <M on={on} k={{ rotate: [0, 0, -14, 10, -4, 0] }} t={T} o="50% 90%" d={1.5} rd={0.4}>
          <ellipse cx={18.5} cy={11} rx={6} ry={4.2} fill={rib} transform="rotate(-25 18.5 11)" />
          <ellipse cx={29.5} cy={11} rx={6} ry={4.2} fill={rib} transform="rotate(25 29.5 11)" />
        </M>
        <rect x={6} y={14} width={36} height={9} rx={3.5} fill={lid} />
        <rect x={21.5} y={14} width={5} height={9} fill={rib} />
        <circle cx={24} cy={13.5} r={3.2} fill={rib} />
        <rect x={9} y={16} width={6} height={2} rx={1} fill={W} opacity={0.55} />
      </M>
    </>
  );
};

const CUP = 'M13 8 H35 V17 C35 25 30 30 24 30 C18 30 13 25 13 17 Z';
const HEART = 'M24 41 C10 31 5 24 5 17 C5 11 10 7 15 7 C19 7 22 9 24 12 C26 9 29 7 33 7 C38 7 43 11 43 17 C43 24 38 31 24 41 Z';
const CAL_DOTS = [16, 24, 32].flatMap((x) => [25, 32].map((y) => [x, y]));
const calPage = (hi: number) => (
  <>
    <rect x={10} y={18} width={28} height={21} rx={3.5} fill={W} />
    {CAL_DOTS.map(([x, y], i) => i === hi
      ? <path key={i} d={star(x, y, 3.8)} fill={Y} />
      : <circle key={i} cx={x} cy={y} r={2} fill={N} opacity={0.8} />)}
  </>
);

const WHEEL = [P, Y, B, W, P, Y, B, MT];
const wedge = (i: number, n = 8, cx = 24, cy = 23, r = 16) => {
  const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
  return `M${cx} ${cy} L${f1(cx + r * Math.cos(a0))} ${f1(cy + r * Math.sin(a0))} A${r} ${r} 0 0 1 ${f1(cx + r * Math.cos(a1))} ${f1(cy + r * Math.sin(a1))}Z`;
};

const ICONS: Record<IconName, (on: boolean, id: string) => ReactElement> = {
  home: (on) => (
    <>
      <Pop on={on} x={33} y={4} r={3.4} c={Y} kind="heart" dx={3} dy={-8} d={1.8} rd={0.1} />
      <Pop on={on} x={33} y={5} r={2.2} c={B} kind="dot" dx={-3} dy={-9} d={1.8} delay={0.7} rd={0.1} />
      <M on={on} k={SQUASH} t={SQUASH_T} o="50% 100%" d={1} rd={0.6}>
        <rect x={30} y={9} width={6} height={12} rx={1.8} fill={N} />
        <path d="M7 24 L24 9 L41 24 Z" fill={W} stroke={W} strokeWidth={7.5} strokeLinejoin="round" />
        <path d="M7 24 L24 9 L41 24 Z" fill={P} stroke={P} strokeWidth={4} strokeLinejoin="round" />
        <path d={heart(24, 17.5, 0.62)} fill={W} />
        <rect x={10.5} y={22} width={27} height={20} rx={5} fill={B} />
        <rect x={13.5} y={25} width={5} height={2.2} rx={1.1} fill={W} opacity={0.6} />
        <Face on={on} x={24} y={31} gap={10} s={1.05} blush={P} blushO={0.55} />
      </M>
    </>
  ),
  chores: (on) => (
    <>
      <M on={on} k={SQUASH} t={SQUASH_T} o="50% 100%" d={1.1} rd={0.7}>
        <Board board={B} />
        {[19, 26, 33].map((y, i) => (
          <g key={y}>
            <Draw on={on} d={`M15.5 ${y} l2 2 l3.5 -4`} c={P} w={2.8} delay={i * 0.25} />
            <rect x={24} y={y - 1.5} width={8} height={3} rx={1.5} fill={N} opacity={0.7} />
          </g>
        ))}
      </M>
      <Pop on={on} x={41} y={9} r={4.5} c={Y} dx={2} dy={-3} d={1.8} delay={0.75} rd={0} />
      <Pop on={on} x={6} y={16} r={3.4} c={B} dx={-2} dy={-3} d={1.8} delay={0.3} rd={0} />
    </>
  ),
  bonus: (on) => (
    <>
      {[[20, Y, 0], [28, W, 0.2], [24, LP, 0.4]].map(([x, c, delay], i) => (
        <Pop key={i} on={on} x={x as number} y={41} r={2.4} c={c as string} kind="dot" dx={(i - 1) * 3} dy={7} d={0.7} delay={delay as number} rd={0} />
      ))}
      <Pop on={on} x={7} y={12} r={3.6} c={Y} d={1.2} delay={0.2} />
      <Pop on={on} x={41} y={22} r={3} c={B} d={1.2} delay={0.7} />
      <M on={on} k={{ y: [0, -4, -1, -4, 0], rotate: [0, 3, -3, 2, 0] }} d={1.4}>
        <M on={on} k={{ x: [0, -0.6, 0.6, -0.4, 0] }} d={0.25}>
          <M on={on} k={{ scaleY: [1, 1.4, 0.9, 1.25, 1], scaleX: [1, 0.85, 1.05, 0.9, 1] }} o="50% 0%" d={0.4}>
            <path d="M18.5 33 Q24 47 29.5 33 Z" fill={Y} />
            <path d="M21 33 Q24 41 27 33 Z" fill={P} />
          </M>
          <path d="M18 23 L10 32 Q10 35.5 13.5 34 L19 31 Z" fill={P} />
          <path d="M30 23 L38 32 Q38 35.5 34.5 34 L29 31 Z" fill={P} />
          <path d="M24 4 C31 10 33 21 30.5 34 H17.5 C15 21 17 10 24 4 Z" fill={B} />
          <path d="M24 4 C27.5 7 29.5 10.5 30.5 14 H17.5 C18.5 10.5 20.5 7 24 4 Z" fill={N} />
          <ellipse cx={20.5} cy={25} rx={1.4} ry={4.5} fill={W} opacity={0.55} />
          <circle cx={24} cy={21} r={5} fill={W} />
          <circle cx={24} cy={21} r={3.2} fill={N} />
          <circle cx={25.2} cy={19.8} r={1.1} fill={W} />
        </M>
      </M>
    </>
  ),
  school: (on) => (
    <>
      <Pop on={on} x={7} y={9} r={4} c={Y} d={1.5} delay={0.35} rd={0.3} dx={-2} />
      <Pop on={on} x={41} y={7} r={3.4} c={B} d={1.5} delay={0.45} rd={0.3} dx={2} />
      <M on={on} k={{ y: [0, 0, -9, 0, 0, 0], rotate: [0, 0, -14, 4, 0, 0], scaleY: [1, 0.9, 1.06, 0.86, 1.04, 1], scaleX: [1, 1.06, 0.96, 1.1, 0.98, 1] }}
        t={[0, 0.12, 0.38, 0.62, 0.8, 1]} o="50% 100%" d={1.5} rd={0.3}>
        <path d="M13 21 V31 Q24 38 35 31 V21 Z" fill={B} />
        <path d="M15.5 27 Q24 32 32.5 27" fill="none" stroke={W} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
        <path d="M4 18 L24 9 L44 18 L24 27 Z" fill={N} stroke={N} strokeWidth={2.4} strokeLinejoin="round" />
        <path d="M14 15.5 L24 11 L27 12.3 L17 16.8 Z" fill={W} opacity={0.25} />
        <M on={on} k={{ rotate: [0, 0, 22, -16, 8, 0] }} t={[0, 0.12, 0.4, 0.62, 0.8, 1]} o="0% 0%" d={1.5} rd={0.3}>
          <path d="M24 18 L37 22 V32" fill="none" stroke={Y} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M37 31 L40 37 H34 Z" fill={Y} stroke={Y} strokeWidth={1.6} strokeLinejoin="round" />
        </M>
        <circle cx={24} cy={18} r={2.4} fill={Y} />
      </M>
    </>
  ),
  prizes: gift(Y, P, B, N),
  gift: gift(B, N, P, N),
  trophies: (on, id) => (
    <>
      <Pop on={on} x={7} y={7} r={4} c={B} d={1.4} delay={0.25} rd={0.4} dx={-2} />
      <Pop on={on} x={42} y={6} r={4.4} c={P} d={1.4} delay={0.45} rd={0.4} dx={2} />
      <M on={on} k={{ y: [0, 0, -4, 0, 0], scaleY: [1, 0.9, 1.06, 0.93, 1], scaleX: [1, 1.08, 0.96, 1.05, 1] }}
        t={[0, 0.15, 0.4, 0.65, 1]} o="50% 100%" d={1.4} rd={0.4}>
        <path d="M14 12 H8.5 Q7 22 16 23 M34 12 H39.5 Q41 22 32 23" fill="none" stroke={Y} strokeWidth={3.6} strokeLinecap="round" />
        <rect x={20.5} y={28} width={7} height={8} fill={Y} />
        <rect x={14} y={35} width={20} height={7.5} rx={3} fill={N} />
        <path d={star(24, 38.8, 2.6)} fill={Y} />
        <clipPath id={id}><path d={CUP} /></clipPath>
        <path d={CUP} fill={Y} />
        <rect x={15.5} y={10.5} width={3} height={8} rx={1.5} fill={W} opacity={0.6} />
        <Face on={on} x={24} y={17} gap={9} s={1} blush={P} blushO={0.55} />
        <g clipPath={`url(#${id})`}>
          <M on={on} k={{ x: [-26, -26, 26] }} t={[0, 0.3, 1]} d={1.4} rd={0.4}>
            <path d="M20 4 h5 l-8 30 h-5 Z" fill={W} opacity={0.7} />
          </M>
        </g>
      </M>
    </>
  ),
  inbox: (on) => (
    <>
      <Pop on={on} x={24} y={6} r={3.6} c={P} kind="heart" dy={-7} d={1.3} delay={0.3} rd={0.2} />
      <M on={on} k={{ scaleY: [1, 1, 0.92, 1.03, 1], scaleX: [1, 1, 1.05, 0.98, 1] }} t={[0, 0.2, 0.45, 0.7, 1]} o="50% 100%" d={1.3} rd={0.2}>
        <path d="M7 26 L13 12 H35 L41 26 V37 Q41 41 37 41 H11 Q7 41 7 37 Z" fill={B} />
        <M on={on} k={{ y: [0, 0, -7, -5, 0], rotate: [0, 0, -6, 5, 0] }} t={[0, 0.2, 0.45, 0.7, 1]} o="50% 100%" d={1.3} rd={0.2}>
          <rect x={15} y={8} width={18} height={22} rx={3} fill={W} />
          <path d={heart(24, 16, 0.75)} fill={P} />
          <rect x={18.5} y={22.5} width={11} height={2} rx={1} fill={N} opacity={0.35} />
        </M>
        <path d="M7 26 H17 Q19 32 24 32 Q29 32 31 26 H41 V37 Q41 41 37 41 H11 Q7 41 7 37 Z" fill={N} />
        <rect x={10.5} y={35} width={5} height={2} rx={1} fill={W} opacity={0.35} />
      </M>
    </>
  ),
  schedule: (on) => (
    <>
      <Pop on={on} x={41} y={9} r={4} c={Y} d={1.8} delay={1} rd={0.6} />
      <M on={on} k={{ y: [0, 0, -3, 0, 0], rotate: [0, 0, -4, 3, 0] }} t={[0, 0.5, 0.65, 0.82, 1]} o="50% 100%" d={1.8} rd={0.6}>
        <rect x={7} y={10} width={34} height={32} rx={7} fill={P} />
        <rect x={10} y={13} width={6} height={2} rx={1} fill={W} opacity={0.5} />
        {calPage(2)}
        <M on={on} k={{ scaleY: [1, 1, 0, 0, 1] }} t={[0, 0.25, 0.5, 0.55, 1]} o="50% 0%" d={1.8} rd={0.6}>{calPage(1)}</M>
        <rect x={14} y={6} width={4} height={9} rx={2} fill={N} />
        <rect x={30} y={6} width={4} height={9} rx={2} fill={N} />
      </M>
    </>
  ),
  catalog: (on) => (
    <>
      <Pop on={on} x={41} y={8} r={4} c={Y} d={1.2} delay={0.2} rd={0.6} />
      <M on={on} k={{ rotate: [0, -9, 8, -5, 3, 0], scaleY: [1, 1.04, 0.95, 1.02, 1, 1] }} d={1.2} rd={0.6} o="50% 100%">
        <Board board={P} />
        <path d={star(18.5, 20, 3.8)} fill={Y} />
        <circle cx={18.5} cy={27} r={2.6} fill={B} />
        <path d={heart(18.5, 33.5, 0.5)} fill={P} />
        {[20, 27, 33.5].map((y) => <rect key={y} x={24} y={y - 1.5} width={8} height={3} rx={1.5} fill={N} opacity={0.7} />)}
      </M>
    </>
  ),
  family: (on) => (
    <>
      <Pop on={on} x={24} y={9} r={4.5} c={P} kind="heart" dy={-6} d={1.4} delay={0.5} rd={0.3} />
      {([[14, B, 0], [34, P, 0.15]] as const).map(([x, c, delay]) => (
        <M key={x} on={on} k={{ y: [0, -5, 0, 0], scaleY: [1, 1.05, 0.9, 1], scaleX: [1, 0.96, 1.08, 1] }} t={[0, 0.35, 0.7, 1]} o="50% 100%" d={0.8} rd={0.6} delay={delay}>
          <circle cx={x} cy={15} r={6.5} fill={c} />
          <circle cx={x - 2.3} cy={15} r={1.2} fill={N} />
          <circle cx={x + 2.3} cy={15} r={1.2} fill={N} />
          <ellipse cx={x - 3.8} cy={17.5} rx={1.4} ry={0.9} fill={W} opacity={0.6} />
          <ellipse cx={x + 3.8} cy={17.5} rx={1.4} ry={0.9} fill={W} opacity={0.6} />
          <rect x={x - 8} y={23} width={16} height={19} rx={7} fill={c} />
        </M>
      ))}
      <M on={on} k={{ y: [0, -6, 0, 0], scaleY: [1, 1.06, 0.88, 1], scaleX: [1, 0.95, 1.1, 1] }} t={[0, 0.35, 0.7, 1]} o="50% 100%" d={0.8} rd={0.6} delay={0.3}>
        <circle cx={24} cy={25} r={5.5} fill={Y} />
        <circle cx={22.2} cy={25} r={1.05} fill={N} />
        <circle cx={25.8} cy={25} r={1.05} fill={N} />
        <ellipse cx={20.6} cy={27.2} rx={1.2} ry={0.8} fill={P} opacity={0.55} />
        <ellipse cx={27.4} cy={27.2} rx={1.2} ry={0.8} fill={P} opacity={0.55} />
        <rect x={18} y={31.5} width={12} height={11} rx={5} fill={Y} />
      </M>
    </>
  ),
  star: (on) => (
    <>
      <M on={on} k={{ rotate: [0, -10, 8, -4, 0], scale: [1, 1.12, 0.94, 1.04, 1] }} d={1.6} rd={0.7}>
        <path d={star(24, 26, 17)} fill={Y} stroke={Y} strokeWidth={3.5} strokeLinejoin="round" />
        <Shine x={17.5} y={19} rx={2.6} ry={1.5} a={-40} />
        <Face on={on} x={24} y={26} gap={8.5} s={1.1} blush={P} blushO={0.55} />
      </M>
      <Pop on={on} x={41} y={8} r={4.5} c={B} d={1.6} delay={0.1} rd={0.7} dx={2} />
      <Pop on={on} x={7} y={10} r={4} c={P} d={1.6} delay={0.6} rd={0.7} dx={-2} />
      <Pop on={on} x={42} y={36} r={3} c={P} d={1.6} delay={1.0} rd={0.7} dx={2} dy={2} />
    </>
  ),
  camera: (on) => (
    <>
      <M on={on} k={{ scaleY: [1, 1, 0.9, 1.04, 1], scaleX: [1, 1, 1.05, 0.98, 1] }} t={[0, 0.3, 0.4, 0.55, 1]} o="50% 100%" d={1.6} rd={0.4}>
        <rect x={15} y={10} width={13} height={8} rx={3} fill={N} />
        <rect x={5} y={15} width={38} height={25} rx={8} fill={B} />
        <rect x={8.5} y={18.5} width={6} height={2.2} rx={1.1} fill={W} opacity={0.6} />
        <circle cx={24} cy={27.5} r={9} fill={W} />
        <M on={on} k={{ scale: [1, 1, 0.7, 1.08, 1] }} t={[0, 0.3, 0.4, 0.55, 1]} d={1.6} rd={0.4}>
          <circle cx={24} cy={27.5} r={6} fill={N} />
          <circle cx={26.2} cy={25.3} r={1.8} fill={W} />
          <circle cx={22} cy={29.8} r={0.9} fill={W} opacity={0.7} />
        </M>
        <rect x={33} y={19} width={6} height={3.5} rx={1.75} fill={Y} />
      </M>
      <M on={on} k={{ scale: [0, 0, 1.5, 0, 0], opacity: [0, 0, 1, 0, 0], rotate: [0, 0, 45, 90, 90] }} t={[0, 0.3, 0.42, 0.7, 1]} d={1.6} rd={0.4}>
        <path d={spark(41, 10, 7, 0.12)} fill={Y} />
      </M>
      <Pop on={on} x={8} y={9} r={3} c={P} d={0.8} rd={1.2} delay={0.6} />
    </>
  ),
  lock: (on) => (
    <>
      <M on={on} k={{ y: [0, 0, -5, -4, 0], rotate: [0, 0, 8, 6, 0] }} t={[0, 0.2, 0.4, 0.75, 1]} o="0% 100%" d={1.5} rd={0.5}>
        <path d="M16 23 V16 a8 8 0 0 1 16 0 V23" fill="none" stroke={N} strokeWidth={5} strokeLinecap="round" />
      </M>
      <M on={on} k={{ rotate: [0, -6, 6, -3, 0, 0], scaleY: [1, 0.94, 1.03, 1, 1, 1] }} t={[0, 0.1, 0.2, 0.3, 0.4, 1]} o="50% 100%" d={1.5} rd={0.5}>
        <rect x={10} y={21} width={28} height={21} rx={7} fill={Y} />
        <rect x={13} y={24} width={5} height={2} rx={1} fill={W} opacity={0.6} />
        <circle cx={24} cy={29.5} r={3.4} fill={N} />
        <rect x={22.5} y={30} width={3} height={6.5} rx={1.5} fill={N} />
      </M>
      <Pop on={on} x={40} y={14} r={3.6} c={B} d={0.8} rd={1.2} delay={0.6} />
    </>
  ),
  heart: (on) => (
    <>
      <M on={on} k={{ scale: [1, 1.18, 0.94, 1.1, 1] }} t={[0, 0.2, 0.42, 0.62, 1]} d={1.1} rd={0.2}>
        <path d={HEART} fill={P} />
        <ellipse cx={14} cy={15} rx={3.6} ry={2.3} fill={W} opacity={0.7} transform="rotate(-35 14 15)" />
        <Face on={on} x={24} y={22} gap={9} s={1.05} eye={N} blush={W} blushO={0.45} />
      </M>
      <Pop on={on} x={6} y={8} r={4} c={LP} kind="heart" dx={-3} dy={-5} d={1.1} rd={0.2} />
      <Pop on={on} x={42} y={8} r={3.4} c={P} kind="heart" dx={3} dy={-5} d={1.1} delay={0.3} rd={0.2} />
    </>
  ),
  fire: (on) => (
    <>
      <Pop on={on} x={16} y={10} r={2} c={Y} kind="dot" dx={-3} dy={-8} d={1.1} rd={0.1} />
      <Pop on={on} x={33} y={12} r={1.6} c={P} kind="dot" dx={3} dy={-9} d={1.1} delay={0.5} rd={0.1} />
      <M on={on} k={{ scaleY: [1, 1.1, 0.94, 1.06, 1], scaleX: [1, 0.95, 1.04, 0.97, 1], rotate: [0, -2, 2, -1, 0] }} o="50% 100%" d={0.9}>
        <path d="M24 5 C28 13 37 18 37 29 C37 37 31 43 24 43 C17 43 11 37 11 29 C11 22 16 18 18 12 C20 17 22 19 24 20 C25 15 24 10 24 5 Z" fill={P} />
        <ellipse cx={15.5} cy={29} rx={1.5} ry={3.5} fill={W} opacity={0.45} />
        <M on={on} k={{ scaleY: [1, 0.86, 1.12, 0.93, 1] }} o="50% 100%" d={0.7}>
          <path d="M24 22 C27 27 31 30 31 34 C31 38 28 41 24 41 C20 41 17 38 17 34 C17 30 21 27 24 22 Z" fill={Y} />
        </M>
        <Face on={on} x={24} y={33.5} gap={6} s={0.75} blush={P} blushO={0.6} />
      </M>
    </>
  ),
  check: (on) => (
    <>
      <M on={on} k={{ scale: [1, 1.12, 0.95, 1.03, 1] }} t={[0, 0.2, 0.4, 0.6, 1]} d={1.8}>
        <circle cx={24} cy={24} r={19} fill={P} />
        <Shine x={14.5} y={14.5} rx={3.4} ry={2} a={-45} o={0.55} />
      </M>
      <Draw on={on} d="M15 24.5 L21.5 31 L33.5 18" c={W} w={5} />
      <Pop on={on} x={41} y={7} r={4} c={Y} d={1.8} delay={0.45} rd={0} />
      <Pop on={on} x={7} y={40} r={3} c={B} d={1.8} delay={0.6} rd={0} dy={3} />
    </>
  ),
  chat: (on) => (
    <>
      <M on={on} k={{ y: [0, -2.5, 0], rotate: [0, -4, 0] }} o="0% 100%" d={1.1}>
        <path d="M13 6 H25 Q33 6 33 14 V16 Q33 24 25 24 H15 L9 29 L10 23 Q5 21 5 14 Q5 6 13 6 Z" fill={Y} />
        <path d={heart(19, 14.5, 0.6)} fill={P} />
      </M>
      <M on={on} k={{ y: [0, 0, -2.5, 0], rotate: [0, 0, 3, 0] }} t={[0, 0.3, 0.65, 1]} o="100% 100%" d={1.1}>
        <path d="M24 17 H36 Q44 17 44 25.5 Q44 32 39 34 L40 41 L33 35 H24 Q16 35 16 26 Q16 17 24 17 Z" fill={B} />
        <rect x={20} y={20.5} width={5} height={2} rx={1} fill={W} opacity={0.6} />
        {[24, 30, 36].map((x, i) => (
          <M key={x} on={on} k={{ y: [0, -3.5, 0, 0], scaleY: [1, 1.15, 0.85, 1] }} t={[0, 0.3, 0.55, 1]} d={0.9} delay={i * 0.15} rd={0.2}>
            <circle cx={x} cy={27} r={2.3} fill={W} />
          </M>
        ))}
      </M>
    </>
  ),
  draw: (on) => (
    <>
      <M on={on} k={{ rotate: [0, 3, -2, 0] }} d={1.3} rd={0.3} o="50% 100%">
        <path d="M8 30 Q8 10 26 9 Q42 9 42 23 Q42 31 34 30 Q29 30 30 35 Q31 41 24 41 Q8 41 8 30 Z" fill={Y} />
        <ellipse cx={14} cy={23} rx={1.3} ry={3} fill={W} opacity={0.5} transform="rotate(25 14 23)" />
        {([[17, 20, P, 0], [26, 16, B, 0.15], [34, 21, N, 0.3], [16, 31, W, 0.45]] as const).map(([x, y, c, delay]) => (
          <M key={x + y} on={on} k={{ scale: [1, 1.3, 0.9, 1] }} d={1.3} delay={delay} rd={0.3}>
            <circle cx={x} cy={y} r={3.3} fill={c} />
          </M>
        ))}
      </M>
      <M on={on} k={{ rotate: [0, -16, 10, -6, 0], y: [0, -1, 0, -1, 0] }} d={1.3} o="10% 90%" rd={0.3}>
        <path d="M27 38 L40 18 L44 20.5 L31 40.5 Z" fill={LP} />
        <path d="M38.5 20.3 L40 18 L44 20.5 L42.5 22.8 Z" fill={B} />
        <path d="M27 38 L31 40.5 L26 44 Z" fill={N} />
      </M>
      <Pop on={on} x={8} y={9} r={3.8} c={P} d={1.3} delay={0.3} rd={0.3} />
      <Pop on={on} x={40} y={7} r={3} c={B} d={1.3} delay={0.7} rd={0.3} />
    </>
  ),
  spin: (on) => (
    <>
      <rect x={21.5} y={36} width={5} height={7} rx={1.5} fill={N} />
      <rect x={14} y={40.5} width={20} height={5} rx={2.5} fill={N} />
      <M on={on} k={{ rotate: [0, 0, 400, 360] }} t={[0, 0.08, 0.8, 1]} d={2} rd={0.5}>
        <circle cx={24} cy={23} r={18} fill={N} />
        {WHEEL.map((c, i) => <path key={i} d={wedge(i)} fill={c} />)}
        {WHEEL.map((_, i) => {
          const a = ((i + 0.5) / 8) * Math.PI * 2;
          return <circle key={i} cx={f1(24 + 17 * Math.cos(a))} cy={f1(23 + 17 * Math.sin(a))} r={0.9} fill={Y} />;
        })}
        <circle cx={24} cy={23} r={4.5} fill={W} />
        <circle cx={24} cy={23} r={2.2} fill={P} />
      </M>
      <M on={on} k={{ rotate: [0, 0, -22, 0, -18, 0, -12, 0, -6, 0, 0] }} t={[0, 0.08, 0.16, 0.24, 0.34, 0.44, 0.55, 0.65, 0.75, 0.85, 1]} o="50% 0%" d={2} rd={0.5}>
        <path d="M20 3 H28 L24 10.5 Z" fill={Y} stroke={Y} strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx={24} cy={4} r={1.2} fill={N} />
      </M>
      <Pop on={on} x={42} y={8} r={4} c={Y} d={0.8} delay={1.5} rd={1.7} />
      <Pop on={on} x={6} y={10} r={3.4} c={P} d={0.8} delay={1.6} rd={1.7} />
    </>
  ),
  album: (on) => (
    <>
      <Pop on={on} x={42} y={7} r={4} c={Y} d={1.6} delay={0.4} rd={0.4} dx={2} />
      <M on={on} k={{ rotate: [0, -4, 3, -1, 0], y: [0, -2, 0, -0.5, 0] }} o="50% 100%" d={1.6} rd={0.4}>
        <rect x={13} y={8} width={28} height={34} rx={5} fill={W} />
        <rect x={13} y={8} width={28} height={34} rx={5} fill={LP} opacity={0.35} />
        <rect x={7} y={6} width={30} height={36} rx={5} fill={N} />
        <path d="M14 6 H32 Q37 6 37 11 V37 Q37 42 32 42 H14 Z" fill={B} />
        {[12, 18, 24, 30, 36].map((y) => <circle key={y} cx={10.5} cy={y} r={1} fill={W} opacity={0.75} />)}
        <M on={on} k={{ rotate: [0, 0, 180, 360, 360], scale: [1, 1.3, 1.1, 1, 1] }} t={[0, 0.15, 0.4, 0.6, 1]} d={1.6} rd={0.4}>
          <path d={star(26, 17, 6.5)} fill={Y} stroke={Y} strokeWidth={1.5} strokeLinejoin="round" />
        </M>
        <M on={on} k={{ scale: [1, 1, 1.25, 0.95, 1] }} t={[0, 0.3, 0.5, 0.7, 1]} d={1.6} rd={0.4}>
          <path d={heart(21, 31, 0.8)} fill={P} />
        </M>
        <M on={on} k={{ rotate: [0, 0, 0, -25, 0] }} t={[0, 0.4, 0.55, 0.75, 1]} o="0% 100%" d={1.6} rd={0.4}>
          <circle cx={31} cy={33} r={4} fill={W} />
          <circle cx={31} cy={33} r={2} fill={MT} />
        </M>
      </M>
      <M on={on} k={{ rotate: [0, 18, -12, 6, 0] }} o="50% 0%" d={1.6} rd={0.4} delay={0.1}>
        <path d="M28 41 H33 V47.5 L30.5 45.5 L28 47.5 Z" fill={P} />
      </M>
    </>
  ),
  mood: (on) => (
    <>
      <Pop on={on} x={42} y={7} r={4} c={P} kind="heart" dx={2} dy={-5} d={1.3} delay={0.3} rd={0.4} />
      <Pop on={on} x={6} y={9} r={3.6} c={B} d={1.3} delay={0.6} rd={0.4} dx={-2} />
      <M on={on} k={{ ...SQUASH, rotate: [0, -6, 6, -2, 0] }} t={SQUASH_T} o="50% 100%" d={1.3} rd={0.4}>
        <circle cx={24} cy={25} r={18} fill={Y} />
        <Shine x={14.5} y={15.5} rx={4} ry={2.4} a={-40} />
        <ellipse cx={13} cy={29} rx={3.6} ry={2.1} fill={P} opacity={0.5} />
        <ellipse cx={35} cy={29} rx={3.6} ry={2.1} fill={P} opacity={0.5} />
        <M on={on} k={{ scaleY: [1, 1, 0.12, 1, 1] }} t={[0, 0.5, 0.58, 0.66, 1]} d={1.3} rd={0.4}>
          <ellipse cx={17.5} cy={22} rx={2.4} ry={2.9} fill={N} />
          <ellipse cx={30.5} cy={22} rx={2.4} ry={2.9} fill={N} />
          <circle cx={18.4} cy={21} r={0.9} fill={W} />
          <circle cx={31.4} cy={21} r={0.9} fill={W} />
        </M>
        <M on={on} k={{ scaleY: [1, 1.35, 0.85, 1.1, 1], scaleX: [1, 0.9, 1.08, 0.97, 1] }} t={SQUASH_T} o="50% 0%" d={1.3} rd={0.4}>
          <path d="M17.5 29 Q24 38.5 30.5 29 Z" fill={N} />
          <ellipse cx={24} cy={33.2} rx={3} ry={1.6} fill={P} />
        </M>
      </M>
    </>
  ),
  sound: (on) => (
    <>
      <M on={on} k={{ scaleX: [1, 0.9, 1.06, 1], scaleY: [1, 1.05, 0.97, 1] }} o="0% 50%" d={0.5}>
        <rect x={5} y={18} width={9} height={12} rx={2.5} fill={N} />
        <path d="M12 18 L22 10 Q24.5 8.8 24.5 11.5 V36.5 Q24.5 39.2 22 38 L12 30 Z" fill={B} />
        <rect x={16.5} y={17} width={1.8} height={7} rx={0.9} fill={W} opacity={0.6} transform="rotate(-38 17.4 20.5)" />
      </M>
      <M on={on} k={{ opacity: [1, 0.35, 1], scale: [1, 1.15, 1] }} o="0% 50%" d={0.5}>
        <path d="M29 19 Q33 24 29 29" fill="none" stroke={P} strokeWidth={3} strokeLinecap="round" />
      </M>
      <M on={on} k={{ opacity: [1, 1, 0.35, 1], scale: [1, 1, 1.12, 1] }} o="0% 50%" d={0.5}>
        <path d="M33.5 14.5 Q40.5 24 33.5 33.5" fill="none" stroke={B} strokeWidth={3} strokeLinecap="round" />
      </M>
      <M on={on} k={{ y: [0, -4, 0], rotate: [0, 10, -6, 0] }} d={1.1} o="30% 100%">
        <path d={note(39, 10)} fill={P} />
      </M>
      <Pop on={on} x={40} y={40} kind="note" c={Y} r={4} dx={3} dy={-10} d={1.4} delay={0.2} rd={0} t={[0, 0.25, 1]} />
      <Pop on={on} x={30} y={42} kind="note" c={P} r={4} dx={-2} dy={-12} d={1.4} delay={0.9} rd={0} t={[0, 0.25, 1]} />
    </>
  ),
  paw: (on) => (
    <>
      <Pop on={on} x={7} y={8} r={3.6} c={P} kind="heart" dx={-3} dy={-5} d={1.2} delay={0.35} rd={0.4} />
      <Pop on={on} x={41} y={6} r={3} c={Y} d={1.2} delay={0.45} rd={0.4} dx={2} />
      <M on={on} k={{ y: [0, -3, 2, 0], scaleY: [1, 1.04, 0.86, 1], scaleX: [1, 0.97, 1.1, 1], rotate: [0, -6, 0, 0] }} t={[0, 0.3, 0.5, 1]} o="50% 100%" d={1.2} rd={0.4}>
        <circle cx={11.5} cy={20} r={6} fill={FUR} />
        <circle cx={19} cy={12.5} r={6.5} fill={FUR} />
        <circle cx={29} cy={12.5} r={6.5} fill={FUR} />
        <circle cx={36.5} cy={20} r={6} fill={FUR} />
        <ellipse cx={24} cy={31} rx={14.5} ry={12.5} fill={FUR} />
        <ellipse cx={14} cy={27} rx={1.6} ry={3.6} fill={W} opacity={0.35} transform="rotate(30 14 27)" />
        <M on={on} k={{ scale: [1, 1, 1.25, 1] }} t={[0, 0.4, 0.55, 1]} d={1.2} rd={0.4}>
          <circle cx={11.5} cy={20.5} r={2.8} fill={LP} />
          <circle cx={19} cy={13} r={3} fill={LP} />
          <circle cx={29} cy={13} r={3} fill={LP} />
          <circle cx={36.5} cy={20.5} r={2.8} fill={LP} />
          <path d={heart(24, 32.5, 1.25)} fill={P} />
        </M>
      </M>
    </>
  ),
  sparkle: (on) => (
    <>
      <M on={on} k={{ rotate: [0, 18, -10, 4, 0], scale: [1, 1.18, 0.9, 1.05, 1] }} d={1.5} rd={0.3}>
        <path d={spark(22, 26, 18, 0.24)} fill={Y} />
        <Shine x={18} y={20} rx={1.6} ry={3.2} a={-30} o={0.75} />
        <circle cx={19.3} cy={27} r={1.3} fill={N} />
        <circle cx={24.7} cy={27} r={1.3} fill={N} />
        <ellipse cx={17} cy={29.6} rx={1.5} ry={0.9} fill={P} opacity={0.55} />
        <ellipse cx={27} cy={29.6} rx={1.5} ry={0.9} fill={P} opacity={0.55} />
      </M>
      <M on={on} k={{ scale: [1, 0.3, 1.25, 1], rotate: [0, 45, 90, 90] }} d={1.5} delay={0.25} rd={0.3}>
        <path d={spark(39, 9, 6.5, 0.12)} fill={B} />
      </M>
      <M on={on} k={{ scale: [1, 1.35, 0.4, 1], rotate: [0, -45, -90, -90] }} d={1.5} delay={0.5} rd={0.3}>
        <path d={spark(39.5, 37, 4.5, 0.12)} fill={P} />
      </M>
      <Pop on={on} x={7} y={9} r={3.4} c={B} d={1.5} delay={0.8} rd={0.3} />
    </>
  ),
};

export function Icon({ name, size = 32, active = false }: { name: IconName; size?: number; active?: boolean }) {
  const id = 'ic' + useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false"
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible', flexShrink: 0 }}>
      {ICONS[name](active, id)}
    </svg>
  );
}
