import { useState, useEffect, useRef, useCallback } from 'react';
import { ref as dbRef, onValue, set as dbSet, get as dbGet, serverTimestamp } from 'firebase/database';
import { db } from '../../lib/firebase';
import type { TraineeRecord, LaneConfig, EventCode, CohortRecord, Platoon } from '../../types/aft/aft.types';
import type { ParseExcelResult } from '../../utils/aft/excelParser';
import {
  STORAGE_KEY_TRAINEES,
  STORAGE_KEY_LANE_CONFIG,
  STORAGE_KEY_ACTIVE_COUNTS,
  STORAGE_KEY_RETEST_CUSTOM_TRAINEES,
  STORAGE_KEY_ACTIVE_COHORT_ID,
  STORAGE_KEY_COHORTS_LIST,
  STORAGE_KEY_ACTIVE_PLATOON,
  DEFAULT_COHORT_NAME,
  createDefaultLaneTrainees,
  createDefaultLaneConfigs
} from '../../utils/aft/constants';
import { normalizeLaneTrainees, normalizeActiveCount, normalizeCustomTrainees } from '../../utils/aft/normalizers';
import { getAgeGroupFromAge, formatAftDate } from '../../utils/aft/timeFormatter';
import {
  loadCohortsListFromStorage,
  loadActiveCohortIdFromStorage,
  loadActivePlatoonFromStorage,
  loadCohortPlatoonDataFromStorage,
  saveCohortPlatoonDataToStorage,
  removeCohortDataFromStorage,
  sanitizeCohortId,
  calculateActiveTraineeCount,
  getCohortPlatoonCounts,
  isCohortRosterUploaded
} from '../../utils/aft/cycleStorage';

