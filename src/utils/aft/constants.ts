import type { EventConfig, LaneConfig, TraineeRecord } from '../../types/aft/aft.types';

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

export const STORAGE_KEY_TRAINEES = 'aft_trainees_lane_v2';
export const STORAGE_KEY_LANE_CONFIG = 'aft_lane_configs_v2';
export const STORAGE_KEY_ACTIVE_COUNTS = 'aft_lane_active_counts_v2';
export const STORAGE_KEY_RETEST_CUSTOM_TRAINEES = 'aft_retest_custom_trainees';

export const createDefaultLaneTrainees = (): Record<number, TraineeRecord[]> => {
  const result: Record<number, TraineeRecord[]> = {};
  for (let l = 1; l <= 10; l++) {
    const list: TraineeRecord[] = [];
    for (let r = 1; r <= 10; r++) {
      list.push({
        id: `lane-${l}-t-${r}`,
        rosterNumber: `${(l - 1) * 10 + r}`,
        vestNumber: `${r}`,
        name: `Trainee ${(l - 1) * 10 + r}`,
        age: 22,
        ageGroup: '22-26',
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
  for (let l = 1; l <= 10; l++) {
    const color = VEST_COLORS[(l - 1) % VEST_COLORS.length];
    result[l] = {
      laneNumber: l,
      vestColor: color.name,
      vestColorCode: color.code
    };
  }
  return result;
};
