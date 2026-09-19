import {
  validateBuilderTokens,
} from "@/lib/analytics/metric-library";

import type {
  AnalysisMetricAggregation,
  FormulaBuilderToken,
} from "@/lib/analytics/metric-library";


export const ANALYSIS_FORMULA_MAX_DEPENDENCY_DEPTH =
  50;


export type FormulaEngineDefinition = {
  id: string;
  aggregationType:
    AnalysisMetricAggregation;
  tokens:
    FormulaBuilderToken[];
};

export type FormulaEngineReport = {
  reportId: string;
  reportDate: string;
  managerId: string;
  values:
    ReadonlyMap<string, number>;
};

export type FormulaEvaluationIssue = {
  divideByZeroCount: number;
  nonFiniteValueCount: number;
};

export type FormulaEvaluationResult = {
  value: number | null;
  issue:
    FormulaEvaluationIssue;
};


type RpnToken =
  Exclude<
    FormulaBuilderToken,
    {
      type:
        | "left_paren"
        | "right_paren";
    }
  >;


type CompiledDefinition =
  FormulaEngineDefinition & {
    rpn:
      RpnToken[];
  };


const PRECEDENCE:
  Record<
    "+" | "-" | "*" | "/",
    number
  > = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2,
  };


function isOperatorToken(
  token:
    FormulaBuilderToken
): token is Extract<
  FormulaBuilderToken,
  {
    type: "operator";
  }
> {
  return (
    token.type ===
    "operator"
  );
}


function toRpn(
  tokens:
    FormulaBuilderToken[]
): RpnToken[] {
  const output:
    RpnToken[] = [];

  const operators:
    FormulaBuilderToken[] =
      [];

  for (
    const token of
    tokens
  ) {
    if (
      token.type ===
        "raw_metric" ||
      token.type ===
        "analysis_metric" ||
      token.type ===
        "number"
    ) {
      output.push(
        token
      );
      continue;
    }

    if (
      token.type ===
      "operator"
    ) {
      while (
        operators.length >
        0
      ) {
        const top =
          operators[
            operators.length -
              1
          ];

        if (
          !isOperatorToken(
            top
          )
        ) {
          break;
        }

        if (
          PRECEDENCE[
            top.value
          ] <
          PRECEDENCE[
            token.value
          ]
        ) {
          break;
        }

        output.push(
          operators.pop() as
            RpnToken
        );
      }

      operators.push(
        token
      );
      continue;
    }

    if (
      token.type ===
      "left_paren"
    ) {
      operators.push(
        token
      );
      continue;
    }

    if (
      token.type ===
      "right_paren"
    ) {
      let foundLeft =
        false;

      while (
        operators.length >
        0
      ) {
        const top =
          operators.pop();

        if (!top) {
          break;
        }

        if (
          top.type ===
          "left_paren"
        ) {
          foundLeft =
            true;
          break;
        }

        output.push(
          top as
            RpnToken
        );
      }

      if (
        !foundLeft
      ) {
        throw new Error(
          "수식 괄호 구조가 올바르지 않습니다."
        );
      }
    }
  }

  while (
    operators.length >
    0
  ) {
    const top =
      operators.pop();

    if (!top) {
      break;
    }

    if (
      top.type ===
        "left_paren" ||
      top.type ===
        "right_paren"
    ) {
      throw new Error(
        "수식 괄호 구조가 올바르지 않습니다."
      );
    }

    output.push(
      top as
        RpnToken
    );
  }

  return output;
}


function finiteOrNull(
  value:
    number,
  issue:
    FormulaEvaluationIssue
) {
  if (
    Number.isFinite(
      value
    )
  ) {
    return value;
  }

  issue
    .nonFiniteValueCount +=
    1;

  return null;
}


