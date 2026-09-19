export type AnalysisReportPresetGranularity =
  | "monthly"
  | "daily";


export type AnalysisReportPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  granularity:
    AnalysisReportPresetGranularity;
  startMonth: string;
  endMonth: string;
  managerIds: string[];
  reportItemKeys: string[];
  createdAt: string;
  updatedAt: string;
};


export type SaveAnalysisReportPresetPayload = {
  presetId:
    string | null;
  name: string;
  granularity:
    AnalysisReportPresetGranularity;
  startMonth: string;
  endMonth: string;
  managerIds: string[];
  reportItemKeys: string[];
};


const MONTH_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


function text(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}


function textArray(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  const result:
    string[] = [];

  const seen =
    new Set<string>();

  for (
    const item of
    value
  ) {
    const normalized =
      text(item);

    if (
      normalized === "" ||
      seen.has(
        normalized
      )
    ) {
      continue;
    }

    seen.add(
      normalized
    );

    result.push(
      normalized
    );
  }

  return result;
}


export function normalizeAnalysisReportPreset(
  row:
    Record<string, unknown>
): AnalysisReportPreset {
  const granularity =
    row.granularity ===
    "daily"
      ? "daily"
      : "monthly";

  return {
    id:
      text(
        row.id
      ),
    name:
      text(
        row.name
      ),
    isDefault:
      row.is_default ===
      true,
    granularity,
    startMonth:
      text(
        row.start_month
      ),
    endMonth:
      text(
        row.end_month
      ),
    managerIds:
      textArray(
        row.manager_ids
      ),
    reportItemKeys:
      textArray(
        row.report_item_keys
      ),
    createdAt:
      text(
        row.created_at
      ),
    updatedAt:
      text(
        row.updated_at
      ),
  };
}


export function validateAnalysisReportPresetPayload(
  payload:
    SaveAnalysisReportPresetPayload
) {
  const name =
    payload.name.trim();

  if (
    name.length < 1 ||
    name.length > 60
  ) {
    throw new Error(
      "보고서 이름은 1~60자로 입력해주세요."
    );
  }

  if (
    payload.granularity !==
      "monthly" &&
    payload.granularity !==
      "daily"
  ) {
    throw new Error(
      "집계단위를 확인해주세요."
    );
  }

  if (
    !MONTH_PATTERN.test(
      payload.startMonth
    ) ||
    !MONTH_PATTERN.test(
      payload.endMonth
    )
  ) {
    throw new Error(
      "조회월 형식을 확인해주세요."
    );
  }

  if (
    payload.startMonth >
    payload.endMonth
  ) {
    throw new Error(
      "시작월은 종료월보다 늦을 수 없습니다."
    );
  }

  const managerIds =
    textArray(
      payload.managerIds
    );

  if (
    managerIds.length ===
    0
  ) {
    throw new Error(
      "저장할 매니저를 1명 이상 선택해주세요."
    );
  }

  if (
    managerIds.length >
    100 ||
    managerIds.some(
      (id) =>
        !UUID_PATTERN.test(
          id
        )
    )
  ) {
    throw new Error(
      "매니저 선택정보를 확인해주세요."
    );
  }

  const reportItemKeys =
    textArray(
      payload.reportItemKeys
    );

  if (
    reportItemKeys.length ===
    0
  ) {
    throw new Error(
      "보고서 구성에 분석항목을 1개 이상 추가해주세요."
    );
  }

  if (
    reportItemKeys.length >
      60 ||
    reportItemKeys.some(
      (key) =>
        key.length >
          160
    )
  ) {
    throw new Error(
      "보고서 구성 항목을 확인해주세요."
    );
  }

  return {
    presetId:
      payload.presetId,
    name,
    granularity:
      payload.granularity,
    startMonth:
      payload.startMonth,
    endMonth:
      payload.endMonth,
    managerIds,
    reportItemKeys,
  };
}
