import * as XLSX from 'xlsx';
import type { TraineeRecord } from '../../types/aft/aft.types';
import { getAgeGroupFromAge } from './timeFormatter';

export interface PlatoonRosterResult {
  parsedTraineesByLane: Record<number, TraineeRecord[]>;
  counts: Record<number, number>;
  totalTrainees: number;
}

export interface ParseExcelResult {
  alpha: PlatoonRosterResult;
  bravo: PlatoonRosterResult;
  totalTrainees: number;
  parsedTraineesByLane: Record<number, TraineeRecord[]>;
  counts: Record<number, number>;
  alphaDate?: string;
  bravoDate?: string;
}

function isIntegerCell(val: unknown): boolean {
  if (val === undefined || val === null || val === '') return false;
  const num = typeof val === 'number' ? val : Number(String(val).trim());
  return !isNaN(num) && Number.isInteger(num);
}

function isStringNameCell(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  const str = String(val).trim();
  if (!str) return false;
  const num = Number(str);
  return isNaN(num);
}

function isAgeCell(val: unknown): boolean {
  if (!isIntegerCell(val)) return false;
  const num = typeof val === 'number' ? val : Number(String(val).trim());
  return num > 0 && num <= 120;
}

function distributeTraineesAcrossLanes(
  rawList: { rn: string; name: string; age: number }[],
  platoon: 'alpha' | 'bravo'
): PlatoonRosterResult {
  const numLanes = 10;
  const total = rawList.length;
  const counts: Record<number, number> = {};
  const parsedTraineesByLane: Record<number, TraineeRecord[]> = {};

  if (total === 0) {
    for (let l = 1; l <= numLanes; l++) {
      counts[l] = 0;
      parsedTraineesByLane[l] = [];
    }
    return {
      parsedTraineesByLane,
      counts,
      totalTrainees: 0
    };
  }

  const baseCount = Math.floor(total / numLanes);
  const remainder = total % numLanes;

  for (let l = 1; l <= numLanes; l++) {
    counts[l] = l <= remainder ? baseCount + 1 : baseCount;
  }

  let pointer = 0;
  for (let l = 1; l <= numLanes; l++) {
    const laneCount = counts[l];
    const list: TraineeRecord[] = [];
    for (let pos = 1; pos <= laneCount; pos++) {
      if (pointer < rawList.length) {
        const item = rawList[pointer++];
        list.push({
          id: `imp-${platoon}-l${l}-p${pos}-${Date.now()}`,
          rosterNumber: item.rn,
          vestNumber: `${pos}`,
          name: item.name,
          age: item.age,
          ageGroup: getAgeGroupFromAge(item.age),
          isDummy: false,
          scores: { MDL: '', MDL2: '', HRP: '', SDC: '', PLK: '', '2MR': '' }
        });
      }
    }
    parsedTraineesByLane[l] = list;
  }

  return {
    parsedTraineesByLane,
    counts,
    totalTrainees: total
  };
}

