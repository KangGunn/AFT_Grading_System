import React, { useState, useMemo } from 'react';
import XLSX from 'xlsx-js-style';
import type { TraineeRecord, LaneConfig, Platoon } from '../../types/aft/aft.types';
import { calculateOfficialAftScore } from '../../data/aftStandards2025';
import { parseTimeToSeconds, formatAftDate, timeStringToExcelNumber } from '../../utils/aft/timeFormatter';
import { loadCohortPlatoonDataFromStorage, isPlatoonDummyData, isUploadedTrainee } from '../../utils/aft/cycleStorage';
import { getContrastTextColor } from '../../lib/utils';

interface AllResultsViewProps {
  activeCohortId?: string;
  activeCohortName?: string;
  laneTrainees: Record<number, TraineeRecord[]>;
  activeCountByLane: Record<number, number>;
  laneConfigs: Record<number, LaneConfig>;
  onBackToLanes: () => void;
  backButtonLabel?: string;
  onOpenReTest?: () => void;
  activePlatoon?: Platoon;
  onSelectPlatoon?: (platoon: Platoon) => void;
}

interface ProcessedTraineeResult {
  lane: number;
  laneConfig: LaneConfig;
  trainee: TraineeRecord;
  rnNum: number; // For clean numerical sorting
  // Raw attempts (Initial)
  mdl1: string;
  mdl2: string;
  hrp: string;
  sdc: string;
  plk: string;
  tmr: string;
  // Converted official scores (Initial)
  mdlScore: number;
  hrpScore: number;
  sdcScore: number;
  plkScore: number;
  tmrScore: number;
  totalScore: number;
  passedCount: number;
  allCompleted: boolean;
  isPassed: boolean;
  // Re-Test Results
  mdlRetest?: string;
  hrpRetest?: string;
  sdcRetest?: string;
  plkRetest?: string;
  tmrRetest?: string;
  mdlRetestScore?: number;
  hrpRetestScore?: number;
  sdcRetestScore?: number;
  plkRetestScore?: number;
  tmrRetestScore?: number;
  hasAnyRetest: boolean;
  finalTotalScore: number;
  finalPassed: boolean;
  isRetestPass: boolean;
}

