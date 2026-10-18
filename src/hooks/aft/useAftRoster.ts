import { useState, useEffect, useRef } from 'react';
import { ref as dbRef, onValue, set as dbSet, get as dbGet, serverTimestamp } from 'firebase/database';
import { db } from '../../lib/firebase';
import type { TraineeRecord, LaneConfig, EventCode } from '../../types/aft/aft.types';
import {
  STORAGE_KEY_TRAINEES,
  STORAGE_KEY_LANE_CONFIG,
  STORAGE_KEY_ACTIVE_COUNTS,
  STORAGE_KEY_RETEST_CUSTOM_TRAINEES,
  createDefaultLaneTrainees,
  createDefaultLaneConfigs
} from '../../utils/aft/constants';
import { normalizeLaneTrainees, normalizeActiveCount, normalizeCustomTrainees } from '../../utils/aft/normalizers';
import { getAgeGroupFromAge } from '../../utils/aft/timeFormatter';

export function useAftRoster() {
  // Lane Trainees Data (Persisted across sessions)
  const [laneTrainees, setLaneTrainees] = useState<Record<number, TraineeRecord[]>>(() => {
    if (typeof window === 'undefined') return createDefaultLaneTrainees();
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_TRAINEES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load trainees:', e);
    }
    return createDefaultLaneTrainees();
  });

  const laneTraineesRef = useRef(laneTrainees);
  useEffect(() => {
    laneTraineesRef.current = laneTrainees;
  }, [laneTrainees]);

  // Lane Configuration (Vest Color, etc.)
  const [laneConfigs, setLaneConfigs] = useState<Record<number, LaneConfig>>(() => {
    if (typeof window === 'undefined') return createDefaultLaneConfigs();
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_LANE_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load lane configs:', e);
    }
    return createDefaultLaneConfigs();
  });

  const laneConfigsRef = useRef(laneConfigs);
  useEffect(() => {
    laneConfigsRef.current = laneConfigs;
  }, [laneConfigs]);

  // Active Count per Lane (1 to 10)
  const [activeCountByLane, setActiveCountByLane] = useState<Record<number, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY_ACTIVE_COUNTS);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load active counts:', e);
      }
    }
    const initial: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) initial[i] = 10;
    return initial;
  });

  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  // Sync to LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_TRAINEES, JSON.stringify(laneTrainees));
    }
  }, [laneTrainees]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_LANE_CONFIG, JSON.stringify(laneConfigs));
    }
  }, [laneConfigs]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_ACTIVE_COUNTS, JSON.stringify(activeCountByLane));
    }
  }, [activeCountByLane]);

  // Custom Re-Test Trainees (EXT Soldiers) State & LocalStorage
  const [retestCustomTrainees, setRetestCustomTrainees] = useState<TraineeRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_RETEST_CUSTOM_TRAINEES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load custom retest trainees:', e);
    }
    return [];
  });

  const retestCustomTraineesRef = useRef(retestCustomTrainees);
  useEffect(() => {
    retestCustomTraineesRef.current = retestCustomTrainees;
  }, [retestCustomTrainees]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY_RETEST_CUSTOM_TRAINEES, JSON.stringify(retestCustomTrainees));
    }
  }, [retestCustomTrainees]);

  // Connection Health Listener
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

  // Real-time listener & Immediate Fetch for Shared Trainee Roster from Firebase RTDB
  useEffect(() => {
    const rosterRef = dbRef(db, 'aft_sessions/roster');

    // 1. Immediate One-Time Fetch on Mount
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
            if (data.laneConfigs) {
              setLaneConfigs(data.laneConfigs);
              laneConfigsRef.current = data.laneConfigs;
            }
          }
        }
      })
      .catch((err) => {
        console.warn('Initial Firebase roster get failed:', err);
      });

    // 2. Real-time Live Subscription
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
            if (data.laneConfigs) {
              setLaneConfigs(data.laneConfigs);
              laneConfigsRef.current = data.laneConfigs;
            }
          }
        }
      },
      (error) => {
        console.warn('Firebase roster onValue listener error:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time listener & Immediate Fetch for Custom Re-Test Trainees (EXT Soldiers) from Firebase RTDB
  useEffect(() => {
    const customRef = dbRef(db, 'aft_sessions/retest_custom_trainees');

    // 1. Immediate One-Time Fetch on Mount
    dbGet(customRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const normalized = normalizeCustomTrainees(snapshot.val());
          setRetestCustomTrainees(normalized);
          retestCustomTraineesRef.current = normalized;
        } else if (retestCustomTraineesRef.current.length > 0) {
          // If Firebase is empty but we have local soldiers, migrate them to Firebase
          dbSet(customRef, retestCustomTraineesRef.current).catch(console.warn);
        }
      })
      .catch((err) => {
        console.warn('Initial Firebase custom retest get failed:', err);
      });

    // 2. Real-time Live Subscription
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
      (err) => {
        console.warn('Firebase custom retest listener error:', err);
      }
    );

    return () => unsub();
  }, []);

  // Dual Lane Simultaneous Grading State & Firebase RTDB Listener
  const [dualLanes, setDualLanes] = useState<Record<number, { primaryLane: number; active: boolean }>>({});

  useEffect(() => {
    try {
      const dualRef = dbRef(db, 'aft_sessions/dual_lanes');
      const unsub = onValue(
        dualRef,
        (snap) => {
          if (snap.exists()) {
            setDualLanes(snap.val() || {});
          } else {
            setDualLanes({});
          }
        },
        (err) => {
          console.warn('Firebase dual_lanes listener error:', err);
        }
      );
      return () => unsub();
    } catch {
      // ignore
    }
  }, []);

  // Actions
  const updateScore = async (
    selectedLane: number,
    traineeId: string,
    eventCode: EventCode,
    value: string
  ) => {
    const currentList = laneTraineesRef.current[selectedLane] || createDefaultLaneTrainees()[selectedLane] || [];
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

    try {
      const laneRef = dbRef(db, `aft_sessions/roster/laneTrainees/${selectedLane}`);
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
    const currentList = laneTraineesRef.current[selectedLane] || createDefaultLaneTrainees()[selectedLane] || [];
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
      const laneRef = dbRef(db, `aft_sessions/roster/laneTrainees/${selectedLane}`);
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
      const configRef = dbRef(db, `aft_sessions/roster/laneConfigs/${laneNum}`);
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
    const currentList = laneTraineesRef.current[selectedLane] || createDefaultLaneTrainees()[selectedLane] || [];
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
      const laneRef = dbRef(db, `aft_sessions/roster/laneTrainees/${selectedLane}`);
      await dbSet(laneRef, nextList);
    } catch (e) {
      console.warn('Failed to sync retest score to Firebase:', e);
    }
  };

  const uploadRoster = async (
    parsedTraineesByLane: Record<number, TraineeRecord[]>,
    counts: Record<number, number>,
    totalTrainees: number
  ) => {
    setLaneTrainees(parsedTraineesByLane);
    setActiveCountByLane(counts);

    const rosterRef = dbRef(db, 'aft_sessions/roster');
    await dbSet(rosterRef, {
      laneTrainees: parsedTraineesByLane,
      activeCountByLane: counts,
      laneConfigs,
      uploadedAt: serverTimestamp(),
      totalTrainees
    });
  };

  const setDualLane = async (primaryLane: number, secondaryLane: number) => {
    try {
      const dualRef = dbRef(db, `aft_sessions/dual_lanes/${secondaryLane}`);
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
      console.warn('Failed to set dual lane in Firebase:', e);
      setDualLanes((prev) => ({
        ...prev,
        [secondaryLane]: { primaryLane, active: true }
      }));
    }
  };

  const clearDualLane = async (secondaryLane: number) => {
    try {
      const dualRef = dbRef(db, `aft_sessions/dual_lanes/${secondaryLane}`);
      await dbSet(dualRef, null);
      setDualLanes((prev) => {
        const next = { ...prev };
        delete next[secondaryLane];
        return next;
      });
    } catch (e) {
      console.warn('Failed to clear dual lane in Firebase:', e);
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
      scores: {
        MDL: '',
        MDL2: '',
        HRP: '',
        SDC: '',
        PLK: '',
        '2MR': ''
      }
    };

    const nextList = [...retestCustomTraineesRef.current, newTrainee];
    retestCustomTraineesRef.current = nextList;
    setRetestCustomTrainees(nextList);

    try {
      const customRef = dbRef(db, 'aft_sessions/retest_custom_trainees');
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
      const customRef = dbRef(db, 'aft_sessions/retest_custom_trainees');
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
      const customRef = dbRef(db, 'aft_sessions/retest_custom_trainees');
      await dbSet(customRef, nextList);
    } catch (e) {
      console.warn('Failed to sync deleted custom retest trainee to Firebase:', e);
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
      const customRef = dbRef(db, 'aft_sessions/retest_custom_trainees');
      await dbSet(customRef, nextList);
    } catch (e) {
      console.warn('Failed to sync custom retest score to Firebase:', e);
    }
  };

  return {
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
    uploadRoster,
    setActiveCountByLane
  };
}