export function parseTraineeExcel(fileData: string | ArrayBuffer): ParseExcelResult {
  const wb = XLSX.read(fileData, { type: 'binary' });
  let wsName = wb.Sheets['Main'] ? 'Main' : wb.SheetNames[0];
  let ws = wb.Sheets[wsName];
  let rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  if (!rows || rows.length < 1) {
    for (const name of wb.SheetNames) {
      const candidateWs = wb.Sheets[name];
      const candidateRows = XLSX.utils.sheet_to_json(candidateWs, { header: 1 }) as unknown[][];
      if (candidateRows && candidateRows.length > 0) {
        wsName = name;
        ws = candidateWs;
        rows = candidateRows;
        break;
      }
    }
  }

  if (!rows || rows.length < 1) {
    throw new Error('Empty or invalid Excel sheet.');
  }

  // 1. Check if the first row is data (Column 0: int RN, Column 1: string Name, Column 2: int Age)
  const firstRow = (rows[0] as unknown[]) || [];
  const isFirstRowData =
    firstRow.length >= 3 &&
    isIntegerCell(firstRow[0]) &&
    isStringNameCell(firstRow[1]) &&
    isAgeCell(firstRow[2]);

  let startRowIndex = 0;
  let rosterIdx = 0;
  let nameIdx = 1;
  let ageIdx = 2;
  let dateIdx = -1;

  if (!isFirstRowData) {
    // Treat first row as Header
    startRowIndex = 1;
    const header = firstRow.map(h => String(h || '').trim().toLowerCase());
    const detectedRoster = header.findIndex(
      h => h === 'rn' || h.includes('roster') || h.includes('number') || h.includes('no') || h.includes('num') || h.includes('순번') || h.includes('번호') || h.includes('교번')
    );
    const detectedName = header.findIndex(
      h => h.includes('name') || h.includes('이름') || h.includes('성명') || h.includes('trainee')
    );
    const detectedAge = header.findIndex(
      h => h.includes('age') || h.includes('나이') || h.includes('연령')
    );

    if (detectedRoster !== -1) rosterIdx = detectedRoster;
    if (detectedName !== -1) nameIdx = detectedName;
    if (detectedAge !== -1) ageIdx = detectedAge;
    const detectedDate = header.findIndex(
      h => h === 'date' || h.includes('date') || h.includes('날짜') || h.includes('일자')
    );
    if (detectedDate !== -1) dateIdx = detectedDate;
  }

  // Collect all valid trainee rows and separate into Alpha (RN <= 100) and Bravo (RN >= 101)
  const alphaRaw: { rn: string; name: string; age: number }[] = [];
  const bravoRaw: { rn: string; name: string; age: number }[] = [];
  let alphaDate: string | undefined = undefined;
  let bravoDate: string | undefined = undefined;

  for (let i = startRowIndex; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0 || !row.some(cell => cell !== undefined && cell !== null && cell !== '')) continue;

    // Roster Number
    const rawRosterVal = row[rosterIdx];
    let rawRoster = '';
    let parsedRn = NaN;
    if (rawRosterVal !== undefined && rawRosterVal !== null && String(rawRosterVal).trim() !== '') {
      parsedRn = parseInt(String(rawRosterVal).trim(), 10);
      rawRoster = !isNaN(parsedRn) ? String(parsedRn) : String(rawRosterVal).trim();
    } else {
      rawRoster = String(alphaRaw.length + bravoRaw.length + 1);
      parsedRn = alphaRaw.length + bravoRaw.length + 1;
    }

    // Name
    const rawNameVal = row[nameIdx];
    const rawName = (rawNameVal !== undefined && rawNameVal !== null && String(rawNameVal).trim() !== '')
      ? String(rawNameVal).trim()
      : `Trainee ${rawRoster}`;

    // Age
    const rawAgeVal = row[ageIdx];
    const parsedAge = (rawAgeVal !== undefined && rawAgeVal !== null) ? parseInt(String(rawAgeVal).trim(), 10) : 22;
    const rawAge = (!isNaN(parsedAge) && parsedAge > 0) ? parsedAge : 22;

    const traineeObj = { rn: rawRoster, name: rawName, age: rawAge };

    // Separate by Platoon: RN <= 100 -> Alpha, RN >= 101 -> Bravo
    if (dateIdx !== -1 && row[dateIdx] !== undefined && row[dateIdx] !== null && String(row[dateIdx]).trim() !== '') {
      const dStr = String(row[dateIdx]).trim();
      if (!isNaN(parsedRn) && parsedRn >= 101) {
        if (!bravoDate) bravoDate = dStr;
      } else {
        if (!alphaDate) alphaDate = dStr;
      }
    }

    if (!isNaN(parsedRn) && parsedRn >= 101) {
      bravoRaw.push(traineeObj);
    } else {
      alphaRaw.push(traineeObj);
    }
  }

  if (alphaRaw.length === 0 && bravoRaw.length === 0) {
    throw new Error('No trainee data found in file.');
  }

  // Sort raw trainees numerically by RN within each platoon
  alphaRaw.sort((a, b) => (parseInt(a.rn, 10) || 0) - (parseInt(b.rn, 10) || 0));
  bravoRaw.sort((a, b) => (parseInt(a.rn, 10) || 0) - (parseInt(b.rn, 10) || 0));

  const alphaResult = distributeTraineesAcrossLanes(alphaRaw, 'alpha');
  const bravoResult = distributeTraineesAcrossLanes(bravoRaw, 'bravo');
  const totalTrainees = alphaResult.totalTrainees + bravoResult.totalTrainees;

  // Primary fallback result (Alpha if has trainees, else Bravo)
  const primaryResult = alphaResult.totalTrainees > 0 ? alphaResult : bravoResult;

  return {
    alpha: alphaResult,
    bravo: bravoResult,
    totalTrainees,
    parsedTraineesByLane: primaryResult.parsedTraineesByLane,
    counts: primaryResult.counts
  };
}
