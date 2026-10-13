import { useState, useEffect, useRef } from 'react';
import { ref as dbRef, onValue, set as dbSet, get as dbGet, serverTimestamp } from 'firebase/database';
import { db } from '../../lib/firebase';
import type { TraineeRecord, LaneConfig, EventCode } from '../../types/aft/aft.types';
import {
  STORAGE_KEY_TRAINEES,
  STORAGE_KEY_LANE_CONFIG,
  STORAGE_KEY_ACTIVE_COUNTS,
  createDefaultLaneTrainees,
  createDefaultLaneConfigs
} from '../../utils/aft/constants';
import { normalizeLaneTrainees, normalizeActiveCount } from '../../utils/aft/normalizers';
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

  return {
    laneTrainees,
    laneConfigs,
    activeCountByLane,
    isFirebaseConnected,
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