export function useAftRoster() {
  // ----------------------------------------------------
  // 1. Cohorts & Platoon State
  // ----------------------------------------------------
  const [cohorts, setCohorts] = useState<CohortRecord[]>(() => loadCohortsListFromStorage());
  const [activeCohortId, setActiveCohortId] = useState<string>(() => loadActiveCohortIdFromStorage());
  const [activePlatoon, setActivePlatoon] = useState<Platoon>(() => loadActivePlatoonFromStorage());

  const cohortsRef = useRef(cohorts);
  useEffect(() => {
    cohortsRef.current = cohorts;
  }, [cohorts]);

  const activeCohortIdRef = useRef(activeCohortId);
  useEffect(() => {
    activeCohortIdRef.current = activeCohortId;
  }, [activeCohortId]);

  const activePlatoonRef = useRef(activePlatoon);
  useEffect(() => {
    activePlatoonRef.current = activePlatoon;
  }, [activePlatoon]);

  // Active Cohort Object
  const activeCohort = cohorts.find(c => c.id === activeCohortId) || {
    id: activeCohortId,
    name: activeCohortId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hasUploadedRoster: isCohortRosterUploaded(activeCohortId)
  };

  // ----------------------------------------------------
  // 2. Active Platoon In-Memory Data
  // ----------------------------------------------------
  const initialData = loadCohortPlatoonDataFromStorage(activeCohortId, activePlatoon);

  const [laneTrainees, setLaneTrainees] = useState<Record<number, TraineeRecord[]>>(initialData.laneTrainees);
  const laneTraineesRef = useRef(laneTrainees);
  useEffect(() => {
    laneTraineesRef.current = laneTrainees;
  }, [laneTrainees]);

  const [laneConfigs, setLaneConfigs] = useState<Record<number, LaneConfig>>(initialData.laneConfigs);
  const laneConfigsRef = useRef(laneConfigs);
  useEffect(() => {
    laneConfigsRef.current = laneConfigs;
  }, [laneConfigs]);

  const [activeCountByLane, setActiveCountByLane] = useState<Record<number, number>>(initialData.activeCountByLane);
  const activeCountByLaneRef = useRef(activeCountByLane);
  useEffect(() => {
    activeCountByLaneRef.current = activeCountByLane;
  }, [activeCountByLane]);

  const [retestCustomTrainees, setRetestCustomTrainees] = useState<TraineeRecord[]>(initialData.retestCustomTrainees);
  const retestCustomTraineesRef = useRef(retestCustomTrainees);
  useEffect(() => {
    retestCustomTraineesRef.current = retestCustomTrainees;
  }, [retestCustomTrainees]);

  const [dualLanes, setDualLanes] = useState<Record<number, { primaryLane: number; active: boolean }>>({});
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  // ----------------------------------------------------
  // 3. LocalStorage Persistence per Active Cohort & Platoon
  // ----------------------------------------------------
  useEffect(() => {
    if (typeof window !== 'undefined') {
      saveCohortPlatoonDataToStorage(activeCohortId, activePlatoon, {
        laneTrainees,
        laneConfigs,
        activeCountByLane,
        retestCustomTrainees
      });

      // Backward compatibility mirror
      window.localStorage.setItem(STORAGE_KEY_TRAINEES, JSON.stringify(laneTrainees));
      window.localStorage.setItem(STORAGE_KEY_LANE_CONFIG, JSON.stringify(laneConfigs));
      window.localStorage.setItem(STORAGE_KEY_ACTIVE_COUNTS, JSON.stringify(activeCountByLane));
      window.localStorage.setItem(STORAGE_KEY_RETEST_CUSTOM_TRAINEES, JSON.stringify(retestCustomTrainees));
    }
  }, [activeCohortId, activePlatoon, laneTrainees, laneConfigs, activeCountByLane, retestCustomTrainees]);

  // ----------------------------------------------------
  // 4. Firebase Health Check Listener
  // ----------------------------------------------------
  useEffect(() => {
    try {
      const connectedRef = dbRef(db, '.info/connected');
      const unsub = onValue(connectedRef, (snap) => {
        setIsFirebaseConnected(snap.val() === true);
      });
      return () => unsub();
    } catch {
      setIsFirebaseConnected(false);
    }
  }, []);

  // ----------------------------------------------------
  // 5. Firebase Cohorts List Synchronization
  // ----------------------------------------------------
  useEffect(() => {
    const cohortsListRef = dbRef(db, 'aft_sessions/cohorts/list');

    const handleSyncCohorts = (remoteVal: any) => {
      if (!remoteVal) return;
      const remoteList: CohortRecord[] = Array.isArray(remoteVal) ? remoteVal : Object.values(remoteVal);
      if (!remoteList || remoteList.length === 0) return;

      const mergedMap = new Map<string, CohortRecord>();

      // 1. Keep default 01-27
      const defaultCounts = getCohortPlatoonCounts(DEFAULT_COHORT_NAME);
      mergedMap.set(DEFAULT_COHORT_NAME, {
        id: DEFAULT_COHORT_NAME,
        name: DEFAULT_COHORT_NAME,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        hasUploadedRoster: defaultCounts.hasUploaded,
        alphaTraineeCount: defaultCounts.alpha,
        bravoTraineeCount: defaultCounts.bravo,
        traineeCount: defaultCounts.total
      });

      // 2. Add local cohorts from storage / memory
      loadCohortsListFromStorage().forEach(c => {
        if (c && c.id) {
          const counts = getCohortPlatoonCounts(c.id);
          const alpha = counts.hasUploaded ? counts.alpha : (typeof c.alphaTraineeCount === 'number' ? c.alphaTraineeCount : 0);
          const bravo = counts.hasUploaded ? counts.bravo : (typeof c.bravoTraineeCount === 'number' ? c.bravoTraineeCount : 0);
          const total = alpha + bravo;
          const hasUploaded = total > 0;

          mergedMap.set(c.id, {
            ...c,
            hasUploadedRoster: hasUploaded,
            alphaTraineeCount: alpha,
            bravoTraineeCount: bravo,
            traineeCount: total
          });
        }
      });

      // 3. Add remote cohorts
      remoteList.forEach(c => {
        if (c && c.id) {
          const existing = mergedMap.get(c.id);
          const counts = getCohortPlatoonCounts(c.id);

          // If local client has actual trainee records uploaded, trust local counts.
          // Otherwise, if remote has explicitly uploaded alpha/bravo trainee counts, use them.
          // Never count default dummy trainees.
          const alpha = counts.hasUploaded
            ? counts.alpha
            : (typeof c.alphaTraineeCount === 'number' ? c.alphaTraineeCount : (existing?.alphaTraineeCount ?? 0));
          const bravo = counts.hasUploaded
            ? counts.bravo
            : (typeof c.bravoTraineeCount === 'number' ? c.bravoTraineeCount : (existing?.bravoTraineeCount ?? 0));
          const total = alpha + bravo;
          const hasUploaded = total > 0;

          mergedMap.set(c.id, {
            ...existing,
            ...c,
            hasUploadedRoster: hasUploaded,
            alphaTraineeCount: alpha,
            bravoTraineeCount: bravo,
            traineeCount: total
          });
        }
      });

      const mergedList = Array.from(mergedMap.values());
      mergedList.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      setCohorts(mergedList);
      cohortsRef.current = mergedList;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY_COHORTS_LIST, JSON.stringify(mergedList));
      }
    };

    dbGet(cohortsListRef)
      .then((snap) => {
        if (snap.exists()) {
          handleSyncCohorts(snap.val());
        } else {
          const initialMap: Record<string, CohortRecord> = {};
          cohortsRef.current.forEach((c) => {
            initialMap[c.id] = c;
          });
          dbSet(cohortsListRef, initialMap).catch(console.warn);
        }
      })
      .catch((err) => {
        console.warn('Initial Firebase cohorts list fetch failed:', err);
      });

    const unsub = onValue(
      cohortsListRef,
      (snap) => {
        if (snap.exists()) {
          handleSyncCohorts(snap.val());
        }
      },
      (err) => {
        console.warn('Firebase cohorts list onValue error:', err);
      }
    );

    return () => unsub();
  }, []);

  // ----------------------------------------------------
  // 6. Firebase Roster Subscription (Scoped to Active Cohort & Platoon)
  // ----------------------------------------------------
  useEffect(() => {
    const platoonRosterPath = `aft_sessions/cohorts/data/${activeCohortId}/${activePlatoon}/roster`;
    const rosterRef = dbRef(db, platoonRosterPath);

    dbGet(rosterRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data && data.laneTrainees) {
            const normalized = normalizeLaneTrainees(data.laneTrainees);
            setLaneTrainees(normalized);
            laneTraineesRef.current = normalized;
            if (data.activeCountByLane) {
              setActiveCountByLane(normalizeActiveCount(data.activeCountByLane));
            }
          }
        }
      })
      .catch((err) => {
        console.warn(`Initial Firebase roster get failed for cohort ${activeCohortId} platoon ${activePlatoon}:`, err);
      });

    const unsubscribe = onValue(
      rosterRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data && data.laneTrainees) {
            const normalized = normalizeLaneTrainees(data.laneTrainees);
            setLaneTrainees(normalized);
            laneTraineesRef.current = normalized;
            if (data.activeCountByLane) {
              setActiveCountByLane(normalizeActiveCount(data.activeCountByLane));
            }
          }
        }
      },
      (error) => {
        console.warn(`Firebase roster onValue error:`, error);
      }
    );

    return () => unsubscribe();
  }, [activeCohortId, activePlatoon]);

  // ----------------------------------------------------
  // 7. Firebase Custom Re-Test Trainees (Scoped to Active Cohort & Platoon)
  // ----------------------------------------------------
  useEffect(() => {
    const customRef = dbRef(db, `aft_sessions/cohorts/data/${activeCohortId}/${activePlatoon}/retest_custom_trainees`);

    dbGet(customRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const normalized = normalizeCustomTrainees(snapshot.val());
          setRetestCustomTrainees(normalized);
          retestCustomTraineesRef.current = normalized;
        } else {
          setRetestCustomTrainees([]);
          retestCustomTraineesRef.current = [];
        }
      })
      .catch(console.warn);

    const unsub = onValue(
      customRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const normalized = normalizeCustomTrainees(snapshot.val());
          setRetestCustomTrainees(normalized);
          retestCustomTraineesRef.current = normalized;
        } else {
          setRetestCustomTrainees([]);
          retestCustomTraineesRef.current = [];
        }
      },
      console.warn
    );

    return () => unsub();
  }, [activeCohortId, activePlatoon]);

  // ----------------------------------------------------
  // 8. Dual Lanes (Scoped to Active Cohort & Platoon)
  // ----------------------------------------------------
  useEffect(() => {
    try {
      const dualRef = dbRef(db, `aft_sessions/cohorts/data/${activeCohortId}/${activePlatoon}/dual_lanes`);
      const unsub = onValue(
        dualRef,
        (snap) => {
          if (snap.exists()) {
            setDualLanes(snap.val() || {});
          } else {
            setDualLanes({});
          }
        },
        console.warn
      );
      return () => unsub();
    } catch {}
  }, [activeCohortId, activePlatoon]);

  // ----------------------------------------------------
  // 9. Platoon & Cohort Actions
  // ----------------------------------------------------
  const switchPlatoon = useCallback((targetPlatoon: Platoon) => {
    if (targetPlatoon === activePlatoonRef.current) return;

    // 1. Save current platoon state
    saveCohortPlatoonDataToStorage(activeCohortIdRef.current, activePlatoonRef.current, {
      laneTrainees: laneTraineesRef.current,
      laneConfigs: laneConfigsRef.current,
      activeCountByLane: activeCountByLaneRef.current,
      retestCustomTrainees: retestCustomTraineesRef.current
    });

    // 2. Load target platoon state
    const nextData = loadCohortPlatoonDataFromStorage(activeCohortIdRef.current, targetPlatoon);
    setLaneTrainees(nextData.laneTrainees);
    laneTraineesRef.current = nextData.laneTrainees;

    setActiveCountByLane(nextData.activeCountByLane);
    activeCountByLaneRef.current = nextData.activeCountByLane;

    setRetestCustomTrainees(nextData.retestCustomTrainees);
    retestCustomTraineesRef.current = nextData.retestCustomTrainees;

    // 3. Update activePlatoon
    setActivePlatoon(targetPlatoon);
    activePlatoonRef.current = targetPlatoon;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_ACTIVE_PLATOON, targetPlatoon);
    }
  }, []);

  const switchCohort = useCallback((targetCohortId: string) => {
    if (targetCohortId === activeCohortIdRef.current) return;

    // 1. Save current cohort platoon data
    saveCohortPlatoonDataToStorage(activeCohortIdRef.current, activePlatoonRef.current, {
      laneTrainees: laneTraineesRef.current,
      laneConfigs: laneConfigsRef.current,
      activeCountByLane: activeCountByLaneRef.current,
      retestCustomTrainees: retestCustomTraineesRef.current
    });

    // 2. Load target cohort data for active platoon
    const nextData = loadCohortPlatoonDataFromStorage(targetCohortId, activePlatoonRef.current);
    setLaneTrainees(nextData.laneTrainees);
    laneTraineesRef.current = nextData.laneTrainees;

    setLaneConfigs(nextData.laneConfigs);
    laneConfigsRef.current = nextData.laneConfigs;

    setActiveCountByLane(nextData.activeCountByLane);
    activeCountByLaneRef.current = nextData.activeCountByLane;

    setRetestCustomTrainees(nextData.retestCustomTrainees);
    retestCustomTraineesRef.current = nextData.retestCustomTrainees;

    // 3. Update activeCohortId
    setActiveCohortId(targetCohortId);
    activeCohortIdRef.current = targetCohortId;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_ACTIVE_COHORT_ID, targetCohortId);
    }
  }, []);

  const createCohort = useCallback(async (rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) throw new Error('Please enter a cycle name.');

    const cohortId = sanitizeCohortId(trimmed);

    // Duplicate check
    const exists = cohortsRef.current.some(c => c.id === cohortId || c.name === trimmed);
    if (exists) {
      throw new Error(`Cycle already exists: ${trimmed}`);
    }

    const newCohort: CohortRecord = {
      id: cohortId,
      name: trimmed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hasUploadedRoster: false,
      alphaTraineeCount: 0,
      bravoTraineeCount: 0,
      traineeCount: 0
    };

    const nextList = [...cohortsRef.current, newCohort];
    setCohorts(nextList);
    cohortsRef.current = nextList;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`aft_c_${cohortId}_alpha_uploaded_count`, '0');
      window.localStorage.setItem(`aft_c_${cohortId}_bravo_uploaded_count`, '0');
      window.localStorage.setItem(`aft_c_${cohortId}_roster_uploaded`, 'false');
      window.localStorage.setItem(`aft_c_${cohortId}_alpha_roster_uploaded`, 'false');
      window.localStorage.setItem(`aft_c_${cohortId}_bravo_roster_uploaded`, 'false');
      window.localStorage.setItem(STORAGE_KEY_COHORTS_LIST, JSON.stringify(nextList));
    }

    // Initialize clean platoon data (no roster uploaded yet)
    for (const p of ['alpha', 'bravo'] as Platoon[]) {
      const freshT = createDefaultLaneTrainees(p);
      const freshC: Record<number, number> = {};
      for (let i = 1; i <= 10; i++) freshC[i] = 10;

      saveCohortPlatoonDataToStorage(cohortId, p, {
        laneTrainees: freshT,
        laneConfigs: createDefaultLaneConfigs(),
        activeCountByLane: freshC,
        retestCustomTrainees: []
      });
    }

    // Sync to Firebase
    try {
      const cohortsMap: Record<string, CohortRecord> = {};
      nextList.forEach(c => { cohortsMap[c.id] = c; });
      await dbSet(dbRef(db, 'aft_sessions/cohorts/list'), cohortsMap);
    } catch (e) {
      console.warn('Failed to sync new cohort to Firebase:', e);
    }

    switchCohort(cohortId);
    return newCohort;
  }, [switchCohort]);

  const deleteCohort = useCallback(async (cohortId: string) => {
    if (cohortsRef.current.length <= 1) {
      throw new Error('At least one cycle must be maintained.');
    }
    if (cohortId === DEFAULT_COHORT_NAME) {
      throw new Error('Default cycle (01-27) cannot be deleted.');
    }

    const nextList = cohortsRef.current.filter(c => c.id !== cohortId);
    setCohorts(nextList);
    cohortsRef.current = nextList;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_COHORTS_LIST, JSON.stringify(nextList));
      removeCohortDataFromStorage(cohortId);
    }

    try {
      const cohortsMap: Record<string, CohortRecord> = {};
      nextList.forEach(c => { cohortsMap[c.id] = c; });
      await dbSet(dbRef(db, 'aft_sessions/cohorts/list'), cohortsMap);
      await dbSet(dbRef(db, `aft_sessions/cohorts/data/${cohortId}`), null);
    } catch (e) {
      console.warn(`Failed to delete cohort ${cohortId} from Firebase:`, e);
    }

    if (activeCohortIdRef.current === cohortId) {
      const fallback = nextList[0];
      if (fallback) {
        switchCohort(fallback.id);
      }
    }
  }, [switchCohort]);

  const renameCohort = useCallback(async (cohortId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Please enter a cycle name.');

    const nextList = cohortsRef.current.map(c => {
      if (c.id === cohortId) {
        return { ...c, name: trimmed, updatedAt: Date.now() };
      }
      return c;
    });

    setCohorts(nextList);
    cohortsRef.current = nextList;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_COHORTS_LIST, JSON.stringify(nextList));
    }

    try {
      await dbSet(dbRef(db, `aft_sessions/cohorts/list/${cohortId}/name`), trimmed);
      await dbSet(dbRef(db, `aft_sessions/cohorts/list/${cohortId}/updatedAt`), serverTimestamp());
    } catch (e) {
      console.warn('Failed to update cohort name in Firebase:', e);
    }
  }, []);

  // ----------------------------------------------------
  // 10. Excel Roster Upload Action (Auto-Splits Alpha & Bravo)
  // ----------------------------------------------------
  const uploadRoster = async (parseResult: ParseExcelResult) => {
    const cId = activeCohortIdRef.current;

    // Save Alpha Platoon data
    if (parseResult.alpha.totalTrainees > 0) {
      saveCohortPlatoonDataToStorage(cId, 'alpha', {
        laneTrainees: parseResult.alpha.parsedTraineesByLane,
        activeCountByLane: parseResult.alpha.counts
      });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`aft_c_${cId}_alpha_uploaded_count`, String(parseResult.alpha.totalTrainees));
        window.localStorage.setItem(`aft_c_${cId}_alpha_roster_uploaded`, 'true');
      }
    } else {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`aft_c_${cId}_alpha_uploaded_count`, '0');
        window.localStorage.setItem(`aft_c_${cId}_alpha_roster_uploaded`, 'false');
      }
    }

    // Save Bravo Platoon data
    if (parseResult.bravo.totalTrainees > 0) {
      saveCohortPlatoonDataToStorage(cId, 'bravo', {
        laneTrainees: parseResult.bravo.parsedTraineesByLane,
        activeCountByLane: parseResult.bravo.counts
      });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`aft_c_${cId}_bravo_uploaded_count`, String(parseResult.bravo.totalTrainees));
        window.localStorage.setItem(`aft_c_${cId}_bravo_roster_uploaded`, 'true');
      }
    } else {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`aft_c_${cId}_bravo_uploaded_count`, '0');
        window.localStorage.setItem(`aft_c_${cId}_bravo_roster_uploaded`, 'false');
      }
    }

    // Set uploaded flag & dates
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`aft_c_${cId}_roster_uploaded`, 'true');
      if (parseResult.alphaDate) {
        window.localStorage.setItem(`aft_c_${cId}_alpha_date`, parseResult.alphaDate);
      }
      if (parseResult.bravoDate) {
        window.localStorage.setItem(`aft_c_${cId}_bravo_date`, parseResult.bravoDate);
      }
    }

    // Update in-memory state for active platoon
    const activeResult = activePlatoonRef.current === 'alpha' ? parseResult.alpha : parseResult.bravo;
    if (activeResult.totalTrainees > 0) {
      setLaneTrainees(activeResult.parsedTraineesByLane);
      laneTraineesRef.current = activeResult.parsedTraineesByLane;

      setActiveCountByLane(activeResult.counts);
      activeCountByLaneRef.current = activeResult.counts;
    }

    // Update cohorts list
    const updatedList = cohortsRef.current.map(c => {
      if (c.id === cId) {
        return {
          ...c,
          hasUploadedRoster: true,
          alphaTraineeCount: parseResult.alpha.totalTrainees,
          bravoTraineeCount: parseResult.bravo.totalTrainees,
          traineeCount: parseResult.totalTrainees,
          updatedAt: Date.now()
        };
      }
      return c;
    });

    setCohorts(updatedList);
    cohortsRef.current = updatedList;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_COHORTS_LIST, JSON.stringify(updatedList));
    }

    // Sync to Firebase
    try {
      const cohortsMap: Record<string, CohortRecord> = {};
      updatedList.forEach(c => { cohortsMap[c.id] = c; });
      await dbSet(dbRef(db, 'aft_sessions/cohorts/list'), cohortsMap);

      if (parseResult.alpha.totalTrainees > 0) {
        await dbSet(dbRef(db, `aft_sessions/cohorts/data/${cId}/alpha/roster`), {
          laneTrainees: parseResult.alpha.parsedTraineesByLane,
          activeCountByLane: parseResult.alpha.counts,
          uploadedAt: serverTimestamp(),
          totalTrainees: parseResult.alpha.totalTrainees
        });
      }

      if (parseResult.bravo.totalTrainees > 0) {
        await dbSet(dbRef(db, `aft_sessions/cohorts/data/${cId}/bravo/roster`), {
          laneTrainees: parseResult.bravo.parsedTraineesByLane,
          activeCountByLane: parseResult.bravo.counts,
          uploadedAt: serverTimestamp(),
          totalTrainees: parseResult.bravo.totalTrainees
        });
      }
    } catch (e) {
      console.warn('Failed to sync uploaded rosters to Firebase:', e);
    }
  };

  // ----------------------------------------------------
  // 11. Scoring & Grading Actions (Scoped to Active Platoon)
  // ----------------------------------------------------
  const updateScore = async (
    selectedLane: number,
    traineeId: string,
    eventCode: EventCode,
    value: string
  ) => {
    const currentList = laneTraineesRef.current[selectedLane] || [];
    const nextList = currentList.map((t) => {
      if (t.id === traineeId) {
        return {
          ...t,
          scores: {
            ...t.scores,
            [eventCode]: value
          }
        };
      }
      return t;
    });

    const nextTrainees = {
      ...laneTraineesRef.current,
      [selectedLane]: nextList
    };
    laneTraineesRef.current = nextTrainees;
    setLaneTrainees(nextTrainees);

    if (typeof window !== 'undefined') {
      const cId = activeCohortIdRef.current;
      const platoon = activePlatoonRef.current;
      window.localStorage.setItem(`aft_c_${cId}_${platoon}_grading_date`, formatAftDate(new Date()));
    }

    try {
      const cId = activeCohortIdRef.current;
      const platoon = activePlatoonRef.current;
      const laneRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/${platoon}/roster/laneTrainees/${selectedLane}`);
      await dbSet(laneRef, nextList);
    } catch (e) {
      console.warn('Failed to sync score to Firebase:', e);
    }
  };

  const updateTrainee = async (
    selectedLane: number,
    traineeId: string,
    updates: Partial<TraineeRecord>
  ) => {
    const currentList = laneTraineesRef.current[selectedLane] || [];
    const nextList = currentList.map((t) => {
      if (t.id === traineeId) {
        const updated = { ...t, ...updates };
        if (updates.age !== undefined) {
          updated.ageGroup = getAgeGroupFromAge(updates.age);
        }
        return updated;
      }
      return t;
    });

    const nextTrainees = {
      ...laneTraineesRef.current,
      [selectedLane]: nextList
    };
    laneTraineesRef.current = nextTrainees;
    setLaneTrainees(nextTrainees);

    try {
      const cId = activeCohortIdRef.current;
      const platoon = activePlatoonRef.current;
      const laneRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/${platoon}/roster/laneTrainees/${selectedLane}`);
      await dbSet(laneRef, nextList);
    } catch (e) {
      console.warn('Failed to sync trainee update to Firebase:', e);
    }
  };

  const updateLaneVestConfig = async (laneNum: number, colorName: string, colorCode: string) => {
    const nextConfigs = {
      ...laneConfigsRef.current,
      [laneNum]: {
        laneNumber: laneNum,
        vestColor: colorName,
        vestColorCode: colorCode
      }
    };
    laneConfigsRef.current = nextConfigs;
    setLaneConfigs(nextConfigs);

    try {
      const cId = activeCohortIdRef.current;
      const configRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/laneConfigs/${laneNum}`);
      await dbSet(configRef, {
        laneNumber: laneNum,
        vestColor: colorName,
        vestColorCode: colorCode
      });
    } catch (e) {
      console.warn('Failed to sync lane config update to Firebase:', e);
    }
  };

  const updateRetestScore = async (
    selectedLane: number,
    traineeId: string,
    eventCode: EventCode,
    value: string
  ) => {
    const currentList = laneTraineesRef.current[selectedLane] || [];
    const nextList = currentList.map((t) => {
      if (t.id === traineeId) {
        return {
          ...t,
          retestScores: {
            ...(t.retestScores || {}),
            [eventCode]: value
          }
        };
      }
      return t;
    });

    const nextTrainees = {
      ...laneTraineesRef.current,
      [selectedLane]: nextList
    };
    laneTraineesRef.current = nextTrainees;
    setLaneTrainees(nextTrainees);

    try {
      const cId = activeCohortIdRef.current;
      const platoon = activePlatoonRef.current;
      const laneRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/${platoon}/roster/laneTrainees/${selectedLane}`);
      await dbSet(laneRef, nextList);
    } catch (e) {
      console.warn('Failed to sync retest score to Firebase:', e);
    }
  };

  const setDualLane = async (primaryLane: number, secondaryLane: number) => {
    const cId = activeCohortIdRef.current;
    const platoon = activePlatoonRef.current;
    try {
      const dualRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/${platoon}/dual_lanes/${secondaryLane}`);
      await dbSet(dualRef, {
        primaryLane,
        active: true,
        updatedAt: serverTimestamp()
      });
      setDualLanes((prev) => ({
        ...prev,
        [secondaryLane]: { primaryLane, active: true }
      }));
    } catch (e) {
      setDualLanes((prev) => ({
        ...prev,
        [secondaryLane]: { primaryLane, active: true }
      }));
    }
  };

  const clearDualLane = async (secondaryLane: number) => {
    const cId = activeCohortIdRef.current;
    const platoon = activePlatoonRef.current;
    try {
      const dualRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/${platoon}/dual_lanes/${secondaryLane}`);
      await dbSet(dualRef, null);
      setDualLanes((prev) => {
        const next = { ...prev };
        delete next[secondaryLane];
        return next;
      });
    } catch (e) {
      setDualLanes((prev) => {
        const next = { ...prev };
        delete next[secondaryLane];
        return next;
      });
    }
  };

  const addCustomRetestSoldier = async (soldier: {
    name: string;
    age: number;
    vestNumber?: string;
    rosterNumber?: string;
  }) => {
    const nextRoster = soldier.rosterNumber?.trim() || '';
    const nextVest = soldier.vestNumber?.trim() || '';
    const newTrainee: TraineeRecord = {
      id: `custom-retest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: soldier.name.trim(),
      age: soldier.age,
      ageGroup: getAgeGroupFromAge(soldier.age),
      vestNumber: nextVest,
      rosterNumber: nextRoster,
      scores: { MDL: '', MDL2: '', HRP: '', SDC: '', PLK: '', '2MR': '' }
    };

    const nextList = [...retestCustomTraineesRef.current, newTrainee];
    retestCustomTraineesRef.current = nextList;
    setRetestCustomTrainees(nextList);

    try {
      const cId = activeCohortIdRef.current;
      const platoon = activePlatoonRef.current;
      const customRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/${platoon}/retest_custom_trainees`);
      await dbSet(customRef, nextList);
    } catch (e) {
      console.warn('Failed to sync added custom retest trainee to Firebase:', e);
    }
  };

  const editCustomRetestSoldier = async (
    traineeId: string,
    soldier: {
      name: string;
      age: number;
      vestNumber?: string;
      rosterNumber?: string;
    }
  ) => {
    const nextList = retestCustomTraineesRef.current.map((t) => {
      if (t.id === traineeId) {
        return {
          ...t,
          name: soldier.name.trim(),
          age: soldier.age,
          ageGroup: getAgeGroupFromAge(soldier.age),
          vestNumber: soldier.vestNumber !== undefined ? soldier.vestNumber.trim() : t.vestNumber,
          rosterNumber: soldier.rosterNumber !== undefined ? soldier.rosterNumber.trim() : t.rosterNumber
        };
      }
      return t;
    });

    retestCustomTraineesRef.current = nextList;
    setRetestCustomTrainees(nextList);

    try {
      const cId = activeCohortIdRef.current;
      const platoon = activePlatoonRef.current;
      const customRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/${platoon}/retest_custom_trainees`);
      await dbSet(customRef, nextList);
    } catch (e) {
      console.warn('Failed to sync edited custom retest trainee to Firebase:', e);
    }
  };

  const removeCustomRetestSoldier = async (traineeId: string) => {
    const nextList = retestCustomTraineesRef.current.filter((t) => t.id !== traineeId);
    retestCustomTraineesRef.current = nextList;
    setRetestCustomTrainees(nextList);

    try {
      const cId = activeCohortIdRef.current;
      const platoon = activePlatoonRef.current;
      const customRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/${platoon}/retest_custom_trainees`);
      await dbSet(customRef, nextList);
    } catch (e) {
      console.warn('Failed to sync deleted custom retest trainee to Firebase:', e);
    }
  };

  const reorderCustomRetestSoldiers = async (nextList: TraineeRecord[]) => {
    retestCustomTraineesRef.current = nextList;
    setRetestCustomTrainees(nextList);

    try {
      const cId = activeCohortIdRef.current;
      const platoon = activePlatoonRef.current;
      const customRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/${platoon}/retest_custom_trainees`);
      await dbSet(customRef, nextList);
    } catch (e) {
      console.warn('Failed to sync reordered custom retest trainees to Firebase:', e);
    }
  };

  const updateCustomRetestScore = async (
    traineeId: string,
    eventCode: EventCode,
    value: string
  ) => {
    const nextList = retestCustomTraineesRef.current.map((t) => {
      if (t.id === traineeId) {
        return {
          ...t,
          scores: {
            ...t.scores,
            [eventCode]: value
          }
        };
      }
      return t;
    });

    retestCustomTraineesRef.current = nextList;
    setRetestCustomTrainees(nextList);

    try {
      const cId = activeCohortIdRef.current;
      const platoon = activePlatoonRef.current;
      const customRef = dbRef(db, `aft_sessions/cohorts/data/${cId}/${platoon}/retest_custom_trainees`);
      await dbSet(customRef, nextList);
    } catch (e) {
      console.warn('Failed to sync custom retest score to Firebase:', e);
    }
  };

  return {
    cohorts,
    activeCohortId,
    activeCohort,
    activePlatoon,
    switchPlatoon,
    switchCohort,
    createCohort,
    deleteCohort,
    renameCohort,
    laneTrainees,
    laneConfigs,
    activeCountByLane,
    isFirebaseConnected,
    retestCustomTrainees,
    addCustomRetestSoldier,
    editCustomRetestSoldier,
    removeCustomRetestSoldier,
    reorderCustomRetestSoldiers,
    updateCustomRetestScore,
    dualLanes,
    setDualLane,
    clearDualLane,
    updateScore,
    updateTrainee,
    updateRetestScore,
    updateLaneVestConfig,
    uploadRoster,
    setActiveCountByLane
  };
}
