import type { CombatSide, MechClassId } from '../types/game';

interface FighterSvgProps {
  classId: MechClassId;
  side?: CombatSide;
  facing?: 'right' | 'left';
  size?: 'sm' | 'md' | 'lg';
  destroyed?: boolean;
  defending?: boolean;
  impactFlash?: boolean;
  exploding?: boolean;
  heroHover?: boolean;
  className?: string;
}

const CLASS_ACCENTS: Record<MechClassId, string> = {
  striker: '#F59E0B',
  interceptor: '#38BDF8',
  siege: '#EF4444',
  support: '#10B981',
};

const PALETTES: Record<
  CombatSide,
  {
    hullDark: string;
    hullMid: string;
    hullLight: string;
    cockpit: string;
    trim: string;
    flameCore: string;
    flameOuter: string;
  }
> = {
  ally: {
    hullDark: '#162032',
    hullMid: '#29384F',
    hullLight: '#526580',
    cockpit: '#7DD3FC',
    trim: '#94A3B8',
    flameCore: '#E0F2FE',
    flameOuter: '#38BDF8',
  },
  enemy: {
    hullDark: '#23131A',
    hullMid: '#441F2B',
    hullLight: '#753345',
    cockpit: '#FB7185',
    trim: '#B45B6E',
    flameCore: '#FEF08A',
    flameOuter: '#F97316',
  },
};

const SIZE_CLASSES = {
  sm: 'w-14 h-14',
  md: 'w-20 h-20',
  lg: 'w-56 h-56 sm:w-64 sm:h-64',
};

const SPARK_VECTORS: Array<{ dx: string; dy: string; color: string; r: number }> = [
  { dx: '34px', dy: '-14px', color: '#F59E0B', r: 3.2 },
  { dx: '-30px', dy: '-22px', color: '#EF4444', r: 2.8 },
  { dx: '26px', dy: '26px', color: '#FDE047', r: 2.6 },
  { dx: '-34px', dy: '18px', color: '#F97316', r: 3.0 },
  { dx: '8px', dy: '-36px', color: '#FEF08A', r: 2.2 },
  { dx: '-6px', dy: '34px', color: '#EF4444', r: 2.5 },
  { dx: '38px', dy: '6px', color: '#FB923C', r: 2.4 },
  { dx: '-36px', dy: '-2px', color: '#FDE047', r: 2.2 },
];

