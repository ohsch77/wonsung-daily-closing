"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  GripVertical,
  LoaderCircle,
  Pencil,
  Percent,
  Plus,
  Power,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  ANALYSIS_FORMULA_MAX_TOKENS,
  aggregationLabel,
  toBuilderTokens,
  unitLabel,
  validateBuilderTokens,
} from "@/lib/analytics/metric-library";

import type {
  AnalysisFormulaTokenView,
  AnalysisMetricAggregation,
  AnalysisMetricLibraryItem,
  AnalysisMetricPreviewResult,
  AnalysisMetricLibrarySnapshot,
  AnalysisMetricUnit,
  FormulaBuilderToken,
  SaveAnalysisMetricPayload,
} from "@/lib/analytics/metric-library";


type EditorState = {
  metricId: string | null;
  name: string;
  groupName: string;
  description: string;
  metricKind:
    | "calculated"
    | "ratio";
  unit:
    AnalysisMetricUnit;
  defaultAggregationType:
    AnalysisMetricAggregation;
  displayOrder:
    number | null;
  tokens:
    FormulaBuilderToken[];
};


function emptyEditor(): EditorState {
  return {
    metricId: null,
    name: "",
    groupName:
      "사용자 정의",
    description: "",
    metricKind:
      "calculated",
    unit:
      "number",
    defaultAggregationType:
      "sum",
    displayOrder:
      null,
    tokens: [],
  };
}


function badgeClass(
  item:
    AnalysisMetricLibraryItem
) {
  if (
    item.sourceType ===
    "raw"
  ) {
    return "border-[#DDE0E4] bg-[#F5F6F7] text-[#6F747B]";
  }

  if (
    item.metricKind ===
    "ratio"
  ) {
    return "border-[#DDD5F3] bg-[#F7F4FF] text-[#6D55A6]";
  }

  return "border-[#F0D4DB] bg-[#FFF3F6] text-[#A50034]";
}


function badgeIcon(
  item:
    AnalysisMetricLibraryItem
) {
  if (
    item.sourceType ===
    "raw"
  ) {
    return (
      <Database
        size={11}
      />
    );
  }

  if (
    item.metricKind ===
    "ratio"
  ) {
    return (
      <Percent
        size={11}
      />
    );
  }

  return (
    <Calculator
      size={11}
    />
  );
}


function ModalShell({
  children,
  onClose,
  wide = false,
}: {
  children:
    React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const body =
      document.body;
    const root =
      document.documentElement;

    const previousBodyOverflow =
      body.style.overflow;
    const previousRootOverflow =
      root.style.overflow;

    body.style.overflow =
      "hidden";
    root.style.overflow =
      "hidden";

    return () => {
      body.style.overflow =
        previousBodyOverflow;
      root.style.overflow =
        previousRootOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          onClose();
        }
      };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center overflow-hidden bg-black/35 p-2 sm:p-5"
      onMouseDown={
        onClose
      }
    >
      <div
        className={[
          "flex h-[calc(100dvh-16px)] w-full min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#E2E4E7] bg-white shadow-2xl sm:h-[calc(100dvh-40px)] sm:rounded-[18px]",
          wide
            ? "max-h-[860px] max-w-[1180px]"
            : "max-h-[760px] max-w-[720px]",
        ].join(" ")}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        {children}
      </div>
    </div>
  );
}


function FormulaTokenChip({
  token,
  itemMap,
  onRemove,
}: {
  token:
    FormulaBuilderToken;
  itemMap:
    Map<
      string,
      AnalysisMetricLibraryItem
    >;
  onRemove?: () => void;
}) {
  let text = "";
  let kind:
    "item" |
    "operator" |
    "number" |
    "paren" =
      "item";

  if (
    token.type ===
      "raw_metric" ||
    token.type ===
      "analysis_metric"
  ) {
    text =
      itemMap.get(
        `${
          token.type ===
          "raw_metric"
            ? "raw"
            : "formula"
        }:${token.metricId}`
      )?.name ??
      "알 수 없는 항목";
  }
  else if (
    token.type ===
    "operator"
  ) {
    text =
      token.value === "*"
        ? "×"
        : token.value === "/"
          ? "÷"
          : token.value;
    kind = "operator";
  }
  else if (
    token.type ===
    "number"
  ) {
    text =
      String(
        token.value
      );
    kind = "number";
  }
  else {
    text =
      token.type ===
      "left_paren"
        ? "("
        : ")";
    kind = "paren";
  }

  return (
    <span
      className={[
        "inline-flex h-8 items-center gap-1.5 rounded-[9px] border px-2.5 text-[10px] font-black",
        kind === "operator"
          ? "border-[#E0D8DA] bg-[#FFF7F9] text-[#A50034]"
          : kind === "item"
            ? "border-[#DDE0E4] bg-white text-[#4D5259]"
            : "border-[#E3E5E8] bg-[#F7F8F9] text-[#646970]",
      ].join(" ")}
    >
      {text}

      {onRemove && (
        <button
          type="button"
          onClick={
            onRemove
          }
          className="ml-0.5 text-[#A4A8AE] hover:text-[#A50034]"
          title="토큰 제거"
        >
          <X
            size={11}
          />
        </button>
      )}
    </span>
  );
}


