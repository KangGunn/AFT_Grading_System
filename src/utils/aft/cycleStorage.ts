import type { CohortRecord, LaneConfig, TraineeRecord, Platoon } from '../../types/aft/aft.types';
import {
  STORAGE_KEY_TRAINEES,
  STORAGE_KEY_LANE_CONFIG,
  STORAGE_KEY_ACTIVE_COUNTS,
  STORAGE_KEY_RETEST_CUSTOM_TRAINEES,
  STORAGE_KEY_ACTIVE_COHORT_ID,
  STORAGE_KEY_COHORTS_LIST,
  STORAGE_KEY_ACTIVE_PLATOON,
  DEFAULT_COHORT_NAME,
  getCohortStorageKey,
  getCohortPlatoonStorageKey,
  createDefaultLaneTrainees,
  createDefaultLaneConfigs
} from './constants';
import { normalizeLaneTrainees, normalizeActiveCount, normalizeCustomTrainees } from './normalizers';

/**
 * Sanitizes cohort name for safe usage as a Firebase RTDB key and storage key.
 */
export function sanitizeCohortId(name: string): string {
  const sanitized = name.trim().replace(/[.#$\[\]/]/g, '_');
  return sanitized.length > 0 ? sanitized : `cohort-${Date.now()}`;
}

export interface LoadedPlatoonData {
  laneTrainees: Record<number, TraineeRecord[]>;
  laneConfigs: Record<number, LaneConfig>;
  activeCountByLane: Record<number, number>;
  retestCustomTrainees: TraineeRecord[];
}

/**
 * Accurately calculates total active trainees from activeCountByLane or laneTrainees.
 */
export function calculateActiveTraineeCount(
  activeCountByLane?: Record<number, number>,
  laneTrainees?: Record<number, TraineeRecord[]>
): number {
  if (activeCountByLane) {
    let sum = 0;
    let hasCount = false;
    for (let l = 1; l <= 10; l++) {
      if (typeof activeCountByLane[l] === 'number') {
        sum += activeCountByLane[l];
        hasCount = true;
      }
    }
    if (hasCount) return sum;
  }

  if (laneTrainees) {
    let sum = 0;
    for (let l = 1; l <= 10; l++) {
      sum += laneTrainees[l]?.length || 0;
    }
    return sum;
  }

  return 0;
}

/**
 * Helper to identify whether a trainee record was uploaded from Excel
 * vs generated as a default dummy record.
 */
export function isUploadedTrainee(t: TraineeRecord): boolean {
  if (!t) return false;
  if (t.isDummy === true) return false;
  if (t.isDummy === false) return true;
  if (t.id && t.id.startsWith('imp-')) return true;
  if (t.id && t.id.startsWith('lane-')) return false;
  if (/^Trainee\s+\d+$/i.test(t.name?.trim() || '')) return false;
  return true;
}

/**
 * Counts only valid uploaded trainees for a given cohort and platoon.
 * Directly inspects stored trainee records.
 * Default dummy trainees are NEVER counted.
 */
export function countUploadedTraineesInPlatoon(cohortId: string, platoon: Platoon): number {
  if (typeof window === 'undefined') return 0;
  try {
    // 1. Inspect actual trainees stored in platoon storage key
    const rawT = window.localStorage.getItem(getCohortPlatoonStorageKey(cohortId, platoon, STORAGE_KEY_TRAINEES));
    let laneData: Record<number, TraineeRecord[]> | null = null;

    if (rawT) {
      try { laneData = JSON.parse(rawT); } catch {}
    }

    // 2. Legacy fallback for default cohort 01-27 alpha
    if (!laneData && platoon === 'alpha' && (cohortId === DEFAULT_COHORT_NAME || cohortId === '01-27')) {
      const legRaw = window.localStorage.getItem(STORAGE_KEY_TRAINEES);
      if (legRaw) {
        try { laneData = JSON.parse(legRaw); } catch {}
      }
    }

    if (laneData) {
      let count = 0;
      for (let l = 1; l <= 10; l++) {
        const laneList = laneData[l] || [];
        for (const t of laneList) {
          if (isUploadedTrainee(t)) {
            count++;
          }
        }
      }
      return count;
    }

    // 3. Fallback: check explicit uploaded count if no trainee data was stored at all
    const explicitCount = window.localStorage.getItem(`aft_c_${cohortId}_${platoon}_uploaded_count`);
    if (explicitCount !== null) {
      const parsed = parseInt(explicitCount, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {}
  return 0;
}

/**
 * Checks whether a platoon contains dummy data (i.e. not uploaded from Excel).
 */
export function isPlatoonDummyData(cohortId: string, platoon: Platoon): boolean {
  return countUploadedTraineesInPlatoon(cohortId, platoon) === 0;
}

/**
 * Checks whether a platoon has an uploaded trainee roster.
 */
export function isPlatoonRosterUploaded(cohortId: string, platoon: Platoon): boolean {
  return countUploadedTraineesInPlatoon(cohortId, platoon) > 0;
}

/**
 * Retrieves the count of trainees for Alpha and Bravo platoons in a cohort.
 * Only valid uploaded trainees are counted; default dummy trainees are excluded.
 */
export function getCohortPlatoonCounts(cohortId: string): {
  alpha: number;
  bravo: number;
  total: number;
  hasUploaded: boolean;
} {
  const alpha = countUploadedTraineesInPlatoon(cohortId, 'alpha');
  const bravo = countUploadedTraineesInPlatoon(cohortId, 'bravo');
  const total = alpha + bravo;
  const hasUploaded = total > 0;

  return {
    alpha,
    bravo,
    total,
    hasUploaded
  };
}

/**
 * Checks whether a cohort has an uploaded trainee roster.
 */
export function isCohortRosterUploaded(cohortId: string): boolean {
  return getCohortPlatoonCounts(cohortId).hasUploaded;
}

/**
 * Loads the active platoon from storage ('alpha' by default).
 */
export function loadActivePlatoonFromStorage(): Platoon {
  if (typeof window === 'undefined') return 'alpha';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY_ACTIVE_PLATOON);
    if (saved === 'alpha' || saved === 'bravo') return saved;
  } catch {}
  return 'alpha';
}

/**
 * Loads platoon-specific data for a cohort from localStorage.
 */
export function loadCohortPlatoonDataFromStorage(cohortId: string, platoon: Platoon): LoadedPlatoonData {
  const defaultTrainees = createDefaultLaneTrainees(platoon);
  const defaultConfigs = createDefaultLaneConfigs();
  const defaultCounts: Record<number, number> = {};
  for (let i = 1; i <= 10; i++) defaultCounts[i] = 10;

  if (typeof window === 'undefined') {
    return {
      laneTrainees: defaultTrainees,
      laneConfigs: defaultConfigs,
      activeCountByLane: defaultCounts,
      retestCustomTrainees: []
    };
  }

  let laneTrainees: Record<number, TraineeRecord[]> | null = null;
  let laneConfigs: Record<number, LaneConfig> | null = null;
  let activeCountByLane: Record<number, number> | null = null;
  let retestCustomTrainees: TraineeRecord[] | null = null;

  try {
    // 1. Platoon-specific trainees
    const rawT = window.localStorage.getItem(getCohortPlatoonStorageKey(cohortId, platoon, STORAGE_KEY_TRAINEES));
    if (rawT) laneTrainees = normalizeLaneTrainees(JSON.parse(rawT));

    // 2. Platoon-specific active counts
    const rawA = window.localStorage.getItem(getCohortPlatoonStorageKey(cohortId, platoon, STORAGE_KEY_ACTIVE_COUNTS));
    if (rawA) activeCountByLane = normalizeActiveCount(JSON.parse(rawA));

    // 3. Platoon-specific retests
    const rawR = window.localStorage.getItem(getCohortPlatoonStorageKey(cohortId, platoon, STORAGE_KEY_RETEST_CUSTOM_TRAINEES));
    if (rawR) retestCustomTrainees = normalizeCustomTrainees(JSON.parse(rawR));

    // 4. Cohort lane vest configs
    const rawC = window.localStorage.getItem(getCohortStorageKey(cohortId, STORAGE_KEY_LANE_CONFIG)) ||
                 window.localStorage.getItem(STORAGE_KEY_LANE_CONFIG);
    if (rawC) laneConfigs = JSON.parse(rawC);
  } catch (e) {
    console.warn(`Error loading platoon data for cohort ${cohortId} platoon ${platoon}:`, e);
  }

  // Legacy fallback for Alpha if empty
  if (!laneTrainees && platoon === 'alpha') {
    try {
      const rawLegacyT = window.localStorage.getItem(getCohortStorageKey(cohortId, STORAGE_KEY_TRAINEES)) ||
                         window.localStorage.getItem(STORAGE_KEY_TRAINEES);
      if (rawLegacyT) laneTrainees = normalizeLaneTrainees(JSON.parse(rawLegacyT));

      const rawLegacyA = window.localStorage.getItem(getCohortStorageKey(cohortId, STORAGE_KEY_ACTIVE_COUNTS)) ||
                         window.localStorage.getItem(STORAGE_KEY_ACTIVE_COUNTS);
      if (rawLegacyA) activeCountByLane = normalizeActiveCount(JSON.parse(rawLegacyA));
    } catch {}
  }

  return {
    laneTrainees: laneTrainees || defaultTrainees,
    laneConfigs: laneConfigs || defaultConfigs,
    activeCountByLane: activeCountByLane || defaultCounts,
    retestCustomTrainees: retestCustomTrainees || []
  };
}

/**
 * Saves platoon-specific data for a cohort into localStorage.
 */
export function saveCohortPlatoonDataToStorage(
  cohortId: string,
  platoon: Platoon,
  data: {
    laneTrainees?: Record<number, TraineeRecord[]>;
    laneConfigs?: Record<number, LaneConfig>;
    activeCountByLane?: Record<number, number>;
    retestCustomTrainees?: TraineeRecord[];
  }
) {
  if (typeof window === 'undefined') return;

  try {
    if (data.laneTrainees) {
      window.localStorage.setItem(
        getCohortPlatoonStorageKey(cohortId, platoon, STORAGE_KEY_TRAINEES),
        JSON.stringify(data.laneTrainees)
      );
    }
    if (data.activeCountByLane) {
      window.localStorage.setItem(
        getCohortPlatoonStorageKey(cohortId, platoon, STORAGE_KEY_ACTIVE_COUNTS),
        JSON.stringify(data.activeCountByLane)
      );
    }
    if (data.retestCustomTrainees) {
      window.localStorage.setItem(
        getCohortPlatoonStorageKey(cohortId, platoon, STORAGE_KEY_RETEST_CUSTOM_TRAINEES),
        JSON.stringify(data.retestCustomTrainees)
      );
    }
    if (data.laneConfigs) {
      window.localStorage.setItem(
        getCohortStorageKey(cohortId, STORAGE_KEY_LANE_CONFIG),
        JSON.stringify(data.laneConfigs)
      );
    }
  } catch (e) {
    console.warn(`Error saving platoon data for ${cohortId} ${platoon}:`, e);
  }
}

/**
 * Loads the cohort metadata list from localStorage.
 */
export function loadCohortsListFromStorage(): CohortRecord[] {
  if (typeof window === 'undefined') {
    return [{
      id: DEFAULT_COHORT_NAME,
      name: DEFAULT_COHORT_NAME,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hasUploadedRoster: false
    }];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_COHORTS_LIST);
    if (raw) {
      const parsed: CohortRecord[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Guarantee default cohort is preserved
        const hasDefault = parsed.some(c => c.id === DEFAULT_COHORT_NAME || c.name === DEFAULT_COHORT_NAME);
        if (!hasDefault) {
          const defaultCohort: CohortRecord = {
            id: DEFAULT_COHORT_NAME,
            name: DEFAULT_COHORT_NAME,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            hasUploadedRoster: isCohortRosterUploaded(DEFAULT_COHORT_NAME)
          };
          parsed.unshift(defaultCohort);
        }

        // Refresh accurate platoon counts & upload flags
        const refreshed = parsed.map(c => {
          const counts = getCohortPlatoonCounts(c.id);
          const alpha = counts.hasUploaded ? counts.alpha : (typeof c.alphaTraineeCount === 'number' ? c.alphaTraineeCount : 0);
          const bravo = counts.hasUploaded ? counts.bravo : (typeof c.bravoTraineeCount === 'number' ? c.bravoTraineeCount : 0);
          const total = alpha + bravo;
          const hasUploaded = total > 0;

          return {
            ...c,
            hasUploadedRoster: hasUploaded,
            alphaTraineeCount: alpha,
            bravoTraineeCount: bravo,
            traineeCount: total
          };
        });

        window.localStorage.setItem(STORAGE_KEY_COHORTS_LIST, JSON.stringify(refreshed));
        return refreshed;
      }
    }
  } catch (e) {
    console.error('Failed to parse cohorts list from localStorage:', e);
  }

  // Initial cohort setup
  const initialUploaded = isCohortRosterUploaded(DEFAULT_COHORT_NAME);
  const initialCohort: CohortRecord = {
    id: DEFAULT_COHORT_NAME,
    name: DEFAULT_COHORT_NAME,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hasUploadedRoster: initialUploaded,
    alphaTraineeCount: initialUploaded ? getCohortPlatoonCounts(DEFAULT_COHORT_NAME).alpha : 0,
    bravoTraineeCount: initialUploaded ? getCohortPlatoonCounts(DEFAULT_COHORT_NAME).bravo : 0,
    traineeCount: initialUploaded ? getCohortPlatoonCounts(DEFAULT_COHORT_NAME).total : 0
  };

  const initialList = [initialCohort];
  try {
    window.localStorage.setItem(STORAGE_KEY_COHORTS_LIST, JSON.stringify(initialList));
    window.localStorage.setItem(STORAGE_KEY_ACTIVE_COHORT_ID, initialCohort.id);
  } catch {}

  return initialList;
}

export function loadActiveCohortIdFromStorage(): string {
  if (typeof window === 'undefined') return DEFAULT_COHORT_NAME;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY_ACTIVE_COHORT_ID);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return DEFAULT_COHORT_NAME;
}

export function removeCohortDataFromStorage(cohortId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getCohortStorageKey(cohortId, STORAGE_KEY_LANE_CONFIG));
    window.localStorage.removeItem(`aft_c_${cohortId}_roster_uploaded`);
    for (const p of ['alpha', 'bravo'] as Platoon[]) {
      window.localStorage.removeItem(getCohortPlatoonStorageKey(cohortId, p, STORAGE_KEY_TRAINEES));
      window.localStorage.removeItem(getCohortPlatoonStorageKey(cohortId, p, STORAGE_KEY_ACTIVE_COUNTS));
      window.localStorage.removeItem(getCohortPlatoonStorageKey(cohortId, p, STORAGE_KEY_RETEST_CUSTOM_TRAINEES));
    }
  } catch (e) {
    console.warn(`Error removing cohort storage for ${cohortId}:`, e);
  }
}

// Cycle-named aliases
export const sanitizeCycleId = sanitizeCohortId;
export const getCyclePlatoonCounts = getCohortPlatoonCounts;
export const isCycleRosterUploaded = isCohortRosterUploaded;
export const loadCyclePlatoonDataFromStorage = loadCohortPlatoonDataFromStorage;
export const saveCyclePlatoonDataToStorage = saveCohortPlatoonDataToStorage;
export const removeCycleDataFromStorage = removeCohortDataFromStorage;
export const loadCyclesListFromStorage = loadCohortsListFromStorage;
export const loadActiveCycleIdFromStorage = loadActiveCohortIdFromStorage;