export function FighterSvg({
  classId,
  side = 'ally',
  facing = 'right',
  size = 'md',
  destroyed = false,
  defending = false,
  impactFlash = false,
  exploding = false,
  heroHover = false,
  className = '',
}: FighterSvgProps) {
  const p = PALETTES[side];
  const accent = side === 'enemy' ? '#F43F5E' : CLASS_ACCENTS[classId];
  const flipTransform =
    facing === 'left' ? 'scale(-1, 1) translate(-120, 0)' : undefined;

  const hoverClass = destroyed
    ? ''
    : heroHover
    ? 'anim-ship-hover-hero'
    : 'anim-ship-hover';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${SIZE_CLASSES[size]} ${hoverClass} ${className}`}
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full select-none ${
          destroyed ? 'opacity-25 grayscale' : ''
        }`}
        aria-hidden="true"
      >
        {/* Subtle engine ambient glow */}
        {!destroyed && (
          <ellipse
            cx={facing === 'left' ? '92' : '28'}
            cy="60"
            rx="16"
            ry="20"
            fill={p.flameOuter}
            opacity="0.14"
          />
        )}

        {/* Defend: Translucent Energy Shield Bubble */}
        {defending && !destroyed && (
          <g className="anim-shield-bubble">
            <ellipse
              cx="60"
              cy="60"
              rx="52"
              ry="44"
              fill="#38BDF8"
              fillOpacity="0.1"
              stroke="#38BDF8"
              strokeWidth="1.8"
            />
            <ellipse
              cx="60"
              cy="60"
              rx="46"
              ry="38"
              stroke="#7DD3FC"
              strokeWidth="0.9"
              strokeDasharray="8 6"
              opacity="0.7"
            />
          </g>
        )}

        <g transform={flipTransform}>
          {/* ================= STRIKER: Wide-Wing Heavy Bomber ================= */}
          {classId === 'striker' && (
            <g>
              {/* Dual Thruster Flames */}
              {!destroyed && (
                <g className="anim-thruster">
                  <polygon points="24,44 6,48 24,52" fill={p.flameOuter} />
                  <polygon points="24,46 13,48 24,50" fill={p.flameCore} />
                  <polygon points="24,68 6,72 24,76" fill={p.flameOuter} />
                  <polygon points="24,70 13,72 24,74" fill={p.flameCore} />
                </g>
              )}

              {/* Wide Swept Bomber Wings */}
              <polygon
                points="68,48 36,14 24,18 38,52"
                fill={p.hullMid}
                stroke={p.trim}
                strokeWidth="1.3"
              />
              <polygon
                points="68,72 36,106 24,102 38,68"
                fill={p.hullMid}
                stroke={p.trim}
                strokeWidth="1.3"
              />
              {/* Wing Accent Stripes */}
              <line x1="34" y1="22" x2="52" y2="41" stroke={accent} strokeWidth="2.4" />
              <line x1="34" y1="98" x2="52" y2="79" stroke={accent} strokeWidth="2.4" />

              {/* Under-Wing Bomb Bays / Ordnance Pods */}
              <rect
                x="44"
                y="26"
                width="24"
                height="9"
                rx="3"
                fill={p.hullDark}
                stroke={accent}
                strokeWidth="1.2"
              />
              <rect
                x="44"
                y="85"
                width="24"
                height="9"
                rx="3"
                fill={p.hullDark}
                stroke={accent}
                strokeWidth="1.2"
              />
              <circle cx="66" cy="30.5" r="2.2" fill={accent} />
              <circle cx="66" cy="89.5" r="2.2" fill={accent} />

              {/* Twin Engine Nacelles */}
              <rect x="22" y="42" width="18" height="12" rx="2" fill={p.hullDark} stroke={p.trim} strokeWidth="1.2" />
              <rect x="22" y="66" width="18" height="12" rx="2" fill={p.hullDark} stroke={p.trim} strokeWidth="1.2" />

              {/* Main Heavy Bomber Fuselage */}
              <polygon
                points="28,50 84,48 106,60 84,72 28,70"
                fill={p.hullLight}
                stroke={p.trim}
                strokeWidth="1.4"
              />
              <polygon
                points="40,54 78,53 92,60 78,67 40,66"
                fill={p.hullDark}
              />

              {/* Cockpit Canopy / Enemy Drone Eye */}
              {side === 'enemy' ? (
                <polygon points="74,56 90,60 74,64" fill={p.cockpit} />
              ) : (
                <ellipse cx="78" cy="60" rx="10" ry="4.5" fill={p.cockpit} opacity="0.92" />
              )}
              {/* Twin Nose Cannons */}
              <line x1="92" y1="54" x2="108" y2="54" stroke={p.trim} strokeWidth="1.6" />
              <line x1="92" y1="66" x2="108" y2="66" stroke={p.trim} strokeWidth="1.6" />
            </g>
          )}

          {/* ================= INTERCEPTOR: Slim Fast Dart Fighter ================= */}
          {classId === 'interceptor' && (
            <g>
              {/* High-Velocity Jet Plume */}
              {!destroyed && (
                <g className="anim-thruster">
                  <polygon points="24,54 2,60 24,66" fill={p.flameOuter} />
                  <polygon points="24,57 10,60 24,63" fill={p.flameCore} />
                </g>
              )}

              {/* Sleek Swept Razor Wings */}
              <polygon
                points="66,54 28,24 18,30 42,56"
                fill={p.hullMid}
                stroke={p.trim}
                strokeWidth="1.2"
              />
              <polygon
                points="66,66 28,96 18,90 42,64"
                fill={p.hullMid}
                stroke={p.trim}
                strokeWidth="1.2"
              />
              {/* Forward Stabilizer Canards */}
              <polygon
                points="88,56 76,42 70,45 80,56"
                fill={p.hullLight}
                stroke={accent}
                strokeWidth="1"
              />
              <polygon
                points="88,64 76,78 70,75 80,64"
                fill={p.hullLight}
                stroke={accent}
                strokeWidth="1"
              />
              {/* Wingtip Laser Emitters */}
              <line x1="28" y1="27" x2="46" y2="27" stroke={accent} strokeWidth="2" />
              <line x1="28" y1="93" x2="46" y2="93" stroke={accent} strokeWidth="2" />

              {/* Needle Dart Fuselage */}
              <polygon
                points="22,53 74,52 114,60 74,68 22,67"
                fill={p.hullLight}
                stroke={p.trim}
                strokeWidth="1.3"
              />
              <polygon
                points="34,56 76,56 104,60 76,64 34,64"
                fill={p.hullDark}
              />
              <line x1="36" y1="60" x2="108" y2="60" stroke={accent} strokeWidth="1.5" opacity="0.85" />

              {/* Streamlined Visor Canopy */}
              <polygon
                points="62,57 86,60 62,63 56,60"
                fill={p.cockpit}
              />
            </g>
          )}

          {/* ================= SIEGE: Bulky Gunship + Long Front Railcannon ================= */}
          {classId === 'siege' && (
            <g>
              {/* Twin Heavy Plasma Exhausts */}
              {!destroyed && (
                <g className="anim-thruster">
                  <polygon points="18,41 3,46 18,51" fill={p.flameOuter} />
                  <polygon points="18,44 9,46 18,48" fill={p.flameCore} />
                  <polygon points="18,69 3,74 18,79" fill={p.flameOuter} />
                  <polygon points="18,72 9,74 18,76" fill={p.flameCore} />
                </g>
              )}

              {/* Armored Heavy Sponsons */}
              <polygon
                points="20,30 66,30 78,44 20,44"
                fill={p.hullDark}
                stroke={p.trim}
                strokeWidth="1.4"
              />
              <polygon
                points="20,90 66,90 78,76 20,76"
                fill={p.hullDark}
                stroke={p.trim}
                strokeWidth="1.4"
              />
              <rect x="30" y="34" width="28" height="4" fill={accent} opacity="0.9" />
              <rect x="30" y="82" width="28" height="4" fill={accent} opacity="0.9" />

              {/* Bulky Main Gunship Core */}
              <polygon
                points="16,42 74,40 84,50 84,70 74,80 16,78"
                fill={p.hullMid}
                stroke={p.trim}
                strokeWidth="1.5"
              />
              <rect x="26" y="47" width="44" height="26" rx="3" fill={p.hullDark} stroke={p.hullLight} strokeWidth="1.1" />

              {/* Long Front Spinal Railcannon */}
              <rect
                x="56"
                y="53"
                width="58"
                height="5"
                rx="1"
                fill={p.hullLight}
                stroke={p.trim}
                strokeWidth="1.2"
              />
              <rect
                x="56"
                y="62"
                width="58"
                height="5"
                rx="1"
                fill={p.hullLight}
                stroke={p.trim}
                strokeWidth="1.2"
              />
              {/* Glowing Rail Charge Channel */}
              <rect
                x="62"
                y="58.5"
                width="50"
                height="3"
                fill={accent}
                opacity={destroyed ? 0.2 : 0.95}
              />

              {/* Armored Bridge Visor */}
              <rect x="34" y="55" width="14" height="10" rx="2" fill={p.cockpit} opacity="0.9" />
            </g>
          )}

          {/* ================= SUPPORT: Rounded Craft + Side Pods + Glowing Repair Beam Emitter ================= */}
          {classId === 'support' && (
            <g>
              {/* Rear Harmonic Thrusters */}
              {!destroyed && (
                <g className="anim-thruster">
                  <polygon points="24,52 6,60 24,68" fill={p.flameOuter} />
                  <polygon points="24,56 12,60 24,64" fill={p.flameCore} />
                </g>
              )}

              {/* Connecting Pylons */}
              <rect x="46" y="25" width="14" height="70" rx="2" fill={p.hullDark} stroke={p.trim} strokeWidth="1.2" />

              {/* Twin Side Capacitor / Repair Pods */}
              <ellipse
                cx="54"
                cy="24"
                rx="18"
                ry="9"
                fill={p.hullMid}
                stroke={accent}
                strokeWidth="1.4"
              />
              <ellipse
                cx="54"
                cy="96"
                rx="18"
                ry="9"
                fill={p.hullMid}
                stroke={accent}
                strokeWidth="1.4"
              />
              <circle cx="64" cy="24" r="3" fill={accent} opacity={destroyed ? 0.2 : 1} />
              <circle cx="64" cy="96" r="3" fill={accent} opacity={destroyed ? 0.2 : 1} />

              {/* Rounded Central Command Hull */}
              <ellipse
                cx="58"
                cy="60"
                rx="32"
                ry="24"
                fill={p.hullMid}
                stroke={p.trim}
                strokeWidth="1.5"
              />
              <ellipse
                cx="58"
                cy="60"
                rx="22"
                ry="15"
                fill={p.hullDark}
                stroke={accent}
                strokeWidth="1.1"
              />

              {/* Glowing Front Repair Beam Emitter */}
              <path
                d="M84 48 Q100 60 84 72"
                stroke={accent}
                strokeWidth="2.4"
                fill="none"
              />
              <circle
                cx="93"
                cy="60"
                r="6"
                fill={accent}
                opacity={destroyed ? 0.15 : 0.35}
              />
              <circle
                cx="93"
                cy="60"
                r="3.2"
                fill="#ECFDF5"
                opacity={destroyed ? 0.2 : 1}
              />

              {/* Command Dome */}
              <ellipse cx="62" cy="60" rx="9" ry="6" fill={p.cockpit} opacity="0.9" />
            </g>
          )}
        </g>

        {/* Impact Flash Overlay (on hit) */}
        {impactFlash && (
          <g className="anim-impact-flash">
            <circle cx="60" cy="60" r="28" fill="#FEF08A" opacity="0.7" />
            <polygon
              points="60,22 68,50 96,60 68,70 60,98 52,70 24,60 52,50"
              fill="#FFFFFF"
              opacity="0.9"
            />
          </g>
        )}

        {/* Explosion Shockwave Ring (on destroy) */}
        {exploding && (
          <g>
            <circle
              cx="60"
              cy="60"
              r="34"
              stroke="#F97316"
              strokeWidth="4"
              fill="#F59E0B"
              fillOpacity="0.35"
              className="anim-explosion-ring"
            />
          </g>
        )}
      </svg>

      {/* CSS Particle Burst on Destruction */}
      {exploding && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {SPARK_VECTORS.map((spark, i) => (
            <span
              key={i}
              className="absolute rounded-full anim-explosion-spark"
              style={
                {
                  width: `${spark.r * 2}px`,
                  height: `${spark.r * 2}px`,
                  backgroundColor: spark.color,
                  '--dx': spark.dx,
                  '--dy': spark.dy,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
