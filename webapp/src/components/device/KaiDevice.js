// Stylised illustration of the Kai voice device (green body, smiling screen,
// speaker grille). Inline SVG so it scales crisply and needs no asset file.
export default function KaiDevice({ className }) {
  return (
    <svg
      viewBox="0 0 150 110"
      className={className}
      role="img"
      aria-label="Kai voice device"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="kaiBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#83a193" />
          <stop offset="1" stopColor="#465d4f" />
        </linearGradient>
      </defs>

      <rect x="8" y="16" width="134" height="80" rx="26" fill="url(#kaiBody)" />
      <rect x="8" y="16" width="134" height="34" rx="26" fill="#ffffff" opacity="0.08" />

      <g fill="#2f3f36" opacity="0.6">
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 6 }).map((_, c) => (
            <circle key={`${r}-${c}`} cx={88 + c * 8} cy={44 + r * 9} r="1.7" />
          )),
        )}
      </g>

      <rect x="20" y="30" width="52" height="52" rx="15" fill="#0e120e" />
      <circle cx="46" cy="56" r="22" fill="#181d18" />
      <circle cx="39" cy="50" r="3.6" fill="#ffffff" />
      <circle cx="53" cy="50" r="3.6" fill="#ffffff" />
      <path
        d="M38 60 q8 8 16 0"
        stroke="#ffffff"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />

      <text
        x="124"
        y="32"
        textAnchor="end"
        fontSize="13"
        fontWeight="700"
        fill="#2f3f36"
        opacity="0.85"
      >
        kai
      </text>
    </svg>
  );
}
