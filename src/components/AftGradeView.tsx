import { useState, useMemo, useEffect } from 'react';
import type { DisplayMode, EventCode, TraineeRecord } from '../types/aft/aft.types';
import { useAftRoster } from '../hooks/aft/useAftRoster';
import { useAftTimer } from '../hooks/aft/useAftTimer';
import { getAgeGroupFromAge } from '../utils/aft/timeFormatter';
import {
  getStrictFailedTrainees,
  RETEST_LANE_NUM,
  RETEST_LANE_CONFIG
} from '../utils/aft/retestHelpers';
import { LaneSelectHeader } from './aft/LaneSelectHeader';
import { LaneSelectView } from './lane/LaneSelectView';
import { GradingView } from './grading/GradingView';
import { TwoMileRunStartPointView } from './aft/TwoMileRunStartPointView';
import { AllResultsView } from './aft/AllResultsView';
import { ImportModal } from './modals/ImportModal';
import { StandardsModal } from './modals/StandardsModal';
import { VestSettingsModal } from './modals/VestSettingsModal';

interface Props {
  onBack?: () => void;
  displayMode?: DisplayMode;
}

export default function AftGradeView({ }: Props) {
  // Screen mode: 'lane_select' (Hub), 'grading' (Lane Evaluation / Re-Test), '2mr_start_point' (Dedicated 2MR Master Clock), 'all_results' (Full Roster Spreadsheet View)
  const [currentView, setCurrentView] = useState<'lane_select' | 'grading' | '2mr_start_point' | 'all_results'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('aft_current_view');
      if (saved === 'lane_select' || saved === 'grading' || saved === '2mr_start_point' || saved === 'all_results') {
        return saved;
      }
    }
    return 'lane_select';
  });

  const [selectedLane, setSelectedLane] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('aft_selected_lane');
      const parsed = saved ? parseInt(saved, 10) : 1;
      if ((parsed >= 1 && parsed <= 10) || parsed === RETEST_LANE_NUM) return parsed;
    }
    return 1;
  });

  // Track navigation origin
  const [gradingSource, setGradingSource] = useState<'lane_select' | 'all_results'>('lane_select');
  const [allResultsSource, setAllResultsSource] = useState<'lane_select' | 'grading'>('lane_select');

  const [showImportModal, setShowImportModal] = useState(false);
  const [showStandardsModal, setShowStandardsModal] = useState(false);
  const [showVestSettingsModal, setShowVestSettingsModal] = useState(false);

  // 1. Roster State & Firebase RTDB Sync Hook
  const {
    laneTrainees,
    laneConfigs,
    activeCountByLane,
    isFirebaseConnected,
    retestCustomTrainees,
    addCustomRetestSoldier,
    editCustomRetestSoldier,
    removeCustomRetestSoldier,
    updateCustomRetestScore,
    dualLanes,
    setDualLane,
    clearDualLane,
    updateScore,
    updateTrainee,
    updateRetestScore,
    updateLaneVestConfig,
    uploadRoster
  } = useAftRoster();

  // Secondary Lane for 2MR Simultaneous Grading
  const [secondaryLane, setSecondaryLane] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('aft_dual_secondary_lane');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 1 && parsed <= 10) return parsed;
      }
    }
    return null;
  });

  const effectiveSecondaryLane =
    selectedLane !== RETEST_LANE_NUM && secondaryLane !== selectedLane ? secondaryLane : null;

  const secondaryLaneConfig = effectiveSecondaryLane
    ? (laneConfigs[effectiveSecondaryLane] || {
        laneNumber: effectiveSecondaryLane,
        vestColor: 'Blue',
        vestColorCode: '#3B82F6'
      })
    : undefined;

  const secondaryActiveCount = effectiveSecondaryLane
    ? (activeCountByLane[effectiveSecondaryLane] ?? (laneTrainees[effectiveSecondaryLane]?.length || 10))
    : 0;

  const secondaryTrainees = effectiveSecondaryLane
    ? (laneTrainees[effectiveSecondaryLane] || []).slice(0, secondaryActiveCount)
    : [];

  const handleSelectSecondaryLane = async (laneNum: number | null) => {
    if (selectedLane === RETEST_LANE_NUM) return;
    const prevSecondary = secondaryLane;
    setSecondaryLane(laneNum);
    if (typeof window !== 'undefined') {
      if (laneNum !== null) {
        window.localStorage.setItem('aft_dual_secondary_lane', String(laneNum));
      } else {
        window.localStorage.removeItem('aft_dual_secondary_lane');
      }
    }

    if (prevSecondary !== null) {
      await clearDualLane(prevSecondary);
    }
    if (laneNum !== null) {
      await setDualLane(selectedLane, laneNum);
    }
  };

  // Failed trainees calculation across all lanes (Strictly FAIL only, incomplete excluded)
  const failedTrainees = useMemo(() => {
    return getStrictFailedTrainees(laneTrainees, activeCountByLane);
  }, [laneTrainees, activeCountByLane]);

  // Fast mapping of traineeId to their original lane
  const failedLaneMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const ft of failedTrainees) {
      map.set(ft.id, ft.originalLane);
    }
    return map;
  }, [failedTrainees]);

  // Temporary vest numbers specifically for Re-Test (in-memory, does not affect original lane trainee vest numbers)
  const [retestTemporaryVestNumbers, setRetestTemporaryVestNumbers] = useState<Record<string, string>>({});

  // Re-Test trainees formatted for GradingView (with scores bound to retestScores and isolated temporary vest numbers)
  const retestTraineeRecords: TraineeRecord[] = useMemo(() => {
    return failedTrainees.map(ft => ({
      ...ft,
      vestNumber: retestTemporaryVestNumbers[ft.id] !== undefined
        ? retestTemporaryVestNumbers[ft.id]
        : ft.vestNumber,
      scores: {
        MDL: ft.retestScores?.MDL || '',
        MDL2: ft.retestScores?.MDL2 || '',
        HRP: ft.retestScores?.HRP || '',
        SDC: ft.retestScores?.SDC || '',
        PLK: ft.retestScores?.PLK || '',
        '2MR': ft.retestScores?.['2MR'] || ''
      }
    }));
  }, [failedTrainees, retestTemporaryVestNumbers]);

  const retestCustomRecords: TraineeRecord[] = useMemo(() => {
    return retestCustomTrainees.map(ct => ({
      ...ct,
      vestNumber: retestTemporaryVestNumbers[ct.id] !== undefined
        ? retestTemporaryVestNumbers[ct.id]
        : ct.vestNumber
    }));
  }, [retestCustomTrainees, retestTemporaryVestNumbers]);

  const allRetestTrainees = useMemo(() => {
    return [...retestTraineeRecords, ...retestCustomRecords];
  }, [retestTraineeRecords, retestCustomRecords]);

  // Current lane config
  const currentLaneConfig = selectedLane === RETEST_LANE_NUM
    ? RETEST_LANE_CONFIG
    : (laneConfigs[selectedLane] || {
      laneNumber: selectedLane,
      vestColor: 'Red',
      vestColorCode: '#EF4444'
    });

  const currentActiveCount = activeCountByLane[selectedLane] ?? (laneTrainees[selectedLane]?.length || 10);
  const currentLaneTrainees = selectedLane === RETEST_LANE_NUM
    ? allRetestTrainees
    : (laneTrainees[selectedLane] || []).slice(0, currentActiveCount);

  const handleAddRetestSoldier = (soldier: {
    name: string;
    age: number;
    vestNumber?: string;
    rosterNumber?: string;
  }) => {
    addCustomRetestSoldier(soldier);
  };

  const handleEditRetestSoldier = (traineeId: string, soldier: {
    name: string;
    age: number;
    vestNumber?: string;
    rosterNumber?: string;
  }) => {
    editCustomRetestSoldier(traineeId, soldier);
    if (soldier.vestNumber) {
      setRetestTemporaryVestNumbers(prev => ({
        ...prev,
        [traineeId]: soldier.vestNumber!.trim()
      }));
    }
  };

  const handleRemoveRetestSoldier = (traineeId: string) => {
    removeCustomRetestSoldier(traineeId);
    setRetestTemporaryVestNumbers(prev => {
      const next = { ...prev };
      delete next[traineeId];
      return next;
    });
  };

  // 2. Timer & Stopwatch Hook
  const timer = useAftTimer(selectedLane, (traineeId, eventCode, timeStr, targetLane) => {
    const effectiveLane = targetLane || selectedLane;
    if (effectiveLane === RETEST_LANE_NUM) {
      const origLane = failedLaneMap.get(traineeId);
      if (origLane !== undefined) {
        updateRetestScore(origLane, traineeId, eventCode, timeStr);
      } else {
        updateCustomRetestScore(traineeId, eventCode, timeStr);
      }
    } else {
      updateScore(effectiveLane, traineeId, eventCode, timeStr);
    }
  });

  const handleScoreChange = (traineeId: string, eventCode: EventCode, val: string, targetLane?: number) => {
    const effectiveLane = targetLane || selectedLane;
    if (effectiveLane === RETEST_LANE_NUM) {
      const origLane = failedLaneMap.get(traineeId);
      if (origLane !== undefined) {
        updateRetestScore(origLane, traineeId, eventCode, val);
      } else {
        updateCustomRetestScore(traineeId, eventCode, val);
      }
    } else {
      updateScore(effectiveLane, traineeId, eventCode, val);
    }
  };

  const handleUpdateTrainee = (traineeId: string, updates: Partial<TraineeRecord>, targetLane?: number) => {
    const effectiveLane = targetLane || selectedLane;
    if (effectiveLane === RETEST_LANE_NUM) {
      if (updates.vestNumber !== undefined) {
        setRetestTemporaryVestNumbers(prev => ({
          ...prev,
          [traineeId]: updates.vestNumber || ''
        }));
      }

      const isCustom = retestCustomTrainees.some(t => t.id === traineeId);
      if (isCustom) {
        const existing = retestCustomTrainees.find(t => t.id === traineeId);
        if (existing) {
          editCustomRetestSoldier(traineeId, {
            name: updates.name !== undefined ? updates.name : existing.name,
            age: updates.age !== undefined ? updates.age : existing.age,
            vestNumber: updates.vestNumber !== undefined ? updates.vestNumber : existing.vestNumber,
            rosterNumber: updates.rosterNumber !== undefined ? updates.rosterNumber : existing.rosterNumber
          });
        }
        return;
      }

      // If there are other updates besides vestNumber, pass them through
      const { vestNumber: _, ...otherUpdates } = updates;
      if (Object.keys(otherUpdates).length > 0) {
        const origLane = failedLaneMap.get(traineeId);
        if (origLane !== undefined) {
          updateTrainee(origLane, traineeId, otherUpdates);
        }
      }
    } else {
      updateTrainee(effectiveLane, traineeId, updates);
    }
  };

  const handleSelectLane = (laneNum: number) => {
    setSelectedLane(laneNum);
    setGradingSource('lane_select');
    setCurrentView('grading');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aft_selected_lane', String(laneNum));
      window.localStorage.setItem('aft_current_view', 'grading');
    }
  };

  const handleSelectReTestLane = () => {
    setSelectedLane(RETEST_LANE_NUM);
    setGradingSource('lane_select');
    setCurrentView('grading');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aft_selected_lane', String(RETEST_LANE_NUM));
      window.localStorage.setItem('aft_current_view', 'grading');
    }
  };

  const handleOpenReTestFromAllResults = () => {
    setSelectedLane(RETEST_LANE_NUM);
    setGradingSource('all_results');
    setCurrentView('grading');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aft_selected_lane', String(RETEST_LANE_NUM));
      window.localStorage.setItem('aft_current_view', 'grading');
    }
  };

  const handleSelectLane2Mr = (laneNum: number) => {
    setSelectedLane(laneNum);
    setGradingSource('lane_select');
    setCurrentView('grading');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aft_selected_lane', String(laneNum));
      window.localStorage.setItem('aft_current_view', 'grading');
      window.localStorage.setItem(`aft_event_idx_lane_${laneNum}`, '4'); // Event index 4 is 2MR
    }
  };

  const handleOpen2MrMasterClock = () => {
    setCurrentView('2mr_start_point');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aft_current_view', '2mr_start_point');
    }
  };

  const handleOpenAllResultsFromLaneSelect = () => {
    setAllResultsSource('lane_select');
    setCurrentView('all_results');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aft_current_view', 'all_results');
    }
  };

  const handleOpenAllResultsFromGrading = () => {
    setAllResultsSource('grading');
    setCurrentView('all_results');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aft_current_view', 'all_results');
    }
  };

  const handleBackFromAllResults = () => {
    if (allResultsSource === 'grading') {
      setCurrentView('grading');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('aft_current_view', 'grading');
      }
    } else {
      setCurrentView('lane_select');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('aft_current_view', 'lane_select');
      }
    }
  };

  const handleBackFromGrading = () => {
    if (gradingSource === 'all_results') {
      setCurrentView('all_results');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('aft_current_view', 'all_results');
      }
    } else {
      setCurrentView('lane_select');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('aft_current_view', 'lane_select');
      }
    }
  };

  const handleBackToLaneSelect = () => {
    setCurrentView('lane_select');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aft_current_view', 'lane_select');
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-slate-900 flex justify-center items-stretch lg:items-center lg:py-4 lg:px-4 overflow-hidden">
      {/* Container - mobile standard width, wide only for all_results spreadsheet */}
      <div className={`w-full h-full max-h-full lg:max-h-[880px] lg:rounded-3xl bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-gray-100 flex flex-col shadow-2xl overflow-hidden relative border border-slate-700/50 ${currentView === 'all_results' ? 'max-w-6xl' : 'max-w-md'
        }`}>

        {/* SCREEN 1: LANE SELECTION HUB (Select Your Lane) */}
        {currentView === 'lane_select' && (
          <>
            <LaneSelectHeader
              onOpenImport={() => setShowImportModal(true)}
              onOpenSettings={() => setShowVestSettingsModal(true)}
              onOpenAllResults={handleOpenAllResultsFromLaneSelect}
            />
            <LaneSelectView
              laneConfigs={laneConfigs}
              activeCountByLane={activeCountByLane}
              laneTrainees={laneTrainees}
              failedCount={failedTrainees.length}
              onSelectLane={handleSelectLane}
              onOpen2MrStartPoint={handleOpen2MrMasterClock}
              onSelectReTestLane={handleSelectReTestLane}
            />
          </>
        )}

        {/* SCREEN: ALL RESULTS SPREADSHEET (Full Roster Results sorted by RN) */}
        {currentView === 'all_results' && (
          <AllResultsView
            laneTrainees={laneTrainees}
            activeCountByLane={activeCountByLane}
            laneConfigs={laneConfigs}
            onBackToLanes={handleBackFromAllResults}
            backButtonLabel={allResultsSource === 'grading' ? (selectedLane === RETEST_LANE_NUM ? 'Re-Test' : `Lane ${selectedLane}`) : 'Lanes'}
            onOpenReTest={handleOpenReTestFromAllResults}
          />
        )}

        {/* SCREEN 2: 2MR MASTER CLOCK (Dedicated Master Clock Screen) */}
        {currentView === '2mr_start_point' && (
          <TwoMileRunStartPointView
            twoMileRunSync={timer.twoMileRunSync}
            twoMileRunElapsedMs={timer.twoMileRunElapsedMs}
            isFirebaseConnected={isFirebaseConnected}
            laneTrainees={laneTrainees}
            laneConfigs={laneConfigs}
            activeCountByLane={activeCountByLane}
            onStart2MrTimer={() => timer.start2MrMasterTimer('Master Clock')}
            onReset2MrTimer={timer.reset2MrMasterTimer}
            onBackToLanes={handleBackToLaneSelect}
            onSelectLane2Mr={handleSelectLane2Mr}
          />
        )}

        {/* SCREEN 3: LANE GRADING VIEW (Active Evaluation Mode - Works for both Lanes 1-10 and Re-Test Lane) */}
        {currentView === 'grading' && (
          <GradingView
            selectedLane={selectedLane}
            currentLaneConfig={currentLaneConfig}
            currentTrainees={currentLaneTrainees}
            isFirebaseConnected={isFirebaseConnected}
            twoMileRunSync={timer.twoMileRunSync}
            twoMileRunElapsedMs={timer.twoMileRunElapsedMs}
            plkElapsedMs={timer.plkElapsedMs}
            plkTimerRunning={timer.plkTimerRunning}
            sdcStartTimes={timer.sdcStartTimes}
            sdcElapsedMs={timer.sdcElapsedMs}
            selectedPlkIds={timer.selectedPlkIds}
            plkRunningIds={timer.plkRunningIds}
            onBackToLanes={handleBackFromGrading}
            backButtonLabel={gradingSource === 'all_results' ? 'Total Results' : 'Lanes'}
            onOpenStandards={() => setShowStandardsModal(true)}
            onScoreChange={handleScoreChange}
            onUpdateTrainee={handleUpdateTrainee}
            onStart2MrTimer={timer.start2MrMasterTimer}
            onReset2MrTimer={timer.reset2MrMasterTimer}
            onStartBatchPlk={timer.startBatchPlk}
            onCancelPlkBatch={timer.cancelPlkBatch}
            onTogglePlkSelect={timer.toggleSelectPlkTrainee}
            onTimerAction={(traineeId, eventCode, targetLane) => {
              if (eventCode === 'SDC') timer.handleSdcAction(traineeId);
              else if (eventCode === 'PLK') timer.recordPlkStop(traineeId);
              else if (eventCode === '2MR') timer.handle2MrAction(traineeId, targetLane);
            }}
            onOpenAllResults={handleOpenAllResultsFromGrading}
            secondaryLane={selectedLane === RETEST_LANE_NUM ? null : effectiveSecondaryLane}
            secondaryLaneConfig={selectedLane === RETEST_LANE_NUM ? undefined : secondaryLaneConfig}
            secondaryTrainees={selectedLane === RETEST_LANE_NUM ? [] : secondaryTrainees}
            allLaneConfigs={laneConfigs}
            activeCountByLane={activeCountByLane}
            dualLanes={selectedLane === RETEST_LANE_NUM ? undefined : dualLanes}
            onSelectSecondaryLane={selectedLane === RETEST_LANE_NUM ? undefined : handleSelectSecondaryLane}
            retestCustomTrainees={selectedLane === RETEST_LANE_NUM ? retestCustomTrainees : undefined}
            onAddRetestSoldier={selectedLane === RETEST_LANE_NUM ? handleAddRetestSoldier : undefined}
            onEditRetestSoldier={selectedLane === RETEST_LANE_NUM ? handleEditRetestSoldier : undefined}
            onRemoveRetestSoldier={selectedLane === RETEST_LANE_NUM ? handleRemoveRetestSoldier : undefined}
          />
        )}
      </div>

      {/* EXCEL IMPORT / ROSTER VIEWER MODAL */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onUploadRoster={uploadRoster}
        laneTrainees={laneTrainees}
        laneConfigs={laneConfigs}
      />

      {/* OFFICIAL 2025 AFT STANDARDS MODAL */}
      <StandardsModal
        isOpen={showStandardsModal}
        onClose={() => setShowStandardsModal(false)}
      />

      {/* LANE VEST COLORS SETTINGS MODAL */}
      <VestSettingsModal
        isOpen={showVestSettingsModal}
        onClose={() => setShowVestSettingsModal(false)}
        laneConfigs={laneConfigs}
        onUpdateLaneColor={updateLaneVestConfig}
      />
    </div>
  );
}