function evaluateRpn(
  rpn:
    RpnToken[],
  resolveRaw:
    (
      metricId:
        string
    ) => number | null,
  resolveFormula:
    (
      metricId:
        string
    ) => number | null,
  issue:
    FormulaEvaluationIssue
) {
  const stack:
    Array<
      number | null
    > = [];

  for (
    const token of
    rpn
  ) {
    if (
      token.type ===
      "number"
    ) {
      stack.push(
        Number.isFinite(
          token.value
        )
          ? token.value
          : finiteOrNull(
              token.value,
              issue
            )
      );
      continue;
    }

    if (
      token.type ===
      "raw_metric"
    ) {
      stack.push(
        resolveRaw(
          token.metricId
        )
      );
      continue;
    }

    if (
      token.type ===
      "analysis_metric"
    ) {
      stack.push(
        resolveFormula(
          token.metricId
        )
      );
      continue;
    }

    if (
      token.type !==
      "operator"
    ) {
      throw new Error(
        "지원하지 않는 수식 토큰입니다."
      );
    }

    if (
      stack.length <
      2
    ) {
      throw new Error(
        "수식 구조가 올바르지 않습니다."
      );
    }

    const right =
      stack.pop() ??
      null;

    const left =
      stack.pop() ??
      null;

    if (
      left ===
        null ||
      right ===
        null
    ) {
      stack.push(
        null
      );
      continue;
    }

    switch (
      token.value
    ) {
      case "+":
        stack.push(
          finiteOrNull(
            left +
              right,
            issue
          )
        );
        break;

      case "-":
        stack.push(
          finiteOrNull(
            left -
              right,
            issue
          )
        );
        break;

      case "*":
        stack.push(
          finiteOrNull(
            left *
              right,
            issue
          )
        );
        break;

      case "/":
        if (
          right ===
          0
        ) {
          issue
            .divideByZeroCount +=
            1;

          stack.push(
            null
          );
        }
        else {
          stack.push(
            finiteOrNull(
              left /
                right,
              issue
            )
          );
        }
        break;
    }
  }

  if (
    stack.length !==
    1
  ) {
    throw new Error(
      "수식 계산 구조가 올바르지 않습니다."
    );
  }

  return (
    stack[0] ??
    null
  );
}


type DailyEvaluationMemoCache =
  WeakMap<
    FormulaEngineReport,
    Map<string, number | null>
  >;


