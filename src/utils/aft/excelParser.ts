import * as XLSX from 'xlsx';
import type { TraineeRecord } from '../../types/aft/aft.types';
import { getAgeGroupFromAge } from './timeFormatter';

export interface ParseExcelResult {
  parsedTraineesByLane: Record<number, TraineeRecord[]>;
  counts: Record<number, number>;
  totalTrainees: number;
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

export function parseTraineeExcel(fileData: string | ArrayBuffer): ParseExcelResult {
  const wb = XLSX.read(fileData, { type: 'binary' });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

  if (!rows || rows.length < 1) {
    throw new Error('Empty or invalid Excel sheet.');
  }

  // 1. Check if the first row is data (Column 0: int 교번, Column 1: string 이름, Column 2: int 나이)
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
  }

  // Collect all valid trainee rows
  const rawTrainees: { rn: string; name: string; age: number }[] = [];

  for (let i = startRowIndex; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0 || !row.some(cell => cell !== undefined && cell !== null && cell !== '')) continue;

    // First column: Roster Number (int) - Preserve exact roster number even if some numbers are skipped
    const rawRosterVal = row[rosterIdx];
    let rawRoster = '';
    if (rawRosterVal !== undefined && rawRosterVal !== null && String(rawRosterVal).trim() !== '') {
      const parsedInt = parseInt(String(rawRosterVal).trim(), 10);
      rawRoster = !isNaN(parsedInt) ? String(parsedInt) : String(rawRosterVal).trim();
    } else {
      rawRoster = String(rawTrainees.length + 1);
    }

    // Second column: Name (string)
    const rawNameVal = row[nameIdx];
    const rawName = (rawNameVal !== undefined && rawNameVal !== null && String(rawNameVal).trim() !== '')
      ? String(rawNameVal).trim()
      : `Trainee ${rawRoster}`;

    // Third column: Age (int)
    const rawAgeVal = row[ageIdx];
    const parsedAge = (rawAgeVal !== undefined && rawAgeVal !== null) ? parseInt(String(rawAgeVal).trim(), 10) : 22;
    const rawAge = (!isNaN(parsedAge) && parsedAge > 0) ? parsedAge : 22;

    rawTrainees.push({
      rn: rawRoster,
      name: rawName,
      age: rawAge
    });
  }

  if (rawTrainees.length === 0) {
    throw new Error('No trainee data found in file.');
  }

  const totalTrainees = rawTrainees.length;
  const numLanes = 10;
  const baseCount = Math.floor(totalTrainees / numLanes);
  const remainder = totalTrainees % numLanes;

  const counts: Record<number, number> = {};
  for (let l = 1; l <= numLanes; l++) {
    counts[l] = l <= remainder ? baseCount + 1 : baseCount;
  }

  const parsedTraineesByLane: Record<number, TraineeRecord[]> = {};
  let traineePointer = 0;

  for (let l = 1; l <= numLanes; l++) {
    const laneCount = counts[l];
    const list: TraineeRecord[] = [];

    for (let pos = 1; pos <= laneCount; pos++) {
      if (traineePointer < rawTrainees.length) {
        const item = rawTrainees[traineePointer++];
        list.push({
          id: `imp-l${l}-p${pos}-${Date.now()}`,
          rosterNumber: item.rn,
          vestNumber: `${pos}`,
          name: item.name,
          age: item.age,
          ageGroup: getAgeGroupFromAge(item.age),
          scores: { MDL: '', MDL2: '', HRP: '', SDC: '', PLK: '', '2MR': '' }
        });
      }
    }

    parsedTraineesByLane[l] = list;
  }

  return {
    parsedTraineesByLane,
    counts,
    totalTrainees
  };
}
