/**
 * The brand mark: a pawn wearing a blindfold. The pawn takes the current text color; the band takes the studio
 * color, so it reads as a pale band on a black pawn in light mode and a dark band on a white pawn in dark mode.
 */
export function PawnMark({ size = 28, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g fill="currentColor">
        <circle cx="16" cy="8.4" r="5.1" />
        <rect x="10.4" y="14.1" width="11.2" height="2.7" rx="1.35" />
        <path d="M12.7 16.5c-.3 3.4-1.6 6.1-3.6 8.4h13.8c-2-2.3-3.3-5-3.6-8.4z" />
        <rect x="7.1" y="24.6" width="17.8" height="3.8" rx="1.9" />
      </g>
      {/* The blindfold: a band around the head with two tails at the knot. */}
      <g fill="var(--studio-hi, #fafafa)">
        <path d="M10.4 6.9c3.6-1.2 7.6-1.2 11.2 0v3c-3.6-1.2-7.6-1.2-11.2 0z" />
        <path d="M21.2 7.5c1.9-.7 3.7-.3 5.2 1.3-1.2-.1-2.2.1-3 .6 1.2.6 2 1.6 2.4 3.1-1.5-1.2-3-1.9-4.6-2z" />
      </g>
    </svg>
  );
}
