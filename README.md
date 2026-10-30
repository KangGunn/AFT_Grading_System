# AFT Grading System

## 주요 파일 구조 및 기능 맵 (Project Structure & Feature Map)

```
src/
├── components/
│   ├── AftGradeView.tsx              # 메인 컨트롤러 (화면 전환: 레인선택 / 채점 / 전체결과 / 마스터시계)
│   ├── aft/
│   │   ├── LaneSelectHeader.tsx      # 레인 선택 화면 상단 바 (Excel 가져오기, 조끼 설정, 전체 결과 버튼)
│   │   ├── GradingHeader.tsx         # 채점 화면 상단 바 (뒤로가기, 타이머, Standards 기준표 버튼)
│   │   ├── AllResultsView.tsx        # 전체 결과 스프레드시트 뷰 (모든 인원 5종목 성적 및 PASS/FAIL 성적표)
│   │   └── TwoMileRunStartPointView.tsx # 2MR 전용 마스터 시계 및 출발선 뷰
│   ├── lane/
│   │   ├── LaneSelectView.tsx        # 레인 선택 허브 화면 (1~10레인 + Re-Test 레인 카드 목록)
│   │   └── LaneCard.tsx              # 개별 레인 카드 (조끼색, 인원수, 진행 현황)
│   ├── grading/
│   │   ├── GradingView.tsx           # 레인 채점 화면 (종목 탭, 타이머, 군인 채점 카드들)
│   │   ├── EventTabs.tsx             # 5대 종목 탭 바 (MDL, HRP, SDC, PLK, 2MR)
│   │   ├── TraineeCard.tsx           # 주 레인 군인 1명 채점 카드 (기록 입력, 타이머, PASS/FAIL 판정)
│   │   └── DualLaneTraineeCard.tsx   # 2MR 동시 채점 시 보조 레인 군인 카드
│   └── modals/
│       ├── ManageRetestSoldiersModal.tsx # Re-Test 레인 외부 인원 관리 (추가 / 수정 / 삭제 / 순서변경)
│       ├── StandardsModal.tsx        # 'Standards' 버튼 클릭 시 열리는 AFT 2025 기준표 모달
│       ├── ImportModal.tsx           # 엑셀 명단 파일 업로드 모달
│       ├── VestSettingsModal.tsx     # 레인별 조끼 색상 설정 모달
│       ├── DualLaneModal.tsx         # 2MR 동시 평가용 보조 레인 선택 모달
│       └── HrpClickerModal.tsx       # HRP 종목 팔굽혀펴기 카운터 클릭커 모달
├── data/
│   └── aftStandards2025.ts           # 2025 육군 체력검정 기준표 데이터 및 점수 계산 함수
├── hooks/aft/
│   ├── useAftRoster.ts               # 명단 / 점수 / Re-Test 인원 Firebase RTDB 및 로컬 실시간 동기화
│   └── useAftTimer.ts                # 타이머 / 스톱워치 / 마스터 시계 로직
└── types/aft/
    ├── aft.types.ts                  # TraineeRecord, EventCode, LaneConfig 등 공통 타입 정의
    └── standards.types.ts            # 기준표 데이터 관련 타입 정의
```
