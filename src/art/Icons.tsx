import { motion, type TargetAndTransition, type Variants } from 'framer-motion';
import { useId, type ReactElement, type ReactNode } from 'react';

export type IconName =
  | 'home' | 'chores' | 'bonus' | 'school' | 'prizes' | 'trophies' | 'inbox' | 'schedule' | 'catalog'
  | 'family' | 'star' | 'camera' | 'gift' | 'lock' | 'heart' | 'fire' | 'check' | 'chat' | 'draw';

const P = '#ff6fae', LP = '#ffb3d9', B = '#6ec6f0', N = '#2f4a8a', Y = '#ffd84d', W = '#ffffff';

const star = (cx: number, cy: number, R: number, r = R * 0.48) =>
  'M' + Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2, d = i % 2 ? r : R;
    return `${(cx + d * Math.cos(a)).toFixed(1)} ${(cy + d * Math.sin(a)).toFixed(1)}`;
  }).join(' L') + 'Z';
const spark = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`;

/** Animated group: loops keyframes `k` while `on`, otherwise rests on each first keyframe. `o` = pivot within the shape (fill-box). */
function M({ on, k, d = 1.2, o = '50% 50%', delay = 0, rd = 0, children }: {
  on: boolean; k: Record<string, number[]>; d?: number; o?: string; delay?: number; rd?: number; children: ReactNode;
}) {
  const [originX, originY] = o.split(' ');
  const rest = Object.fromEntries(Object.entries(k).map(([p, v]) => [p, v[0]]));
  const variants: Variants = {
    rest: { ...rest, transition: { duration: 0.3 } } as TargetAndTransition,
    on: { ...k, transition: { duration: d, delay, repeat: Infinity, repeatDelay: rd, ease: 'easeInOut' } } as TargetAndTransition,
  };
  return (
    <motion.g style={{ transformBox: 'fill-box', originX, originY }} variants={variants} initial="rest" animate={on ? 'on' : 'rest'}>
      {children}
    </motion.g>
  );
}

/** Stroke that draws itself in (looping) while `on`; fully drawn otherwise. */
function Draw({ on, d, c, w, delay = 0 }: { on: boolean; d: string; c: string; w: number; delay?: number }) {
  return (
    <motion.path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
      initial={{ pathLength: 1 }} animate={{ pathLength: on ? [0, 1, 1] : 1 }}
      transition={on ? { duration: 1.8, times: [0, 0.3, 1], delay, repeat: Infinity, ease: 'easeOut' } : { duration: 0.2 }} />
  );
}

const Board = ({ board }: { board: string }) => (
  <>
    <rect x={9} y={8} width={30} height={35} rx={6} fill={board} />
    <rect x={13} y={13} width={22} height={26} rx={3} fill={W} />
    <rect x={18} y={5} width={12} height={7} rx={3.5} fill={N} />
  </>
);

const gift = (box: string, lid: string, rib: string) => (on: boolean) => (
  <>
    <rect x={9} y={22} width={30} height={20} rx={3} fill={box} />
    <rect x={21} y={22} width={6} height={20} fill={rib} />
    <M on={on} k={{ y: [0, -7, 0, 0], rotate: [0, -8, 0, 0] }} o="50% 100%" d={1.3} rd={0.4}>
      <ellipse cx={18.5} cy={11} rx={6} ry={4} fill={rib} transform="rotate(-25 18.5 11)" />
      <ellipse cx={29.5} cy={11} rx={6} ry={4} fill={rib} transform="rotate(25 29.5 11)" />
      <rect x={6} y={14} width={36} height={9} rx={3} fill={lid} />
      <rect x={21} y={14} width={6} height={9} fill={rib} />
      <circle cx={24} cy={13.5} r={3} fill={rib} />
    </M>
  </>
);

const CUP = 'M13 8 H35 V17 C35 25 30 30 24 30 C18 30 13 25 13 17 Z';
const HEART = 'M24 41 C10 31 5 24 5 17 C5 11 10 7 15 7 C19 7 22 9 24 12 C26 9 29 7 33 7 C38 7 43 11 43 17 C43 24 38 31 24 41 Z';
const CAL_DOTS = [16, 24, 32].flatMap((x) => [25, 32].map((y) => [x, y]));
const calPage = (hi: number) => (
  <>
    <rect x={10} y={18} width={28} height={21} rx={3} fill={W} />
    {CAL_DOTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === hi ? 3.2 : 2} fill={i === hi ? Y : N} />)}
  </>
);

const ICONS: Record<IconName, (on: boolean, id: string) => ReactElement> = {
  home: (on) => (
    <>
      <rect x={30} y={9} width={6} height={12} rx={1.5} fill={N} />
      <M on={on} k={{ opacity: [0, 1, 0], y: [0, -6, -11], scale: [0.5, 1, 1.3] }} d={1.6}>
        <circle cx={33} cy={6} r={3} fill={LP} />
      </M>
      <path d="M7 24 L24 9 L41 24 Z" fill={P} stroke={P} strokeWidth={4} strokeLinejoin="round" />
      <rect x={11} y={22} width={26} height={19} rx={3} fill={B} />
      <rect x={26} y={26} width={7} height={7} rx={2} fill={Y} />
      <M on={on} k={{ scaleY: [1, 0.85, 1.06, 1] }} o="50% 100%" d={0.8} rd={0.8}>
        <rect x={14} y={29} width={9} height={12} rx={4} fill={N} />
      </M>
    </>
  ),
  chores: (on) => (
    <>
      <Board board={B} />
      {[19, 26, 33].map((y, i) => (
        <g key={y}>
          <Draw on={on} d={`M15.5 ${y} l2 2 l3.5 -4`} c={P} w={2.6} delay={i * 0.25} />
          <rect x={24} y={y - 1.5} width={8} height={3} rx={1.5} fill={N} opacity={0.75} />
        </g>
      ))}
    </>
  ),
  bonus: (on) => (
    <M on={on} k={{ y: [0, -3, 0], rotate: [0, 3, -3, 0] }} d={0.9}>
      <M on={on} k={{ scaleY: [1, 1.35, 0.9, 1.2, 1] }} o="50% 0%" d={0.4}>
        <path d="M18.5 33 Q24 47 29.5 33 Z" fill={Y} />
        <path d="M21 33 Q24 41 27 33 Z" fill={P} />
      </M>
      <path d="M18 23 L10 32 Q10 35 13 34 L19 31 Z" fill={P} />
      <path d="M30 23 L38 32 Q38 35 35 34 L29 31 Z" fill={P} />
      <path d="M24 4 C31 10 33 21 30.5 34 H17.5 C15 21 17 10 24 4 Z" fill={B} />
      <circle cx={24} cy={18} r={5} fill={W} />
      <circle cx={24} cy={18} r={3} fill={N} />
    </M>
  ),
  school: (on) => (
    <M on={on} k={{ rotate: [0, -10, 6, 0] }} o="50% 100%" d={1.4} rd={0.4}>
      <path d="M13 21 V31 Q24 38 35 31 V21 Z" fill={B} />
      <path d="M4 18 L24 9 L44 18 L24 27 Z" fill={N} stroke={N} strokeWidth={2} strokeLinejoin="round" />
      <M on={on} k={{ rotate: [0, 18, -12, 0] }} o="0% 0%" d={1.4} rd={0.4}>
        <path d="M24 18 L37 22 V32" fill="none" stroke={Y} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={37} cy={34} r={3} fill={Y} />
      </M>
      <circle cx={24} cy={18} r={2.2} fill={Y} />
    </M>
  ),
  prizes: gift(P, LP, Y),
  gift: gift(B, N, P),
  trophies: (on, id) => (
    <>
      <path d="M14 12 H8 Q7 22 16 23 M34 12 H40 Q41 22 32 23" fill="none" stroke={Y} strokeWidth={3.5} strokeLinecap="round" />
      <rect x={20.5} y={28} width={7} height={8} fill={Y} />
      <rect x={14} y={35} width={20} height={7} rx={2.5} fill={N} />
      <clipPath id={id}><path d={CUP} /></clipPath>
      <path d={CUP} fill={Y} />
      <path d={star(24, 18, 6)} fill={P} />
      <g clipPath={`url(#${id})`}>
        <M on={on} k={{ x: [-26, 26] }} d={1.1} rd={0.9}>
          <path d="M20 4 h6 l-8 30 h-6 Z" fill={W} opacity={0.75} />
        </M>
      </g>
    </>
  ),
  inbox: (on) => (
    <M on={on} k={{ y: [0, 0, 2, 0] }} d={1.2} rd={0.3}>
      <path d="M7 26 L13 12 H35 L41 26 V37 Q41 41 37 41 H11 Q7 41 7 37 Z" fill={B} />
      <M on={on} k={{ y: [0, -6, 0, 0] }} d={1.2} rd={0.3}>
        <rect x={15} y={8} width={18} height={22} rx={2.5} fill={W} />
        <path d="M24 19 C20 16 19.5 13.5 21.5 12.5 C22.8 12 23.6 12.8 24 13.6 C24.4 12.8 25.2 12 26.5 12.5 C28.5 13.5 28 16 24 19 Z" fill={P} />
      </M>
      <path d="M7 26 H17 Q19 32 24 32 Q29 32 31 26 H41 V37 Q41 41 37 41 H11 Q7 41 7 37 Z" fill={N} />
    </M>
  ),
  schedule: (on) => (
    <>
      <rect x={7} y={10} width={34} height={32} rx={6} fill={P} />
      {calPage(2)}
      <M on={on} k={{ scaleY: [1, 1, 0, 1] }} o="50% 0%" d={1.6} rd={0.6}>{calPage(1)}</M>
      <rect x={14} y={6} width={4} height={9} rx={2} fill={N} />
      <rect x={30} y={6} width={4} height={9} rx={2} fill={N} />
    </>
  ),
  catalog: (on) => (
    <M on={on} k={{ rotate: [0, -9, 8, -5, 3, 0] }} d={1} rd={0.8} o="50% 100%">
      <Board board={P} />
      <path d={star(18.5, 20, 3.8)} fill={Y} />
      <circle cx={18.5} cy={27} r={2.6} fill={B} />
      <circle cx={18.5} cy={33.5} r={2.6} fill={LP} />
      {[20, 27, 33.5].map((y) => <rect key={y} x={24} y={y - 1.5} width={8} height={3} rx={1.5} fill={N} opacity={0.75} />)}
    </M>
  ),
  family: (on) => (
    <>
      {([[14, B, 0], [34, P, 0.15]] as const).map(([x, c, delay]) => (
        <M key={x} on={on} k={{ y: [0, -4, 0] }} d={0.7} rd={0.5} delay={delay}>
          <circle cx={x} cy={15} r={6} fill={c} />
          <rect x={x - 8} y={23} width={16} height={19} rx={7} fill={c} />
        </M>
      ))}
      <M on={on} k={{ y: [0, -5, 0] }} d={0.7} rd={0.5} delay={0.3}>
        <circle cx={24} cy={25} r={5} fill={Y} />
        <rect x={18} y={31.5} width={12} height={11} rx={5} fill={Y} />
      </M>
    </>
  ),
  star: (on) => (
    <>
      <M on={on} k={{ rotate: [0, 360], scale: [1, 1.2, 1] }} d={1.6} rd={0.8}>
        <path d={star(24, 26, 17)} fill={Y} stroke={Y} strokeWidth={3} strokeLinejoin="round" />
      </M>
      {([[40, 8, B, 0], [8, 10, P, 0.5]] as const).map(([x, y, c, delay]) => (
        <M key={x} on={on} k={{ scale: [0, 1, 0], opacity: [0, 1, 0] }} d={1.2} delay={delay} rd={0.4}>
          <path d={spark(x, y, 4.5)} fill={c} />
        </M>
      ))}
    </>
  ),
  camera: (on) => (
    <>
      <rect x={15} y={10} width={13} height={8} rx={3} fill={N} />
      <rect x={5} y={15} width={38} height={25} rx={7} fill={B} />
      <circle cx={24} cy={27.5} r={8.5} fill={W} />
      <M on={on} k={{ scale: [1, 0.75, 1] }} d={1.4} rd={0.6}>
        <circle cx={24} cy={27.5} r={5.5} fill={N} />
      </M>
      <circle cx={26} cy={25.5} r={1.6} fill={W} />
      <rect x={33} y={19} width={6} height={3.5} rx={1.75} fill={Y} />
      <M on={on} k={{ scale: [0, 1.4, 0], opacity: [0, 1, 0] }} d={1.4} rd={0.6}>
        <path d={spark(41, 11, 7)} fill={Y} />
      </M>
    </>
  ),
  lock: (on) => (
    <>
      <M on={on} k={{ y: [0, -4, -4, 0] }} d={1.4} rd={0.5}>
        <path d="M16 23 V16 a8 8 0 0 1 16 0 V23" fill="none" stroke={N} strokeWidth={5} strokeLinecap="round" />
      </M>
      <M on={on} k={{ rotate: [0, 0, -6, 6, 0] }} d={1.4} rd={0.5}>
        <rect x={10} y={21} width={28} height={21} rx={6} fill={Y} />
        <circle cx={24} cy={29.5} r={3.2} fill={N} />
        <rect x={22.5} y={30} width={3} height={6.5} rx={1.5} fill={N} />
      </M>
    </>
  ),
  heart: (on) => (
    <M on={on} k={{ scale: [1, 1.18, 1, 1.1, 1] }} d={1} rd={0.2}>
      <path d={HEART} fill={P} />
      <ellipse cx={14} cy={15} rx={3.5} ry={2.2} fill={W} opacity={0.7} transform="rotate(-35 14 15)" />
    </M>
  ),
  fire: (on) => (
    <M on={on} k={{ scaleY: [1, 1.08, 0.95, 1.05, 1], scaleX: [1, 0.96, 1.03, 0.98, 1] }} o="50% 100%" d={0.8}>
      <path d="M24 5 C28 13 37 18 37 29 C37 37 31 43 24 43 C17 43 11 37 11 29 C11 22 16 18 18 12 C20 17 22 19 24 20 C25 15 24 10 24 5 Z" fill={P} />
      <M on={on} k={{ scaleY: [1, 0.85, 1.12, 0.92, 1] }} o="50% 100%" d={0.6}>
        <path d="M24 22 C27 27 31 30 31 34 C31 38 28 41 24 41 C20 41 17 38 17 34 C17 30 21 27 24 22 Z" fill={Y} />
      </M>
    </M>
  ),
  check: (on) => (
    <>
      <M on={on} k={{ scale: [1, 1.08, 1] }} d={1.8}>
        <circle cx={24} cy={24} r={19} fill={P} />
      </M>
      <Draw on={on} d="M15 24.5 L21.5 31 L33.5 18" c={W} w={5} />
    </>
  ),
  chat: (on) => (
    <>
      <path d="M13 6 H25 Q33 6 33 14 V16 Q33 24 25 24 H15 L9 29 L10 23 Q5 21 5 14 Q5 6 13 6 Z" fill={B} />
      <path d="M24 17 H36 Q44 17 44 25.5 Q44 32 39 34 L40 41 L33 35 H24 Q16 35 16 26 Q16 17 24 17 Z" fill={P} />
      {[24, 30, 36].map((x, i) => (
        <M key={x} on={on} k={{ y: [0, -3.5, 0, 0] }} d={0.9} delay={i * 0.15} rd={0.2}>
          <circle cx={x} cy={26} r={2.3} fill={W} />
        </M>
      ))}
    </>
  ),
  draw: (on) => (
    <>
      <path d="M8 30 Q8 10 26 9 Q42 9 42 23 Q42 31 34 30 Q29 30 30 35 Q31 41 24 41 Q8 41 8 30 Z" fill={Y} />
      <circle cx={17} cy={20} r={3.2} fill={P} />
      <circle cx={26} cy={16} r={3.2} fill={B} />
      <circle cx={34} cy={21} r={3.2} fill={N} />
      <circle cx={16} cy={31} r={3.2} fill={W} />
      <M on={on} k={{ rotate: [0, -14, 10, 0] }} d={1.1} o="10% 90%" rd={0.4}>
        <path d="M27 38 L40 18 L44 20.5 L31 40.5 Z" fill={LP} />
        <path d="M27 38 L31 40.5 L26 44 Z" fill={N} />
      </M>
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
