import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function fail(message) {
  console.error("\n[FAIL] " + message);
  process.exit(1);
}

function read(rel) {
  const full = path.join(projectRoot, rel);
  if (!fs.existsSync(full)) {
    fail(`File not found: ${rel}`);
  }
  return { full, text: fs.readFileSync(full, "utf8") };
}

function replaceRequired(text, search, replacement, label) {
  const count = text.split(search).length - 1;
  if (count !== 1) {
    fail(`${label}: expected exactly 1 match, found ${count}`);
  }
  return text.replace(search, replacement);
}

function backupAndWrite(full, text) {
  const backup = full + ".before-10-9-2.bak";
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(full, backup);
  }
  fs.writeFileSync(full, text, "utf8");
}

function patchSystemOverview() {
  const rel = "src/components/system-performance/SystemPerformanceOverview.tsx";
  const { full, text: original } = read(rel);
  let text = original;

  if (!text.includes("판매 전일누적과 당일누적을 각각 입력·관리하고, 두 누적값의 차이로 당일실적을 계산합니다.")) {
    text = replaceRequired(
      text,
      "판매 전일누적과 당일실적을 각각 입력·관리합니다.",
      "판매 전일누적과 당일누적을 각각 입력·관리하고, 두 누적값의 차이로 당일실적을 계산합니다.",
      "system sales description"
    );
  }

  if (!text.includes("매출 전일누적과 당일누적을 각각 입력·관리하고, 두 누적값의 차이로 당일실적을 계산합니다.")) {
    text = replaceRequired(
      text,
      "매출 전일누적과 당일실적을 각각 입력·관리합니다.",
      "매출 전일누적과 당일누적을 각각 입력·관리하고, 두 누적값의 차이로 당일실적을 계산합니다.",
      "system revenue description"
    );
  }

  // In this component, the remaining three "당일실적" literals are only the current snapshot label/open/delete title.
  const remaining = text.split('"당일실적"').length - 1;
  if (remaining === 3) {
    text = text.split('"당일실적"').join('"당일누적"');
  } else if (remaining !== 0) {
    fail(`system current snapshot label: expected 3 or 0 remaining matches, found ${remaining}`);
  }

  if (
    !text.includes('label="당일누적"') ||
    !text.includes('"current",\n                        "당일누적"')
  ) {
    fail("system current snapshot label verification failed");
  }

  if (text !== original) {
    backupAndWrite(full, text);
    console.log("[PATCH] " + rel);
  } else {
    console.log("[OK] already patched: " + rel);
  }
}

function patchCardParser() {
  const rel = "src/lib/card-performance-parser.ts";
  const { full, text: original } = read(rel);
  let text = original;

  if (!text.includes('const periodStartDate =\n    `${reportDate.slice(0, 7)}-01`;')) {
    const anchor = `  const headerMap =
    resolveHeaderMap(matrix);`;

    const replacement = `  const periodStartDate =
    \`${"${reportDate.slice(0, 7)}"}-01\`;


  const headerMap =
    resolveHeaderMap(matrix);`;

    text = replaceRequired(
      text,
      anchor,
      replacement,
      "card period start"
    );
  }

  const oldDateFilter = `    if (targetDate !== reportDate) {
      continue;
    }`;

  const newDateFilter = `    /*
     * 승인 입력은 승인일자만, 취소 입력은 취소일자만 기준으로
     * 선택 월의 1일부터 기준일까지 전체 누적 원본을 보관합니다.
     *
     * approval -> approvalDate
     * cancel   -> cancelDate
     */
    if (
      targetDate < periodStartDate ||
      targetDate > reportDate
    ) {
      continue;
    }`;

  if (!text.includes(newDateFilter)) {
    text = replaceRequired(
      text,
      oldDateFilter,
      newDateFilter,
      "card cumulative date range"
    );
  }

  text = text.replace(
    "금액이 비어있거나 음수인 기준일 자료가 있습니다.",
    "금액이 비어있거나 음수인 월 누적 자료가 있습니다."
  );
  text = text.replace(
    "담당자 정보가 없는 기준일 자료가 ${unmatchedManagerCount}건 있습니다.",
    "담당자 정보가 없는 월 누적 자료가 ${unmatchedManagerCount}건 있습니다."
  );

  if (
    !text.includes("targetDate < periodStartDate") ||
    !text.includes("targetDate > reportDate")
  ) {
    fail("card cumulative parser verification failed");
  }

  if (text !== original) {
    backupAndWrite(full, text);
    console.log("[PATCH] " + rel);
  } else {
    console.log("[OK] already patched: " + rel);
  }
}

