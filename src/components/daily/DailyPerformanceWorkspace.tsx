"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Check,
  LoaderCircle,
  RotateCcw,
  Save,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/client";

import DailyManagerClosingStatusPanel from "@/components/daily-performance/DailyManagerClosingStatusPanel";
import OffdayAttributionGuard from "@/components/daily-performance/OffdayAttributionGuard";
import DailyAttendanceSelector from "@/components/daily-performance/DailyAttendanceSelector";

import type {
  DailyManager,
  DailyMetric,
  DailyMetricCategory,
} from "@/lib/daily-performance";


type Props = {
  managers: DailyManager[];
  categories: DailyMetricCategory[];
  metrics: DailyMetric[];
  currentManagerId: string;
  currentUserId: string;
  today: string;
};


type SaveState =
  | "idle"
  | "saving"
  | "saved"
  | "error";


function createEmptyValues(
  metrics: DailyMetric[]
) {
  const result: Record<string, string> = {};

  for (const metric of metrics) {
    result[metric.id] = "";
  }

  return result;
}


function normalizeInputValue(
  value: string
) {
  return value
    .replace(/[^\d]/g, "")
    .replace(/^0+(?=\d)/, "");
}


function formatInputValue(
  value: string
) {
  if (value === "") {
    return "";
  }

  const normalized =
    value.replace(
      /^0+(?=\d)/,
      ""
    );

  return normalized.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );
}


function statusLabel(
  status: string | null
) {
  switch (status) {
    case "submitted":
      return "저장완료";

    case "closed":
      return "저장완료";

    case "draft":
      return "작성중";

    default:
      return "불러오는 중";
  }
}


