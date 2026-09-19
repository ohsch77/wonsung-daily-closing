"use client";

import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  DatabaseZap,
  LoaderCircle,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import type {
  ChangeEvent,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";


type ResetTarget =
  | "daily"
  | "system"
  | "card"
  | "cash";


type PreviewCounts = {
  daily:
    number;
  system:
    number;
  card:
    number;
  cash:
    number;
  total:
    number;
};


const TARGETS:
  Array<{
    key:
      ResetTarget;
    label:
      string;
    description:
      string;
  }> = [
    {
      key: "daily",
      label: "일실적",
      description:
        "일실적 입력값 · 무실적확정 · 출근선택 · 일마감정보",
    },
    {
      key: "system",
      label: "전산실적",
      description:
        "사원별 판매/매출 업로드 · 붙여넣기 자료",
    },
    {
      key: "card",
      label: "카드실적",
      description:
        "카드승인/취소 업로드 · 무실적확정 자료",
    },
    {
      key: "cash",
      label: "판매시재",
      description:
        "일자별 시재 · 현금수금 · 입금 · 경비 입력자료",
    },
  ];


function getKstToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Seoul",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value ??
    "";

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value ??
    "";

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value ??
    "";

  return `${year}-${month}-${day}`;
}


function getMonthStart(
  dateString:
    string
) {
  return `${dateString.slice(0, 7)}-01`;
}


function normalizeCounts(
  value:
    unknown
): PreviewCounts {
  const row =
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
      ? value as
          Record<
            string,
            unknown
          >
      : {};

  const read =
    (
      key:
        keyof PreviewCounts
    ) => {
      const parsed =
        Number(
          row[key] ??
          0
        );

      return Number.isFinite(
        parsed
      )
        ? Math.max(
            0,
            Math.trunc(
              parsed
            )
          )
        : 0;
    };

  return {
    daily:
      read("daily"),
    system:
      read("system"),
    card:
      read("card"),
    cash:
      read("cash"),
    total:
      read("total"),
  };
}


function countLabel(
  value:
    number
) {
  return `${value.toLocaleString(
    "ko-KR"
  )}건`;
}

function getRpcErrorMessage(
  error:
    unknown,
  fallback:
    string
) {
  if (
    error &&
    typeof error ===
      "object"
  ) {
    const row =
      error as Record<
        string,
        unknown
      >;

    const parts = [
      row.message,
      row.details,
      row.hint,
    ]
      .map(
        (value) =>
          typeof value ===
            "string"
            ? value.trim()
            : ""
      )
      .filter(
        Boolean
      );

    if (parts.length > 0) {
      return Array.from(
        new Set(
          parts
        )
      ).join(
        " · "
      );
    }
  }

  if (
    error instanceof
    Error &&
    error.message
  ) {
    return error.message;
  }

  return fallback;
}