function patchCardOverview() {
  const rel = "src/components/card/CardPerformanceOverview.tsx";
  const { full, text: original } = read(rel);
  let text = original;

  const oldApproval =
    "신용카드 승인내역 월 누적 원본에서 기준일 승인건만 추출합니다.";
  const newApproval =
    "신용카드 승인내역 월 누적 원본 전체를 입력하고 승인일자 기준으로 당일·누적 실적을 계산합니다.";

  const oldCancel =
    "신용카드 승인취소내역 월 누적 원본에서 기준일 취소건만 추출합니다.";
  const newCancel =
    "신용카드 승인취소내역 월 누적 원본 전체를 입력하고 취소일자 기준으로 당일·누적 실적을 계산합니다.";

  if (!text.includes(newApproval)) {
    text = replaceRequired(text, oldApproval, newApproval, "card approval description");
  }
  if (!text.includes(newCancel)) {
    text = replaceRequired(text, oldCancel, newCancel, "card cancel description");
  }

  if (text !== original) {
    backupAndWrite(full, text);
    console.log("[PATCH] " + rel);
  } else {
    console.log("[OK] already patched: " + rel);
  }
}

function patchClosingReportKk() {
  const rel = "src/components/closing/ClosingReportCard.tsx";
  const { full, text: original } = read(rel);
  let text = original;

  // Existing final PNG card converts monetary sections to KK in one formatter.
  // Previous implementation used /1000. Correct Excel-style ###0.0,, means /1,000,000
  // and exactly one decimal. Counts and rates use separate branches and are untouched.
  const divRegex = /\/\s*(?:1_000|1000)(?![\d_])/g;
  const matches = [...text.matchAll(divRegex)];

  if (matches.length === 0) {
    if (!/\/\s*1_000_000(?![\d_])/.test(text)) {
      fail("ClosingReportCard: KK divisor (/1000) pattern not found. No report code was changed.");
    }
  } else {
    // Integrity guard: every candidate must be near report formatting clues.
    for (const m of matches) {
      const idx = m.index ?? 0;
      const context = text.slice(Math.max(0, idx - 900), Math.min(text.length, idx + 900));
      if (!/(formatNumber|formatValue|KK|toLocaleString)/.test(context)) {
        fail("ClosingReportCard: found /1000 outside a recognized formatting context. Aborting to preserve integrity.");
      }
    }
    text = text.replace(divRegex, "/ 1_000_000");
  }

  // Force the KK formatter to render one decimal like Excel ###0.0,,.
  // Restrict edit to the local formatter window around /1_000_000.
  const kkIndex = text.search(/\/\s*1_000_000(?![\d_])/);
  if (kkIndex < 0) {
    fail("ClosingReportCard: corrected KK divisor not found after patch.");
  }

  const winStart = Math.max(0, kkIndex - 1200);
  const winEnd = Math.min(text.length, kkIndex + 1600);
  let before = text.slice(0, winStart);
  let windowText = text.slice(winStart, winEnd);
  let after = text.slice(winEnd);

  if (/maximumFractionDigits\s*:\s*1/.test(windowText) && !/minimumFractionDigits\s*:\s*1/.test(windowText)) {
    windowText = windowText.replace(
      /maximumFractionDigits\s*:\s*1/,
      "minimumFractionDigits: 1,\n        maximumFractionDigits: 1"
    );
  } else if (!/minimumFractionDigits\s*:\s*1/.test(windowText)) {
    // Common compact Intl form.
    const compactIntl = /\.toLocaleString\(\s*["']ko-KR["']\s*\)/;
    if (compactIntl.test(windowText)) {
      windowText = windowText.replace(
        compactIntl,
        '.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })'
      );
    } else if (!/\.toFixed\(\s*1\s*\)/.test(windowText)) {
      fail("ClosingReportCard: could not safely identify the one-decimal formatter. Aborting before write.");
    }
  }

  text = before + windowText + after;

  if (
    !/\/\s*1_000_000(?![\d_])/.test(text) ||
    !(/minimumFractionDigits\s*:\s*1/.test(text) || /\.toFixed\(\s*1\s*\)/.test(text))
  ) {
    fail("ClosingReportCard: KK format verification failed.");
  }

  if (text !== original) {
    backupAndWrite(full, text);
    console.log("[PATCH] " + rel);
  } else {
    console.log("[OK] already patched: " + rel);
  }
}

console.log("10-9-2 targeted patch start");
console.log("Project: " + projectRoot);

patchSystemOverview();
patchCardParser();
patchCardOverview();
patchClosingReportKk();

console.log("\n[DONE] Targeted source patch completed.");
console.log("Backups: *.before-10-9-2.bak");
console.log("Next: npm run lint");
console.log("Then: npm run build");
