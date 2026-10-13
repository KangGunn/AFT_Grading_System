import type { AgeGroup } from '../../types/aft/aft.types';

export function getAgeGroupFromAge(age: number): AgeGroup {
  if (age <= 21) return '17-21';
  if (age <= 26) return '22-26';
  if (age <= 31) return '27-31';
  if (age <= 36) return '32-36';
  if (age <= 41) return '37-41';
  if (age <= 46) return '42-46';
  if (age <= 51) return '47-51';
  if (age <= 56) return '52-56';
  if (age <= 61) return '57-61';
  return '62+';
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${m}:${s.toString().padStart(2, '0')}.${tenths}`;
}

export function parseTimeString(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10) || 0;
      const s = parseInt(parts[1], 10) || 0;
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
    return trimmed;
  }

  // Pure digits auto-conversion
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 1 || digits.length === 2) {
    const s = parseInt(digits, 10);
    return `0:${s.toString().padStart(2, '0')}`;
  } else if (digits.length === 3) {
    const m = parseInt(digits.slice(0, 1), 10);
    const s = parseInt(digits.slice(1), 10);
    return `${m}:${s.toString().padStart(2, '0')}`;
  } else {
    const m = parseInt(digits.slice(0, digits.length - 2), 10);
    const s = parseInt(digits.slice(digits.length - 2), 10);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const trimmed = timeStr.trim();
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const m = parseInt(parts[0], 10) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  }
  return parseFloat(trimmed) || 0;
}

