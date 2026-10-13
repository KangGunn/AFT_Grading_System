export type DisplayMode = 'auto' | 'tv';

export type AgeGroup = '17-21' | '22-26' | '27-31' | '32-36' | '37-41' | '42-46' | '47-51' | '52-56' | '57-61' | '62+';

export type EventCode = 'MDL' | 'MDL2' | 'HRP' | 'SDC' | 'PLK' | '2MR';

export interface TraineeRecord {
  id: string;
  rosterNumber: string; // e.g. "001", "12"
  vestNumber: string;   // e.g. "1", "07"
  name: string;
  age: number;
  ageGroup: AgeGroup;
  scores: {
    MDL: string;
    MDL2?: string;
    HRP: string;
    SDC: string;
    PLK: string;
    '2MR': string;
  };
  retestScores?: {
    MDL?: string;
    MDL2?: string;
    HRP?: string;
    SDC?: string;
    PLK?: string;
    '2MR'?: string;
  };
}

export interface LaneConfig {
  laneNumber: number;
  vestColor: string;
  vestColorCode: string;
}

export interface EventConfig {
  id: string;
  name: string;
  code: 'MDL' | 'HRP' | 'SDC' | 'PLK' | '2MR';
  unit: string;
  minVal: number;
  maxVal: number;
  step: number;
  placeholder: string;
  isTime?: boolean;
  desc: string;
}
