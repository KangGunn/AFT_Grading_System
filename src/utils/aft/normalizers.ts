import type { TraineeRecord } from '../../types/aft/aft.types';
import { createDefaultLaneTrainees } from './constants';

export const normalizeLaneTrainees = (raw: any): Record<number, TraineeRecord[]> => {
  const defaults = createDefaultLaneTrainees();
  if (!raw) return defaults;

  const result: Record<number, TraineeRecord[]> = {};

  if (Array.isArray(raw)) {
    // Detect whether array is 1-indexed (length > 10 or raw[0] is null/undefined) or 0-indexed
    const isOneIndexed = raw.length > 10 || (raw.length > 0 && (raw[0] === null || raw[0] === undefined));

    for (let l = 1; l <= 10; l++) {
      const idx = isOneIndexed ? l : l - 1;
      const list = raw[idx];
      if (Array.isArray(list) && list.filter(Boolean).length > 0) {
        result[l] = list.filter(Boolean);
      } else if (list && typeof list === 'object') {
        const items = Object.values(list).filter(Boolean) as TraineeRecord[];
        result[l] = items.length > 0 ? items : (defaults[l] || []);
      } else {
        result[l] = defaults[l] || [];
      }
    }
  } else if (typeof raw === 'object') {
    for (let l = 1; l <= 10; l++) {
      const list = raw[l] ?? raw[String(l)];
      if (Array.isArray(list) && list.filter(Boolean).length > 0) {
        result[l] = list.filter(Boolean);
      } else if (list && typeof list === 'object') {
        const items = Object.values(list).filter(Boolean) as TraineeRecord[];
        result[l] = items.length > 0 ? items : (defaults[l] || []);
      } else {
        result[l] = defaults[l] || [];
      }
    }
  } else {
    return defaults;
  }

  return result;
};

export const normalizeActiveCount = (raw: any): Record<number, number> => {
  const result: Record<number, number> = {};
  if (!raw) {
    for (let l = 1; l <= 10; l++) result[l] = 10;
    return result;
  }

  if (Array.isArray(raw)) {
    const isOneIndexed = raw.length > 10 || (raw.length > 0 && (raw[0] === null || raw[0] === undefined));
    for (let l = 1; l <= 10; l++) {
      const idx = isOneIndexed ? l : l - 1;
      const count = raw[idx];
      result[l] = typeof count === 'number' && count > 0 ? count : 10;
    }
  } else if (typeof raw === 'object') {
    for (let l = 1; l <= 10; l++) {
      const count = raw[l] ?? raw[String(l)];
      result[l] = typeof count === 'number' && count > 0 ? count : 10;
    }
  } else {
    for (let l = 1; l <= 10; l++) result[l] = 10;
  }

  return result;
};
