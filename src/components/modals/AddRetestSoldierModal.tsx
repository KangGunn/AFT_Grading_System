import React, { useState, useEffect } from 'react';
import { getAgeGroupFromAge } from '../../utils/aft/timeFormatter';

interface AddRetestSoldierModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultVestNumber?: string;
  onAdd: (soldier: {
    name: string;
    age: number;
    vestNumber?: string;
    rosterNumber?: string;
  }) => void;
}

export const AddRetestSoldierModal: React.FC<AddRetestSoldierModalProps> = ({
  isOpen,
  onClose,
  defaultVestNumber = '1',
  onAdd
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [vestNumber, setVestNumber] = useState('');
  const [rosterNumber, setRosterNumber] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setAge('');
      setVestNumber('');
      setRosterNumber('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedAge = parseInt(age, 10);
  const calculatedAgeGroup = !isNaN(parsedAge) && parsedAge > 0 ? getAgeGroupFromAge(parsedAge) : '-';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a soldier name.');
      return;
    }

    if (isNaN(parsedAge) || parsedAge < 17 || parsedAge > 90) {
      setError('Please enter a valid age (17 - 90).');
      return;
    }

    onAdd({
      name: trimmedName,
      age: parsedAge,
      vestNumber: vestNumber.trim() || defaultVestNumber,
      rosterNumber: rosterNumber.trim()
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎖️</span>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Add Soldier
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Re-Test Lane · Excluded from Total Scorecard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 p-1.5 text-gray-400 hover:text-gray-700 dark:bg-slate-800 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Name Input */}
          <div>
            <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
              Name <span className="text-red-500">*</span>
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
                placeholder="e.g. 22"
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
                placeholder="Optional"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-2 flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-black text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 px-5 py-2 text-xs font-black text-white shadow-md transition-all"
            >
              + Add Soldier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
