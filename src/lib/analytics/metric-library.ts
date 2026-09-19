export type AnalysisMetricSourceType =
  | "raw"
  | "formula";

export type AnalysisMetricKind =
  | "raw"
  | "calculated"
  | "ratio";

export type AnalysisMetricUnit =
  | "amount"
  | "count"
  | "percent"
  | "number";

export type AnalysisMetricAggregation =
  | "sum"
  | "average"
  | "rate";

export type FormulaTokenType =
  | "raw_metric"
  | "analysis_metric"
  | "operator"
  | "number"
  | "left_paren"
  | "right_paren";

export type AnalysisMetricLibraryItem = {
  libraryKey: string;
  sourceType: AnalysisMetricSourceType;
  sourceId: string;
  code: string;
  name: string;
  groupName: string;
  unit: AnalysisMetricUnit;
  defaultAggregationType: AnalysisMetricAggregation;
  metricKind: AnalysisMetricKind;
  badgeLabel: string;
  origin: string;
  isActive: boolean;
  canOpenFormula: boolean;
  displayOrder: number;
};

export type AnalysisFormulaDefinition = {
  id: string;
  code: string;
  name: string;
  groupName: string;
  description: string | null;
  metricKind: "calculated" | "ratio";
  unit: AnalysisMetricUnit;
  defaultAggregationType: AnalysisMetricAggregation;
  origin: "system" | "user";
  isLocked: boolean;
  isActive: boolean;
  displayOrder: number;
  version: number;
};

export type AnalysisFormulaTokenView = {
  analysisMetricId: string;
  tokenOrder: number;
  tokenType: FormulaTokenType;
  rawMetricId: string | null;
  referencedAnalysisMetricId: string | null;
  operatorValue: string | null;
  numberValue: number | null;
  displayText: string;
  referencedIsActive: boolean;
  referencedBadgeLabel: string | null;
};

export type AnalysisMetricUsage = {
  referencedSourceType: AnalysisMetricSourceType;
  referencedSourceId: string;
  dependentMetricId: string;
  dependentMetricName: string;
  dependentMetricKind: "calculated" | "ratio";
  dependentIsActive: boolean;
};

export type AnalysisMetricLibrarySnapshot = {
  items: AnalysisMetricLibraryItem[];
  formulaDefinitions: AnalysisFormulaDefinition[];
  formulaTokens: AnalysisFormulaTokenView[];
  usages: AnalysisMetricUsage[];
  canManage: boolean;
  generatedAt: string;
};

export type FormulaBuilderToken =
  | {
      type: "raw_metric";
      metricId: string;
    }
  | {
      type: "analysis_metric";
      metricId: string;
    }
  | {
      type: "operator";
      value: "+" | "-" | "*" | "/";
    }
  | {
      type: "number";
      value: number;
    }
  | {
      type: "left_paren";
    }
  | {
      type: "right_paren";
    };

export type SaveAnalysisMetricPayload = {
  metricId: string | null;
  name: string;
  groupName: string;
  description: string;
  metricKind: "calculated" | "ratio";
  unit: AnalysisMetricUnit;
  defaultAggregationType: AnalysisMetricAggregation;
  displayOrder: number | null;
  tokens: FormulaBuilderToken[];
};


export type PreviewAnalysisMetricPayload = {
  metricId: string | null;
  metricKind: "calculated" | "ratio";
  unit: AnalysisMetricUnit;
  defaultAggregationType: AnalysisMetricAggregation;
  tokens: FormulaBuilderToken[];
};

export type AnalysisMetricPreviewRow = {
  managerId: string;
  managerName: string;
  employeeNo: string;
  reportCount: number;
  value: number | null;
  divideByZeroCount: number;
};

export type AnalysisMetricPreviewResult = {
  startDate: string;
  endDate: string;
  completedReportCount: number;
  managerCount: number;
  totalValue: number | null;
  totalDivideByZeroCount: number;
  unit: AnalysisMetricUnit;
  aggregationType: AnalysisMetricAggregation;
  rows: AnalysisMetricPreviewRow[];
  generatedAt: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const result = text(value);
  return result === "" ? null : result;
}

function bool(value: unknown) {
  return value === true;
}

