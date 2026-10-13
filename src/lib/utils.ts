/**
 * General utility helper functions
 */

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Returns '#FFFFFF' or '#0F172A' (dark slate) depending on background color brightness
 */
export function getContrastTextColor(hexColor?: string, colorName?: string): string {
  if (!hexColor) return '#FFFFFF';
  
  // If color name is White, Yellow, Cyan, Lime, etc. always return dark text
  const lowerName = (colorName || '').toLowerCase();
  if (lowerName === 'white' || lowerName === 'yellow' || lowerName === 'cyan' || lowerName === 'lime') {
    return '#0F172A';
  }

  // Calculate perceived luminance (YIQ formula)
  const hex = hexColor.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#0F172A' : '#FFFFFF';
  }

  return '#FFFFFF';
}
