"use client";

import {
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";


type DatasetType =
  | "approval"
  | "cancel";


type BatchRow = {
  id: string;
  dataset_type: string;
  status: string;
  row_count: number | null;
};


type Props = {
  reportDate: string;
};


const DATASETS: Array<{
  type: DatasetType;
  label: string;
}> = [
  {
    type: "approval",
    label: "카드승인",
  },
  {
    type: "cancel",
    label: "카드취소",
  },
];


export default function CardNoPerformanceControl({
  reportDate,
}: Props) {
  const router =
    useRouter();

  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const [
    batches,
    setBatches,
  ] = useState<
    BatchRow[]
  >([]);

  const [
    editable,
    setEditable,
  ] = useState(
    false
  );

  const [
    loading,
    setLoading,
  ] = useState(
    true
  );

  const [
    busy,
    setBusy,
  ] = useState<
    DatasetType | null
  >(
    null
  );

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const loadState =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setErrorMessage(
          ""
        );

        try {
          const [
            batchResult,
            editableResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "card_import_batches"
                )
                .select(
                  "id,dataset_type,status,row_count"
                )
                .eq(
                  "report_date",
                  reportDate
                ),

              supabase.rpc(
                "is_performance_upload_editable",
                {
                  p_report_date:
                    reportDate,
                }
              ),
            ]);

          if (
            batchResult.error
          ) {
            throw batchResult.error;
          }

          if (
            editableResult.error
          ) {
            throw editableResult.error;
          }

          setBatches(
            (
              batchResult.data ??
              []
            ) as BatchRow[]
          );

          setEditable(
            editableResult.data ===
              true
          );
        }
        catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "카드실적 무실적 상태를 확인하지 못했습니다."
          );
        }
        finally {
          setLoading(
            false
          );
        }
      },
      [
        reportDate,
        supabase,
      ]
    );


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadState();
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [loadState]);


  const stateFor =
    (
      datasetType:
        DatasetType
    ) => {
      const rows =
        batches.filter(
          (item) =>
            item.dataset_type ===
            datasetType
        );

      const draft =
        rows.find(
          (item) =>
            item.status ===
            "draft"
        );

      if (draft) {
        return {
          state:
            "draft" as const,
          rowCount:
            draft.row_count,
        };
      }

      const applied =
        rows.find(
          (item) =>
            item.status ===
            "applied"
        );

      if (!applied) {
        return {
          state:
            "missing" as const,
          rowCount:
            null,
        };
      }

      if (
        Number(
          applied.row_count ??
          0
        ) === 0
      ) {
        return {
          state:
            "no_performance" as const,
          rowCount:
            0,
        };
      }

      return {
        state:
          "complete" as const,
        rowCount:
          Number(
            applied.row_count
          ),
      };
    };


  const confirmNoPerformance =
    async (
      datasetType:
        DatasetType,
      label: string
    ) => {
      if (!editable) {
        setErrorMessage(
          "마감이 확정된 날짜입니다. 마감보고에서 [수정] 후 변경해주세요."
        );
        return;
      }

      if (
        !window.confirm(
          `${reportDate} ${label}을 무실적 확정할까요?\n\n0행 applied 카드실적으로 정상 완료 처리됩니다.`
        )
      ) {
        return;
      }

      setBusy(
        datasetType
      );

      setMessage(
        ""
      );

      setErrorMessage(
        ""
      );

      try {
        const {
          error,
        } =
          await supabase.rpc(
            "confirm_card_performance_no_performance",
            {
              p_report_date:
                reportDate,
              p_dataset_type:
                datasetType,
            }
          );

        if (error) {
          throw error;
        }

        setMessage(
          `${label}을 무실적 확정했습니다.`
        );

        await loadState();

        router.refresh();
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : `${label} 무실적 확정 중 오류가 발생했습니다.`
        );
      }
      finally {
        setBusy(
          null
        );
      }
    };


  const cancelNoPerformance =
    async (
      datasetType:
        DatasetType,
      label: string
    ) => {
      if (!editable) {
        setErrorMessage(
          "마감이 확정된 날짜입니다. 마감보고에서 [수정] 후 변경해주세요."
        );
        return;
      }

      if (
        !window.confirm(
          `${reportDate} ${label} 무실적 확정을 취소할까요?\n\n취소 후 다시 카드실적을 입력할 수 있습니다.`
        )
      ) {
        return;
      }

      setBusy(
        datasetType
      );

      setMessage(
        ""
      );

      setErrorMessage(
        ""
      );

      try {
        const {
          error,
        } =
          await supabase.rpc(
            "cancel_card_performance_no_performance",
            {
              p_report_date:
                reportDate,
              p_dataset_type:
                datasetType,
            }
          );

        if (error) {
          throw error;
        }

        setMessage(
          `${label} 무실적 확정을 취소했습니다.`
        );

        await loadState();

        router.refresh();
      }
      catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : `${label} 무실적 확정 취소 중 오류가 발생했습니다.`
        );
      }
      finally {
        setBusy(
          null
        );
      }
    };


  return (
    <section className="rounded-[18px] border border-[#E5E7EA] bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[12px] font-black text-[#30343A]">
            카드실적 입력 상태
          </p>

          <p className="mt-1 text-[10px] font-semibold leading-4 text-[#92969D]">
            승인·취소 자료가 실제로 0건인 경우에만 무실적 확정해주세요.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[500px]">
          {DATASETS.map(
            (dataset) => {
              const state =
                stateFor(
                  dataset.type
                );

              const isBusy =
                busy ===
                dataset.type;

              return (
                <div
                  key={
                    dataset.type
                  }
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-[13px] bg-[#F7F8F9] px-3 py-2"
                >
                  <div>
                    <p className="text-[10px] font-black text-[#555A62]">
                      {dataset.label}
                    </p>

                    <p className="mt-0.5 text-[9px] font-bold text-[#92969D]">
                      {loading
                        ? "확인 중"
                        : state.state ===
                            "complete"
                          ? "입력완료"
                          : state.state ===
                              "draft"
                            ? "작성중"
                            : state.state ===
                                "no_performance"
                              ? "무실적 확정"
                              : "미입력"}
                    </p>
                  </div>

                  {loading ? (
                    <LoaderCircle
                      size={15}
                      className="animate-spin text-[#92969D]"
                    />
                  ) : state.state ===
                      "missing" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void confirmNoPerformance(
                          dataset.type,
                          dataset.label
                        )
                      }
                      disabled={
                        !editable ||
                        isBusy
                      }
                      className="inline-flex h-[32px] shrink-0 items-center justify-center gap-1 rounded-[9px] border border-[#D8DFEA] bg-white px-2.5 text-[9px] font-black text-[#315F9B] transition hover:bg-[#F4F7FC] disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {isBusy ? (
                        <LoaderCircle
                          size={12}
                          className="animate-spin"
                        />
                      ) : (
                        <CheckCircle2
                          size={12}
                        />
                      )}
                      무실적 확정
                    </button>
                  ) : state.state ===
                      "no_performance" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void cancelNoPerformance(
                          dataset.type,
                          dataset.label
                        )
                      }
                      disabled={
                        !editable ||
                        isBusy
                      }
                      className="inline-flex h-[32px] shrink-0 items-center justify-center gap-1 rounded-[9px] border border-[#E1E3E7] bg-white px-2.5 text-[9px] font-black text-[#737881] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {isBusy ? (
                        <LoaderCircle
                          size={12}
                          className="animate-spin"
                        />
                      ) : (
                        <RotateCcw
                          size={12}
                        />
                      )}
                      확정 취소
                    </button>
                  ) : (
                    <span className="inline-flex h-[30px] shrink-0 items-center gap-1 rounded-full bg-white px-2.5 text-[9px] font-black text-[#287348]">
                      <CheckCircle2
                        size={11}
                      />
                      {state.state ===
                        "draft"
                        ? "작성중"
                        : "완료"}
                    </span>
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>

      {message && (
        <p className="mt-3 rounded-[10px] bg-[#F4FBF6] px-3 py-2 text-[10px] font-bold text-[#287348]">
          {message}
        </p>
      )}

      {errorMessage && (
        <p className="mt-3 rounded-[10px] bg-[#FFF5F6] px-3 py-2 text-[10px] font-bold text-[#A50034]">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
