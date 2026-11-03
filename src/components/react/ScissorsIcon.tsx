interface Props {
  className?: string;
}

// Gunting dengan animasi SMIL (membuka-menutup loop) — disediakan pengguna.
export default function ScissorsIcon({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 430 435" aria-hidden="true">
      <defs>
        <g id="partA">
          <path d="M322,22 Q295,22 270,52 L172,205 Q165,222 172,240 L205,300 L238,300 L262,238 Z" />
          <path d="M205,285 L238,285 L222,322 L192,322 Z" />
          <path transform="rotate(12 180 365)" fillRule="evenodd" d="M128,365 a52,58 0 1,0 104,0 a52,58 0 1,0 -104,0 Z M153,367 a27,31 0 1,0 54,0 a27,31 0 1,0 -54,0 Z" />
        </g>
        <g id="partB">
          <path d="M298,148 L405,105 Q412,122 395,142 Q335,195 262,240 L225,232 Z" />
          <path d="M108,240 L128,212 Q150,205 175,205 L230,205 L232,238 L150,255 Z" />
          <path transform="rotate(-28 62 250)" fillRule="evenodd" d="M7,250 a55,42 0 1,0 110,0 a55,42 0 1,0 -110,0 Z M32,252 a30,20 0 1,0 60,0 a30,20 0 1,0 -60,0 Z" />
        </g>
      </defs>

      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          dur="1.4s"
          repeatCount="indefinite"
          calcMode="spline"
          keyTimes="0;0.1;0.35;0.4;0.8;1"
          values="0 213 213;0 213 213;-15 213 213;-15 213 213;0 213 213;0 213 213"
          keySplines="0 0 1 1;0.5 0 0.9 0.5;0 0 1 1;0.3 0 0.3 1;0 0 1 1"
        />
        <use xlinkHref="#partB" fill="#000" />
      </g>

      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          dur="1.4s"
          repeatCount="indefinite"
          calcMode="spline"
          keyTimes="0;0.1;0.35;0.4;0.8;1"
          values="0 213 213;0 213 213;15 213 213;15 213 213;0 213 213;0 213 213"
          keySplines="0 0 1 1;0.5 0 0.9 0.5;0 0 1 1;0.3 0 0.3 1;0 0 1 1"
        />
        <use xlinkHref="#partA" fill="#000" />
      </g>

      <rect x="204" y="204" width="18" height="18" fill="#fff" transform="rotate(15 213 213)" />
    </svg>
  );
}