export function createFormulaEngine(
  definitions:
    FormulaEngineDefinition[]
) {
  const definitionMap =
    new Map<
      string,
      FormulaEngineDefinition
    >();

  for (
    const definition of
    definitions
  ) {
    const metricId =
      String(
        definition.id ??
        ""
      ).trim();

    if (
      metricId ===
      ""
    ) {
      throw new Error(
        "계산항목 ID가 비어 있습니다."
      );
    }

    if (
      definitionMap.has(
        metricId
      )
    ) {
      throw new Error(
        "동일한 계산항목 ID가 중복되었습니다."
      );
    }

    definitionMap.set(
      metricId,
      definition
    );
  }

  const knownAnalysisMetricIds =
    new Set(
      definitionMap.keys()
    );

  const compiledMap =
    new Map<
      string,
      CompiledDefinition
    >();


  function requireDefinition(
    metricId: string
  ) {
    const definition =
      definitionMap.get(
        metricId
      );

    if (!definition) {
      throw new Error(
        "참조한 계산항목을 찾을 수 없습니다."
      );
    }

    const cached =
      compiledMap.get(
        metricId
      );

    if (cached) {
      return cached;
    }

    const validation =
      validateBuilderTokens(
        definition.tokens,
        {
          selfMetricId:
            metricId,
          knownAnalysisMetricIds,
        }
      );

    if (
      !validation.valid
    ) {
      throw new Error(
        `계산항목 수식 오류: ${validation.message}`
      );
    }

    const compiled:
      CompiledDefinition = {
        ...definition,
        rpn:
          toRpn(
            definition.tokens
          ),
      };

    compiledMap.set(
      metricId,
      compiled
    );

    return compiled;
  }


  function assertDepth(
    stack:
      Set<string>
  ) {
    if (
      stack.size >=
      ANALYSIS_FORMULA_MAX_DEPENDENCY_DEPTH
    ) {
      throw new Error(
        `계산항목 중첩은 최대 ${ANALYSIS_FORMULA_MAX_DEPENDENCY_DEPTH}단계까지 사용할 수 있습니다.`
      );
    }
  }


  function safeRawValue(
    value:
      number | undefined,
    issue:
      FormulaEvaluationIssue
  ) {
    if (
      value ===
      undefined
    ) {
      return 0;
    }

    if (
      !Number.isFinite(
        value
      )
    ) {
      issue
        .nonFiniteValueCount +=
        1;
      return null;
    }

    return value;
  }


  function evaluateDaily(
    metricId: string,
    report:
      FormulaEngineReport,
    issue:
      FormulaEvaluationIssue,
    stack:
      Set<string>,
    memo:
      Map<string, number | null>
  ): number | null {
    if (
      memo.has(
        metricId
      )
    ) {
      return (
        memo.get(
          metricId
        ) ??
        null
      );
    }

    if (
      stack.has(
        metricId
      )
    ) {
      throw new Error(
        "계산항목 순환참조가 감지되었습니다."
      );
    }

    assertDepth(
      stack
    );

    const definition =
      requireDefinition(
        metricId
      );

    stack.add(
      metricId
    );

    try {
      const value =
        evaluateRpn(
          definition.rpn,
          (
            rawMetricId
          ) =>
            safeRawValue(
              report.values.get(
                rawMetricId
              ),
              issue
            ),
          (
            referencedMetricId
          ) =>
            evaluateDaily(
              referencedMetricId,
              report,
              issue,
              stack,
              memo
            ),
          issue
        );

      memo.set(
        metricId,
        value
      );

      return value;
    }
    finally {
      stack.delete(
        metricId
      );
    }
  }


  function aggregateDailyValues(
    metricId: string,
    reports:
      FormulaEngineReport[],
    aggregationType:
      "sum" | "average",
    issue:
      FormulaEvaluationIssue,
    dailyMemoCache:
      DailyEvaluationMemoCache
  ) {
    const values:
      number[] = [];

    for (
      const report of
      reports
    ) {
      let memo =
        dailyMemoCache.get(
          report
        );

      if (!memo) {
        memo =
          new Map<
            string,
            number | null
          >();

        dailyMemoCache.set(
          report,
          memo
        );
      }

      const value =
        evaluateDaily(
          metricId,
          report,
          issue,
          new Set(),
          memo
        );

      if (
        value !==
        null
      ) {
        values.push(
          value
        );
      }
    }

    if (
      values.length ===
      0
    ) {
      return null;
    }

    const total =
      values.reduce(
        (
          sum,
          value
        ) =>
          sum +
          value,
        0
      );

    if (
      !Number.isFinite(
        total
      )
    ) {
      issue
        .nonFiniteValueCount +=
        1;

      return null;
    }

    return aggregationType ===
      "average"
      ? finiteOrNull(
          total /
            values.length,
          issue
        )
      : total;
  }

  function evaluatePeriod(
    metricId: string,
    reports:
      FormulaEngineReport[],
    issue:
      FormulaEvaluationIssue,
    stack:
      Set<string>,
    periodMemo:
      Map<string, number | null>,
    dailyMemoCache:
      DailyEvaluationMemoCache,
    rawPeriodMemo:
      Map<string, number | null>
  ): number | null {
    if (
      periodMemo.has(
        metricId
      )
    ) {
      return (
        periodMemo.get(
          metricId
        ) ??
        null
      );
    }

    if (
      stack.has(
        metricId
      )
    ) {
      throw new Error(
        "계산항목 순환참조가 감지되었습니다."
      );
    }

    assertDepth(
      stack
    );

    const definition =
      requireDefinition(
        metricId
      );

    if (
      definition
        .aggregationType ===
        "sum" ||
      definition
        .aggregationType ===
        "average"
    ) {
      const value =
        aggregateDailyValues(
          metricId,
          reports,
          definition
            .aggregationType,
          issue,
          dailyMemoCache
        );

      periodMemo.set(
        metricId,
        value
      );

      return value;
    }

    stack.add(
      metricId
    );

    try {
      const value =
        evaluateRpn(
          definition.rpn,
          (
            rawMetricId
          ) => {
            if (
              rawPeriodMemo.has(
                rawMetricId
              )
            ) {
              return (
                rawPeriodMemo.get(
                  rawMetricId
                ) ??
                null
              );
            }

            let sum =
              0;

            for (
              const report of
              reports
            ) {
              const rawValue =
                safeRawValue(
                  report
                    .values
                    .get(
                      rawMetricId
                    ),
                  issue
                );

              if (
                rawValue ===
                null
              ) {
                rawPeriodMemo.set(
                  rawMetricId,
                  null
                );

                return null;
              }

              sum +=
                rawValue;

              if (
                !Number.isFinite(
                  sum
                )
              ) {
                issue
                  .nonFiniteValueCount +=
                  1;

                rawPeriodMemo.set(
                  rawMetricId,
                  null
                );

                return null;
              }
            }

            rawPeriodMemo.set(
              rawMetricId,
              sum
            );

            return sum;
          },
          (
            referencedMetricId
          ) =>
            evaluatePeriod(
              referencedMetricId,
              reports,
              issue,
              stack,
              periodMemo,
              dailyMemoCache,
              rawPeriodMemo
            ),
          issue
        );

      periodMemo.set(
        metricId,
        value
      );

      return value;
    }
    finally {
      stack.delete(
        metricId
      );
    }
  }

  function createIssue():
    FormulaEvaluationIssue {
    return {
      divideByZeroCount:
        0,
      nonFiniteValueCount:
        0,
    };
  }


  return {
    evaluatePeriod(
      metricId:
        string,
      reports:
        FormulaEngineReport[]
    ): FormulaEvaluationResult {
      const issue =
        createIssue();

      if (
        reports.length ===
        0
      ) {
        return {
          value: null,
          issue,
        };
      }

      const value =
        evaluatePeriod(
          metricId,
          reports,
          issue,
          new Set(),
          new Map(),
          new WeakMap(),
          new Map()
        );

      return {
        value,
        issue,
      };
    },

    evaluatePeriodValues(
      metricIds:
        string[],
      reports:
        FormulaEngineReport[]
    ) {
      const values =
        new Map<
          string,
          number | null
        >();

      if (
        metricIds.length ===
          0 ||
        reports.length ===
          0
      ) {
        for (
          const metricId of
          metricIds
        ) {
          values.set(
            metricId,
            null
          );
        }

        return values;
      }

      const issue =
        createIssue();

      const periodMemo =
        new Map<
          string,
          number | null
        >();

      const dailyMemoCache:
        DailyEvaluationMemoCache =
          new WeakMap();

      const rawPeriodMemo =
        new Map<
          string,
          number | null
        >();

      for (
        const metricId of
        metricIds
      ) {
        try {
          values.set(
            metricId,
            evaluatePeriod(
              metricId,
              reports,
              issue,
              new Set(),
              periodMemo,
              dailyMemoCache,
              rawPeriodMemo
            )
          );
        }
        catch {
          values.set(
            metricId,
            null
          );
        }
      }

      return values;
    },

    evaluateDaily(
      metricId:
        string,
      report:
        FormulaEngineReport
    ): FormulaEvaluationResult {
      const issue =
        createIssue();

      const value =
        evaluateDaily(
          metricId,
          report,
          issue,
          new Set(),
          new Map()
        );

      return {
        value,
        issue,
      };
    },
  };
}