export default function DataResetPanel() {
  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const today =
    useMemo(
      () =>
        getKstToday(),
      []
    );

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      () =>
        getMonthStart(
          today
        )
    );

  const [
    endDate,
    setEndDate,
  ] =
    useState(
      today
    );

  const [
    targets,
    setTargets,
  ] =
    useState<
      Record<
        ResetTarget,
        boolean
      >
    >({
      daily: true,
      system: true,
      card: true,
      cash: true,
    });

  const [
    rangePreview,
    setRangePreview,
  ] =
    useState<
      PreviewCounts | null
    >(null);

  const [
    allPreview,
    setAllPreview,
  ] =
    useState<
      PreviewCounts | null
    >(null);

  const [
    busy,
    setBusy,
  ] =
    useState<
      | "range-preview"
      | "range-delete"
      | "all-preview"
      | "all-delete"
      | null
    >(null);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");


  const selectedCount =
    Object.values(
      targets
    ).filter(
      Boolean
    ).length;


  const targetPayload =
    useMemo(
      () => ({
        daily:
          targets.daily,
        system:
          targets.system,
        card:
          targets.card,
        cash:
          targets.cash,
      }),
      [
        targets,
      ]
    );


  const resetFeedback =
    () => {
      setMessage("");
      setErrorMessage("");
    };


  const toggleTarget =
    (
      key:
        ResetTarget
    ) => {
      setTargets(
        (current) => ({
          ...current,
          [key]:
            !current[
              key
            ],
        })
      );

      setRangePreview(
        null
      );
      resetFeedback();
    };


  const previewRange =
    async () => {
      resetFeedback();

      if (
        !startDate ||
        !endDate
      ) {
        setErrorMessage(
          "초기화 시작일과 종료일을 선택해주세요."
        );
        return;
      }

      if (
        endDate <
        startDate
      ) {
        setErrorMessage(
          "종료일은 시작일보다 빠를 수 없습니다."
        );
        return;
      }

      if (
        selectedCount ===
        0
      ) {
        setErrorMessage(
          "초기화할 데이터를 1개 이상 선택해주세요."
        );
        return;
      }

      setBusy(
        "range-preview"
      );

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "admin_preview_operational_data_reset",
            {
              p_start_date:
                startDate,
              p_end_date:
                endDate,
              p_targets:
                targetPayload,
              p_all:
                false,
            }
          );

        if (error) {
          throw error;
        }

        setRangePreview(
          normalizeCounts(
            data
          )
        );
      }
      catch (error) {
        setRangePreview(
          null
        );

        setErrorMessage(
          getRpcErrorMessage(
            error,
            "삭제 대상 확인 중 오류가 발생했습니다."
          )
        );
      }
      finally {
        setBusy(
          null
        );
      }
    };


  const executeRange =
    async () => {
      resetFeedback();

      if (
        !rangePreview
      ) {
        setErrorMessage(
          "먼저 [삭제 대상 확인]을 실행해주세요."
        );
        return;
      }

      if (
        typeof window !==
          "undefined" &&
        !window.confirm(
          `${startDate} ~ ${endDate} 선택 실적 데이터를 초기화합니다. 계속하시겠습니까?`
        )
      ) {
        return;
      }

      setBusy(
        "range-delete"
      );

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "admin_execute_operational_data_reset",
            {
              p_start_date:
                startDate,
              p_end_date:
                endDate,
              p_targets:
                targetPayload,
              p_all:
                false,
              p_confirmation:
                "기간초기화",
            }
          );

        if (error) {
          throw error;
        }

        const result =
          normalizeCounts(
            data
          );

        setMessage(
          `${startDate} ~ ${endDate} 선택 데이터 초기화를 완료했습니다. 삭제 ${countLabel(
            result.total
          )}`
        );

        setRangePreview(
          null
        );
      }
      catch (error) {
        setErrorMessage(
          getRpcErrorMessage(
            error,
            "기간 데이터 초기화 중 오류가 발생했습니다."
          )
        );
      }
      finally {
        setBusy(
          null
        );
      }
    };


  const previewAll =
    async () => {
      resetFeedback();
      setBusy(
        "all-preview"
      );

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "admin_preview_operational_data_reset",
            {
              p_start_date:
                null,
              p_end_date:
                null,
              p_targets: {
                daily: true,
                system: true,
                card: true,
                cash: true,
              },
              p_all:
                true,
            }
          );

        if (error) {
          throw error;
        }

        setAllPreview(
          normalizeCounts(
            data
          )
        );
      }
      catch (error) {
        setAllPreview(
          null
        );

        setErrorMessage(
          getRpcErrorMessage(
            error,
            "전체 삭제 대상 확인 중 오류가 발생했습니다."
          )
        );
      }
      finally {
        setBusy(
          null
        );
      }
    };


  const executeAll =
    async () => {
      resetFeedback();

      if (
        !allPreview
      ) {
        setErrorMessage(
          "먼저 전체 [삭제 대상 확인]을 실행해주세요."
        );
        return;
      }

      if (
        typeof window !==
          "undefined" &&
        !window.confirm(
          "모든 기간의 일실적·전산실적·카드실적·판매시재를 초기화합니다. 설정/권한/분석수식은 유지됩니다. 계속하시겠습니까?"
        )
      ) {
        return;
      }

      setBusy(
        "all-delete"
      );

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "admin_execute_operational_data_reset",
            {
              p_start_date:
                null,
              p_end_date:
                null,
              p_targets: {
                daily: true,
                system: true,
                card: true,
                cash: true,
              },
              p_all:
                true,
              p_confirmation:
                "전체초기화",
            }
          );

        if (error) {
          throw error;
        }

        const result =
          normalizeCounts(
            data
          );

        setMessage(
          `전체 실적 데이터 초기화를 완료했습니다. 삭제 ${countLabel(
            result.total
          )}`
        );

        setAllPreview(
          null
        );
      }
      catch (error) {
        setErrorMessage(
          getRpcErrorMessage(
            error,
            "전체 데이터 초기화 중 오류가 발생했습니다."
          )
        );
      }
      finally {
        setBusy(
          null
        );
      }
    };


  const renderCounts =
    (
      counts:
        PreviewCounts
    ) => (
      <div className="overflow-hidden rounded-[14px] border border-[#E5E7EA] bg-white">
        {TARGETS.map(
          (target) => (
            <div
              key={
                target.key
              }
              className="flex items-center justify-between gap-4 border-b border-[#EEF0F2] px-4 py-3 last:border-b-0"
            >
              <span className="text-[11px] font-bold text-[#62676F]">
                {target.label}
              </span>

              <span className="text-[12px] font-black tabular-nums text-[#33373D]">
                {countLabel(
                  counts[
                    target.key
                  ]
                )}
              </span>
            </div>
          )
        )}

        <div className="flex items-center justify-between gap-4 bg-[#F8F9FA] px-4 py-3">
          <span className="text-[11px] font-black text-[#444950]">
            삭제 대상 합계
          </span>

          <span className="text-[13px] font-black tabular-nums text-[#A50034]">
            {countLabel(
              counts.total
            )}
          </span>
        </div>
      </div>
    );


  return (
    <section className="rounded-[22px] border border-[#E5D7DB] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#FFF1F4] text-[#A50034]">
          <DatabaseZap
            size={20}
          />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
            DATA RESET
          </p>

          <h2 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-[#25282D]">
            실적 데이터 초기화
          </h2>

          <p className="mt-2 max-w-[900px] text-[12px] font-medium leading-5 text-[#777C84]">
            수기 입력·업로드한 운영 실적만 초기화합니다. 매니저, 권한, 지표설정, 경비분류, 휴무설정, 분석수식, 내 보고서는 삭제하지 않습니다.
          </p>
        </div>
      </div>

      {(message ||
        errorMessage) && (
        <div
          className={[
            "mt-5 rounded-[13px] border px-4 py-3 text-[11px] font-bold leading-5",
            errorMessage
              ? "border-[#F0CDD3] bg-[#FFF5F7] text-[#A50034]"
              : "border-[#CFE8D8] bg-[#F2FBF5] text-[#287348]",
          ].join(
            " "
          )}
        >
          {errorMessage ||
            message}
        </div>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="rounded-[18px] border border-[#E5E7EA] bg-[#FCFCFD] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CalendarRange
              size={18}
              className="mt-0.5 shrink-0 text-[#A50034]"
            />

            <div>
              <h3 className="text-[15px] font-black text-[#292C31]">
                기간 초기화
              </h3>

              <p className="mt-1 text-[11px] leading-5 text-[#8A8F96]">
                원하는 기간과 데이터 종류를 선택하여 해당 부분만 초기화합니다.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-black text-[#6E737B]">
                시작일
              </span>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={
                  (event: ChangeEvent<HTMLInputElement>) => {
                    setStartDate(
                      event.target.value
                    );
                    setRangePreview(
                      null
                    );
                  }
                }
                className="mt-1.5 h-11 w-full rounded-[11px] border border-[#DDE0E4] bg-white px-3 text-[12px] font-bold text-[#3F444B] outline-none focus:border-[#A50034]"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-black text-[#6E737B]">
                종료일
              </span>

              <input
                type="date"
                value={
                  endDate
                }
                onChange={
                  (event: ChangeEvent<HTMLInputElement>) => {
                    setEndDate(
                      event.target.value
                    );
                    setRangePreview(
                      null
                    );
                  }
                }
                className="mt-1.5 h-11 w-full rounded-[11px] border border-[#DDE0E4] bg-white px-3 text-[12px] font-bold text-[#3F444B] outline-none focus:border-[#A50034]"
              />
            </label>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-black text-[#6E737B]">
              초기화 대상
            </p>

            <div className="mt-2 grid gap-2">
              {TARGETS.map(
                (target) => (
                  <button
                    key={
                      target.key
                    }
                    type="button"
                    onClick={() =>
                      toggleTarget(
                        target.key
                      )
                    }
                    className={[
                      "flex min-h-[54px] touch-manipulation items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition",
                      targets[
                        target.key
                      ]
                        ? "border-[#E2BCC7] bg-[#FFF6F8]"
                        : "border-[#E3E5E8] bg-white",
                    ].join(
                      " "
                    )}
                  >
                    <span
                      className={[
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border",
                        targets[
                          target.key
                        ]
                          ? "border-[#A50034] bg-[#A50034] text-white"
                          : "border-[#C9CDD2] bg-white",
                      ].join(
                        " "
                      )}
                    >
                      {targets[
                        target.key
                      ] && (
                        <CheckCircle2
                          size={13}
                        />
                      )}
                    </span>

                    <span className="min-w-0">
                      <span className="block text-[11px] font-black text-[#43484F]">
                        {target.label}
                      </span>

                      <span className="mt-0.5 block text-[9px] font-medium leading-4 text-[#9599A0]">
                        {target.description}
                      </span>
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={
              previewRange
            }
            disabled={
              busy !==
              null
            }
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[11px] border border-[#D7DADF] bg-white px-4 text-[11px] font-black text-[#5E636B] transition hover:bg-[#F6F7F8] disabled:opacity-50"
          >
            {busy ===
            "range-preview" ? (
              <LoaderCircle
                size={15}
                className="animate-spin"
              />
            ) : (
              <Search
                size={15}
              />
            )}
            삭제 대상 확인
          </button>

          {rangePreview && (
            <div className="mt-4 space-y-4">
              {renderCounts(
                rangePreview
              )}

              <div className="rounded-[13px] border border-[#F1DFC0] bg-[#FFF9EF] p-4">
                <p className="text-[10px] font-bold leading-5 text-[#87621E]">
                  삭제 대상 확인이 끝나면 아래 버튼으로 선택 기간 데이터를 초기화합니다.
                </p>

                <button
                  type="button"
                  onClick={
                    executeRange
                  }
                  disabled={
                    busy !==
                    null
                  }
                  className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-[#A50034] px-4 text-[11px] font-black text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ===
                  "range-delete" ? (
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                  ) : (
                    <Trash2
                      size={15}
                    />
                  )}
                  기간초기화
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[18px] border border-[#F0CDD3] bg-[#FFF8FA] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <RotateCcw
              size={18}
              className="mt-0.5 shrink-0 text-[#A50034]"
            />

            <div>
              <h3 className="text-[15px] font-black text-[#292C31]">
                전체 초기화
              </h3>

              <p className="mt-1 text-[11px] leading-5 text-[#8A8F96]">
                모든 기간의 일실적·전산실적·카드실적·판매시재 운영 데이터를 삭제합니다.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[14px] border border-[#EBC7D0] bg-white p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={17}
                className="mt-0.5 shrink-0 text-[#A50034]"
              />

              <div>
                <p className="text-[11px] font-black text-[#A50034]">
                  설정 데이터는 유지됩니다.
                </p>

                <p className="mt-1 text-[10px] leading-5 text-[#777C84]">
                  매니저·권한·지표·경비분류·휴무설정·분석항목·수식·저장보고서는 초기화 대상이 아닙니다.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={
              previewAll
            }
            disabled={
              busy !==
              null
            }
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[11px] border border-[#E0C8CE] bg-white px-4 text-[11px] font-black text-[#A50034] transition hover:bg-[#FFF1F4] disabled:opacity-50"
          >
            {busy ===
            "all-preview" ? (
              <LoaderCircle
                size={15}
                className="animate-spin"
              />
            ) : (
              <Search
                size={15}
              />
            )}
            전체 삭제 대상 확인
          </button>

          {allPreview && (
            <div className="mt-4 space-y-4">
              {renderCounts(
                allPreview
              )}

              <div className="rounded-[13px] border border-[#EDC1CB] bg-white p-4">
                <p className="text-[10px] font-bold leading-5 text-[#A50034]">
                  삭제 대상 확인이 끝나면 아래 버튼으로 전체 초기화를 실행합니다.
                </p>

                <button
                  type="button"
                  onClick={
                    executeAll
                  }
                  disabled={
                    busy !==
                    null
                  }
                  aria-label="전체 실적 데이터 초기화"
                  className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[11px] border border-[#A50034] bg-[#A50034] px-4 text-[11px] font-black text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    backgroundColor:
                      "#A50034",
                    color:
                      "#FFFFFF",
                    minHeight:
                      "44px",
                  }}
                >
                  {busy ===
                  "all-delete" ? (
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                  ) : (
                    <DatabaseZap
                      size={15}
                    />
                  )}
                  전체초기화
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
