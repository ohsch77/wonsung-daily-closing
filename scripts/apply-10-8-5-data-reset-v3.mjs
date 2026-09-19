import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const candidatePaths = [
  path.join(
    root,
    "src",
    "app",
    "(app)",
    "admin",
    "page.tsx"
  ),
  path.join(
    root,
    "src",
    "app",
    "admin",
    "page.tsx"
  ),
];

const filePath =
  candidatePaths.find(
    (candidate) =>
      fs.existsSync(
        candidate
      )
  );

if (!filePath) {
  throw new Error(
    [
      "관리자 페이지를 찾을 수 없습니다.",
      "확인한 경로:",
      ...candidatePaths.map(
        (candidate) =>
          `- ${candidate}`
      ),
    ].join("\n")
  );
}

const originalSource =
  fs.readFileSync(
    filePath,
    "utf8"
  );

let source =
  originalSource;

const importLine =
  'import DataResetPanel from "@/components/admin/DataResetPanel";';


// ---------------------------------------------------------
// 1. import
// ---------------------------------------------------------
if (
  !source.includes(
    importLine
  )
) {
  const importPattern =
    /import\s+StoreCalendarSettingsPanel\s+from\s+["']@\/components\/admin\/StoreCalendarSettingsPanel["'];?/;

  const match =
    source.match(
      importPattern
    );

  if (!match) {
    throw new Error(
      [
        "DataResetPanel import 삽입 기준점을 찾지 못했습니다.",
        "기존 관리자 페이지는 수정하지 않았습니다.",
      ].join(" ")
    );
  }

  source =
    source.replace(
      match[0],
      `${match[0]}\n${importLine}`
    );
}


// ---------------------------------------------------------
// 2. 설정 바로가기 카드
//
// 기존 카드 전체 문자열을 비교하지 않습니다.
// manager / daily-metric / expense-category 3개 링크가
// 동시에 들어 있는 카드 grid section만 정확히 찾습니다.
// ---------------------------------------------------------
if (
  !source.includes(
    'href="#data-reset"'
  )
) {
  const expenseMarker =
    'href="#expense-category-settings"';

  const expenseIndex =
    source.indexOf(
      expenseMarker
    );

  if (
    expenseIndex ===
    -1
  ) {
    throw new Error(
      [
        "경비분류 설정 바로가기(href=#expense-category-settings)를 찾지 못했습니다.",
        "기존 관리자 페이지는 수정하지 않았습니다.",
      ].join(" ")
    );
  }

  const sectionStart =
    source.lastIndexOf(
      "<section",
      expenseIndex
    );

  const sectionEnd =
    source.indexOf(
      "</section>",
      expenseIndex
    );

  if (
    sectionStart ===
      -1 ||
    sectionEnd ===
      -1 ||
    sectionEnd <=
      sectionStart
  ) {
    throw new Error(
      [
        "설정 바로가기 카드 영역(section)을 안전하게 찾지 못했습니다.",
        "기존 관리자 페이지는 수정하지 않았습니다.",
      ].join(" ")
    );
  }

  const cardSection =
    source.slice(
      sectionStart,
      sectionEnd
    );

  const requiredLinks = [
    'href="#manager-settings"',
    'href="#daily-metric-settings"',
    'href="#expense-category-settings"',
  ];

  if (
    !requiredLinks.every(
      (link) =>
        cardSection.includes(
          link
        )
    )
  ) {
    throw new Error(
      [
        "찾은 section이 관리자 설정 바로가기 카드 영역과 일치하지 않습니다.",
        "안전을 위해 기존 관리자 페이지는 수정하지 않았습니다.",
      ].join(" ")
    );
  }

  const resetCard = `
        <a href="#data-reset" title="실적 데이터 초기화 영역으로 이동" className="rounded-[18px] border border-[#E7C9D1] bg-[#FFF8FA] p-5 group cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:border-[#C8CCD2] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A50034]/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white text-[#A50034] shadow-sm">
            <Settings2
              size={17}
            />
          </div>

          <h3 className="mt-4 text-[16px] font-black text-[#292C31]">
            데이터 초기화
          </h3>

          <p className="mt-1 text-[11px] font-bold leading-5 text-[#A50034]">
            관리자 전용 · 실적 데이터만
          </p>

          <p className="mt-3 text-[11px] leading-5 text-[#92969D]">
            기간별 또는 전체 수기·업로드 실적을 안전하게 초기화합니다.
          </p>
        </a>
`;

  source =
    source.slice(
      0,
      sectionEnd
    ) +
    resetCard +
    source.slice(
      sectionEnd
    );
}


// ---------------------------------------------------------
// 3. DataResetPanel 본문
// ---------------------------------------------------------
if (
  !source.includes(
    "<DataResetPanel />"
  )
) {
  const storeCalendarMarker =
    '<div id="store-calendar-settings"';

  const storeCalendarIndex =
    source.indexOf(
      storeCalendarMarker
    );

  if (
    storeCalendarIndex ===
    -1
  ) {
    throw new Error(
      [
        "지점 운영일 설정 영역(id=store-calendar-settings)을 찾지 못했습니다.",
        "기존 관리자 페이지는 수정하지 않았습니다.",
      ].join(" ")
    );
  }

  const lineStart =
    source.lastIndexOf(
      "\n",
      storeCalendarIndex
    ) + 1;

  const resetPanel =
`      <div id="data-reset" className="scroll-mt-24">
        <DataResetPanel />
      </div>

`;

  source =
    source.slice(
      0,
      lineStart
    ) +
    resetPanel +
    source.slice(
      lineStart
    );
}


// ---------------------------------------------------------
// 4. 저장 전 무결성 검증
// ---------------------------------------------------------
const assertions = [
  {
    label:
      "DataResetPanel import",
    count:
      source.split(
        importLine
      ).length -
      1,
  },
  {
    label:
      "데이터 초기화 바로가기",
    count:
      source.split(
        'href="#data-reset"'
      ).length -
      1,
  },
  {
    label:
      "DataResetPanel 렌더",
    count:
      source.split(
        "<DataResetPanel />"
      ).length -
      1,
  },
];

for (
  const assertion of
  assertions
) {
  if (
    assertion.count !==
    1
  ) {
    throw new Error(
      `${assertion.label} 검증 실패(${assertion.count}개). 기존 관리자 페이지는 수정하지 않았습니다.`
    );
  }
}

const preserveMarkers = [
  'href="#manager-settings"',
  'href="#daily-metric-settings"',
  'href="#expense-category-settings"',
  'id="manager-settings"',
  'id="daily-metric-settings"',
  'id="expense-category-settings"',
  'id="store-calendar-settings"',
  "<ManagerSettingsPanel",
  "<DailyMetricSettingsPanel",
  "<ExpenseCategorySettingsPanel",
  "<StoreCalendarSettingsPanel",
];

for (
  const marker of
  preserveMarkers
) {
  if (
    originalSource.includes(
      marker
    ) &&
    !source.includes(
      marker
    )
  ) {
    throw new Error(
      `기존 코드 보존 검증 실패: ${marker}. 파일을 저장하지 않았습니다.`
    );
  }
}


// ---------------------------------------------------------
// 5. 변경이 있을 때만 백업 후 저장
// ---------------------------------------------------------
if (
  source ===
  originalSource
) {
  console.log(
    "10-8.5 데이터 초기화 UI가 이미 연결되어 있습니다. 추가 변경 없음:",
    filePath
  );

  process.exit(
    0
  );
}

const backupPath =
  `${filePath}.before-data-reset-v3.bak`;

if (
  !fs.existsSync(
    backupPath
  )
) {
  fs.writeFileSync(
    backupPath,
    originalSource,
    "utf8"
  );
}

fs.writeFileSync(
  filePath,
  source,
  "utf8"
);

console.log(
  "10-8.5 관리자 데이터 초기화 UI 연결 완료:",
  filePath
);

console.log(
  "수정 전 백업:",
  backupPath
);
