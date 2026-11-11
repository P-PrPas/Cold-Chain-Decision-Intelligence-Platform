import { useId } from "react";

const ROUTE = "M6 46 C20 46 20 20 32 20 C44 20 44 46 58 46";

/** "The Gap": one route stroke, cold blue to amber, with one visible break. */
export function BrandMark({
  size = 32,
  mono = false,
  className = "brand-mark",
}: {
  size?: number;
  mono?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {mono ? null : (
        <defs>
          <linearGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            x1="6"
            y1="0"
            x2="58"
            y2="0"
          >
            <stop offset="0" stopColor="var(--temp-cold)" />
            <stop offset="0.45" stopColor="var(--temp-cool)" />
            <stop offset="1" stopColor="var(--temp-warm)" />
          </linearGradient>
        </defs>
      )}
      <path
        d={ROUTE}
        pathLength={100}
        fill="none"
        stroke={mono ? "currentColor" : `url(#${id})`}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray="44 12 44"
      />
    </svg>
  );
}