export default function DailyPerformanceWorkspace({
  managers,
  categories,
  metrics,
  currentManagerId,
  currentUserId,
  today,
}: Props) {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(today);

  const [
    selectedManagerId,
    setSelectedManagerId,
  ] = useState(
    currentManagerId
  );

  const [
    isAttributionInputAllowed,
    setIsAttributionInputAllowed,
  ] = useState(false);

  const [
    isClosingEditable,
    setIsClosingEditable,
  ] = useState(false);

  const [
    closingEditableLoaded,
    setClosingEditableLoaded,
  ] = useState(false);

  const [
    reportId,
    setReportId,
  ] = useState<string | null>(
    null
  );

  const [
    reportStatus,
    setReportStatus,
  ] = useState<string | null>(
    null
  );

  const [
    selectedNoPerformanceConfirmed,
    setSelectedNoPerformanceConfirmed,
  ] = useState(false);

  const [
    selectedNoPerformanceStatusLoaded,
    setSelectedNoPerformanceStatusLoaded,
  ] = useState(false);

  const [
    closingStatusRefreshKey,
    setClosingStatusRefreshKey,
  ] = useState(0);

  const [
    values,
    setValues,
  ] = useState<
    Record<string, string>
  >(
    () =>
      createEmptyValues(
        metrics
      )
  );

  const [
    reportMetricIds,
    setReportMetricIds,
  ] = useState<string[]>(
    []
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSwitching,
    setIsSwitching,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    saveState,
    setSaveState,
  ] = useState<SaveState>(
    "idle"
  );


  const reportIdRef =
    useRef<string | null>(
      null
    );

  const valuesRef =
    useRef<
      Record<string, string>
    >(
      createEmptyValues(
        metrics
      )
    );

  const reportMetricIdsRef =
    useRef<string[]>([]);

  const dirtyRef =
    useRef(false);

  const editVersionRef =
    useRef(0);

  const loadSequenceRef =
    useRef(0);

  const inputRefs =
    useRef<
      Record<
        string,
        HTMLInputElement | null
      >
    >({});


  const selectedManager =
    managers.find(
      (manager) =>
        manager.id ===
        selectedManagerId
    );


  const availableMetricSet =
    useMemo(
      () =>
        new Set(
          reportMetricIds
        ),
      [reportMetricIds]
    );


  const visibleMetrics =
    useMemo(
      () =>
        metrics.filter(
          (metric) =>
            availableMetricSet.has(
              metric.id
            )
        ),
      [
        metrics,
        availableMetricSet,
      ]
    );


  const visibleCategoryIds =
    useMemo(
      () =>
        new Set(
          visibleMetrics.map(
            (metric) =>
              metric.categoryId
          )
        ),
      [visibleMetrics]
    );


  const visibleCategories =
    useMemo(
      () =>
        categories.filter(
          (category) =>
            visibleCategoryIds.has(
              category.id
            )
        ),
      [
        categories,
        visibleCategoryIds,
      ]
    );


  /*
   * 화면에 실제 렌더링되는 순서와
   * 키보드 이동 순서를 동일하게 맞춥니다.
   *
   * 카테고리 배치 순서 → 카테고리 안의 지표 순서대로
   * Enter/Shift+Enter 이동이 이루어집니다.
   */
  const renderedMetrics =
    useMemo(
      () =>
        visibleCategories.flatMap(
          (category) =>
            visibleMetrics.filter(
              (metric) =>
                metric.categoryId ===
                category.id
            )
        ),
      [
        visibleCategories,
        visibleMetrics,
      ]
    );


  const metricIndexMap =
    useMemo(() => {
      const result =
        new Map<string, number>();

      renderedMetrics.forEach(
        (metric, index) => {
          result.set(
            metric.id,
            index
          );
        }
      );

      return result;
    }, [renderedMetrics]);


  /*
   * DB에는 숫자만 저장합니다.
   *
   * Draft 자동저장 시 화면의 빈칸은
   * 그대로 빈칸으로 유지하지만,
   * DB 저장용 Snapshot에서는 0으로 처리합니다.
   *
   * 실제 화면에 0을 표시하는 것은
   * 최종 [저장] 버튼을 눌렀을 때만 수행합니다.
   */
  const createSaveSnapshot =
    useCallback(
      (
        source:
          Record<string, string>
      ) => {
        const snapshot = {
          ...source,
        };

        for (
          const metricId of
          reportMetricIdsRef.current
        ) {
          if (
            snapshot[metricId] ===
              undefined ||
            snapshot[metricId] ===
              ""
          ) {
            snapshot[metricId] =
              "0";
          }
        }

        return snapshot;
      },
      []
    );


  /*
   * 최종 [저장] 시에만
   * 화면의 모든 빈칸을 0으로 채웁니다.
   */
  const fillAllEmptyValuesWithZero =
    useCallback(
      () => {
        const nextValues = {
          ...valuesRef.current,
        };

        let changed = false;

        for (
          const metricId of
          reportMetricIdsRef.current
        ) {
          if (
            nextValues[metricId] ===
              undefined ||
            nextValues[metricId] ===
              ""
          ) {
            nextValues[metricId] =
              "0";

            changed = true;
          }
        }

        if (changed) {
          valuesRef.current =
            nextValues;

          dirtyRef.current =
            true;

          editVersionRef.current +=
            1;

          setValues(
            nextValues
          );

          setReportStatus(
            "draft"
          );

          setSaveState(
            "idle"
          );
        }

        return nextValues;
      },
      []
    );


  /*
   * Draft 저장
   */
  const persistDraft =
    useCallback(
      async (
        targetReportId: string,
        sourceSnapshot:
          Record<string, string>
      ) => {
        const {
          data: editableData,
          error: editableError,
        } = await supabase.rpc(
          "is_closing_date_editable",
          {
            p_report_date:
              selectedDate,
          }
        );

        if (editableError) {
          throw editableError;
        }

        const editable =
          editableData === true;

        setIsClosingEditable(
          editable
        );
        setClosingEditableLoaded(
          true
        );

        if (!editable) {
          throw new Error(
            "마감이 확정된 날짜입니다. 마감보고에서 [수정]을 누른 뒤 일실적을 변경해주세요."
          );
        }

        const metricIds =
          reportMetricIdsRef.current;

        if (
          metricIds.length === 0
        ) {
          return;
        }

        const snapshot =
          createSaveSnapshot(
            sourceSnapshot
          );

        const valueRows =
          metricIds.map(
            (metricId) => ({
              report_id:
                targetReportId,

              metric_id:
                metricId,

              value:
                Number(
                  snapshot[
                    metricId
                  ] || "0"
                ),
            })
          );

        const {
          error: valueError,
        } =
          await supabase
            .from(
              "daily_metric_values"
            )
            .upsert(
              valueRows,
              {
                onConflict:
                  "report_id,metric_id",
              }
            );

        if (valueError) {
          throw valueError;
        }


        const {
          error: reportError,
        } =
          await supabase
            .from(
              "daily_reports"
            )
            .update({
              status: "draft",
              updated_by:
                currentUserId,
            })
            .eq(
              "id",
              targetReportId
            );

        if (reportError) {
          throw reportError;
        }
      },
      [
        createSaveSnapshot,
        currentUserId,
        selectedDate,
        supabase,
      ]
    );


  /*
   * 아직 자동저장되지 않은 값이 있다면
   * 즉시 Draft 저장합니다.
   *
   * 날짜 / 매니저 변경 시 사용합니다.
   */
  const flushPendingDraft =
    useCallback(
      async () => {
        const targetReportId =
          reportIdRef.current;

        if (
          !dirtyRef.current ||
          !targetReportId
        ) {
          return;
        }

        const version =
          editVersionRef.current;

        const snapshot = {
          ...valuesRef.current,
        };

        setSaveState(
          "saving"
        );

        await persistDraft(
          targetReportId,
          snapshot
        );

        if (
          reportIdRef.current ===
            targetReportId &&
          editVersionRef.current ===
            version
        ) {
          dirtyRef.current =
            false;

          setSaveState(
            "saved"
          );

          setReportStatus(
            "draft"
          );
        }
      },
      [persistDraft]
    );


  /*
   * 날짜 / 매니저 변경 시
   * 해당 Report를 불러옵니다.
   */
  useEffect(() => {
    let cancelled = false;

    const sequence =
      ++loadSequenceRef.current;


    async function loadReport() {
      const {
        data: editableData,
        error: editableError,
      } =
        await supabase.rpc(
          "is_closing_date_editable",
          {
            p_report_date:
              selectedDate,
          }
        );

      if (editableError) {
        throw editableError;
      }

      const editable =
        editableData === true;

      let {
        data: report,
        error: reportError,
      } =
        await supabase
          .from(
            "daily_reports"
          )
          .select(
            "id,status"
          )
          .eq(
            "report_date",
            selectedDate
          )
          .eq(
            "manager_id",
            selectedManagerId
          )
          .maybeSingle();

      if (reportError) {
        throw reportError;
      }

      if (
        !report &&
        editable
      ) {
        const {
          error: createError,
        } =
          await supabase.rpc(
            "get_or_create_daily_report",
            {
              p_report_date:
                selectedDate,

              p_manager_id:
                selectedManagerId,
            }
          );

        if (createError) {
          throw createError;
        }

        const result =
          await supabase
            .from(
              "daily_reports"
            )
            .select(
              "id,status"
            )
            .eq(
              "report_date",
              selectedDate
            )
            .eq(
              "manager_id",
              selectedManagerId
            )
            .maybeSingle();

        report =
          result.data;
        reportError =
          result.error;

        if (reportError) {
          throw reportError;
        }
      }

      if (
        cancelled ||
        sequence !==
          loadSequenceRef.current
      ) {
        return;
      }

      setIsClosingEditable(
        editable
      );
      setClosingEditableLoaded(
        true
      );

      if (!report) {
        const emptyValues =
          createEmptyValues(
            metrics
          );

        valuesRef.current =
          emptyValues;
        reportMetricIdsRef.current =
          [];
        reportIdRef.current =
          null;
        dirtyRef.current =
          false;

        setValues(
          emptyValues
        );
        setReportMetricIds(
          []
        );
        setReportId(
          null
        );
        setReportStatus(
          null
        );
        setSaveState(
          "saved"
        );
        setLoadError(
          ""
        );
        setIsLoading(
          false
        );
        return;
      }

      const {
        data: metricValues,
        error: valueError,
      } =
        await supabase
          .from(
            "daily_metric_values"
          )
          .select(
            "metric_id,value"
          )
          .eq(
            "report_id",
            report.id
          );


      if (valueError) {
        throw valueError;
      }


      if (
        cancelled ||
        sequence !==
          loadSequenceRef.current
      ) {
        return;
      }


      /*
       * draft 상태의 0값은
       * 화면에서는 빈칸으로 보여줍니다.
       *
       * submitted / closed 상태는
       * 이미 최종 저장된 데이터이므로
       * 실제 0값을 표시합니다.
       */
      const isCompleted =
        report.status ===
          "submitted" ||
        report.status ===
          "closed";


      const nextValues =
        createEmptyValues(
          metrics
        );

      const nextMetricIds:
        string[] = [];


      for (
        const row of
        metricValues ?? []
      ) {
        const metricId =
          String(
            row.metric_id
          );

        nextMetricIds.push(
          metricId
        );


        const numericValue =
          Number(
            row.value ?? 0
          );


        if (
          !isCompleted &&
          numericValue === 0
        ) {
          nextValues[
            metricId
          ] = "";
        }
        else {
          nextValues[
            metricId
          ] =
            String(
              numericValue
            );
        }
      }


      valuesRef.current =
        nextValues;

      reportMetricIdsRef.current =
        nextMetricIds;

      reportIdRef.current =
        report.id;

      dirtyRef.current =
        false;


      setValues(
        nextValues
      );

      setReportMetricIds(
        nextMetricIds
      );

      setReportId(
        report.id
      );

      setReportStatus(
        report.status
      );

      setSaveState(
        "saved"
      );

      setLoadError("");

      setIsLoading(
        false
      );
    }


    void loadReport().catch(
      (error: unknown) => {
        if (cancelled) {
          return;
        }

        console.error(
          error
        );

        setLoadError(
          "일실적 데이터를 불러오지 못했습니다."
        );

        setIsClosingEditable(
          false
        );
        setClosingEditableLoaded(
          true
        );

        setIsLoading(
          false
        );

        setSaveState(
          "error"
        );
      }
    );


    return () => {
      cancelled = true;
    };
  }, [
    metrics,
    selectedDate,
    selectedManagerId,
    supabase,
  ]);


  /*
   * 선택 매니저의 무실적 확정 상태를 별도로 동기화합니다.
   *
   * 무실적 확정은 실제 실적값과 분리된 상태이므로
   * 일실적 Report의 draft/submitted 상태만으로는 판단하지 않습니다.
   */
  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(
      () => {
        if (cancelled) {
          return;
        }

        setSelectedNoPerformanceStatusLoaded(
          false
        );

        void (async () => {
          const result =
            await supabase.rpc(
              "get_daily_manager_attendance_status",
              {
                p_report_date:
                  selectedDate,
              }
            );

          if (cancelled) {
            return;
          }

          if (result.error) {
            console.error(
              "무실적 확정 상태 조회 오류:",
              result.error
            );

            setSelectedNoPerformanceConfirmed(
              false
            );
            setSelectedNoPerformanceStatusLoaded(
              false
            );
            return;
          }

          const selectedStatus =
            (result.data ?? []).find(
              (row: {
                manager_id?: string;
              }) =>
                row.manager_id ===
                selectedManagerId
            ) as
              | {
                  status_code?: string;
                  no_performance_confirmed?: boolean;
                }
              | undefined;

          setSelectedNoPerformanceConfirmed(
            selectedStatus
              ?.no_performance_confirmed ===
              true ||
              selectedStatus
                ?.status_code ===
                "no_performance"
          );

          setSelectedNoPerformanceStatusLoaded(
            true
          );
        })();
      },
      0
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    closingStatusRefreshKey,
    selectedDate,
    selectedManagerId,
    supabase,
  ]);


  /*
   * 값을 입력한 후 약 700ms 동안
   * 추가 입력이 없으면 Draft 자동저장합니다.
   *
   * 화면의 빈칸은 그대로 유지됩니다.
   */
  useEffect(() => {
    if (
      !dirtyRef.current ||
      !reportId ||
      selectedNoPerformanceConfirmed
    ) {
      return;
    }

    const targetReportId =
      reportId;

    const version =
      editVersionRef.current;

    const snapshot = {
      ...values,
    };

    const timer =
      window.setTimeout(
        async () => {
          if (
            !dirtyRef.current
          ) {
            return;
          }

          setSaveState(
            "saving"
          );

          try {
            await persistDraft(
              targetReportId,
              snapshot
            );

            if (
              reportIdRef.current ===
                targetReportId &&
              editVersionRef.current ===
                version
            ) {
              dirtyRef.current =
                false;

              setSaveState(
                "saved"
              );

              setReportStatus(
                "draft"
              );
            }
          } catch (
            error
          ) {
            console.error(
              error
            );

            setSaveState(
              "error"
            );
          }
        },
        700
      );


    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    persistDraft,
    reportId,
    selectedNoPerformanceConfirmed,
    values,
  ]);


  /*
   * 입력값 변경
   */
  const updateValue =
    (
      metricId: string,
      inputValue: string
    ) => {
      if (
        !closingEditableLoaded ||
        !isClosingEditable ||
        !isAttributionInputAllowed ||
        selectedNoPerformanceConfirmed
      ) {
        return;
      }

      const normalized =
        normalizeInputValue(
          inputValue
        );

      const nextValues = {
        ...valuesRef.current,
        [metricId]:
          normalized,
      };

      valuesRef.current =
        nextValues;

      dirtyRef.current =
        true;

      editVersionRef.current +=
        1;

      setValues(
        nextValues
      );

      setReportStatus(
        "draft"
      );

      setSaveState(
        "idle"
      );
    };


  /*
   * Enter 키 = Tab 키와 동일한 입력칸 이동
   *
   * Enter       → 다음 입력칸
   * Shift+Enter → 이전 입력칸
   *
   * 실제 화면 렌더링 순서를 기준으로 이동하므로
   * 카테고리 배치가 달라도 중간에 건너뛰지 않습니다.
   */
  const handleInputEnter =
    (
      metricIndex: number,
      moveBackward: boolean
    ) => {
      const nextIndex =
        moveBackward
          ? metricIndex - 1
          : metricIndex + 1;

      const nextMetric =
        renderedMetrics[
          nextIndex
        ];

      if (!nextMetric) {
        void flushPendingDraft();

        return;
      }

      inputRefs.current[
        nextMetric.id
      ]?.focus();
    };


  /*
   * 현재 입력값 전체 초기화
   *
   * 날짜 / 매니저 선택과 Report 자체는 유지하고
   * 현재 Report의 입력값만 빈칸으로 되돌립니다.
   *
   * 기존 자동저장 규칙을 그대로 사용하므로
   * 초기화된 값은 Draft로 안전하게 반영됩니다.
   */
  const handleResetValues =
    useCallback(
      () => {
        if (
          isLoading ||
          isSwitching ||
          isSubmitting ||
          !reportIdRef.current ||
          !closingEditableLoaded ||
          !isClosingEditable ||
          !isAttributionInputAllowed
        ) {
          return;
        }

        const metricIds =
          reportMetricIdsRef.current;

        const hasInputValue =
          metricIds.some(
            (metricId) =>
              (
                valuesRef.current[
                  metricId
                ] ?? ""
              ) !== ""
          );

        if (!hasInputValue) {
          return;
        }

        const confirmed =
          window.confirm(
            "현재 입력된 실적값을 모두 초기화할까요?\n\n실적일자와 매니저 선택은 유지되며, 입력값만 빈칸으로 변경됩니다."
          );

        if (!confirmed) {
          return;
        }

        const nextValues = {
          ...valuesRef.current,
        };

        for (
          const metricId of
          metricIds
        ) {
          nextValues[
            metricId
          ] = "";
        }

        valuesRef.current =
          nextValues;

        dirtyRef.current =
          true;

        editVersionRef.current +=
          1;

        setValues(
          nextValues
        );

        setReportStatus(
          "draft"
        );

        setSaveState(
          "idle"
        );

        /*
         * 초기화는 단순 화면 비우기로 끝내지 않고
         * 즉시 Draft로 저장합니다.
         *
         * 그래야 submitted 상태가 바로 draft로 변경되고
         * 하단 매니저별 일실적 상태도 같은 화면에서
         * 즉시 미완료로 다시 계산할 수 있습니다.
         */
        const targetReportId =
          reportIdRef.current;

        const resetVersion =
          editVersionRef.current;

        if (targetReportId) {
          setSaveState(
            "saving"
          );

          void persistDraft(
            targetReportId,
            nextValues
          )
            .then(() => {
              if (
                reportIdRef.current ===
                  targetReportId &&
                editVersionRef.current ===
                  resetVersion
              ) {
                dirtyRef.current =
                  false;

                setSaveState(
                  "saved"
                );

                setReportStatus(
                  "draft"
                );

                setClosingStatusRefreshKey(
                  (value) =>
                    value + 1
                );
              }
            })
            .catch((error) => {
              console.error(
                "일실적 초기화 저장 오류:",
                error
              );

              setSaveState(
                "error"
              );

              setLoadError(
                "초기화한 일실적을 저장하지 못했습니다."
              );
            });
        }

        const firstMetric =
          renderedMetrics[0];

        if (firstMetric) {
          window.requestAnimationFrame(
            () => {
              inputRefs.current[
                firstMetric.id
              ]?.focus();
            }
          );
        }
      },
      [
        closingEditableLoaded,
        isAttributionInputAllowed,
        isClosingEditable,
        isLoading,
        isSubmitting,
        isSwitching,
        persistDraft,
        renderedMetrics,
      ]
    );


  /*
   * 날짜 변경
   */
  const handleDateChange =
    async (
      value: string
    ) => {
      if (
        value ===
        selectedDate
      ) {
        return;
      }

      if (
        value > today
      ) {
        return;
      }

      setIsSwitching(
        true
      );

      try {
        await flushPendingDraft();

        dirtyRef.current =
          false;

        reportIdRef.current =
          null;

        reportMetricIdsRef.current =
          [];

        setReportId(
          null
        );

        setReportMetricIds(
          []
        );

        setIsLoading(
          true
        );

        setLoadError(
          ""
        );

        setIsAttributionInputAllowed(
          false
        );

        setSelectedDate(
          value
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setSaveState(
          "error"
        );
      } finally {
        setIsSwitching(
          false
        );
      }
    };


  /*
   * 매니저 변경
   */
  const handleManagerChange =
    async (
      managerId: string
    ) => {
      if (
        managerId ===
        selectedManagerId
      ) {
        return;
      }

      setIsSwitching(
        true
      );

      try {
        await flushPendingDraft();

        dirtyRef.current =
          false;

        reportIdRef.current =
          null;

        reportMetricIdsRef.current =
          [];

        setReportId(
          null
        );

        setReportMetricIds(
          []
        );

        setIsLoading(
          true
        );

        setLoadError(
          ""
        );

        setIsAttributionInputAllowed(
          false
        );

        setSelectedManagerId(
          managerId
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setSaveState(
          "error"
        );
      } finally {
        setIsSwitching(
          false
        );
      }
    };


  /*
   * 최종 저장
   *
   * 이 시점에서만:
   *
   * 모든 빈칸 → 0
   * Draft 저장
   * submitted 처리
   */
  const handleSave =
    async () => {
      const targetReportId =
        reportIdRef.current;

      if (
        !targetReportId ||
        isSubmitting ||
        !closingEditableLoaded ||
        !isClosingEditable ||
        !isAttributionInputAllowed ||
        !selectedNoPerformanceStatusLoaded ||
        selectedNoPerformanceConfirmed
      ) {
        return;
      }

      setLoadError(
        ""
      );


      /*
       * 무실적은 [저장]으로 0값을 제출하지 않습니다.
       * 일부 항목이 0인 것은 허용하지만, 전체 입력값이
       * 빈칸 또는 0뿐이면 무실적 확정을 사용해야 합니다.
       */
      const hasActualPerformance =
        reportMetricIdsRef.current.some(
          (metricId) =>
            Number(
              valuesRef.current[metricId] ||
                "0"
            ) > 0
        );

      if (!hasActualPerformance) {
        setSaveState(
          "idle"
        );

        window.alert(
          "실적이 없으면 무실적 확정해주세요"
        );

        return;
      }


      setIsSubmitting(
        true
      );


      try {
        const completedValues =
          fillAllEmptyValuesWithZero();


        const version =
          editVersionRef.current;


        setSaveState(
          "saving"
        );


        await persistDraft(
          targetReportId,
          completedValues
        );


        if (
          reportIdRef.current ===
            targetReportId &&
          editVersionRef.current ===
            version
        ) {
          dirtyRef.current =
            false;
        }


        const {
          error,
        } =
          await supabase.rpc(
            "submit_daily_report",
            {
              p_report_id:
                targetReportId,
            }
          );


        if (error) {
          throw error;
        }


        dirtyRef.current =
          false;

        valuesRef.current =
          completedValues;

        setValues(
          completedValues
        );

        setReportStatus(
          "submitted"
        );

        setSaveState(
          "saved"
        );

        /*
         * submit_daily_report 완료 직후 하단 매니저별 상태를
         * 다시 조회하여 페이지 이동 없이 즉시 입력완료로
         * 표시되도록 동기화합니다.
         */
        setClosingStatusRefreshKey(
          (value) => value + 1
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setSaveState(
          "error"
        );

        setLoadError(
          "일실적 저장 중 오류가 발생했습니다."
        );
      } finally {
        setIsSubmitting(
          false
        );
      }
    };


  const isBusy =
    isLoading ||
    isSwitching ||
    isSubmitting;

  const isInputLocked =
    isBusy ||
    !closingEditableLoaded ||
    !isClosingEditable ||
    !isAttributionInputAllowed;


  const hasAnyInputValue =
    reportMetricIds.some(
      (metricId) =>
        (
          values[
            metricId
          ] ?? ""
        ) !== ""
    );


  return (
    <div className="space-y-5">

      {/* Header */}
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-5 sm:p-6">

        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

          <div>

            <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
              DAILY PERFORMANCE
            </p>

            <h2 className="mt-2 text-[26px] font-bold tracking-[-0.04em] text-[#202226]">
              개인 일실적 입력
            </h2>

            <p className="mt-2 text-[13px] leading-5 text-[#838891]">
              실적을 입력한 뒤 Enter를 누르면 다음 입력칸으로 이동합니다.
              Shift+Enter는 이전 입력칸으로 이동하며, 잘못 입력한 경우 [초기화]로 입력값을 한 번에 비울 수 있습니다.
              미입력 항목은 최종 저장 시 자동으로 0 처리됩니다.
            </p>

          </div>


          <div className="flex items-center gap-2">

            <span
              className={[
                "inline-flex min-h-[34px] items-center rounded-full px-3 text-[11px] font-bold",
                selectedNoPerformanceConfirmed
                  ? "bg-[#EEF4FF] text-[#315F9B]"
                  : reportStatus ===
                    "submitted"
                    ? "bg-[#EDF8F1] text-[#287348]"
                    : "bg-[#F3F4F6] text-[#656A72]",
              ].join(" ")}
             data-daily-header-ui-v13="status" style={{ whiteSpace: "nowrap", flexShrink: 0, minWidth: 62, textAlign: "center", wordBreak: "keep-all" }}>
              {selectedNoPerformanceConfirmed
                ? "무실적 확정"
                : statusLabel(
                    reportStatus
                  )}
            </span>


            <button
              type="button"
              onClick={
                handleResetValues
              }
              disabled={
                isBusy ||
                !reportId ||
                !closingEditableLoaded ||
                !isClosingEditable ||
                !isAttributionInputAllowed ||
                !hasAnyInputValue
              }
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[12px] border border-[#DDE0E5] bg-white px-4 text-[13px] font-bold text-[#666B73] transition hover:border-[#BFC3C9] hover:bg-[#F7F8F9] disabled:cursor-not-allowed disabled:bg-[#F5F6F7] disabled:text-[#B0B4BA]"
             data-daily-header-ui-v13="reset" style={{ whiteSpace: "nowrap", flexShrink: 0, minWidth: 78, wordBreak: "keep-all" }}>
              <RotateCcw
                size={15}
              />
              초기화
            </button>


            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={
                isBusy ||
                !reportId ||
                !closingEditableLoaded ||
                !isClosingEditable ||
                !isAttributionInputAllowed ||
                !selectedNoPerformanceStatusLoaded ||
                selectedNoPerformanceConfirmed
              }
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[12px] bg-[#A50034] px-5 text-[13px] font-bold text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:bg-[#D7D9DE] disabled:text-[#92969D]"
             data-daily-header-ui-v13="save" style={{ whiteSpace: "nowrap", flexShrink: 0, minWidth: 86, wordBreak: "keep-all" }}>
              {isSubmitting ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Save
                  size={16}
                />
              )}

              {reportStatus ===
              "submitted"
                ? "저장완료"
                : "저장"}
            </button>

          </div>

        </div>


        {/* Filters */}
        <div className="mt-6 grid gap-4 border-t border-[#ECEEF1] pt-5 sm:grid-cols-2">

          <div>

            <label
              htmlFor="daily-date"
              className="mb-2 block text-[12px] font-bold text-[#555A62]"
            >
              실적일자
            </label>

            <input
              id="daily-date"
              type="date"
              value={
                selectedDate
              }
              max={today}
              disabled={isBusy}
              onChange={(
                event
              ) => {
                void handleDateChange(
                  event.target.value
                );
              }}
              className="h-[48px] w-full rounded-[12px] border border-[#DDE0E5] bg-white px-4 text-[14px] font-semibold text-[#25282D] outline-none transition focus:border-[#8A8E95] focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F6F7F8]"
            />

          </div>


          <div>

            <label
              htmlFor="daily-manager"
              className="mb-2 block text-[12px] font-bold text-[#555A62]"
            >
              매니저
            </label>

            <select
              id="daily-manager"
              value={
                selectedManagerId
              }
              disabled={isBusy}
              onChange={(
                event
              ) => {
                void handleManagerChange(
                  event.target.value
                );
              }}
              className="h-[48px] w-full rounded-[12px] border border-[#DDE0E5] bg-white px-4 text-[14px] font-semibold text-[#25282D] outline-none transition focus:border-[#8A8E95] focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F6F7F8]"
            >
              {managers.map(
                (manager) => (
                  <option
                    key={
                      manager.id
                    }
                    value={
                      manager.id
                    }
                  >
                    {manager.name}
                    {" · "}
                    {manager.employeeNo}
                  </option>
                )
              )}
            </select>

          </div>

        </div>


        {/* Save State */}
        <div className="mt-4 flex min-h-[24px] items-center gap-2 text-[12px]">

          {saveState ===
            "saving" && (
            <>
              <LoaderCircle
                size={14}
                className="animate-spin text-[#737881]"
              />

              <span className="text-[#737881]">
                자동저장 중...
              </span>
            </>
          )}


          {saveState ===
            "saved" && (
            <>
              <Check
                size={14}
                className="text-[#347353]"
              />

              <span className="text-[#667069]">
                서버에 저장되었습니다.
              </span>
            </>
          )}


          {saveState ===
            "error" && (
            <>
              <AlertCircle
                size={14}
                className="text-[#A50034]"
              />

              <span className="font-semibold text-[#A50034]">
                저장상태를 확인해주세요.
              </span>
            </>
          )}


          {saveState ===
            "idle" &&
            !isLoading && (
              <span className="text-[#92969D]">
                빈칸은 저장 버튼을 누를 때까지 그대로 유지됩니다.
              </span>
            )}

        </div>

      </section>


      <DailyAttendanceSelector
        key={`${selectedDate}-${closingStatusRefreshKey}`}
        reportDate={selectedDate}
        managers={managers}
      />


      {closingEditableLoaded &&
        !isClosingEditable && (
        <section className="flex items-start gap-3 rounded-[18px] border border-[#F0D6DE] bg-[#FFF7F9] px-4 py-4 text-[#8C183B]">
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="text-[13px] font-black">
              마감 확정으로 일실적이 잠겨 있습니다.
            </p>

            <p className="mt-1 text-[12px] leading-5 text-[#9A4862]">
              조회는 가능하며, 다시 입력·수정·초기화하려면 마감보고에서 해당 날짜의 [수정]을 먼저 실행해주세요.
            </p>
          </div>
        </section>
      )}


      {selectedNoPerformanceConfirmed && (
        <section className="flex items-start gap-3 rounded-[18px] border border-[#D8E5F7] bg-[#F6F9FE] px-4 py-4 text-[#315F9B]">
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="text-[13px] font-black">
              무실적 확정 상태입니다.
            </p>

            <p className="mt-1 text-[12px] leading-5 text-[#55769E]">
              실제 실적을 입력하려면 아래 매니저별 일실적 상태에서 [확정취소]를 먼저 눌러 무실적 확정을 취소해주세요. 취소하면 입력과 [저장] 버튼이 다시 활성화됩니다.
            </p>
          </div>
        </section>
      )}


      {/* Cancellation Notice */}
      <section className="rounded-[15px] border border-[#ECE5E7] bg-[#FFF9FA] px-4 py-3 text-[12px] leading-5 text-[#6F6065]">

        판매취소·구독취소·교원취소도

        <strong className="mx-1 text-[#A50034]">
          마이너스(-)가 아닌 양수
        </strong>

        로 입력합니다. 차감 계산은 시스템에서 자동 처리합니다.

      </section>


      {/* Error */}
      {loadError && (
        <section className="flex items-start gap-3 rounded-[15px] border border-[#F0D4DB] bg-[#FFF5F7] px-4 py-4 text-[13px] font-medium text-[#A50034]">

          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>
            {loadError}
          </span>

        </section>
      )}


      {/* Loading */}
      {isLoading ? (
        <section className="flex min-h-[280px] items-center justify-center rounded-[22px] border border-[#E5E7EA] bg-white">

          <div className="text-center">

            <LoaderCircle
              size={28}
              className="mx-auto animate-spin text-[#8A8F97]"
            />

            <p className="mt-4 text-[13px] font-semibold text-[#777C84]">
              일실적을 불러오는 중입니다.
            </p>

          </div>

        </section>
      ) : (
        <>

          {/* Selected Manager */}
          <section className="flex items-center justify-between rounded-[16px] border border-[#E5E7EA] bg-white px-5 py-4">

            <div>

              <p className="text-[11px] font-semibold text-[#92969D]">
                선택된 담당자
              </p>

              <p className="mt-1 text-[16px] font-bold text-[#25282D]">
                {selectedManager?.name ??
                  "-"}
              </p>

            </div>


            <div className="text-right">

              <p className="text-[11px] font-semibold text-[#92969D]">
                실적일자
              </p>

              <p className="mt-1 text-[14px] font-bold text-[#454950]">
                {selectedDate}
              </p>

            </div>

          </section>


          <OffdayAttributionGuard
            reportDate={
              selectedDate
            }
            managerId={
              selectedManagerId
            }
            managerName={
              selectedManager?.name
            }
            reportId={
              reportId
            }
            onStateChange={
              setIsAttributionInputAllowed
            }
          
            onCancelled={() => {
              const clearedValues =
                createEmptyValues(
                  metrics
                );

              editVersionRef.current +=
                1;

              dirtyRef.current =
                false;

              valuesRef.current =
                clearedValues;

              setValues(
                clearedValues
              );

              setReportStatus(
                "draft"
              );

              setSaveState(
                "saved"
              );
            }}
/>

          {/* Metrics */}
          <div className="grid items-start gap-4 xl:grid-cols-2">

            {visibleCategories.map(
              (category) => {
                const categoryMetrics =
                  visibleMetrics.filter(
                    (metric) =>
                      metric.categoryId ===
                      category.id
                  );

                if (
                  categoryMetrics.length ===
                  0
                ) {
                  return null;
                }


                return (
                  <section
                    key={
                      category.id
                    }
                    className="overflow-hidden rounded-[20px] border border-[#E5E7EA] bg-white"
                  >

                    <div className="border-b border-[#ECEEF1] bg-[#FAFAFB] px-5 py-4">

                      <h3 className="text-[15px] font-bold tracking-[-0.02em] text-[#292C31]">
                        {category.name}
                      </h3>

                    </div>


                    <div className="divide-y divide-[#F0F1F3]">

                      {categoryMetrics.map(
                        (metric) => {
                          const value =
                            values[
                              metric.id
                            ] ?? "";

                          const globalMetricIndex =
                            metricIndexMap.get(
                              metric.id
                            ) ?? -1;

                          const isCancellation =
                            metric.effectSign <
                              0 ||
                            metric.code.includes(
                              "CANCEL"
                            ) ||
                            metric.name.includes(
                              "취소"
                            );


                          return (
                            <div
                              key={
                                metric.id
                              }
                              className="grid grid-cols-[minmax(0,1fr)_minmax(150px,210px)] items-center gap-4 px-5 py-4"
                            >

                              <div className="min-w-0">

                                <p className="truncate text-[14px] font-semibold text-[#40444A]">
                                  {metric.name}
                                </p>

                                {isCancellation && (
                                  <p className="mt-1 text-[10px] font-medium text-[#A50034]">
                                    양수 입력
                                  </p>
                                )}

                              </div>


                              <div className="relative">

                                <input
                                  ref={(
                                    element
                                  ) => {
                                    inputRefs.current[
                                      metric.id
                                    ] =
                                      element;
                                  }}
                                  type="text"
                                  inputMode="numeric"
                                  value={
                                    formatInputValue(
                                      value
                                    )
                                  }
                                  disabled={
                                    isInputLocked
                                  }
                                  readOnly={
                                    selectedNoPerformanceConfirmed
                                  }
                                  placeholder=""
                                  onFocus={(
                                    event
                                  ) => {
                                    if (
                                      selectedNoPerformanceConfirmed
                                    ) {
                                      return;
                                    }

                                    if (
                                      event.currentTarget.value !==
                                      ""
                                    ) {
                                      event.currentTarget.select();
                                    }
                                  }}
                                  onChange={(
                                    event
                                  ) => {
                                    updateValue(
                                      metric.id,
                                      event.target.value
                                    );
                                  }}
                                  onBlur={() => {
                                    void flushPendingDraft();
                                  }}
                                  onKeyDown={(
                                    event
                                  ) => {
                                    if (
                                      event.key !==
                                      "Enter"
                                    ) {
                                      return;
                                    }

                                    event.preventDefault();

                                    handleInputEnter(
                                      globalMetricIndex,
                                      event.shiftKey
                                    );
                                  }}
                                  className="h-[46px] w-full rounded-[11px] border border-[#DDE0E5] bg-white pl-3 pr-10 text-right text-[15px] font-bold tabular-nums text-[#202328] outline-none transition focus:border-[#767B83] focus:ring-4 focus:ring-black/[0.035] read-only:cursor-not-allowed read-only:bg-[#F5F6F7] read-only:text-[#8C9199] disabled:bg-[#F5F6F7]"
                                />

                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#9A9EA5]">

                                  {metric.unitType ===
                                  "amount"
                                    ? "원"
                                    : "건"}

                                </span>

                              </div>

                            </div>
                          );
                        }
                      )}

                    </div>

                  </section>
                );
              }
            )}

          </div>


          {visibleMetrics.length ===
            0 && (
            <section className="rounded-[20px] border border-[#E5E7EA] bg-white px-6 py-12 text-center">

              <p className="text-[14px] font-semibold text-[#777C84]">
                등록된 일실적 항목이 없습니다.
              </p>

            </section>
          )}


          {/* Bottom Save */}
          <section className="rounded-[20px] border border-[#E5E7EA] bg-white p-4 sm:p-5">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-[12px] font-bold text-[#555A62]">
                  {selectedManager?.name}
                  {" · "}
                  {selectedDate}
                </p>

                <p className="mt-1 text-[11px] text-[#92969D]">
                  미입력 항목은 저장 버튼을 누르면 자동으로 0으로 채워집니다.
                </p>

              </div>


              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={
                    handleResetValues
                  }
                  disabled={
                    isBusy ||
                    !reportId ||
                    !closingEditableLoaded ||
                    !isClosingEditable ||
                    !isAttributionInputAllowed ||
                    !hasAnyInputValue
                  }
                  className="inline-flex h-[48px] min-w-[110px] items-center justify-center gap-2 rounded-[12px] border border-[#DDE0E5] bg-white px-5 text-[13px] font-bold text-[#666B73] transition hover:border-[#BFC3C9] hover:bg-[#F7F8F9] disabled:cursor-not-allowed disabled:bg-[#F5F6F7] disabled:text-[#B0B4BA]"
                >
                  <RotateCcw
                    size={16}
                  />
                  초기화
                </button>

                <button
                  type="button"
                  onClick={
                    handleSave
                  }
                  disabled={
                    isBusy ||
                    !reportId ||
                    !closingEditableLoaded ||
                    !isClosingEditable ||
                    !isAttributionInputAllowed ||
                    !selectedNoPerformanceStatusLoaded ||
                    selectedNoPerformanceConfirmed
                  }
                  className="inline-flex h-[48px] min-w-[140px] items-center justify-center gap-2 rounded-[12px] bg-[#A50034] px-6 text-[13px] font-bold text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:bg-[#D7D9DE] disabled:text-[#92969D]"
                >
                  {isSubmitting ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save
                      size={17}
                    />
                  )}

                  {reportStatus ===
                  "submitted"
                    ? "저장완료"
                    : "저장"}
                </button>
              </div>

            </div>

          </section>


          <DailyManagerClosingStatusPanel
            key={`${selectedDate}-${closingStatusRefreshKey}`}
            reportDate={selectedDate}
            onChanged={() =>
              setClosingStatusRefreshKey(
                (value) => value + 1
              )
            }
          />

        </>
      )}

    </div>
  );
}