export const AllResultsView: React.FC<AllResultsViewProps> = ({
  activeCohortId,
  activeCohortName,
  laneTrainees,
  activeCountByLane,
  laneConfigs,
  onBackToLanes,
  backButtonLabel = 'Lanes',
  onOpenReTest,
  activePlatoon,
  onSelectPlatoon
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLane, setFilterLane] = useState<number | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pass' | 'retest_pass' | 'fail' | 'incomplete'>('all');

  // Flatten and process all active trainees across all 10 lanes
  const allResults: ProcessedTraineeResult[] = useMemo(() => {
    const list: ProcessedTraineeResult[] = [];

    for (let lane = 1; lane <= 10; lane++) {
      const trainees = laneTrainees[lane] || [];
      const count = activeCountByLane[lane] ?? trainees.length;
      const activeList = trainees.slice(0, count);
      const cfg = laneConfigs[lane] || {
        laneNumber: lane,
        vestColor: 'Red',
        vestColorCode: '#EF4444'
      };

      for (const t of activeList) {
        // MDL Best attempt calculation
        const mdl1 = (t.scores.MDL || '').trim();
        const mdl2 = (t.scores.MDL2 || '').trim();
        const hasMdl = mdl1 !== '' || mdl2 !== '';
        const v1 = mdl1 !== '' ? parseFloat(mdl1) || 0 : -1;
        const v2 = mdl2 !== '' ? parseFloat(mdl2) || 0 : -1;
        const bestMdl = Math.max(v1 >= 0 ? v1 : 0, v2 >= 0 ? v2 : 0);
        const mdlScore = hasMdl ? calculateOfficialAftScore('MDL', bestMdl, t.ageGroup) : 0;

        // HRP
        const hrp = (t.scores.HRP || '').trim();
        const hasHrp = hrp !== '';
        const hrpVal = hasHrp ? parseFloat(hrp) || 0 : 0;
        const hrpScore = hasHrp ? calculateOfficialAftScore('HRP', hrpVal, t.ageGroup) : 0;

        // SDC
        const sdc = (t.scores.SDC || '').trim();
        const hasSdc = sdc !== '';
        const sdcSec = hasSdc ? parseTimeToSeconds(sdc) : 0;
        const sdcScore = hasSdc ? calculateOfficialAftScore('SDC', sdcSec, t.ageGroup) : 0;

        // PLK
        const plk = (t.scores.PLK || '').trim();
        const hasPlk = plk !== '';
        const plkSec = hasPlk ? parseTimeToSeconds(plk) : 0;
        const plkScore = hasPlk ? calculateOfficialAftScore('PLK', plkSec, t.ageGroup) : 0;

        // 2MR
        const tmr = (t.scores['2MR'] || '').trim();
        const hasTmr = tmr !== '';
        const tmrSec = hasTmr ? parseTimeToSeconds(tmr) : 0;
        const tmrScore = hasTmr ? calculateOfficialAftScore('2MR', tmrSec, t.ageGroup) : 0;

        let passedCount = 0;
        if (hasMdl && mdlScore >= 60) passedCount++;
        if (hasHrp && hrpScore >= 60) passedCount++;
        if (hasSdc && sdcScore >= 60) passedCount++;
        if (hasPlk && plkScore >= 60) passedCount++;
        if (hasTmr && tmrScore >= 60) passedCount++;

        const totalScore = mdlScore + hrpScore + sdcScore + plkScore + tmrScore;
        const allCompleted = hasMdl && hasHrp && hasSdc && hasPlk && hasTmr;
        const isPassed = allCompleted && passedCount === 5 && totalScore >= 300;

        // Re-test calculation
        const mdlRetest1 = (t.retestScores?.MDL || '').trim();
        const mdlRetest2 = (t.retestScores?.MDL2 || '').trim();
        const hasMdlRetest = mdlRetest1 !== '' || mdlRetest2 !== '';
        const rv1 = mdlRetest1 !== '' ? parseFloat(mdlRetest1) || 0 : -1;
        const rv2 = mdlRetest2 !== '' ? parseFloat(mdlRetest2) || 0 : -1;
        const bestMdlRetest = Math.max(rv1 >= 0 ? rv1 : 0, rv2 >= 0 ? rv2 : 0);
        const mdlRetestScore = hasMdlRetest ? calculateOfficialAftScore('MDL', bestMdlRetest, t.ageGroup) : undefined;
        const mdlRetestDisplay = hasMdlRetest
          ? (mdlRetest1 !== '' && mdlRetest2 !== '' ? `${mdlRetest1} / ${mdlRetest2}` : (mdlRetest1 || mdlRetest2))
          : undefined;

        const hrpRetest = (t.retestScores?.HRP || '').trim();
        const hasHrpRetest = hrpRetest !== '';
        const hrpRetestScore = hasHrpRetest ? calculateOfficialAftScore('HRP', parseFloat(hrpRetest) || 0, t.ageGroup) : undefined;

        const sdcRetest = (t.retestScores?.SDC || '').trim();
        const hasSdcRetest = sdcRetest !== '';
        const sdcRetestScore = hasSdcRetest ? calculateOfficialAftScore('SDC', parseTimeToSeconds(sdcRetest), t.ageGroup) : undefined;

        const plkRetest = (t.retestScores?.PLK || '').trim();
        const hasPlkRetest = plkRetest !== '';
        const plkRetestScore = hasPlkRetest ? calculateOfficialAftScore('PLK', parseTimeToSeconds(plkRetest), t.ageGroup) : undefined;

        const tmrRetest = (t.retestScores?.['2MR'] || '').trim();
        const hasTmrRetest = tmrRetest !== '';
        const tmrRetestScore = hasTmrRetest ? calculateOfficialAftScore('2MR', parseTimeToSeconds(tmrRetest), t.ageGroup) : undefined;

        const hasAnyRetest = hasMdlRetest || hasHrpRetest || hasSdcRetest || hasPlkRetest || hasTmrRetest;

        // Effective scores
        const effMdlScore = hasMdlRetest && mdlRetestScore !== undefined ? mdlRetestScore : mdlScore;
        const effHrpScore = hasHrpRetest && hrpRetestScore !== undefined ? hrpRetestScore : hrpScore;
        const effSdcScore = hasSdcRetest && sdcRetestScore !== undefined ? sdcRetestScore : sdcScore;
        const effPlkScore = hasPlkRetest && plkRetestScore !== undefined ? plkRetestScore : plkScore;
        const effTmrScore = hasTmrRetest && tmrRetestScore !== undefined ? tmrRetestScore : tmrScore;

        let finalPassedCount = 0;
        if ((hasMdl || hasMdlRetest) && effMdlScore >= 60) finalPassedCount++;
        if ((hasHrp || hasHrpRetest) && effHrpScore >= 60) finalPassedCount++;
        if ((hasSdc || hasSdcRetest) && effSdcScore >= 60) finalPassedCount++;
        if ((hasPlk || hasPlkRetest) && effPlkScore >= 60) finalPassedCount++;
        if ((hasTmr || hasTmrRetest) && effTmrScore >= 60) finalPassedCount++;

        const finalTotalScore = effMdlScore + effHrpScore + effSdcScore + effPlkScore + effTmrScore;
        const finalPassed = allCompleted && finalPassedCount === 5 && finalTotalScore >= 300;
        const isRetestPass = !isPassed && finalPassed;

        // Extract numeric portion of rosterNumber for clean sorting
        const rnMatch = t.rosterNumber.match(/\d+/);
        const rnNum = rnMatch ? parseInt(rnMatch[0], 10) : 999999;

        list.push({
          lane,
          laneConfig: cfg,
          trainee: t,
          rnNum,
          mdl1,
          mdl2,
          hrp,
          sdc,
          plk,
          tmr,
          mdlScore,
          hrpScore,
          sdcScore,
          plkScore,
          tmrScore,
          totalScore,
          passedCount,
          allCompleted,
          isPassed,
          mdlRetest: mdlRetestDisplay,
          hrpRetest: hasHrpRetest ? hrpRetest : undefined,
          sdcRetest: hasSdcRetest ? sdcRetest : undefined,
          plkRetest: hasPlkRetest ? plkRetest : undefined,
          tmrRetest: hasTmrRetest ? tmrRetest : undefined,
          mdlRetestScore,
          hrpRetestScore,
          sdcRetestScore,
          plkRetestScore,
          tmrRetestScore,
          hasAnyRetest,
          finalTotalScore,
          finalPassed,
          isRetestPass
        });
      }
    }

    // Sort by RN ascending
    list.sort((a, b) => {
      if (a.rnNum !== b.rnNum) return a.rnNum - b.rnNum;
      return a.trainee.rosterNumber.localeCompare(b.trainee.rosterNumber);
    });

    return list;
  }, [laneTrainees, activeCountByLane, laneConfigs]);

  // Filtered list
  const filteredResults = useMemo(() => {
    return allResults.filter(item => {
      if (filterLane !== 'all' && item.lane !== filterLane) return false;
      if (filterStatus === 'pass' && !item.isPassed) return false;
      if (filterStatus === 'retest_pass' && !item.isRetestPass) return false;
      if (filterStatus === 'fail' && (!item.allCompleted || item.finalPassed)) return false;
      if (filterStatus === 'incomplete' && item.allCompleted) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const rn = item.trainee.rosterNumber.toLowerCase();
        const name = item.trainee.name.toLowerCase();
        const vest = item.trainee.vestNumber.toLowerCase();
        return rn.includes(query) || name.includes(query) || vest.includes(query);
      }
      return true;
    });
  }, [allResults, filterLane, filterStatus, searchTerm]);

  // Export current cycle results to Excel matching official scorecard format
  const handleExportExcel = () => {
    const cId = activeCohortId || activeCohortName || 'default';

    // 1. Resolve Alpha & Bravo dates (unified per platoon, set as grading date)
    const savedAlphaDate = (typeof window !== 'undefined')
      ? (window.localStorage.getItem(`aft_c_${cId}_alpha_grading_date`) ||
         window.localStorage.getItem(`aft_c_${cId}_alpha_date`))
      : null;
    const alphaDate = savedAlphaDate || formatAftDate(new Date());

    const savedBravoDate = (typeof window !== 'undefined')
      ? (window.localStorage.getItem(`aft_c_${cId}_bravo_grading_date`) ||
         window.localStorage.getItem(`aft_c_${cId}_bravo_date`))
      : null;
    const bravoDate = savedBravoDate || formatAftDate(new Date());

    // 2. Gather active trainees from Alpha and Bravo platoons
    const getPlatoonActiveTrainees = (p: 'alpha' | 'bravo'): TraineeRecord[] => {
      if (isPlatoonDummyData(cId, p)) {
        return [];
      }
      if (activePlatoon === p) {
        const list: TraineeRecord[] = [];
        for (let l = 1; l <= 10; l++) {
          const trainees = laneTrainees[l] || [];
          const count = activeCountByLane[l] ?? trainees.length;
          list.push(...trainees.slice(0, count));
        }
        return list;
      } else {
        const data = loadCohortPlatoonDataFromStorage(cId, p);
        const list: TraineeRecord[] = [];
        for (let l = 1; l <= 10; l++) {
          const trainees = data.laneTrainees[l] || [];
          const count = data.activeCountByLane[l] ?? trainees.length;
          list.push(...trainees.slice(0, count));
        }
        return list;
      }
    };

    const alphaTrainees = getPlatoonActiveTrainees('alpha');
    const bravoTrainees = getPlatoonActiveTrainees('bravo');

    interface TraineeExportItem {
      trainee: TraineeRecord;
      rnNum: number;
      isAlpha: boolean;
    }

    const combined: TraineeExportItem[] = [];

    for (const t of alphaTrainees) {
      const m = t.rosterNumber.match(/\d+/);
      const rnNum = m ? parseInt(m[0], 10) : 0;
      combined.push({ trainee: t, rnNum, isAlpha: true });
    }

    for (const t of bravoTrainees) {
      const m = t.rosterNumber.match(/\d+/);
      const rnNum = m ? parseInt(m[0], 10) : 101;
      combined.push({ trainee: t, rnNum, isAlpha: false });
    }

    // Fallback if neither platoon had trainees
    if (combined.length === 0) {
      for (const item of allResults) {
        combined.push({
          trainee: item.trainee,
          rnNum: item.rnNum,
          isAlpha: item.rnNum <= 100
        });
      }
    }

    // Sort numerically by Roster Number
    combined.sort((a, b) => {
      if (a.rnNum !== b.rnNum) return a.rnNum - b.rnNum;
      return a.trainee.rosterNumber.localeCompare(b.trainee.rosterNumber);
    });

    // 3. Build sheet rows strictly matching uploaded source card format up to P/F(2MR)
    const headers = [
      'ROSTER',
      'NAME',
      'AGE',
      'AGE GROUP',
      'DATE',
      'MDL1',
      'MDL2',
      'HRP',
      'SDC',
      'PLK',
      '2MR',
      'SMDL',
      'SHRP',
      'SSDC',
      'SPLK',
      'S2MR',
      'TOTAL',
      'P/F(MDL)',
      'P/F(HRP)',
      'P/F(SDC)',
      'P/F(PLK)',
      'P/F(2MR)'
    ];

    const dataRows: (string | number | undefined)[][] = [];

    for (const item of combined) {
      const t = item.trainee;
      const rn = item.rnNum;
      const name = t.name;
      const age = t.age;
      const ageGroup = t.ageGroup.includes('M') ? t.ageGroup : `${t.ageGroup} M`;
      const tDate = item.isAlpha ? alphaDate : bravoDate;

      // MDL attempts & converted score
      const mdl1Str = (t.scores.MDL || '').trim();
      const mdl2Str = (t.scores.MDL2 || '').trim();
      const v1 = mdl1Str !== '' ? parseFloat(mdl1Str) || 0 : -1;
      const v2 = mdl2Str !== '' ? parseFloat(mdl2Str) || 0 : -1;
      const bestMdl = Math.max(v1 >= 0 ? v1 : 0, v2 >= 0 ? v2 : 0);
      const hasMdl = mdl1Str !== '' || mdl2Str !== '';
      const smdl = hasMdl ? calculateOfficialAftScore('MDL', bestMdl, t.ageGroup) : 0;

      const mdl1Val = mdl1Str !== '' ? (parseFloat(mdl1Str) || 0) : undefined;
      // Optional MDL2: if not attempted, leave blank cell
      const mdl2Val = mdl2Str !== '' ? (parseFloat(mdl2Str) || 0) : undefined;

      // HRP
      const hrpStr = (t.scores.HRP || '').trim();
      const hrpVal = hrpStr !== '' ? (parseFloat(hrpStr) || 0) : undefined;
      const shrp = hrpVal !== undefined ? calculateOfficialAftScore('HRP', hrpVal, t.ageGroup) : 0;

      // SDC
      const sdcStr = (t.scores.SDC || '').trim();
      const sdcNum = timeStringToExcelNumber(sdcStr);
      const ssdc = sdcStr !== '' ? calculateOfficialAftScore('SDC', parseTimeToSeconds(sdcStr), t.ageGroup) : 0;

      // PLK
      const plkStr = (t.scores.PLK || '').trim();
      const plkNum = timeStringToExcelNumber(plkStr);
      const splk = plkStr !== '' ? calculateOfficialAftScore('PLK', parseTimeToSeconds(plkStr), t.ageGroup) : 0;

      // 2MR
      const tmrStr = (t.scores['2MR'] || '').trim();
      const tmrNum = timeStringToExcelNumber(tmrStr);
      const s2mr = tmrStr !== '' ? calculateOfficialAftScore('2MR', parseTimeToSeconds(tmrStr), t.ageGroup) : 0;

      // TOTAL
      const total = smdl + shrp + ssdc + splk + s2mr;

      // Pass / Fail (Pass or Fail)
      const pfMdl = smdl >= 60 ? 'Pass' : 'Fail';
      const pfHrp = shrp >= 60 ? 'Pass' : 'Fail';
      const pfSdc = ssdc >= 60 ? 'Pass' : 'Fail';
      const pfPlk = splk >= 60 ? 'Pass' : 'Fail';
      const pfTmr = s2mr >= 60 ? 'Pass' : 'Fail';

      dataRows.push([
        rn,
        name,
        age,
        ageGroup,
        tDate,
        mdl1Val,
        mdl2Val,
        hrpVal,
        sdcNum,
        plkNum,
        tmrNum,
        smdl,
        shrp,
        ssdc,
        splk,
        s2mr,
        total,
        pfMdl,
        pfHrp,
        pfSdc,
        pfPlk,
        pfTmr
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Column widths: NAME widened significantly, AGE GROUP sized just enough to prevent clipping
    ws['!cols'] = [
      { wch: 10 }, // ROSTER
      { wch: 25 }, // NAME (많이 늘림)
      { wch: 7 },  // AGE
      { wch: 13 }, // AGE GROUP ('AGE GROUP'이 잘리지 않을 정도로만 늘림)
      { wch: 12 }, // DATE
      { wch: 8 },  // MDL1
      { wch: 8 },  // MDL2
      { wch: 8 },  // HRP
      { wch: 8 },  // SDC
      { wch: 8 },  // PLK
      { wch: 8 },  // 2MR
      { wch: 8 },  // SMDL
      { wch: 8 },  // SHRP
      { wch: 8 },  // SSDC
      { wch: 8 },  // SPLK
      { wch: 8 },  // S2MR
      { wch: 9 },  // TOTAL
      { wch: 11 }, // P/F(MDL)
      { wch: 11 }, // P/F(HRP)
      { wch: 11 }, // P/F(SDC)
      { wch: 11 }, // P/F(PLK)
      { wch: 11 }  // P/F(2MR)
    ];

    // 4. Styles: Center all cells, Header bold + gray background + double bottom border
    const headerStyle = {
      font: { name: 'Calibri', sz: 11, bold: true },
      fill: { fgColor: { rgb: 'D9D9D9' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'BFBFBF' } },
        left: { style: 'thin', color: { rgb: 'BFBFBF' } },
        right: { style: 'thin', color: { rgb: 'BFBFBF' } },
        bottom: { style: 'double', color: { rgb: '000000' } }
      }
    };

    const dataStyle = {
      font: { name: 'Calibri', sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'D9D9D9' } },
        bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
        left: { style: 'thin', color: { rgb: 'D9D9D9' } },
        right: { style: 'thin', color: { rgb: 'D9D9D9' } }
      }
    };

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:V1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (R === 0) {
          if (!ws[cellAddress]) ws[cellAddress] = { t: 's', v: '' };
          ws[cellAddress].s = headerStyle;
        } else {
          if (ws[cellAddress]) {
            ws[cellAddress].s = dataStyle;
          }
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Main');
    const safeCohort = (activeCohortName || 'Cycle').replace(/[^a-zA-Z0-9_-]/g, '_');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AFT_Cycle_${safeCohort}_Scorecard.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalCount = allResults.length;
  const incompletedCount = allResults.filter(r => !r.allCompleted).length;
  const failedCount = allResults.filter(r => r.allCompleted && !r.isPassed).length;
  const retestPassCount = allResults.filter(r => r.isRetestPass).length;
  // Recycle: initial failed trainees who completed retest attempts but still failed
  const recycleCount = allResults.filter(r => r.allCompleted && !r.isPassed && r.hasAnyRetest && !r.finalPassed).length;

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header - Compact & non-overlapping stats */}
      <header className="sticky top-0 z-40 w-full bg-blue-900 text-white shadow-md shrink-0">
        <div className="flex items-center justify-between px-3 py-2.5 gap-2">
          {/* Left: Back Button */}
          <button
            onClick={onBackToLanes}
            className="flex items-center gap-1 rounded-lg bg-blue-800 px-2.5 py-1.5 text-xs font-black text-white active:scale-95 hover:bg-blue-700 uppercase shrink-0 shadow"
            title={`Back (${backButtonLabel})`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>{backButtonLabel}</span>
          </button>

          {/* Center: Title + Concise 3-item Stats (Total · Fail · Recycle) */}
          <div className="text-center min-w-0 flex flex-col items-center justify-center">
            <h1 className="text-sm sm:text-base font-black tracking-wider leading-tight whitespace-nowrap">
              SCORECARD
            </h1>
            {/* Desktop View: Full Labels */}
            <div className="hidden sm:flex text-[11px] font-bold text-blue-200 uppercase tracking-wide mt-0.5 items-center gap-1.5 whitespace-nowrap">
              {activeCohortName && (
                <>
                  <span className="text-amber-300 font-extrabold">Cycle {activeCohortName}</span>
                  <span>·</span>
                </>
              )}
              <span>Total <strong className="text-white">{totalCount}</strong></span>
              <span>·</span>
              <span>Fail <strong className="text-amber-300">{failedCount}</strong></span>
              <span>·</span>
              <span>Recycle <strong className="text-red-400">{recycleCount}</strong></span>
            </div>

            {/* Mobile View: Numbers format "T / F / R" */}
            <div className="sm:hidden text-xs font-bold text-blue-200 tracking-wider mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
              {activeCohortName && (
                <>
                  <span className="text-amber-300 font-extrabold text-[11px]">Cycle {activeCohortName}</span>
                  <span className="text-blue-400/70 font-normal">·</span>
                </>
              )}
              <strong className="text-white" title="Total">{totalCount}</strong>
              <span className="text-blue-400/70 font-normal">/</span>
              <strong className="text-amber-300" title="Fail">{failedCount}</strong>
              <span className="text-blue-400/70 font-normal">/</span>
              <strong className="text-red-400" title="Recycle">{recycleCount}</strong>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-1.5 justify-end shrink-0">
            {onOpenReTest && (
              <button
                onClick={onOpenReTest}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white text-[10px] font-black shadow transition-all border border-red-400 shrink-0"
                title="Go to Re-Test grading screen"
              >
                <span>♻️</span>
                <span>Re-Test</span>
                {failedCount > 0 && (
                  <span className="rounded-full bg-slate-950 px-1 text-[9px] text-red-200 font-black border border-red-400">
                    {failedCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center justify-center px-2 py-1.5 rounded-lg bg-emerald-700 border border-emerald-600 text-[10px] font-black text-white hover:bg-emerald-600 active:scale-95 shadow transition-all shrink-0"
              title="Download Excel file"
            >
              <span>📥</span>
              <span className="hidden sm:inline ml-1">Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filter / Search Bar - Compact single row on mobile to maximize table view space */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-2.5 py-1.5 flex items-center gap-1.5 shrink-0">
        {onSelectPlatoon && activePlatoon && (
          <div className="flex items-center gap-1 shrink-0 bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onSelectPlatoon('alpha')}
              className={`px-2 h-6 rounded-md text-[10px] font-black transition-all ${
                activePlatoon === 'alpha'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Alpha
            </button>
            <button
              type="button"
              onClick={() => onSelectPlatoon('bravo')}
              className={`px-2 h-6 rounded-md text-[10px] font-black transition-all ${
                activePlatoon === 'bravo'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bravo
            </button>
          </div>
        )}
        <div className="relative flex-1 min-w-0 flex items-center">
          <span className="absolute left-2.5 pointer-events-none select-none text-xs leading-none flex items-center justify-center">🔍</span>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ fontSize: '11px' }}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2 h-7 font-bold text-white placeholder-slate-400 placeholder:text-[11px] leading-normal focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={filterLane}
          onChange={(e) => setFilterLane(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          style={{ fontSize: '11px' }}
          className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 h-7 font-bold text-white focus:outline-none focus:border-blue-500 shrink-0"
        >
          <option value="all">All Lanes</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(l => (
            <option key={l} value={l}>L{l}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          style={{ fontSize: '11px' }}
          className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 h-7 font-bold text-white focus:outline-none focus:border-blue-500 shrink-0"
        >
          <option value="all">Status</option>
          <option value="pass">PASS</option>
          <option value="retest_pass">Re-Pass</option>
          <option value="fail">FAIL</option>
          <option value="incomplete">Incompl</option>
        </select>
      </div>

      {/* Main Table Area with Horizontal & Vertical Scroll */}
      <div className="flex-1 overflow-auto bg-slate-950 select-text">
        <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-20 bg-slate-900 text-slate-200 border-b-2 border-slate-700 shadow-sm">
            {/* Super Header Grouping */}
            <tr className="border-b border-slate-800 text-[11px] font-black uppercase text-slate-400">
              <th colSpan={4} className="px-3 py-1.5 text-center bg-slate-900/90 border-r-2 border-blue-500/40 text-blue-300">
                👤 Trainee Info
              </th>
              <th colSpan={7} className="px-3 py-1.5 text-center bg-slate-900/90 border-r-2 border-blue-500/40 text-emerald-300">
                ⏱️ Initial Scores & Result
              </th>
              <th colSpan={7} className="px-3 py-1.5 text-center bg-amber-950/40 text-amber-300">
                🔄 Re-Test Scores & Final Status
              </th>
            </tr>

            {/* Sub Header Columns */}
            <tr className="font-extrabold text-[11px] text-slate-300">
              {/* Trainee Info */}
              <th className="px-2.5 py-2 text-center w-12 bg-slate-900">Lane</th>
              <th className="px-2.5 py-2 text-center w-14 bg-slate-900 text-white font-black">RN</th>
              <th className="px-2.5 py-2 text-left min-w-[90px] bg-slate-900">Name</th>
              <th className="px-2 py-2 text-center w-12 bg-slate-900 border-r-2 border-blue-500/40">Age</th>

              {/* Initial Scores (Raw on top, converted points below) */}
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-emerald-300">MDL</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-emerald-300">HRP</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-emerald-300">SDC</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-emerald-300">PLK</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-emerald-300">2MR</th>
              <th className="px-2.5 py-2 text-center w-16 bg-blue-950/80 text-blue-200 font-black">Total</th>
              <th className="px-3 py-2 text-center w-16 bg-slate-900 border-r-2 border-blue-500/40">Result</th>

              {/* Re-Test Columns */}
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-amber-200">MDL Re</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-amber-200">HRP Re</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-amber-200">SDC Re</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-amber-200">PLK Re</th>
              <th className="px-2 py-2 text-center w-16 bg-slate-900/80 text-amber-200">2MR Re</th>
              <th className="px-2.5 py-2 text-center w-18 bg-amber-950/50 text-amber-300 font-black">Final Total</th>
              <th className="px-3 py-2 text-center w-20 bg-slate-900 text-purple-300 font-black">Final Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80 font-medium">
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan={18} className="text-center py-12 text-slate-500 font-bold">
                  No trainee results found.
                </td>
              </tr>
            ) : (
              filteredResults.map((item, idx) => (
                <tr
                  key={`${item.lane}-${item.trainee.id}`}
                  className={`hover:bg-slate-800/60 transition-colors ${item.isRetestPass
                      ? 'bg-emerald-950/20'
                      : item.allCompleted && !item.finalPassed
                        ? 'bg-red-950/15'
                        : idx % 2 === 0
                          ? 'bg-slate-950'
                          : 'bg-slate-900/40'
                    }`}
                >
                  {/* 1. Trainee Info */}
                  <td className="px-2.5 py-2 text-center font-bold">
                    {(() => {
                      const badgeTextColor = getContrastTextColor(item.laneConfig.vestColorCode, item.laneConfig.vestColor);
                      return (
                        <span
                          className="inline-flex h-5 w-6 items-center justify-center rounded text-[10px] font-black shadow-xs border border-black/15"
                          style={{
                            backgroundColor: item.laneConfig.vestColorCode,
                            color: badgeTextColor
                          }}
                          title={`Lane ${item.lane}`}
                        >
                          {item.lane}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-2.5 py-2 text-center font-black text-yellow-300">
                    #{item.trainee.rosterNumber}
                  </td>
                  <td className="px-2.5 py-2 text-left font-black text-white truncate max-w-[120px]" title={item.trainee.name}>
                    {item.trainee.name}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-400 font-bold border-r-2 border-blue-500/40">
                    {item.trainee.age}
                  </td>

                  {/* 2. Initial Scores (Raw on top, converted points on bottom) */}
                  <td className="px-2 py-2 text-center font-mono">
                    {item.mdl1 || item.mdl2 ? (
                      <div>
                        <div className="text-slate-200 font-bold">
                          {item.mdl1 && item.mdl2 ? `${item.mdl1} / ${item.mdl2}` : (item.mdl1 || item.mdl2)}
                        </div>
                        <div className={`text-[10px] font-black ${item.mdlScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.mdlScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.hrp ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.hrp}</div>
                        <div className={`text-[10px] font-black ${item.hrpScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.hrpScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.sdc ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.sdc}</div>
                        <div className={`text-[10px] font-black ${item.sdcScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.sdcScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.plk ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.plk}</div>
                        <div className={`text-[10px] font-black ${item.plkScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.plkScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.tmr ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.tmr}</div>
                        <div className={`text-[10px] font-black ${item.tmrScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.tmrScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2.5 py-2 text-center font-mono font-black text-blue-300 bg-blue-950/40">
                    {item.totalScore}p
                  </td>

                  <td className="px-3 py-2 text-center border-r-2 border-blue-500/40">
                    {!item.allCompleted ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-400">
                        {item.passedCount}/5
                      </span>
                    ) : item.isPassed ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        PASS
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">
                        FAIL
                      </span>
                    )}
                  </td>

                  {/* 4. Dedicated Re-Test Columns */}
                  <td className="px-2 py-2 text-center font-mono">
                    {item.mdlRetest ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.mdlRetest}</div>
                        <div className={`text-[10px] font-black ${item.mdlRetestScore !== undefined && item.mdlRetestScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.mdlRetestScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.hrpRetest ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.hrpRetest}</div>
                        <div className={`text-[10px] font-black ${item.hrpRetestScore !== undefined && item.hrpRetestScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.hrpRetestScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.sdcRetest ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.sdcRetest}</div>
                        <div className={`text-[10px] font-black ${item.sdcRetestScore !== undefined && item.sdcRetestScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.sdcRetestScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.plkRetest ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.plkRetest}</div>
                        <div className={`text-[10px] font-black ${item.plkRetestScore !== undefined && item.plkRetestScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.plkRetestScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-center font-mono">
                    {item.tmrRetest ? (
                      <div>
                        <div className="text-slate-200 font-bold">{item.tmrRetest}</div>
                        <div className={`text-[10px] font-black ${item.tmrRetestScore !== undefined && item.tmrRetestScore >= 60 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.tmrRetestScore}p
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-2.5 py-2 text-center font-mono font-black bg-amber-950/20">
                    {item.hasAnyRetest ? (
                      <span className="text-amber-300 font-black">{item.finalTotalScore}p</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center">
                    {!item.allCompleted ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-400">
                        {item.passedCount}/5
                      </span>
                    ) : item.isRetestPass ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/30 text-emerald-300 border border-emerald-400 shadow-sm" title="Passed after Re-Test">
                        RE-PASS
                      </span>
                    ) : item.isPassed ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        PASS
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">
                        {item.hasAnyRetest ? 'RE-FAIL' : 'FAIL'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
