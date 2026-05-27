// Maps direction indications to SVG arrow components
function getArrows(indications: string[]): { straight: boolean; slightRight: boolean; right: boolean; slightLeft: boolean; left: boolean; uturn: boolean } {
  const r = { straight: false, slightRight: false, right: false, slightLeft: false, left: false, uturn: false };
  for (const i of indications) {
    if (i === 'straight') r.straight = true;
    if (i === 'slight right') r.slightRight = true;
    if (i === 'right') r.right = true;
    if (i === 'slight left') r.slightLeft = true;
    if (i === 'left') r.left = true;
    if (i === 'uturn') r.uturn = true;
  }
  return r;
}

export function LaneArrow({ indications, color, size = 20 }: { indications: string[]; color: string; size?: number }) {
  const dirs = getArrows(indications);

  if (dirs.uturn) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 22V10a4 4 0 00-8 0v2M4 10l3-3 3 3" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (dirs.left || dirs.slightLeft) {
    const d = dirs.left ? 'M16 19H8l-3-3 3-3' : 'M16 19H9l-2-2 2-2';
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={d} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {dirs.straight && <path d="M8 12V5" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.3} />}
      </svg>
    );
  }

  if (dirs.right || dirs.slightRight) {
    const d = dirs.right ? 'M8 19h8l3-3-3-3' : 'M8 19h7l2-2-2-2';
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={d} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {dirs.straight && <path d="M16 12V5" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.3} />}
      </svg>
    );
  }

  // Straight only
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 19V5M8 9l4-4 4 4" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function getLaneLabel(indications: string[]): string {
  if (indications.length === 0) return '';
  if (indications.includes('uturn')) return 'U-turn';
  if (indications.includes('left')) return 'Left';
  if (indications.includes('slight left')) return 'Slight left';
  if (indications.includes('right')) return 'Right';
  if (indications.includes('slight right')) return 'Slight right';
  if (indications.includes('straight')) return 'Straight';
  return '';
}