function finiteNumber(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function unit(value: unknown): AnalysisMetricUnit {
  switch (value) {
    case "amount":
    case "percent":
    case "number":
      return value;
    default:
      return "count";
  }
}

function aggregation(value: unknown): AnalysisMetricAggregation {
  switch (value) {
    case "average":
    case "rate":
      return value;
    default:
      return "sum";
  }
}

export function normalizeLibraryItem(
  value: Record<string, unknown>
): AnalysisMetricLibraryItem {
  const sourceType = value.source_type === "formula" ? "formula" : "raw";
  const rawKind = text(value.metric_kind);

  const metricKind: AnalysisMetricKind =
    sourceType === "raw"
      ? "raw"
      : rawKind === "ratio"
        ? "ratio"
        : "calculated";

  return {
    libraryKey: text(value.library_key),
    sourceType,
    sourceId: text(value.source_id),
    code: text(value.code),
    name: text(value.name),
    groupName: text(value.group_name) || "기타",
    unit: unit(value.unit),
    defaultAggregationType: aggregation(value.default_aggregation_type),
    metricKind,
    badgeLabel: text(value.badge_label) || (sourceType === "raw" ? "RAW" : "계산"),
    origin: text(value.origin),
    isActive: value.is_active !== false,
    canOpenFormula: bool(value.can_open_formula),
    displayOrder: finiteNumber(value.display_order, 999999),
  };
}

export function normalizeFormulaDefinition(
  value: Record<string, unknown>
): AnalysisFormulaDefinition {
  return {
    id: text(value.id),
    code: text(value.code),
    name: text(value.name),
    groupName: text(value.group_name) || "사용자 정의",
    description: nullableText(value.description),
    metricKind: value.metric_kind === "ratio" ? "ratio" : "calculated",
    unit: unit(value.unit),
    defaultAggregationType: aggregation(value.default_aggregation_type),
    origin: value.origin === "system" ? "system" : "user",
    isLocked: bool(value.is_locked),
    isActive: value.is_active !== false,
    displayOrder: finiteNumber(value.display_order, 1000),
    version: finiteNumber(value.version, 1),
  };
}

export function normalizeFormulaToken(
  value: Record<string, unknown>
): AnalysisFormulaTokenView {
  const rawType = text(value.token_type);
  const allowed: FormulaTokenType[] = [
    "raw_metric",
    "analysis_metric",
    "operator",
    "number",
    "left_paren",
    "right_paren",
  ];

  const tokenType = allowed.includes(rawType as FormulaTokenType)
    ? rawType as FormulaTokenType
    : "number";

  return {
    analysisMetricId: text(value.analysis_metric_id),
    tokenOrder: finiteNumber(value.token_order, 0),
    tokenType,
    rawMetricId: nullableText(value.raw_metric_id),
    referencedAnalysisMetricId: nullableText(value.referenced_analysis_metric_id),
    operatorValue: nullableText(value.operator_value),
    numberValue:
      value.number_value === null || value.number_value === undefined
        ? null
        : finiteNumber(value.number_value, 0),
    displayText: text(value.display_text),
    referencedIsActive: value.referenced_is_active !== false,
    referencedBadgeLabel: nullableText(value.referenced_badge_label),
  };
}

export function normalizeUsage(
  value: Record<string, unknown>
): AnalysisMetricUsage {
  return {
    referencedSourceType: value.referenced_source_type === "formula" ? "formula" : "raw",
    referencedSourceId: text(value.referenced_source_id),
    dependentMetricId: text(value.dependent_metric_id),
    dependentMetricName: text(value.dependent_metric_name),
    dependentMetricKind: value.dependent_metric_kind === "ratio" ? "ratio" : "calculated",
    dependentIsActive: value.dependent_is_active !== false,
  };
}

export function toBuilderTokens(
  tokens: AnalysisFormulaTokenView[]
): FormulaBuilderToken[] {
  return [...tokens]
    .sort((a, b) => a.tokenOrder - b.tokenOrder)
    .map((token) => {
      switch (token.tokenType) {
        case "raw_metric":
          return {
            type: "raw_metric" as const,
            metricId: token.rawMetricId ?? "",
          };

        case "analysis_metric":
          return {
            type: "analysis_metric" as const,
            metricId: token.referencedAnalysisMetricId ?? "",
          };

        case "operator":
          return {
            type: "operator" as const,
            value: (token.operatorValue ?? "+") as "+" | "-" | "*" | "/",
          };

        case "left_paren":
          return { type: "left_paren" as const };

        case "right_paren":
          return { type: "right_paren" as const };

        default:
          return {
            type: "number" as const,
            value: token.numberValue ?? 0,
          };
      }
    })
    .filter((token) => {
      if (token.type === "raw_metric" || token.type === "analysis_metric") {
        return token.metricId !== "";
      }
      return true;
    });
}

export const ANALYSIS_FORMULA_MAX_TOKENS =
  100;

export const ANALYSIS_FORMULA_MAX_PARENTHESIS_DEPTH =
  24;


export type FormulaValidationContext = {
  selfMetricId?:
    string | null;

  knownRawMetricIds?:
    ReadonlySet<string>;

  knownAnalysisMetricIds?:
    ReadonlySet<string>;
};


export function validateBuilderTokens(
  tokens:
    FormulaBuilderToken[],
  context:
    FormulaValidationContext = {}
) {
  if (
    !Array.isArray(
      tokens
    )
  ) {
    return {
      valid: false,
      message:
        "수식 빌더 토큰이 올바르지 않습니다.",
    };
  }

  if (
    tokens.length ===
    0
  ) {
    return {
      valid: false,
      message:
        "수식에 항목을 1개 이상 추가해주세요.",
    };
  }

  if (
    tokens.length >
    ANALYSIS_FORMULA_MAX_TOKENS
  ) {
    return {
      valid: false,
      message:
        `하나의 수식은 최대 ${ANALYSIS_FORMULA_MAX_TOKENS}개 토큰까지 사용할 수 있습니다.`,
    };
  }

  let expectOperand =
    true;

  let depth =
    0;

  for (
    const token of
    tokens
  ) {
    if (
      !token ||
      typeof token !==
        "object" ||
      !("type" in token)
    ) {
      return {
        valid: false,
        message:
          "수식 토큰 형식이 올바르지 않습니다.",
      };
    }

    if (
      expectOperand
    ) {
      if (
        token.type ===
        "left_paren"
      ) {
        depth += 1;

        if (
          depth >
          ANALYSIS_FORMULA_MAX_PARENTHESIS_DEPTH
        ) {
          return {
            valid: false,
            message:
              `괄호 중첩은 최대 ${ANALYSIS_FORMULA_MAX_PARENTHESIS_DEPTH}단계까지 사용할 수 있습니다.`,
          };
        }

        continue;
      }

      if (
        token.type ===
        "raw_metric"
      ) {
        const metricId =
          String(
            token.metricId ??
            ""
          ).trim();

        if (
          metricId ===
          ""
        ) {
          return {
            valid: false,
            message:
              "참조한 RAW 항목 ID가 비어 있습니다.",
          };
        }

        if (
          context
            .knownRawMetricIds &&
          !context
            .knownRawMetricIds
            .has(
              metricId
            )
        ) {
          return {
            valid: false,
            message:
              "참조한 RAW 항목을 찾을 수 없습니다.",
          };
        }

        expectOperand =
          false;
        continue;
      }

      if (
        token.type ===
        "analysis_metric"
      ) {
        const metricId =
          String(
            token.metricId ??
            ""
          ).trim();

        if (
          metricId ===
          ""
        ) {
          return {
            valid: false,
            message:
              "참조한 계산항목 ID가 비어 있습니다.",
          };
        }

        if (
          context
            .selfMetricId &&
          metricId ===
            context
              .selfMetricId
        ) {
          return {
            valid: false,
            message:
              "자기 자신을 수식에 사용할 수 없습니다.",
          };
        }

        if (
          context
            .knownAnalysisMetricIds &&
          !context
            .knownAnalysisMetricIds
            .has(
              metricId
            )
        ) {
          return {
            valid: false,
            message:
              "참조한 계산항목을 찾을 수 없습니다.",
          };
        }

        expectOperand =
          false;
        continue;
      }

      if (
        token.type ===
        "number"
      ) {
        if (
          !Number.isFinite(
            token.value
          )
        ) {
          return {
            valid: false,
            message:
              "수식 숫자값은 유한한 숫자만 사용할 수 있습니다.",
          };
        }

        expectOperand =
          false;
        continue;
      }

      return {
        valid: false,
        message:
          "항목·숫자 또는 여는 괄호가 필요한 위치입니다.",
      };
    }

    if (
      token.type ===
      "operator"
    ) {
      if (
        ![
          "+",
          "-",
          "*",
          "/",
        ].includes(
          token.value
        )
      ) {
        return {
          valid: false,
          message:
            "허용되지 않은 연산자입니다.",
        };
      }

      expectOperand =
        true;
      continue;
    }

    if (
      token.type ===
      "right_paren"
    ) {
      if (
        depth <=
        0
      ) {
        return {
          valid: false,
          message:
            "닫는 괄호 위치를 확인해주세요.",
        };
      }

      depth -=
        1;
      continue;
    }

    return {
      valid: false,
      message:
        "연산자 또는 닫는 괄호가 필요한 위치입니다.",
    };
  }

  if (
    expectOperand
  ) {
    return {
      valid: false,
      message:
        "수식이 연산자로 끝날 수 없습니다.",
    };
  }

  if (
    depth !==
    0
  ) {
    return {
      valid: false,
      message:
        "괄호의 짝이 맞지 않습니다.",
    };
  }

  return {
    valid: true,
    message:
      "수식 구조가 정상입니다.",
  };
}

export function unitLabel(value: AnalysisMetricUnit) {
  switch (value) {
    case "amount":
      return "금액";
    case "percent":
      return "%";
    case "number":
      return "숫자";
    default:
      return "건수";
  }
}

export function aggregationLabel(value: AnalysisMetricAggregation) {
  switch (value) {
    case "average":
      return "평균";
    case "rate":
      return "성공률";
    default:
      return "합계";
  }
}
