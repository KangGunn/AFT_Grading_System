import type { EventConfig, LaneConfig, TraineeRecord, Platoon } from '../../types/aft/aft.types';

export const EVENT_CONFIGS: EventConfig[] = [
  {
    id: 'mdl',
    name: '3-Rep Max Deadlift',
    code: 'MDL',
    unit: 'lbs',
    minVal: 80,
    maxVal: 350,
    step: 10,
    placeholder: '340',
    desc: 'Max weight successfully lifted 3 times (100 pts: 340-350 lbs depending on age group)'
  },
  {
    id: 'hrp',
    name: 'Hand-Release Push-Up',
    code: 'HRP',
    unit: 'reps',
    minVal: 10,
    maxVal: 62,
    step: 1,
    placeholder: '60',
    desc: 'Total correct reps completed in 2 minutes (100 pts: ~57-62 reps)'
  },
  {
    id: 'sdc',
    name: 'Sprint-Drag-Carry',
    code: 'SDC',
    unit: 'mm:ss',
    minVal: 60,
    maxVal: 300,
    step: 1,
    placeholder: '1:33',
    isTime: true,
    desc: '5x50m shuttle with sled & kettlebells (100 pts: ~1:30-1:38)'
  },
  {
    id: 'plk',
    name: 'Plank',
    code: 'PLK',
    unit: 'mm:ss',
    minVal: 60,
    maxVal: 240,
    step: 1,
    placeholder: '3:35',
    isTime: true,
    desc: 'Max time holding proper plank position (100 pts: ~3:30-3:40)'
  },
  {
    id: '2mr',
    name: '2-Mile Run',
    code: '2MR',
    unit: 'mm:ss',
    minVal: 600,
    maxVal: 1800,
    step: 1,
    placeholder: '13:22',
    isTime: true,
    desc: '2-Mile timed outdoor run (100 pts: ~13:20-14:00)'
  }
];

export const DEFAULT_VEST_COLOR_CODES: string[] = [
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#64748B'  // Gray
];

export const VEST_COLORS = [
  { name: 'Red', code: '#EF4444' },
  { name: 'Blue', code: '#3B82F6' },
  { name: 'Green', code: '#10B981' },
  { name: 'Yellow', code: '#F59E0B' },
  { name: 'Purple', code: '#8B5CF6' },
  { name: 'Pink', code: '#EC4899' },
  { name: 'Orange', code: '#F97316' },
  { name: 'Teal', code: '#14B8A6' },
  { name: 'Indigo', code: '#6366F1' },
  { name: 'Cyan', code: '#06B6D4' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Lime', code: '#84CC16' },
  { name: 'Rose', code: '#F43F5E' },
  { name: 'Gray', code: '#64748B' }
];

// LocalStorage Keys
export const STORAGE_KEY_TRAINEES = 'aft_trainees_lane_v2';
export const STORAGE_KEY_LANE_CONFIG = 'aft_lane_configs_v2';
export const STORAGE_KEY_ACTIVE_COUNTS = 'aft_lane_active_counts_v2';
export const STORAGE_KEY_RETEST_CUSTOM_TRAINEES = 'aft_retest_custom_trainees';
export const STORAGE_KEY_AVAILABLE_VEST_COLORS = 'aft_available_vest_colors';

export function loadAvailableVestColors(): string[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY_AVAILABLE_VEST_COLORS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((c: any) => typeof c === 'string' && c.startsWith('#'));
          if (valid.length > 0) return valid;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load available vest colors:', e);
  }
  return DEFAULT_VEST_COLOR_CODES;
}

export function saveAvailableVestColors(colors: string[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_AVAILABLE_VEST_COLORS, JSON.stringify(colors));
    }
  } catch (e) {
    console.warn('Failed to save available vest colors:', e);
  }
}

// Cohort Management Keys
export const STORAGE_KEY_ACTIVE_COHORT_ID = 'aft_active_cohort_id';
export const STORAGE_KEY_COHORTS_LIST = 'aft_cohorts_list';
export const DEFAULT_COHORT_NAME = '01-27';

// Platoon Management Keys (Alpha: RN <= 100, Bravo: RN >= 101)
export const STORAGE_KEY_ACTIVE_PLATOON = 'aft_active_platoon';

export const getCohortStorageKey = (cohortId: string, baseKey: string): string => {
  return `aft_c_${cohortId}_${baseKey}`;
};

export const getCohortPlatoonStorageKey = (cohortId: string, platoon: Platoon, baseKey: string): string => {
  return `aft_c_${cohortId}_${platoon}_${baseKey}`;
};

export const createDefaultLaneTrainees = (platoon: Platoon = 'alpha'): Record<number, TraineeRecord[]> => {
  const result: Record<number, TraineeRecord[]> = {};
  const baseRn = platoon === 'bravo' ? 100 : 0;

  for (let l = 1; l <= 10; l++) {
    const list: TraineeRecord[] = [];
    for (let r = 1; r <= 10; r++) {
      const rnNum = baseRn + (l - 1) * 10 + r;
      list.push({
        id: `lane-${l}-${platoon}-t-${r}`,
        rosterNumber: `${rnNum}`,
        vestNumber: `${r}`,
        name: `Trainee ${rnNum}`,
        age: 22,
        ageGroup: '22-26',
        isDummy: true,
        scores: {
          MDL: '',
          MDL2: '',
          HRP: '',
          SDC: '',
          PLK: '',
          '2MR': ''
        }
      });
    }
    result[l] = list;
  }
  return result;
};

export const createDefaultLaneConfigs = (): Record<number, LaneConfig> => {
  const result: Record<number, LaneConfig> = {};
  const available = loadAvailableVestColors();
  for (let l = 1; l <= 10; l++) {
    const colorCode = available[(l - 1) % available.length] || DEFAULT_VEST_COLOR_CODES[(l - 1) % DEFAULT_VEST_COLOR_CODES.length];
    result[l] = {
      laneNumber: l,
      vestColor: colorCode,
      vestColorCode: colorCode
    };
  }
  return result;
};

/**
 * Determines the next pending event index for a lane based on its trainees' scores.
 * 0: MDL, 1: HRP, 2: SDC, 3: PLK, 4: 2MR.
 * If all 5 events are completed, returns EVENT_CONFIGS.length (5), which opens the Result screen.
 */
export function getLanePendingEventIndex(trainees: TraineeRecord[]): number {
  if (!trainees || trainees.length === 0) return 0;

  for (let idx = 0; idx < EVENT_CONFIGS.length; idx++) {
    const code = EVENT_CONFIGS[idx].code;
    const isComplete = trainees.every((t) => {
      if (code === 'MDL') {
        return (t.scores?.MDL || '').trim() !== '' || (t.scores?.MDL2 || '').trim() !== '';
      }
      return (t.scores?.[code] || '').trim() !== '';
    });

    if (!isComplete) {
      return idx;
    }
  }

  return EVENT_CONFIGS.length;
}
