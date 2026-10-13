import { useState, useEffect, useRef } from 'react';
import { ref as dbRef, onValue, set as dbSet, get as dbGet, serverTimestamp } from 'firebase/database';
import { db } from '../../lib/firebase';
import { formatTime } from '../../utils/aft/timeFormatter';

export function useAftTimer(
  selectedLane: number,
  onScoreAutoSave: (traineeId: string, eventCode: 'SDC' | 'PLK' | '2MR', timeStr: string, targetLane?: number) => void
) {
  // ==========================================
  // 1. 2MR (2-Mile Run) Dedicated Master Timer
  // ==========================================
  const [deviceId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('aft_device_id');
      if (saved) return saved;
      const newId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      window.localStorage.setItem('aft_device_id', newId);
      return newId;
    }
    return 'server-device';
  });

  const [twoMileRunSync, setTwoMileRunSync] = useState<{
    startTime: number | null;
    status: 'idle' | 'running' | 'finished';
    startedBy?: string;
    startedById?: string;
    startedInLane?: string;
  }>({ startTime: null, status: 'idle' });

  const [twoMileRunElapsedMs, setTwoMileRunElapsedMs] = useState<number>(0);
  const serverTimeOffsetRef = useRef<number>(0);

  // Server Time Offset
  useEffect(() => {
    try {
      const offsetRef = dbRef(db, '.info/serverTimeOffset');
      const unsub = onValue(offsetRef, (snap) => {
        serverTimeOffsetRef.current = snap.val() || 0;
      });
      return () => unsub();
    } catch {
      // ignore
    }
  }, []);

  // 2MR Firebase Subscription
  useEffect(() => {
    try {
      const runRef = dbRef(db, 'aft_sessions/2mr_master_timer');

      dbGet(runRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            if (data && data.status) {
              setTwoMileRunSync({
                startTime: data.startTime || null,
                status: data.status,
                startedBy: data.startedBy,
                startedById: data.startedById,
                startedInLane: data.startedInLane
              });
            }
          }
        })
        .catch((err) => {
          console.warn('Initial 2MR master timer fetch failed:', err);
        });

      const unsubscribe = onValue(runRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data && data.status) {
            setTwoMileRunSync({
              startTime: data.startTime || null,
              status: data.status,
              startedBy: data.startedBy,
              startedById: data.startedById,
              startedInLane: data.startedInLane
            });
          }
        }
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Failed to listen to 2MR Firebase timer:', e);
    }
  }, []);

  // 2MR Tick Loop
  useEffect(() => {
    let animId: number;
    if (twoMileRunSync.status === 'running' && twoMileRunSync.startTime) {
      const tick = () => {
        const estimatedServerNow = Date.now() + serverTimeOffsetRef.current;
        const diffMs = Math.max(0, estimatedServerNow - twoMileRunSync.startTime!);
        setTwoMileRunElapsedMs(diffMs);
        animId = requestAnimationFrame(tick);
      };
      animId = requestAnimationFrame(tick);
    } else if (twoMileRunSync.status === 'idle') {
      setTwoMileRunElapsedMs(0);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [twoMileRunSync.status, twoMileRunSync.startTime]);

  const start2MrMasterTimer = async (starterLabel: string = 'Master Clock') => {
    try {
      const runRef = dbRef(db, 'aft_sessions/2mr_master_timer');
      await dbSet(runRef, {
        status: 'running',
        startTime: serverTimestamp(),
        startedBy: starterLabel,
        startedInLane: 'start_point'
      });
    } catch (e) {
      console.warn('Failed to start 2MR Master Timer in Firebase:', e);
      setTwoMileRunSync({
        status: 'running',
        startTime: Date.now(),
        startedBy: `${starterLabel} (Local)`,
        startedInLane: 'start_point'
      });
    }
  };

  const reset2MrMasterTimer = async () => {
    try {
      const runRef = dbRef(db, 'aft_sessions/2mr_master_timer');
      await dbSet(runRef, {
        status: 'idle',
        startTime: null,
        startedBy: null,
        startedInLane: null
      });
    } catch (e) {
      console.warn('Failed to reset 2MR Master Timer in Firebase:', e);
    }
    setTwoMileRunSync({ status: 'idle', startTime: null });
    setTwoMileRunElapsedMs(0);
  };

  const handle2MrAction = (traineeId: string, targetLane?: number) => {
    if (twoMileRunSync.status === 'running' && twoMileRunSync.startTime) {
      const estimatedServerNow = Date.now() + serverTimeOffsetRef.current;
      const durationSec = Math.max(0, (estimatedServerNow - twoMileRunSync.startTime) / 1000);
      const formatted = formatTime(durationSec);
      onScoreAutoSave(traineeId, '2MR', formatted, targetLane);
    } else if (twoMileRunElapsedMs > 0) {
      const durationSec = twoMileRunElapsedMs / 1000;
      const formatted = formatTime(durationSec);
      onScoreAutoSave(traineeId, '2MR', formatted, targetLane);
    }
  };

  // ==========================================
  // 2. PLK (Plank) Dedicated Batch Stopwatch
  // ==========================================
  const [selectedPlkIds, setSelectedPlkIds] = useState<string[]>([]);
  const [plkRunningIds, setPlkRunningIds] = useState<string[]>([]);
  const [plkStartedAt, setPlkStartedAt] = useState<number | null>(null);
  const [plkElapsedMs, setPlkElapsedMs] = useState<number>(0);
  const [plkTimerRunning, setPlkTimerRunning] = useState<boolean>(false);
  const plkTimerRef = useRef<number | null>(null);

  const toggleSelectPlkTrainee = (traineeId: string) => {
    setSelectedPlkIds((prev) =>
      prev.includes(traineeId) ? prev.filter((id) => id !== traineeId) : [...prev, traineeId]
    );
  };

  const selectAllPlkTrainees = (allIds: string[]) => {
    setSelectedPlkIds(allIds);
  };

  const clearPlkSelection = () => {
    setSelectedPlkIds([]);
  };

  const startBatchPlk = () => {
    if (selectedPlkIds.length === 0) return;
    const now = performance.now();
    setPlkStartedAt(now);
    setPlkRunningIds([...selectedPlkIds]);
    setPlkTimerRunning(true);
    setPlkElapsedMs(0);

    const tick = () => {
      setPlkElapsedMs(performance.now() - now);
      plkTimerRef.current = requestAnimationFrame(tick);
    };
    plkTimerRef.current = requestAnimationFrame(tick);
  };

  const stopPlkStopwatch = () => {
    setPlkTimerRunning(false);
    if (plkTimerRef.current) cancelAnimationFrame(plkTimerRef.current);
  };

  const recordPlkStop = (traineeId: string) => {
    if (!plkStartedAt) return;
    const now = performance.now();
    const durationSec = (now - plkStartedAt) / 1000;
    const formatted = formatTime(durationSec);
    onScoreAutoSave(traineeId, 'PLK', formatted);
    setPlkRunningIds((prev) => {
      const next = prev.filter((id) => id !== traineeId);
      if (next.length === 0) {
        stopPlkStopwatch();
        setPlkElapsedMs(0);
        setSelectedPlkIds([]);
        setPlkStartedAt(null);
      }
      return next;
    });
  };

  const cancelPlkBatch = () => {
    stopPlkStopwatch();
    setPlkRunningIds([]);
    setSelectedPlkIds([]);
    setPlkStartedAt(null);
    setPlkElapsedMs(0);
  };

  // ==========================================
  // 3. SDC (Sprint-Drag-Carry) Individual Timers
  // ==========================================
  const [sdcStartTimes, setSdcStartTimes] = useState<Record<string, number>>({});
  const [sdcElapsedMs, setSdcElapsedMs] = useState<Record<string, number>>({});
  const sdcTimerRef = useRef<number | null>(null);

  // Live ticking loop for active SDC runners
  useEffect(() => {
    const activeIds = Object.keys(sdcStartTimes);
    if (activeIds.length > 0) {
      const tick = () => {
        const now = performance.now();
        const updated: Record<string, number> = {};
        for (const [id, startedAt] of Object.entries(sdcStartTimes)) {
          updated[id] = Math.max(0, now - startedAt);
        }
        setSdcElapsedMs(updated);
        sdcTimerRef.current = requestAnimationFrame(tick);
      };
      sdcTimerRef.current = requestAnimationFrame(tick);
    } else {
      setSdcElapsedMs({});
    }

    return () => {
      if (sdcTimerRef.current) {
        cancelAnimationFrame(sdcTimerRef.current);
      }
    };
  }, [sdcStartTimes]);

  const handleSdcAction = (traineeId: string) => {
    const now = performance.now();
    const startedAt = sdcStartTimes[traineeId];
    if (startedAt) {
      const durationSec = (now - startedAt) / 1000;
      const formatted = formatTime(durationSec);
      onScoreAutoSave(traineeId, 'SDC', formatted);
      setSdcStartTimes((prev) => {
        const next = { ...prev };
        delete next[traineeId];
        return next;
      });
      setSdcElapsedMs((prev) => {
        const next = { ...prev };
        delete next[traineeId];
        return next;
      });
    } else {
      setSdcStartTimes((prev) => ({ ...prev, [traineeId]: now }));
    }
  };

  return {
    // 2MR
    twoMileRunSync,
    twoMileRunElapsedMs,
    start2MrMasterTimer,
    reset2MrMasterTimer,
    handle2MrAction,

    // PLK
    selectedPlkIds,
    plkRunningIds,
    plkStartedAt,
    plkElapsedMs,
    plkTimerRunning,
    toggleSelectPlkTrainee,
    selectAllPlkTrainees,
    clearPlkSelection,
    startBatchPlk,
    cancelPlkBatch,
    recordPlkStop,

    // SDC
    sdcStartTimes,
    sdcElapsedMs,
    handleSdcAction
  };
}
