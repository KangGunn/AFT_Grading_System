import type { TraineeRecord, LaneConfig } from '../../types/aft/aft.types';
import { calculateOfficialAftScore } from '../../data/aftStandards2025';
import { parseTimeToSeconds } from './timeFormatter';

/**
 * Checks if a trainee has completed all 5 events and resulted in FAIL.
 * Incomplete trainees (missing any event) are NOT considered failed.
 */
export function isTraineeFailed(trainee: TraineeRecord): boolean {
  const hasMdl = (trainee.scores.MDL || '').trim() !== '' || (trainee.scores.MDL2 || '').trim() !== '';
  const hasHrp = (trainee.scores.HRP || '').trim() !== '';
  const hasSdc = (trainee.scores.SDC || '').trim() !== '';
  const hasPlk = (trainee.scores.PLK || '').trim() !== '';
  const hasTmr = (trainee.scores['2MR'] || '').trim() !== '';

  const allCompleted = hasMdl && hasHrp && hasSdc && hasPlk && hasTmr;
  if (!allCompleted) {
    return false; // Incomplete trainees are excluded
  }

  // Calculate initial event scores
  const m1 = (trainee.scores.MDL || '').trim();
  const m2 = (trainee.scores.MDL2 || '').trim();
  const v1 = m1 !== '' ? parseFloat(m1) || 0 : -1;
  const v2 = m2 !== '' ? parseFloat(m2) || 0 : -1;
  const bestMdl = Math.max(v1 >= 0 ? v1 : 0, v2 >= 0 ? v2 : 0);
  const mdlScore = calculateOfficialAftScore('MDL', bestMdl, trainee.ageGroup);

  const hrpVal = parseFloat(trainee.scores.HRP || '0') || 0;
  const hrpScore = calculateOfficialAftScore('HRP', hrpVal, trainee.ageGroup);

  const sdcSec = parseTimeToSeconds(trainee.scores.SDC || '');
  const sdcScore = calculateOfficialAftScore('SDC', sdcSec, trainee.ageGroup);

  const plkSec = parseTimeToSeconds(trainee.scores.PLK || '');
  const plkScore = calculateOfficialAftScore('PLK', plkSec, trainee.ageGroup);

  const tmrSec = parseTimeToSeconds(trainee.scores['2MR'] || '');
  const tmrScore = calculateOfficialAftScore('2MR', tmrSec, trainee.ageGroup);

  const passedCount =
    (mdlScore >= 60 ? 1 : 0) +
    (hrpScore >= 60 ? 1 : 0) +
    (sdcScore >= 60 ? 1 : 0) +
    (plkScore >= 60 ? 1 : 0) +
    (tmrScore >= 60 ? 1 : 0);

  const totalScore = mdlScore + hrpScore + sdcScore + plkScore + tmrScore;
  const isPassed = passedCount === 5 && totalScore >= 300;

  return !isPassed; // Completed but failed to meet pass standards
}

export interface FailedTraineeRecord extends TraineeRecord {
  originalLane: number;
}

/**
 * Collects all trainees across all lanes who strictly FAILED their initial test.
 * Sorted numerically by rosterNumber.
 */
export function getStrictFailedTrainees(
  laneTrainees: Record<number, TraineeRecord[]>,
  activeCountByLane: Record<number, number>
): FailedTraineeRecord[] {
  const failedList: FailedTraineeRecord[] = [];

  for (let lane = 1; lane <= 10; lane++) {
    const list = laneTrainees[lane] || [];
    const count = activeCountByLane[lane] ?? list.length;
    const activeTrainees = list.slice(0, count);

    for (const t of activeTrainees) {
      if (isTraineeFailed(t)) {
        failedList.push({
          ...t,
          originalLane: lane
        });
      }
    }
  }

  failedList.sort((a, b) => {
    const numA = parseInt(a.rosterNumber.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.rosterNumber.replace(/\D/g, '') || '0', 10);
    if (numA !== numB) return numA - numB;
    return a.rosterNumber.localeCompare(b.rosterNumber);
  });

  return failedList;
}

/**
 * Config for the Re-Test Lane
 */
export const RETEST_LANE_NUM = 99;

export const RETEST_LANE_CONFIG: LaneConfig = {
  laneNumber: RETEST_LANE_NUM,
  vestColor: 'Red',
  vestColorCode: '#EF4444'
};
