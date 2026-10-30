import React, { useState, useEffect } from 'react';
import type { TraineeRecord } from '../../types/aft/aft.types';
import { getAgeGroupFromAge } from '../../utils/aft/timeFormatter';

interface ManageRetestSoldiersModalProps {
  isOpen: boolean;
  onClose: () => void;
  customSoldiers: TraineeRecord[];
  defaultVestNumber?: string;
  initialEditingSoldier?: TraineeRecord | null;
  onAdd: (soldier: {
    name: string;
    age: number;
    vestNumber?: string;
    rosterNumber?: string;
  }) => void;
  onEdit: (traineeId: string, soldier: {
    name: string;
    age: number;
    vestNumber?: string;
    rosterNumber?: string;
  }) => void;
  onDelete: (traineeId: string) => void;
  onReorder?: (soldiers: TraineeRecord[]) => void;
}

export const ManageRetestSoldiersModal: React.FC<ManageRetestSoldiersModalProps> = ({
  isOpen,
  onClose,
  customSoldiers,
  defaultVestNumber = '1',
  initialEditingSoldier = null,
  onAdd,
  onEdit,
  onDelete,
  onReorder
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'form'>('list');
  const [editingSoldierId, setEditingSoldierId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [vestNumber, setVestNumber] = useState('');
  const [rosterNumber, setRosterNumber] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Initialize or reset when modal opens or initial editing soldier changes
  useEffect(() => {
    if (isOpen) {
      setError('');
      setDeletingId(null);
      setDraggedIndex(null);
      if (initialEditingSoldier) {
        setEditingSoldierId(initialEditingSoldier.id);
        setName(initialEditingSoldier.name);
        setAge(String(initialEditingSoldier.age));
        setVestNumber(initialEditingSoldier.vestNumber);
        setRosterNumber(initialEditingSoldier.rosterNumber);
        setActiveTab('form');
      } else {
        setEditingSoldierId(null);
        setName('');
        setAge('');
        setVestNumber('');
        setRosterNumber('');
        setActiveTab('list');
      }
    }
  }, [isOpen, initialEditingSoldier]);

  if (!isOpen) return null;

  const parsedAge = parseInt(age, 10);
  const calculatedAgeGroup = !isNaN(parsedAge) && parsedAge > 0 ? getAgeGroupFromAge(parsedAge) : '-';

  const startEditSoldier = (soldier: TraineeRecord) => {
    setError('');
    setDeletingId(null);
    setEditingSoldierId(soldier.id);
    setName(soldier.name);
    setAge(String(soldier.age));
    setVestNumber(soldier.vestNumber);
    setRosterNumber(soldier.rosterNumber);
    setActiveTab('form');
  };

  const startAddSoldier = () => {
    setError('');
    setDeletingId(null);
    setEditingSoldierId(null);
    setName('');
    setAge('');
    setVestNumber('');
    setRosterNumber('');
    setActiveTab('form');
  };

  const moveSoldier = (fromIndex: number, direction: -1 | 1) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= customSoldiers.length) return;
    const nextList = [...customSoldiers];
    const temp = nextList[fromIndex];
    nextList[fromIndex] = nextList[toIndex];
    nextList[toIndex] = temp;
    if (onReorder) {
      onReorder(nextList);
    }
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }
    const nextList = [...customSoldiers];
    const [removed] = nextList.splice(draggedIndex, 1);
    nextList.splice(targetIndex, 0, removed);
    setDraggedIndex(null);
    if (onReorder) {
      onReorder(nextList);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a soldier name.');
      return;
    }

    if (isNaN(parsedAge) || parsedAge < 17 || parsedAge > 90) {
      setError('Please enter a valid age between 17 and 90.');
      return;
    }

    if (editingSoldierId) {
      onEdit(editingSoldierId, {
        name: trimmedName,
        age: parsedAge,
        vestNumber: vestNumber.trim(),
        rosterNumber: rosterNumber.trim()
      });
      setEditingSoldierId(null);
      setActiveTab('list');
    } else {
      onAdd({
        name: trimmedName,
        age: parsedAge,
        vestNumber: vestNumber.trim(),
        rosterNumber: rosterNumber.trim()
      });
      setActiveTab('list');
    }
  };

  const confirmDelete = (traineeId: string) => {
    onDelete(traineeId);
    setDeletingId(null);
    if (editingSoldierId === traineeId) {
      setEditingSoldierId(null);
      setActiveTab('list');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-4 sm:p-5 shadow-2xl dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-col max-h-[88dvh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">👥</span>
            <div className="min-w-0 truncate">
              <h3 className="text-base font-black text-gray-900 dark:text-white truncate">
                Manage EXT Soldiers
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                Re-Test Lane · Add, Edit, or Remove External Soldiers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-gray-100 p-1.5 text-gray-400 hover:text-gray-700 dark:bg-slate-800 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Soldiers Action Header (When in List mode) */}
        {activeTab === 'list' && (
          <div className="flex items-center justify-between pt-3 pb-2 border-b dark:border-slate-800 shrink-0 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <span>📋 Soldiers</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                  {customSoldiers.length}
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={startAddSoldier}
              className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              + Add Soldier
            </button>
          </div>
        )}

        {/* Form Header (When in Form mode) */}
        {activeTab === 'form' && (
          <div className="flex items-center justify-between pt-3 pb-2 border-b dark:border-slate-800 shrink-0 px-1">
            <span className="text-xs font-black text-gray-800 dark:text-gray-200">
              {editingSoldierId ? '✏️ Edit Soldier Details' : '➕ Add New External Soldier'}
            </span>
            <button
              type="button"
              onClick={() => {
                setError('');
                setEditingSoldierId(null);
                setActiveTab('list');
              }}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              ← Back to Soldiers
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-3 min-h-0">
          
          {/* TAB 1: SOLDIER ROSTER LIST */}
          {activeTab === 'list' && (
            <div className="flex flex-col gap-2.5">
              {customSoldiers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-800 p-6 text-center flex flex-col items-center justify-center gap-2.5">
                  <span className="text-3xl">👥</span>
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    No external soldiers added yet.
                  </div>
                  <p className="text-[11px] text-gray-400 max-w-xs">
                    Add external soldiers who are not in the main roster to evaluate them in the Re-Test lane.
                  </p>
                  <button
                    type="button"
                    onClick={startAddSoldier}
                    className="mt-1 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 px-4 py-2 text-xs font-black text-white shadow-sm"
                  >
                    + Add Soldier
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {customSoldiers.map((soldier, index) => {
                    const isDeleting = deletingId === soldier.id;
                    const hasScores = Object.values(soldier.scores || {}).some(v => (v || '').trim() !== '');

                    return (
                      <div
                        key={soldier.id}
                        draggable
                        onDragStart={() => setDraggedIndex(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(index)}
                        className={`rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/60 p-2.5 flex flex-col gap-2 transition-all hover:border-blue-400/50 ${
                          draggedIndex === index ? 'opacity-40 ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          {/* Left: Reorder Buttons, Vest & Info */}
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {/* Up / Down Reorder Buttons */}
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveSoldier(index, -1)}
                                className="h-4 w-5 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-[8px] text-gray-700 dark:text-gray-200 disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-90"
                                title="Move Up"
                                aria-label="Move Up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={index === customSoldiers.length - 1}
                                onClick={() => moveSoldier(index, 1)}
                                className="h-4 w-5 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-[8px] text-gray-700 dark:text-gray-200 disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-90"
                                title="Move Down"
                                aria-label="Move Down"
                              >
                                ▼
                              </button>
                            </div>

                            <div className="flex h-7 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs shadow-xs">
                              {soldier.vestNumber ? `#${soldier.vestNumber}` : '-'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-black text-gray-900 dark:text-white" title={soldier.name}>
                                {soldier.name}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {soldier.rosterNumber && (
                                  <>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">#{soldier.rosterNumber}</span>
                                    <span>·</span>
                                  </>
                                )}
                                <span>Age {soldier.age} ({soldier.ageGroup})</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => startEditSoldier(soldier)}
                              className="rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/80 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 text-xs font-bold transition-colors active:scale-95"
                              title="Edit soldier details"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(isDeleting ? null : soldier.id)}
                              className="rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-950/80 dark:hover:bg-red-900 text-red-700 dark:text-red-300 px-2 py-1 text-xs font-bold transition-colors active:scale-95"
                              title="Delete soldier"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>

                        {/* Delete Confirmation Banner */}
                        {isDeleting && (
                          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-2 flex items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
                            <div className="text-[11px] font-bold text-red-700 dark:text-red-300 min-w-0 truncate">
                              Delete {soldier.name}? {hasScores && '(Scores will be removed)'}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => confirmDelete(soldier.id)}
                                className="rounded-lg bg-red-600 hover:bg-red-700 text-white font-black px-2 py-1 text-[11px] shadow-xs active:scale-95"
                              >
                                Yes, Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                className="rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold px-2 py-1 text-[11px] active:scale-95"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD / EDIT SOLDIER FORM */}
          {activeTab === 'form' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Name Input */}
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  Soldier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Age & Age Group */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="17"
                    max="90"
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="e.g. 24"
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                    Standard Group
                  </label>
                  <div className="flex h-[38px] items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800 text-xs font-black text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-slate-700">
                    {calculatedAgeGroup}
                  </div>
                </div>
              </div>

              {/* Vest Number & Roster Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                    Vest # <span className="text-[10px] font-normal text-gray-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={vestNumber}
                    onChange={(e) => setVestNumber(e.target.value)}
                    placeholder={defaultVestNumber ? `e.g. ${defaultVestNumber}` : 'e.g. 1'}
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                    Roster # / ID <span className="text-[10px] font-normal text-gray-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={rosterNumber}
                    onChange={(e) => setRosterNumber(e.target.value)}
                    placeholder={editingSoldierId ? 'e.g. EXT-1' : `e.g. EXT-${customSoldiers.length + 1}`}
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                  />
                </div>
              </div>

              {/* Notice */}
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 p-2.5 text-[11px] text-blue-700 dark:text-blue-300">
                External soldiers are evaluated in the Re-Test lane and excluded from the main roster total scorecard.
              </div>

              {/* Action Buttons */}
              <div className="mt-2 flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (customSoldiers.length > 0) {
                      setEditingSoldierId(null);
                      setActiveTab('list');
                    } else {
                      onClose();
                    }
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-black text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 px-5 py-2 text-xs font-black text-white shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>{editingSoldierId ? '💾' : '➕'}</span>
                  <span>{editingSoldierId ? 'Save Changes' : 'Add Soldier'}</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