function FormulaEditorModal({
  snapshot,
  initial,
  onClose,
  onSaved,
}: {
  snapshot:
    AnalysisMetricLibrarySnapshot;
  initial:
    EditorState;
  onClose: () => void;
  onSaved: (
    snapshot:
      AnalysisMetricLibrarySnapshot,
    metricId: string
  ) => void;
}) {
  const [
    editor,
    setEditor,
  ] =
    useState<EditorState>(
      initial
    );

  const [
    itemSearch,
    setItemSearch,
  ] =
    useState("");

  const [
    numberValue,
    setNumberValue,
  ] =
    useState("");

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");


  const [
    previewLoading,
    setPreviewLoading,
  ] =
    useState(false);

  const [
    preview,
    setPreview,
  ] =
    useState<AnalysisMetricPreviewResult | null>(
      null
    );

  const [
    previewSignature,
    setPreviewSignature,
  ] =
    useState("");

  const [
    previewError,
    setPreviewError,
  ] =
    useState("");

  const itemMap =
    useMemo(
      () =>
        new Map(
          snapshot.items.map(
            (item) => [
              item.libraryKey,
              item,
            ]
          )
        ),
      [snapshot.items]
    );

  const availableItems =
    useMemo(() => {
      const query =
        itemSearch
          .trim()
          .toLowerCase();

      return snapshot.items
        .filter(
          (item) =>
            item.isActive
        )
        .filter(
          (item) =>
            !(
              item.sourceType ===
                "formula" &&
              item.sourceId ===
                editor.metricId
            )
        )
        .filter(
          (item) =>
            query === "" ||
            item.name
              .toLowerCase()
              .includes(
                query
              ) ||
            item.groupName
              .toLowerCase()
              .includes(
                query
              )
        );
    }, [
      snapshot.items,
      itemSearch,
      editor.metricId,
    ]);

  const groupedItems =
    useMemo(() => {
      const groups =
        new Map<
          string,
          AnalysisMetricLibraryItem[]
        >();

      for (
        const item of
        availableItems
      ) {
        const key =
          item.sourceType ===
          "formula"
            ? "계산항목"
            : item.groupName;

        const rows =
          groups.get(key) ??
          [];

        rows.push(item);
        groups.set(
          key,
          rows
        );
      }

      return Array.from(
        groups.entries()
      );
    }, [availableItems]);

  const validation =
    useMemo(
      () =>
        validateBuilderTokens(
          editor.tokens,
          {
            selfMetricId:
              editor.metricId,
          }
        ),
      [
        editor.tokens,
        editor.metricId,
      ]
    );

  const appendItem =
    (
      item:
        AnalysisMetricLibraryItem
    ) => {
      if (
        editor.tokens.length >=
        ANALYSIS_FORMULA_MAX_TOKENS
      ) {
        setErrorMessage(
          `하나의 수식은 최대 ${ANALYSIS_FORMULA_MAX_TOKENS}개 토큰까지 사용할 수 있습니다.`
        );
        return;
      }

      setEditor(
        (current) => ({
          ...current,
          tokens: [
            ...current.tokens,
            item.sourceType ===
            "raw"
              ? {
                  type:
                    "raw_metric",
                  metricId:
                    item.sourceId,
                }
              : {
                  type:
                    "analysis_metric",
                  metricId:
                    item.sourceId,
                },
          ],
        })
      );
    };

  const appendToken =
    (
      token:
        FormulaBuilderToken
    ) => {
      if (
        editor.tokens.length >=
        ANALYSIS_FORMULA_MAX_TOKENS
      ) {
        setErrorMessage(
          `하나의 수식은 최대 ${ANALYSIS_FORMULA_MAX_TOKENS}개 토큰까지 사용할 수 있습니다.`
        );
        return;
      }

      setEditor(
        (current) => ({
          ...current,
          tokens: [
            ...current.tokens,
            token,
          ],
        })
      );
    };

  const removeToken =
    (
      index: number
    ) => {
      setEditor(
        (current) => ({
          ...current,
          tokens:
            current.tokens.filter(
              (_, tokenIndex) =>
                tokenIndex !==
                index
            ),
        })
      );
    };

  const handleKind =
    (
      kind:
        "calculated" |
        "ratio"
    ) => {
      setEditor(
        (current) => ({
          ...current,
          metricKind:
            kind,
          unit:
            kind === "ratio"
              ? "percent"
              : current.unit ===
                  "percent"
                ? "number"
                : current.unit,
          defaultAggregationType:
            kind === "ratio"
              ? "rate"
              : current.defaultAggregationType ===
                  "rate"
                ? "sum"
                : current.defaultAggregationType,
        })
      );
    };

  const currentPreviewSignature =
    JSON.stringify({
      metricId:
        editor.metricId,
      metricKind:
        editor.metricKind,
      unit:
        editor.unit,
      defaultAggregationType:
        editor.defaultAggregationType,
      tokens:
        editor.tokens,
    });

  const previewIsCurrent =
    preview !== null &&
    previewSignature ===
      currentPreviewSignature;

  const formatPreviewValue =
    (
      value:
        number | null
    ) => {
      if (
        value === null ||
        !Number.isFinite(
          value
        )
      ) {
        return "-";
      }

      if (
        editor.unit ===
        "amount"
      ) {
        return `${Math.round(
          value
        ).toLocaleString(
          "ko-KR"
        )}원`;
      }

      if (
        editor.unit ===
        "percent"
      ) {
        return `${value.toFixed(
          1
        )}%`;
      }

      if (
        editor.unit ===
        "count"
      ) {
        return Number.isInteger(
          value
        )
          ? value.toLocaleString(
              "ko-KR"
            )
          : value.toLocaleString(
              "ko-KR",
              {
                maximumFractionDigits:
                  1,
              }
            );
      }

      return value.toLocaleString(
        "ko-KR",
        {
          maximumFractionDigits:
            2,
        }
      );
    };

  const handlePreview =
    async () => {
      if (
        !validation.valid
      ) {
        setPreviewError(
          validation.message
        );
        return;
      }

      setPreviewLoading(
        true
      );
      setPreviewError("");

      try {
        const response =
          await fetch(
            "/api/analytics/metric-library",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache:
                "no-store",
              body:
                JSON.stringify({
                  action:
                    "preview",
                  payload: {
                    metricId:
                      editor.metricId,
                    metricKind:
                      editor.metricKind,
                    unit:
                      editor.unit,
                    defaultAggregationType:
                      editor.defaultAggregationType,
                    tokens:
                      editor.tokens,
                  },
                }),
            }
          );

        const data =
          await response.json() as
            | {
                preview:
                  AnalysisMetricPreviewResult;
              }
            | {
                error?: string;
              };

        if (
          !response.ok ||
          !("preview" in data)
        ) {
          throw new Error(
            "error" in data &&
            data.error
              ? data.error
              : "계산 미리보기를 불러오지 못했습니다."
          );
        }

        setPreview(
          data.preview
        );

        setPreviewSignature(
          currentPreviewSignature
        );
      }
      catch (error) {
        setPreviewError(
          error instanceof Error
            ? error.message
            : "계산 미리보기를 불러오지 못했습니다."
        );
      }
      finally {
        setPreviewLoading(
          false
        );
      }
    };


  const handleSave =
    async () => {
      if (
        editor.name.trim() ===
        ""
      ) {
        setErrorMessage(
          "항목명을 입력해주세요."
        );
        return;
      }

      if (
        editor.groupName.trim() ===
        ""
      ) {
        setErrorMessage(
          "분류명을 입력해주세요."
        );
        return;
      }

      if (
        !validation.valid
      ) {
        setErrorMessage(
          validation.message
        );
        return;
      }

      setSaving(true);
      setErrorMessage("");

      const payload:
        SaveAnalysisMetricPayload = {
          metricId:
            editor.metricId,
          name:
            editor.name.trim(),
          groupName:
            editor.groupName.trim(),
          description:
            editor.description.trim(),
          metricKind:
            editor.metricKind,
          unit:
            editor.unit,
          defaultAggregationType:
            editor.defaultAggregationType,
          displayOrder:
            editor.displayOrder,
          tokens:
            editor.tokens,
        };

      try {
        const response =
          await fetch(
            "/api/analytics/metric-library",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache:
                "no-store",
              body:
                JSON.stringify({
                  action:
                    "save",
                  payload,
                }),
            }
          );

        const data =
          await response.json() as
            | {
                metricId: string;
                snapshot:
                  AnalysisMetricLibrarySnapshot;
              }
            | {
                error?: string;
              };

        if (
          !response.ok ||
          !("snapshot" in data)
        ) {
          throw new Error(
            "error" in data &&
            data.error
              ? data.error
              : "분석항목을 저장하지 못했습니다."
          );
        }

        onSaved(
          data.snapshot,
          data.metricId
        );
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "분석항목을 저장하지 못했습니다."
        );
      }
      finally {
        setSaving(false);
      }
    };

  return (
    <ModalShell
      onClose={
        onClose
      }
      wide
    >
      <div className="flex items-center justify-between border-b border-[#E7E9EC] px-4 py-3.5 sm:px-5 sm:py-4">
        <div>
          <p className="text-[10px] font-black tracking-[0.08em] text-[#A50034]">
            FORMULA BUILDER
          </p>
          <h3 className="mt-1 text-[18px] font-black text-[#292D32]">
            {editor.metricId
              ? "계산항목 수정"
              : "항목 추가"}
          </h3>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-[10px] border border-[#E1E3E6] text-[#777C84] hover:bg-[#F7F8F9] sm:h-9 sm:w-9"
        >
          <X
            size={16}
          />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
        <div className="mx-auto grid w-full max-w-[1120px] items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="order-2 min-w-0 space-y-3 rounded-[15px] border border-[#E4E6E9] bg-[#FAFAFB] p-3.5 sm:p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="md:col-span-1 xl:col-span-4">
                <span className="mb-1.5 block text-[9px] font-black text-[#777C84]">
                  항목명
                </span>
                <input
                  value={
                    editor.name
                  }
                  onChange={(event) =>
                    setEditor(
                      (current) => ({
                        ...current,
                        name:
                          event.target.value,
                      })
                    )
                  }
                  maxLength={80}
                  className="h-11 w-full rounded-[10px] border border-[#DDE0E4] bg-white px-3 text-[11px] font-bold outline-none focus:border-[#A50034] sm:h-10"
                  placeholder="예: 총판매금액"
                />
              </label>

              <label className="md:col-span-1 xl:col-span-2">
                <span className="mb-1.5 block text-[9px] font-black text-[#777C84]">
                  분류
                </span>
                <input
                  value={
                    editor.groupName
                  }
                  onChange={(event) =>
                    setEditor(
                      (current) => ({
                        ...current,
                        groupName:
                          event.target.value,
                      })
                    )
                  }
                  maxLength={50}
                  className="h-11 w-full rounded-[10px] border border-[#DDE0E4] bg-white px-3 text-[11px] font-bold outline-none focus:border-[#A50034] sm:h-10"
                  placeholder="예: 판매"
                />
              </label>

              <div className="xl:col-span-2">
                <span className="mb-1.5 block text-[9px] font-black text-[#777C84]">
                  유형
                </span>
                <div className="flex h-11 rounded-[10px] border border-[#DDE0E4] bg-white p-1 sm:h-10">
                  <button
                    type="button"
                    onClick={() =>
                      handleKind(
                        "calculated"
                      )
                    }
                    className={[
                      "flex-1 rounded-[7px] text-[9px] font-black",
                      editor.metricKind ===
                      "calculated"
                        ? "bg-[#A50034] text-white"
                        : "text-[#777C84]",
                    ].join(" ")}
                  >
                    계산
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleKind(
                        "ratio"
                      )
                    }
                    className={[
                      "flex-1 rounded-[7px] text-[9px] font-black",
                      editor.metricKind ===
                      "ratio"
                        ? "bg-[#6D55A6] text-white"
                        : "text-[#777C84]",
                    ].join(" ")}
                  >
                    비율
                  </button>
                </div>
              </div>

              <label className="xl:col-span-2">
                <span className="mb-1.5 block text-[9px] font-black text-[#777C84]">
                  표시단위
                </span>
                <select
                  value={
                    editor.unit
                  }
                  onChange={(event) =>
                    setEditor(
                      (current) => ({
                        ...current,
                        unit:
                          event.target.value as AnalysisMetricUnit,
                      })
                    )
                  }
                  disabled={
                    editor.metricKind ===
                    "ratio"
                  }
                  className="h-11 w-full rounded-[10px] border border-[#DDE0E4] bg-white px-3 text-[10px] font-black text-[#555A62] outline-none disabled:bg-[#F3F4F5] sm:h-10"
                >
                  <option value="amount">금액</option>
                  <option value="count">건수</option>
                  <option value="number">숫자</option>
                  <option value="percent">%</option>
                </select>
              </label>

              <label className="xl:col-span-2">
                <span className="mb-1.5 block text-[9px] font-black text-[#777C84]">
                  기본 집계
                </span>
                <select
                  value={
                    editor.defaultAggregationType
                  }
                  onChange={(event) =>
                    setEditor(
                      (current) => ({
                        ...current,
                        defaultAggregationType:
                          event.target.value as AnalysisMetricAggregation,
                      })
                    )
                  }
                  disabled={
                    editor.metricKind ===
                    "ratio"
                  }
                  className="h-11 w-full rounded-[10px] border border-[#DDE0E4] bg-white px-3 text-[10px] font-black text-[#555A62] outline-none disabled:bg-[#F3F4F5] sm:h-10"
                >
                  <option value="sum">합계</option>
                  <option value="average">평균</option>
                  <option value="rate">성공률</option>
                </select>
              </label>

            </div>

            <div className="rounded-[11px] border border-[#E3E5E8] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-black text-[#5D6269]">
                  수식 빌더
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEditor(
                        (current) => ({
                          ...current,
                          tokens:
                            current.tokens.slice(
                              0,
                              -1
                            ),
                        })
                      )
                    }
                    disabled={
                      editor.tokens.length ===
                      0
                    }
                    className="h-9 touch-manipulation rounded-[8px] border border-[#E1E3E6] px-2.5 text-[8px] font-black text-[#777C84] disabled:opacity-35 sm:h-7 sm:px-2"
                  >
                    한 단계 취소
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditor(
                        (current) => ({
                          ...current,
                          tokens: [],
                        })
                      )
                    }
                    disabled={
                      editor.tokens.length ===
                      0
                    }
                    className="h-9 touch-manipulation rounded-[8px] border border-[#F0D4DB] bg-[#FFF7F9] px-2.5 text-[8px] font-black text-[#A50034] disabled:opacity-35 sm:h-7 sm:px-2"
                  >
                    전체 지우기
                  </button>
                </div>
              </div>

              <div className="mt-2 min-h-[74px] rounded-[10px] border border-dashed border-[#D8DBDF] bg-[#FAFAFB] p-2.5">
                {editor.tokens.length ===
                0 ? (
                  <div className="flex min-h-[52px] items-center justify-center text-center text-[9px] font-bold text-[#A0A4AA]">
                    왼쪽 항목과 아래 연산자 버튼을 눌러 수식을 조립하세요.
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {editor.tokens.map(
                      (token, index) => (
                        <FormulaTokenChip
                          key={`${index}-${token.type}`}
                          token={
                            token
                          }
                          itemMap={
                            itemMap
                          }
                          onRemove={() =>
                            removeToken(
                              index
                            )
                          }
                        />
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {([
                  ["+", "+"],
                  ["-", "-"],
                  ["*", "×"],
                  ["/", "÷"],
                ] as const).map(
                  ([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() =>
                        appendToken({
                          type:
                            "operator",
                          value,
                        })
                      }
                      className="h-10 min-w-10 touch-manipulation rounded-[8px] border border-[#E0D8DA] bg-[#FFF7F9] px-2 text-[12px] font-black text-[#A50034] hover:bg-[#FFF0F4] sm:h-8 sm:min-w-9 sm:text-[11px]"
                    >
                      {label}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() =>
                    appendToken({
                      type:
                        "left_paren",
                    })
                  }
                  className="h-10 min-w-10 touch-manipulation rounded-[8px] border border-[#DDE0E4] bg-white px-2 text-[12px] font-black text-[#666B72] sm:h-8 sm:min-w-9 sm:text-[11px]"
                >
                  (
                </button>

                <button
                  type="button"
                  onClick={() =>
                    appendToken({
                      type:
                        "right_paren",
                    })
                  }
                  className="h-10 min-w-10 touch-manipulation rounded-[8px] border border-[#DDE0E4] bg-white px-2 text-[12px] font-black text-[#666B72] sm:h-8 sm:min-w-9 sm:text-[11px]"
                >
                  )
                </button>

                <div className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={
                      numberValue
                    }
                    onChange={(event) =>
                      setNumberValue(
                        event.target.value
                      )
                    }
                    className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#DDE0E4] bg-white px-2 text-right text-[10px] font-black outline-none sm:h-8 sm:w-24 sm:flex-none sm:text-[9px]"
                    placeholder="숫자"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const value =
                        Number(
                          numberValue
                        );
                      if (
                        !Number.isFinite(
                          value
                        )
                      ) {
                        return;
                      }
                      appendToken({
                        type:
                          "number",
                        value,
                      });
                      setNumberValue("");
                    }}
                    className="h-10 touch-manipulation rounded-[8px] border border-[#DDE0E4] bg-white px-3 text-[8px] font-black text-[#666B72] sm:h-8 sm:px-2"
                  >
                    숫자 추가
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div
                  className={[
                    "flex min-h-9 flex-1 items-start gap-1.5 rounded-[9px] px-2.5 py-2 text-[8px] font-bold leading-4",
                    validation.valid
                      ? "bg-[#F3FAF6] text-[#377453]"
                      : "bg-[#FFF7F9] text-[#9A5065]",
                  ].join(" ")}
                >
                  {validation.valid ? (
                    <CheckCircle2
                      size={12}
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <AlertCircle
                      size={12}
                      className="mt-0.5 shrink-0"
                    />
                  )}
                  {validation.message}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void handlePreview()
                  }
                  disabled={
                    !validation.valid ||
                    previewLoading
                  }
                  className="inline-flex h-10 touch-manipulation items-center justify-center gap-1.5 rounded-[9px] border border-[#D8C2C9] bg-white px-3 text-[8px] font-black text-[#A50034] disabled:opacity-40 sm:h-9"
                >
                  {previewLoading ? (
                    <LoaderCircle
                      size={12}
                      className="animate-spin"
                    />
                  ) : (
                    <Eye
                      size={12}
                    />
                  )}
                  계산 미리보기
                </button>
              </div>

              {previewError && (
                <div className="mt-2 flex items-start gap-1.5 rounded-[9px] bg-[#FFF7F9] px-2.5 py-2 text-[8px] font-bold leading-4 text-[#9A5065]">
                  <AlertCircle
                    size={12}
                    className="mt-0.5 shrink-0"
                  />
                  {previewError}
                </div>
              )}

              {preview && (
                <div className="mt-2 rounded-[11px] border border-[#E2E4E7] bg-[#FAFAFB] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-black text-[#4D5259]">
                        현재 월 계산 미리보기
                      </p>
                      <p className="mt-1 text-[8px] font-bold text-[#999DA4]">
                        {preview.startDate} ~ {preview.endDate} · 마감 {preview.completedReportCount}건
                      </p>
                    </div>

                    {!previewIsCurrent && (
                      <span className="rounded-full bg-[#FFF0F4] px-2 py-1 text-[7px] font-black text-[#A50034]">
                        수식 변경됨 · 다시 계산 필요
                      </span>
                    )}
                  </div>

                  {previewIsCurrent && (
                    <>
                      <div className="mt-3 rounded-[10px] border border-[#E5E7EA] bg-white px-3 py-2.5">
                        <p className="text-[8px] font-bold text-[#999DA4]">
                          전체 {aggregationLabel(
                            preview.aggregationType
                          )}
                        </p>
                        <p className="mt-1 text-[16px] font-black tabular-nums text-[#A50034]">
                          {formatPreviewValue(
                            preview.totalValue
                          )}
                        </p>
                      </div>

                      {preview.rows.length >
                        0 ? (
                        <div className="mt-2 grid grid-cols-1 gap-1.5 min-[430px]:grid-cols-2">
                          {preview.rows
                            .slice(
                              0,
                              6
                            )
                            .map(
                              (row) => (
                                <div
                                  key={
                                    row.managerId
                                  }
                                  className="rounded-[9px] border border-[#E5E7EA] bg-white px-2.5 py-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-[8px] font-black text-[#5B6067]">
                                      {row.managerName}
                                    </p>
                                    <span className="text-[7px] font-bold text-[#A0A4AA]">
                                      {row.reportCount}건
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[11px] font-black tabular-nums text-[#33373D]">
                                    {formatPreviewValue(
                                      row.value
                                    )}
                                  </p>
                                </div>
                              )
                            )}
                        </div>
                      ) : (
                        <p className="mt-2 rounded-[9px] bg-white px-3 py-3 text-center text-[8px] font-bold text-[#999DA4]">
                          이번 달에 마감된 일실적이 없습니다.
                        </p>
                      )}

                      {preview.totalDivideByZeroCount >
                        0 && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-[9px] bg-[#FFF9EC] px-2.5 py-2 text-[8px] font-bold leading-4 text-[#8A6A22]">
                          <AlertCircle
                            size={12}
                            className="mt-0.5 shrink-0"
                          />
                          0으로 나누는 계산 {preview.totalDivideByZeroCount}건은 결과를 &quot;-&quot;로 처리했습니다.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[9px] font-black text-[#777C84]">
                설명
              </span>
              <textarea
                value={
                  editor.description
                }
                onChange={(event) =>
                  setEditor(
                    (current) => ({
                      ...current,
                      description:
                        event.target.value,
                    })
                  )
                }
                rows={2}
                className="min-h-[58px] w-full resize-y rounded-[10px] border border-[#DDE0E4] bg-white px-3 py-2.5 text-[10px] font-medium leading-5 outline-none focus:border-[#A50034]"
                placeholder="선택사항"
              />
            </label>
          </section>

          <section className="order-1 min-w-0 rounded-[15px] border border-[#E4E6E9] bg-white p-3.5 sm:p-4 lg:sticky lg:top-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black text-[#4A4F56]">
                  수식에 사용할 항목
                </p>
                <p className="mt-1 text-[8px] font-bold text-[#999DA4]">
                  새로 만든 계산항목도 다시 수식 재료로 사용할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="relative mt-3">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A4AA]"
              />
              <input
                value={
                  itemSearch
                }
                onChange={(event) =>
                  setItemSearch(
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-[10px] border border-[#DDE0E4] bg-[#FAFAFB] pl-9 pr-3 text-[10px] font-bold outline-none focus:border-[#A50034] sm:h-9 sm:text-[9px]"
                placeholder="항목명 또는 분류 검색"
              />
            </div>

            <div className="mt-3 max-h-[38dvh] space-y-4 overflow-y-auto overscroll-contain pr-1 sm:max-h-[42dvh] lg:max-h-[540px]">
              {groupedItems.map(
                ([group, items]) => (
                  <div key={group}>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-[8px] font-black tracking-[0.06em] text-[#777C84]">
                        {group}
                      </p>
                      <span className="text-[8px] font-bold text-[#B0B3B8]">
                        {items.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
                      {items.map(
                        (item) => (
                          <button
                            type="button"
                            key={
                              item.libraryKey
                            }
                            onClick={() =>
                              appendItem(
                                item
                              )
                            }
                            className="min-h-11 w-full min-w-0 touch-manipulation rounded-[9px] border border-[#E2E4E7] bg-[#FAFAFB] px-2.5 py-2.5 text-left transition hover:border-[#C7CBD0] hover:bg-white sm:min-h-0 sm:py-2"
                          >
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[7px] font-black",
                                badgeClass(
                                  item
                                ),
                              ].join(" ")}
                            >
                              {badgeIcon(
                                item
                              )}
                              {item.badgeLabel}
                            </span>
                            <p className="mt-1.5 truncate text-[9px] font-black text-[#4D5259]">
                              {item.name}
                            </p>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-[11px] border border-[#F0CDD3] bg-[#FFF5F7] px-3 py-2.5 text-[9px] font-bold text-[#A50034]">
            <AlertCircle
              size={13}
              className="mt-0.5 shrink-0"
            />
            {errorMessage}
          </div>
        )}

        <div className="sticky bottom-0 z-20 -mx-3 mt-4 flex w-[calc(100%+24px)] max-w-none items-center justify-end gap-2 border-t border-[#ECEEF1] bg-white/95 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-auto sm:w-full sm:max-w-[1120px] sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-4 sm:backdrop-blur-none">
          <button
            type="button"
            onClick={
              onClose
            }
            className="h-11 flex-1 touch-manipulation rounded-[10px] border border-[#DDE0E4] bg-white px-4 text-[10px] font-black text-[#686D74] sm:h-10 sm:flex-none"
          >
            취소
          </button>

          <button
            type="button"
            onClick={() =>
              void handleSave()
            }
            disabled={
              saving ||
              !validation.valid
            }
            className="inline-flex h-11 min-w-[108px] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-[10px] bg-[#A50034] px-4 text-[10px] font-black text-white disabled:opacity-45 sm:h-10 sm:flex-none"
          >
            {saving ? (
              <LoaderCircle
                size={14}
                className="animate-spin"
              />
            ) : (
              <Save
                size={14}
              />
            )}
            저장
          </button>
        </div>
      </div>
    </ModalShell>
  );
}


function FormulaDetailModal({
  snapshot,
  metricId,
  onClose,
  onNavigate,
  onEdit,
  onDelete,
  onToggleActive,
  busy,
}: {
  snapshot:
    AnalysisMetricLibrarySnapshot;
  metricId: string;
  onClose: () => void;
  onNavigate: (
    metricId: string
  ) => void;
  onEdit: (
    metricId: string
  ) => void;
  onDelete: (
    metricId: string
  ) => void;
  onToggleActive: (
    metricId: string,
    isActive: boolean
  ) => void;
  busy: boolean;
}) {
  const definition =
    snapshot.formulaDefinitions.find(
      (item) =>
        item.id ===
        metricId
    );

  const tokens =
    snapshot.formulaTokens
      .filter(
        (token) =>
          token.analysisMetricId ===
          metricId
      )
      .sort(
        (a, b) =>
          a.tokenOrder -
          b.tokenOrder
      );

  const usages =
    snapshot.usages.filter(
      (usage) =>
        usage.referencedSourceType ===
          "formula" &&
        usage.referencedSourceId ===
          metricId
    );

  if (!definition) {
    return null;
  }

  const tokenClass =
    (
      token:
        AnalysisFormulaTokenView
    ) => {
      if (
        token.tokenType ===
        "analysis_metric"
      ) {
        return "border-[#F0D4DB] bg-[#FFF3F6] text-[#A50034]";
      }
      if (
        token.tokenType ===
        "raw_metric"
      ) {
        return "border-[#DDE0E4] bg-white text-[#555A62]";
      }
      return "border-[#E3E5E8] bg-[#F7F8F9] text-[#666B72]";
    };

  return (
    <ModalShell
      onClose={
        onClose
      }
    >
      <div className="flex items-center justify-between border-b border-[#E7E9EC] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black",
                definition.metricKind ===
                "ratio"
                  ? "border-[#DDD5F3] bg-[#F7F4FF] text-[#6D55A6]"
                  : "border-[#F0D4DB] bg-[#FFF3F6] text-[#A50034]",
              ].join(" ")}
            >
              {definition.metricKind ===
              "ratio" ? (
                <Percent
                  size={11}
                />
              ) : (
                <Calculator
                  size={11}
                />
              )}
              {definition.metricKind ===
              "ratio"
                ? "비율"
                : "계산"}
            </span>

            {!definition.isActive && (
              <span className="rounded-full bg-[#F1F2F3] px-2 py-1 text-[8px] font-black text-[#8C9198]">
                사용중지
              </span>
            )}
          </div>

          <h3 className="mt-2 text-[19px] font-black text-[#292D32]">
            {definition.name}
          </h3>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E1E3E6] text-[#777C84]"
        >
          <X
            size={16}
          />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            [
              "분류",
              definition.groupName,
            ],
            [
              "단위",
              unitLabel(
                definition.unit
              ),
            ],
            [
              "기본 집계",
              aggregationLabel(
                definition.defaultAggregationType
              ),
            ],
          ].map(
            ([label, value]) => (
              <div
                key={label}
                className="rounded-[11px] border border-[#E5E7EA] bg-[#FAFAFB] px-3 py-2.5"
              >
                <p className="text-[8px] font-bold text-[#999DA4]">
                  {label}
                </p>
                <p className="mt-1 text-[10px] font-black text-[#4D5259]">
                  {value}
                </p>
              </div>
            )
          )}
        </div>

        {definition.description && (
          <p className="mt-3 rounded-[11px] bg-[#F7F8F9] px-3 py-2.5 text-[9px] font-medium leading-5 text-[#777C84]">
            {definition.description}
          </p>
        )}

        <section className="mt-4 rounded-[14px] border border-[#E4E6E9] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-[#4A4F56]">
                수식 빌더 내용
              </p>
              <p className="mt-1 text-[8px] font-bold text-[#999DA4]">
                계산항목 토큰을 클릭하면 해당 수식 상세로 이동합니다.
              </p>
            </div>
          </div>

          <div className="mt-3 flex min-h-[54px] flex-wrap items-center gap-1.5 rounded-[10px] border border-dashed border-[#D9DCE1] bg-[#FAFAFB] p-3">
            {tokens.map(
              (token) => {
                const clickable =
                  token.tokenType ===
                    "analysis_metric" &&
                  token.referencedAnalysisMetricId;

                return (
                  <button
                    type="button"
                    key={`${token.analysisMetricId}-${token.tokenOrder}`}
                    disabled={
                      !clickable
                    }
                    onClick={() => {
                      if (
                        token.referencedAnalysisMetricId
                      ) {
                        onNavigate(
                          token.referencedAnalysisMetricId
                        );
                      }
                    }}
                    className={[
                      "inline-flex h-8 items-center gap-1 rounded-[9px] border px-2.5 text-[9px] font-black",
                      tokenClass(
                        token
                      ),
                      clickable
                        ? "cursor-pointer hover:shadow-sm"
                        : "cursor-default",
                    ].join(" ")}
                  >
                    {token.referencedBadgeLabel && (
                      <span className="text-[7px] opacity-70">
                        {token.referencedBadgeLabel}
                      </span>
                    )}
                    {token.displayText}
                    {clickable && (
                      <ChevronRight
                        size={10}
                      />
                    )}
                  </button>
                );
              }
            )}
          </div>
        </section>

        <section className="mt-4 rounded-[14px] border border-[#E4E6E9] bg-[#FAFAFB] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-[#4A4F56]">
              사용처
            </p>
            <span className="rounded-full bg-white px-2 py-1 text-[8px] font-black text-[#777C84]">
              {usages.length}개
            </span>
          </div>

          {usages.length ===
          0 ? (
            <p className="mt-3 text-[9px] font-bold text-[#A0A4AA]">
              현재 이 항목을 사용하는 다른 계산항목이 없습니다.
            </p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {usages.map(
                (usage) => (
                  <button
                    type="button"
                    key={
                      usage.dependentMetricId
                    }
                    onClick={() =>
                      onNavigate(
                        usage.dependentMetricId
                      )
                    }
                    className="flex w-full items-center justify-between rounded-[9px] border border-[#E1E3E6] bg-white px-3 py-2 text-left"
                  >
                    <span className="text-[9px] font-black text-[#555A62]">
                      {usage.dependentMetricName}
                    </span>
                    <ChevronRight
                      size={12}
                      className="text-[#999DA4]"
                    />
                  </button>
                )
              )}
            </div>
          )}
        </section>

        {snapshot.canManage &&
          !definition.isLocked && (
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#ECEEF1] pt-4">
            <button
              type="button"
              onClick={() =>
                onEdit(
                  definition.id
                )
              }
              disabled={
                busy
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#DDE0E4] bg-white px-3 text-[9px] font-black text-[#666B72]"
            >
              <Pencil
                size={12}
              />
              수정
            </button>

            {definition.origin ===
              "user" && (
              <button
                type="button"
                onClick={() =>
                  onDelete(
                    definition.id
                  )
                }
                disabled={
                  busy
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#F0CDD3] bg-[#FFF5F7] px-3 text-[9px] font-black text-[#A50034]"
              >
                {busy ? (
                  <LoaderCircle
                    size={12}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2
                    size={12}
                  />
                )}
                삭제
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onToggleActive(
                  definition.id,
                  !definition.isActive
                )
              }
              disabled={
                busy
              }
              className={[
                "inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[9px] font-black",
                definition.isActive
                  ? "border-[#E4D6DA] bg-[#FFF7F9] text-[#A50034]"
                  : "border-[#D7E6DC] bg-[#F4FAF6] text-[#34744E]",
              ].join(" ")}
            >
              {busy ? (
                <LoaderCircle
                  size={12}
                  className="animate-spin"
                />
              ) : (
                <Power
                  size={12}
                />
              )}
              {definition.isActive
                ? "사용중지"
                : "다시 사용"}
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}


async function fetchMetricLibrarySnapshot() {
  const response =
    await fetch(
      "/api/analytics/metric-library",
      {
        method:
          "GET",
        cache:
          "no-store",
      }
    );

  const data =
    await response.json() as
      | AnalysisMetricLibrarySnapshot
      | {
          error?: string;
        };

  if (
    !response.ok ||
    !("items" in data)
  ) {
    throw new Error(
      "error" in data &&
      data.error
        ? data.error
        : "분석항목 모음을 불러오지 못했습니다."
    );
  }

  return data;
}


type MetricLibraryBuilderProps = {
  onReportCompositionChange?: (
    libraryKeys: string[],
    snapshot:
      AnalysisMetricLibrarySnapshot | null
  ) => void;

  restoreReportComposition?: {
    key: string;
    libraryKeys: string[];
  } | null;
};


export default function MetricLibraryBuilder({
  onReportCompositionChange,
  restoreReportComposition = null,
}: MetricLibraryBuilderProps = {}) {
  const [
    snapshot,
    setSnapshot,
  ] =
    useState<AnalysisMetricLibrarySnapshot | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    showInactive,
    setShowInactive,
  ] =
    useState(false);

  const [
    detailMetricId,
    setDetailMetricId,
  ] =
    useState<string | null>(
      null
    );

  const [
    editor,
    setEditor,
  ] =
    useState<EditorState | null>(
      null
    );

  const [
    reportItemKeys,
    setReportItemKeys,
  ] =
    useState<string[]>([]);

  const [
    draggingReportKey,
    setDraggingReportKey,
  ] =
    useState<string | null>(
      null
    );

  const touchMoveTargetRef =
    useRef<string | null>(
      null
    );

  const lastRestoreKeyRef =
    useRef<string | null>(
      null
    );

  useEffect(() => {
    if (
      !restoreReportComposition ||
      lastRestoreKeyRef.current ===
        restoreReportComposition.key
    ) {
      return;
    }

    lastRestoreKeyRef.current =
      restoreReportComposition.key;

    setReportItemKeys(
      Array.from(
        new Set(
          restoreReportComposition.libraryKeys
        )
      )
    );
  }, [
    restoreReportComposition,
  ]);

  useEffect(() => {
    onReportCompositionChange?.(
      reportItemKeys,
      snapshot
    );
  }, [
    onReportCompositionChange,
    reportItemKeys,
    snapshot,
  ]);

  const load =
    async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const data =
          await fetchMetricLibrarySnapshot();

        setSnapshot(
          data
        );
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "분석항목 모음을 불러오지 못했습니다."
        );
      }
      finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    let cancelled =
      false;

    void fetchMetricLibrarySnapshot()
      .then(
        (data) => {
          if (
            cancelled
          ) {
            return;
          }

          setSnapshot(
            data
          );

          setLoading(
            false
          );
        }
      )
      .catch(
        (error: unknown) => {
          if (
            cancelled
          ) {
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "분석항목 모음을 불러오지 못했습니다."
          );

          setLoading(
            false
          );
        }
      );

    return () => {
      cancelled =
        true;
    };
  }, []);

  const visibleItems =
    useMemo(() => {
      if (!snapshot) {
        return [];
      }

      const query =
        search
          .trim()
          .toLowerCase();

      return snapshot.items
        .filter(
          (item) =>
            showInactive ||
            item.isActive
        )
        .filter(
          (item) =>
            query === "" ||
            item.name
              .toLowerCase()
              .includes(
                query
              ) ||
            item.groupName
              .toLowerCase()
              .includes(
                query
              ) ||
            item.badgeLabel
              .toLowerCase()
              .includes(
                query
              )
        );
    }, [
      snapshot,
      search,
      showInactive,
    ]);

  const grouped =
    useMemo(() => {
      const map =
        new Map<
          string,
          AnalysisMetricLibraryItem[]
        >();

      for (
        const item of
        visibleItems
      ) {
        const group =
          item.sourceType ===
          "formula"
            ? `수식 빌더 · ${item.groupName}`
            : item.groupName;

        const rows =
          map.get(group) ??
          [];

        rows.push(item);
        map.set(
          group,
          rows
        );
      }

      return Array.from(
        map.entries()
      );
    }, [visibleItems]);

  const rawCount =
    snapshot?.items.filter(
      (item) =>
        item.sourceType ===
          "raw" &&
        item.isActive
    ).length ?? 0;

  const formulaCount =
    snapshot?.items.filter(
      (item) =>
        item.sourceType ===
          "formula" &&
        item.isActive
    ).length ?? 0;

  const reportItems =
    useMemo(() => {
      if (!snapshot) {
        return [];
      }

      return reportItemKeys.flatMap(
        (libraryKey) => {
          const item =
            snapshot.items.find(
              (row) =>
                row.libraryKey ===
                libraryKey &&
                row.isActive
            );

          return item
            ? [item]
            : [];
        }
      );
    }, [
      snapshot,
      reportItemKeys,
    ]);

  const reportKeySet =
    useMemo(
      () =>
        new Set(
          reportItemKeys
        ),
      [reportItemKeys]
    );

  const toggleReportItem =
    (
      libraryKey: string
    ) => {
      setReportItemKeys(
        (current) =>
          current.includes(
            libraryKey
          )
            ? current.filter(
                (key) =>
                  key !==
                  libraryKey
              )
            : [
                ...current,
                libraryKey,
              ]
      );
    };

  const addReportItem =
    (
      libraryKey: string,
      beforeKey?: string | null
    ) => {
      setReportItemKeys(
        (current) => {
          if (
            current.includes(
              libraryKey
            )
          ) {
            return current;
          }

          if (!beforeKey) {
            return [
              ...current,
              libraryKey,
            ];
          }

          const beforeIndex =
            current.indexOf(
              beforeKey
            );

          if (
            beforeIndex < 0
          ) {
            return [
              ...current,
              libraryKey,
            ];
          }

          const next = [
            ...current,
          ];

          next.splice(
            beforeIndex,
            0,
            libraryKey
          );

          return next;
        }
      );
    };

  const moveReportItem =
    (
      sourceKey: string,
      targetKey: string
    ) => {
      if (
        sourceKey ===
        targetKey
      ) {
        return;
      }

      setReportItemKeys(
        (current) => {
          const sourceIndex =
            current.indexOf(
              sourceKey
            );
          const targetIndex =
            current.indexOf(
              targetKey
            );

          if (
            sourceIndex < 0 ||
            targetIndex < 0
          ) {
            return current;
          }

          const next = [
            ...current,
          ];

          next.splice(
            sourceIndex,
            1
          );

          const adjustedIndex =
            sourceIndex <
            targetIndex
              ? targetIndex -
                1
              : targetIndex;

          next.splice(
            adjustedIndex,
            0,
            sourceKey
          );

          return next;
        }
      );
    };

  const moveReportItemByOffset =
    (
      sourceKey: string,
      offset: -1 | 1
    ) => {
      setReportItemKeys(
        (current) => {
          const sourceIndex =
            current.indexOf(
              sourceKey
            );

          if (
            sourceIndex < 0
          ) {
            return current;
          }

          const targetIndex =
            sourceIndex +
            offset;

          if (
            targetIndex < 0 ||
            targetIndex >=
              current.length
          ) {
            return current;
          }

          const next = [
            ...current,
          ];

          [
            next[sourceIndex],
            next[targetIndex],
          ] = [
            next[targetIndex],
            next[sourceIndex],
          ];

          return next;
        }
      );
    };

  const swapReportItems =
    (
      sourceKey: string,
      targetKey: string
    ) => {
      if (
        sourceKey ===
        targetKey
      ) {
        return;
      }

      setReportItemKeys(
        (current) => {
          const sourceIndex =
            current.indexOf(
              sourceKey
            );
          const targetIndex =
            current.indexOf(
              targetKey
            );

          if (
            sourceIndex < 0 ||
            targetIndex < 0
          ) {
            return current;
          }

          const next = [
            ...current,
          ];

          [
            next[sourceIndex],
            next[targetIndex],
          ] = [
            next[targetIndex],
            next[sourceIndex],
          ];

          return next;
        }
      );
    };


  const handleReportDrop =
    (
      event:
        React.DragEvent,
      beforeKey?: string | null
    ) => {
      event.preventDefault();

      const reportKey =
        event.dataTransfer.getData(
          "application/x-analysis-report-key"
        );

      if (reportKey) {
        if (beforeKey) {
          moveReportItem(
            reportKey,
            beforeKey
          );
        }

        setDraggingReportKey(
          null
        );
        return;
      }

      const libraryKey =
        event.dataTransfer.getData(
          "application/x-analysis-library-key"
        );

      if (!libraryKey) {
        return;
      }

      addReportItem(
        libraryKey,
        beforeKey
      );
    };

  const openCreate =
    () => {
      setEditor(
        emptyEditor()
      );
    };

  const openEdit =
    (
      metricId: string
    ) => {
      if (!snapshot) {
        return;
      }

      const definition =
        snapshot.formulaDefinitions.find(
          (item) =>
            item.id ===
            metricId
        );

      if (!definition) {
        return;
      }

      const tokens =
        snapshot.formulaTokens.filter(
          (token) =>
            token.analysisMetricId ===
            metricId
        );

      setDetailMetricId(
        null
      );

      setEditor({
        metricId:
          definition.id,
        name:
          definition.name,
        groupName:
          definition.groupName,
        description:
          definition.description ??
          "",
        metricKind:
          definition.metricKind,
        unit:
          definition.unit,
        defaultAggregationType:
          definition.defaultAggregationType,
        displayOrder:
          definition.displayOrder,
        tokens:
          toBuilderTokens(
            tokens
          ),
      });
    };

  const toggleActive =
    async (
      metricId: string,
      isActive: boolean
    ) => {
      if (!snapshot) {
        return;
      }

      const usageCount =
        snapshot.usages.filter(
          (usage) =>
            usage.referencedSourceType ===
              "formula" &&
            usage.referencedSourceId ===
              metricId &&
            usage.dependentIsActive
        ).length;

      if (
        !isActive &&
        usageCount > 0
      ) {
        const confirmed =
          window.confirm(
            `이 항목은 현재 ${usageCount}개의 활성 계산항목에서 사용 중입니다. 사용중지하면 신규 수식 선택목록에서는 제외되지만 기존 수식 정의는 유지됩니다. 계속하시겠습니까?`
          );

        if (!confirmed) {
          return;
        }
      }

      setBusy(true);
      setErrorMessage("");

      try {
        const response =
          await fetch(
            "/api/analytics/metric-library",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache:
                "no-store",
              body:
                JSON.stringify({
                  action:
                    "set-active",
                  metricId,
                  isActive,
                }),
            }
          );

        const data =
          await response.json() as
            | {
                snapshot:
                  AnalysisMetricLibrarySnapshot;
              }
            | {
                error?: string;
              };

        if (
          !response.ok ||
          !("snapshot" in data)
        ) {
          throw new Error(
            "error" in data &&
            data.error
              ? data.error
              : "사용여부를 변경하지 못했습니다."
          );
        }

        setSnapshot(
          data.snapshot
        );

        if (!isActive) {
          setReportItemKeys(
            (current) =>
              current.filter(
                (key) =>
                  key !==
                  `formula:${metricId}`
              )
          );
        }
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "사용여부를 변경하지 못했습니다."
        );
      }
      finally {
        setBusy(false);
      }
    };

  const deleteMetric =
    async (
      metricId: string
    ) => {
      if (!snapshot) {
        return;
      }

      const definition =
        snapshot.formulaDefinitions.find(
          (item) =>
            item.id ===
            metricId
        );

      if (
        !definition ||
        definition.origin !==
          "user" ||
        definition.isLocked
      ) {
        window.alert(
          "항목 추가로 만든 사용자 정의 계산항목만 삭제할 수 있습니다."
        );
        return;
      }

      const usages =
        snapshot.usages.filter(
          (usage) =>
            usage.referencedSourceType ===
              "formula" &&
            usage.referencedSourceId ===
              metricId
        );

      if (
        usages.length > 0
      ) {
        window.alert(
          `이 항목은 ${usages.length}개의 다른 계산항목에서 사용 중이므로 삭제할 수 없습니다. 먼저 해당 수식에서 이 항목을 제거해주세요.`
        );
        return;
      }

      const confirmed =
        window.confirm(
          `"${definition.name}" 항목을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
        );

      if (!confirmed) {
        return;
      }

      setBusy(true);
      setErrorMessage("");

      try {
        const response =
          await fetch(
            "/api/analytics/metric-library",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache:
                "no-store",
              body:
                JSON.stringify({
                  action:
                    "delete",
                  metricId,
                }),
            }
          );

        const data =
          await response.json() as
            | {
                snapshot:
                  AnalysisMetricLibrarySnapshot;
              }
            | {
                error?: string;
              };

        if (
          !response.ok ||
          !("snapshot" in data)
        ) {
          throw new Error(
            "error" in data &&
            data.error
              ? data.error
              : "분석항목을 삭제하지 못했습니다."
          );
        }

        setSnapshot(
          data.snapshot
        );

        setReportItemKeys(
          (current) =>
            current.filter(
              (key) =>
                key !==
                `formula:${metricId}`
            )
        );

        setDetailMetricId(
          null
        );
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "분석항목을 삭제하지 못했습니다."
        );
      }
      finally {
        setBusy(false);
      }
    };

  return (
    <div className="space-y-4">
      <section className="space-y-4">
        <div className="rounded-[18px] border border-[#E2E4E7] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-black text-[#30343A]">
                  분석항목 모음
                </h3>
                <span className="rounded-full bg-[#F5F6F7] px-2 py-1 text-[8px] font-black text-[#70757C]">
                  RAW {rawCount}
                </span>
                <span className="rounded-full bg-[#FFF0F4] px-2 py-1 text-[8px] font-black text-[#A50034]">
                  계산 {formulaCount}
                </span>
              </div>

              <p className="mt-1.5 text-[9px] font-medium leading-4 text-[#92969D]">
                설정의 RAW 항목과 수식 빌더에서 만든 계산항목을 함께 관리합니다.
              </p>
            </div>

            {snapshot?.canManage && (
              <button
                type="button"
                onClick={
                  openCreate
                }
                className="inline-flex h-11 w-full touch-manipulation items-center justify-center gap-1.5 rounded-[10px] bg-[#A50034] px-3.5 text-[9px] font-black text-white hover:bg-[#8F002D] sm:h-9 sm:w-auto"
              >
                <Plus
                  size={13}
                />
                항목 추가
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="relative col-span-2 min-w-0 flex-1 sm:min-w-[220px]">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A4AA]"
              />
              <input
                value={
                  search
                }
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-[10px] border border-[#DDE0E4] bg-[#FAFAFB] pl-9 pr-3 text-[10px] font-bold outline-none focus:border-[#A50034] sm:h-9 sm:text-[9px]"
                placeholder="항목명·분류·유형 검색"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setShowInactive(
                  (value) =>
                    !value
                )
              }
              className={[
                "h-11 touch-manipulation rounded-[10px] border px-3 text-[8px] font-black sm:h-9",
                showInactive
                  ? "border-[#CFC5C8] bg-[#FFF7F9] text-[#A50034]"
                  : "border-[#DDE0E4] bg-white text-[#777C84]",
              ].join(" ")}
            >
              {showInactive
                ? "사용중지만 숨기기"
                : "사용중지 포함"}
            </button>

            <button
              type="button"
              onClick={() =>
                void load()
              }
              disabled={
                loading
              }
              className="flex h-11 w-full touch-manipulation items-center justify-center rounded-[10px] border border-[#DDE0E4] bg-white text-[#777C84] disabled:opacity-40 sm:h-9 sm:w-9"
              title="새로고침"
            >
              <RotateCcw
                size={13}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
            </button>
          </div>

          {errorMessage && (
            <div className="mt-3 flex items-start gap-2 rounded-[11px] border border-[#F0CDD3] bg-[#FFF5F7] px-3 py-2.5 text-[9px] font-bold text-[#A50034]">
              <AlertCircle
                size={13}
                className="mt-0.5 shrink-0"
              />
              {errorMessage}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <LoaderCircle
                  size={22}
                  className="mx-auto animate-spin text-[#A50034]"
                />
                <p className="mt-2 text-[9px] font-bold text-[#8A8F97]">
                  분석항목 모음을 불러오는 중입니다.
                </p>
              </div>
            </div>
          ) : grouped.length ===
            0 ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-[13px] border border-dashed border-[#D9DCE1] bg-[#FAFAFB] px-5 text-center text-[10px] font-bold text-[#999DA4]">
              조건에 해당하는 분석항목이 없습니다.
            </div>
          ) : (
            <div className="mt-4 space-y-4 pr-0 sm:max-h-[720px] sm:overflow-y-auto sm:pr-1">
              {grouped.map(
                ([group, items]) => (
                  <div
                    key={group}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-[9px] font-black tracking-[0.05em] text-[#555A62]">
                        {group}
                      </p>
                      <span className="text-[8px] font-bold text-[#B0B3B8]">
                        {items.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                      {items.map(
                        (item) => (
                          <div
                            key={
                              item.libraryKey
                            }
                            role="button"
                            tabIndex={
                              item.isActive
                                ? 0
                                : -1
                            }
                            draggable={
                              item.isActive
                            }
                            onDragStart={(event) => {
                              if (
                                !item.isActive
                              ) {
                                event.preventDefault();
                                return;
                              }

                              event.dataTransfer.effectAllowed =
                                "copy";

                              event.dataTransfer.setData(
                                "application/x-analysis-library-key",
                                item.libraryKey
                              );
                            }}
                            onClick={() => {
                              if (
                                item.isActive
                              ) {
                                toggleReportItem(
                                  item.libraryKey
                                );
                              }
                            }}
                            onKeyDown={(event) => {
                              if (
                                event.target !==
                                event.currentTarget ||
                                !item.isActive
                              ) {
                                return;
                              }

                              if (
                                event.key ===
                                  "Enter" ||
                                event.key ===
                                  " "
                              ) {
                                event.preventDefault();
                                toggleReportItem(
                                  item.libraryKey
                                );
                              }
                            }}
                            className={[
                              "relative min-h-[76px] min-w-0 touch-manipulation select-none rounded-[11px] border px-3 py-3 text-left transition sm:min-h-[70px] sm:px-2.5 sm:py-2.5",
                              !item.isActive
                                ? "cursor-default border-[#E5E7EA] bg-[#F2F3F4] opacity-60"
                                : reportKeySet.has(
                                      item.libraryKey
                                    )
                                  ? "cursor-grab border-[#A50034] bg-[#FFF5F7] shadow-sm active:cursor-grabbing"
                                  : "cursor-grab border-[#E2E4E7] bg-[#FAFAFB] hover:border-[#C8CCD2] hover:bg-white hover:shadow-sm active:cursor-grabbing",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={[
                                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[7px] font-black",
                                  badgeClass(
                                    item
                                  ),
                                ].join(" ")}
                              >
                                {badgeIcon(
                                  item
                                )}
                                {item.badgeLabel}
                              </span>

                              <div className="flex items-center gap-1">
                                {reportKeySet.has(
                                  item.libraryKey
                                ) && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[#A50034] px-1.5 py-0.5 text-[7px] font-black text-white">
                                    <CheckCircle2
                                      size={8}
                                    />
                                    선택
                                  </span>
                                )}

                                {!item.isActive && (
                                  <span className="text-[7px] font-black text-[#8F949B]">
                                    사용중지
                                  </span>
                                )}
                              </div>
                            </div>

                            <p className="mt-2 truncate text-[10px] font-black text-[#454A51]">
                              {item.name}
                            </p>

                            <div className="mt-1 flex items-center justify-between gap-2 text-[7px] font-bold text-[#999DA4]">
                              <span>
                                {unitLabel(
                                  item.unit
                                )}
                                {" · "}
                                {aggregationLabel(
                                  item.defaultAggregationType
                                )}
                              </span>

                              {item.canOpenFormula && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setDetailMetricId(
                                      item.sourceId
                                    );
                                  }}
                                  className="inline-flex min-h-9 touch-manipulation items-center gap-1 rounded-[7px] px-2 text-[#A50034] hover:bg-[#FFF0F4] sm:min-h-0 sm:px-1.5 sm:py-1"
                                  title="수식 상세보기"
                                >
                                  <Eye
                                    size={9}
                                  />
                                  수식
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <aside
          className="rounded-[18px] border border-[#E2E4E7] bg-[#FAFAFB] p-4 sm:p-5"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect =
              draggingReportKey
                ? "move"
                : "copy";
          }}
          onDrop={(event) =>
            handleReportDrop(
              event
            )
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-white text-[#A50034] shadow-sm">
                <Calculator
                  size={15}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-black text-[#3F444B]">
                    보고서 구성
                  </h3>
                  <span className="rounded-full bg-white px-2 py-1 text-[8px] font-black text-[#A50034]">
                    {reportItems.length}개 선택
                  </span>
                </div>
                <p className="mt-0.5 text-[8px] font-bold text-[#999DA4]">
                  선택 순서가 결과표와 Excel 열 순서가 됩니다. 모바일에서는 이동 핸들을 끌거나 좌우 버튼으로 순서를 바꿀 수 있습니다.
                </p>
              </div>
            </div>

            {reportItems.length >
              0 && (
              <button
                type="button"
                onClick={() =>
                  setReportItemKeys(
                    []
                  )
                }
                className="h-10 touch-manipulation rounded-[9px] border border-[#E1E3E6] bg-white px-3 text-[8px] font-black text-[#777C84] hover:border-[#D2BFC5] hover:text-[#A50034] sm:h-8"
              >
                전체 해제
              </button>
            )}
          </div>

          <div
            className={[
              "mt-4 min-h-[150px] rounded-[14px] border border-dashed p-3 sm:p-4",
              draggingReportKey
                ? "border-[#C58A9C] bg-[#FFF8FA]"
                : "border-[#D4D7DB] bg-white",
            ].join(" ")}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) =>
              handleReportDrop(
                event
              )
            }
          >
            {reportItems.length ===
            0 ? (
              <div className="flex min-h-[120px] items-center justify-center px-5 text-center">
                <div>
                  <p className="text-[10px] font-black text-[#666B72]">
                    보고 싶은 분석항목을 여기에 배치하세요.
                  </p>
                  <p className="mt-1.5 text-[9px] font-medium leading-5 text-[#999DA4]">
                    분석항목 카드를 클릭하거나 Drag & Drop하면 선택됩니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {reportItems.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={
                        item.libraryKey
                      }
                      data-report-key={
                        item.libraryKey
                      }
                      draggable
                      onDragStart={(event) => {
                        setDraggingReportKey(
                          item.libraryKey
                        );

                        event.dataTransfer.effectAllowed =
                          "move";

                        event.dataTransfer.setData(
                          "application/x-analysis-report-key",
                          item.libraryKey
                        );
                      }}
                      onDragEnd={() =>
                        setDraggingReportKey(
                          null
                        )
                      }
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onDrop={(event) => {
                        event.stopPropagation();
                        handleReportDrop(
                          event,
                          item.libraryKey
                        );
                      }}
                      className={[
                        "flex min-h-[84px] cursor-grab items-start gap-2 rounded-[11px] border bg-white p-2.5 transition active:cursor-grabbing sm:min-h-[72px]",
                        draggingReportKey ===
                        item.libraryKey
                          ? "border-[#C58A9C] opacity-50"
                          : "border-[#E0E3E6] hover:border-[#C8CCD2] hover:shadow-sm",
                      ].join(" ")}
                    >
                      <div className="mt-0.5 flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className="flex h-10 w-8 touch-none select-none items-center justify-center rounded-[8px] text-[#A7ABB1] hover:bg-[#F5F6F7] sm:h-7 sm:w-6"
                          title="모바일에서는 이 핸들을 끌어 순서를 변경할 수 있습니다."
                          aria-label={`${item.name} 순서 이동`}
                          onPointerDown={(event) => {
                            if (
                              event.pointerType ===
                              "mouse"
                            ) {
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();

                            touchMoveTargetRef.current =
                              null;

                            setDraggingReportKey(
                              item.libraryKey
                            );

                            event.currentTarget.setPointerCapture(
                              event.pointerId
                            );
                          }}
                          onPointerMove={(event) => {
                            if (
                              event.pointerType ===
                                "mouse" ||
                              !event.currentTarget.hasPointerCapture(
                                event.pointerId
                              )
                            ) {
                              return;
                            }

                            event.preventDefault();

                            const target =
                              document
                                .elementFromPoint(
                                  event.clientX,
                                  event.clientY
                                )
                                ?.closest<HTMLElement>(
                                  "[data-report-key]"
                                );

                            const targetKey =
                              target?.dataset
                                .reportKey ??
                              null;

                            if (
                              !targetKey ||
                              targetKey ===
                                item.libraryKey ||
                              touchMoveTargetRef.current ===
                                targetKey
                            ) {
                              return;
                            }

                            touchMoveTargetRef.current =
                              targetKey;

                            swapReportItems(
                              item.libraryKey,
                              targetKey
                            );
                          }}
                          onPointerUp={(event) => {
                            if (
                              event.pointerType ===
                              "mouse"
                            ) {
                              return;
                            }

                            if (
                              event.currentTarget.hasPointerCapture(
                                event.pointerId
                              )
                            ) {
                              event.currentTarget.releasePointerCapture(
                                event.pointerId
                              );
                            }

                            touchMoveTargetRef.current =
                              null;

                            setDraggingReportKey(
                              null
                            );
                          }}
                          onPointerCancel={(event) => {
                            if (
                              event.currentTarget.hasPointerCapture(
                                event.pointerId
                              )
                            ) {
                              event.currentTarget.releasePointerCapture(
                                event.pointerId
                              );
                            }

                            touchMoveTargetRef.current =
                              null;

                            setDraggingReportKey(
                              null
                            );
                          }}
                        >
                          <GripVertical
                            size={16}
                          />
                        </button>

                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#A50034] px-1 text-[8px] font-black text-white sm:h-5 sm:min-w-5 sm:text-[7px]">
                          {index +
                            1}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[7px] font-black",
                              badgeClass(
                                item
                              ),
                            ].join(" ")}
                          >
                            {item.badgeLabel}
                          </span>
                        </div>

                        <p
                          className="mt-1.5 line-clamp-2 min-h-[26px] text-[9px] font-black leading-[13px] text-[#484D54]"
                          title={
                            item.name
                          }
                        >
                          {item.name}
                        </p>

                        <p className="mt-0.5 text-[7px] font-bold text-[#9A9EA5]">
                          {unitLabel(
                            item.unit
                          )}
                          {" · "}
                          {aggregationLabel(
                            item.defaultAggregationType
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            moveReportItemByOffset(
                              item.libraryKey,
                              -1
                            )
                          }
                          disabled={
                            index === 0
                          }
                          className="flex h-10 w-9 touch-manipulation items-center justify-center rounded-[8px] border border-[#E5E7EA] bg-white text-[#777C84] disabled:opacity-25 sm:hidden"
                          title="앞으로 이동"
                          aria-label={`${item.name} 앞으로 이동`}
                        >
                          <ChevronLeft
                            size={16}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            moveReportItemByOffset(
                              item.libraryKey,
                              1
                            )
                          }
                          disabled={
                            index ===
                            reportItems.length -
                              1
                          }
                          className="flex h-10 w-9 touch-manipulation items-center justify-center rounded-[8px] border border-[#E5E7EA] bg-white text-[#777C84] disabled:opacity-25 sm:hidden"
                          title="뒤로 이동"
                          aria-label={`${item.name} 뒤로 이동`}
                        >
                          <ChevronRight
                            size={16}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setReportItemKeys(
                              (current) =>
                                current.filter(
                                  (key) =>
                                    key !==
                                    item.libraryKey
                                )
                            )
                          }
                          className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-[8px] text-[#A0A4AA] hover:bg-[#FFF0F4] hover:text-[#A50034] sm:h-7 sm:w-7"
                          title="보고서 구성에서 제거"
                          aria-label={`${item.name} 보고서 구성에서 제거`}
                        >
                          <X
                            size={14}
                          />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </aside>
      </section>

      {snapshot &&
        editor && (
        <FormulaEditorModal
          snapshot={
            snapshot
          }
          initial={
            editor
          }
          onClose={() =>
            setEditor(
              null
            )
          }
          onSaved={(
            nextSnapshot,
            metricId
          ) => {
            setSnapshot(
              nextSnapshot
            );
            setEditor(
              null
            );
            setDetailMetricId(
              metricId
            );
          }}
        />
      )}

      {snapshot &&
        detailMetricId && (
        <FormulaDetailModal
          snapshot={
            snapshot
          }
          metricId={
            detailMetricId
          }
          onClose={() =>
            setDetailMetricId(
              null
            )
          }
          onNavigate={
            setDetailMetricId
          }
          onEdit={
            openEdit
          }
          onDelete={(metricId) =>
            void deleteMetric(
              metricId
            )
          }
          onToggleActive={(
            metricId,
            isActive
          ) =>
            void toggleActive(
              metricId,
              isActive
            )
          }
          busy={
            busy
          }
        />
      )}
    </div>
  );
}
