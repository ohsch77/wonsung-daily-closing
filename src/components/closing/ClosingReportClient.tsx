"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileCheck2,
  LoaderCircle,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import ClosingReadinessPanel from "@/components/closing/ClosingReadinessPanel";
import ClosingReportCard from "@/components/closing/ClosingReportCard";
import { createClient } from "@/lib/supabase/client";


type ClosingState = {
  exists: boolean;
  closing_date: string;
  status: "draft" | "editing" | "closed" | null;
  expected_manager_count: number;
  revision_no: number;
  first_closed_at: string | null;
  first_closed_by: string | null;
  last_closed_at: string | null;
  last_closed_by: string | null;
  editing_started_at: string | null;
  editing_started_by: string | null;
  updated_at: string | null;
};


function getKoreanToday() {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}


function formatDateText(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}


function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}


function getStatusInfo(
  state: ClosingState | null
) {
  if (state?.status === "closed") {
    return {
      label: "마감완료",
      description: "마감이 확정되어 일실적·전산실적·카드실적이 잠겨 있습니다.",
      Icon: CheckCircle2,
      badgeClassName: "bg-[#EDF8F1] text-[#287348]",
      panelClassName: "border-[#D6E9DC] bg-[#F6FBF7]",
    };
  }

  if (state?.status === "editing") {
    return {
      label: "수정중",
      description: "[수정]으로 다시 열린 상태입니다. 필요한 자료를 변경한 뒤 재마감하세요.",
      Icon: PencilLine,
      badgeClassName: "bg-[#FFF2E2] text-[#986219]",
      panelClassName: "border-[#F1DFC0] bg-[#FFF9EF]",
    };
  }

  return {
    label: "마감전",
    description: "필수 자료의 최종 적용 상태를 확인한 뒤 마감을 확정하세요.",
    Icon: Clock3,
    badgeClassName: "bg-[#F2F3F5] text-[#6F747C]",
    panelClassName: "border-[#E5E7EA] bg-white",
  };
}


export default function ClosingReportClient() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const today = useMemo(
    () => getKoreanToday(),
    []
  );

  const [reportDate, setReportDate] =
    useState(today);
  const [closingState, setClosingState] =
    useState<ClosingState | null>(null);
  const [closingCanClose, setClosingCanClose] =
    useState(false);
  const [stateLoading, setStateLoading] =
    useState(true);
  const [busy, setBusy] =
    useState<"close" | "reopen" | null>(null);
  const [refreshKey, setRefreshKey] =
    useState(0);
  const [message, setMessage] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);


  const loadClosingState =
    useCallback(
      async () => {
        setStateLoading(true);
        setErrorMessage(null);

        try {
          const result = await supabase.rpc(
            "get_daily_closing_state",
            {
              p_closing_date: reportDate,
            }
          );

          if (result.error) {
            throw result.error;
          }

          setClosingState(
            result.data as ClosingState
          );
        }
        catch (error) {
          setClosingState(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "마감 상태를 확인하지 못했습니다."
          );
        }
        finally {
          setStateLoading(false);
        }
      },
      [reportDate, supabase]
    );


  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadClosingState();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [loadClosingState]);


  const changeReportDate =
    useCallback(
      (value: string) => {
        if (!value) {
          return;
        }

        setClosingCanClose(false);
        setClosingState(null);
        setStateLoading(true);
        setMessage(null);
        setErrorMessage(null);
        setReportDate(value);
      },
      []
    );


  const reloadAll =
    useCallback(() => {
      setClosingCanClose(false);
      setRefreshKey((value) => value + 1);
      void loadClosingState();
      router.refresh();
    }, [loadClosingState, router]);


  const handleClose =
    useCallback(
      async () => {
        if (
          busy ||
          stateLoading ||
          !closingCanClose
        ) {
          return;
        }

        const isEditing =
          closingState?.status === "editing";

        const confirmMessage = isEditing
          ? `${formatDateText(reportDate)} 수정 내용을 반영해 다시 마감할까요?\n\n마감 확정 후에는 일실적·전산실적·카드실적이 다시 잠깁니다.`
          : `${formatDateText(reportDate)} 마감을 확정할까요?\n\n마감 확정 후에는 일실적·전산실적·카드실적이 잠깁니다.`;

        if (!window.confirm(confirmMessage)) {
          return;
        }

        setBusy("close");
        setMessage(null);
        setErrorMessage(null);

        try {
          const readinessResult =
            await supabase.rpc(
              "assert_closing_ready",
              {
                p_report_date: reportDate,
              }
            );

          if (readinessResult.error) {
            throw readinessResult.error;
          }

          const closeResult =
            await supabase.rpc(
              "close_daily_closing",
              {
                p_closing_date: reportDate,
              }
            );

          if (closeResult.error) {
            throw closeResult.error;
          }

          setClosingState(
            closeResult.data as ClosingState
          );
          setMessage(
            isEditing
              ? "수정 내용을 반영해 마감을 다시 확정했습니다."
              : "오늘 마감을 확정했습니다."
          );
          reloadAll();
        }
        catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "마감 확정 중 오류가 발생했습니다."
          );
          setClosingCanClose(false);
          setRefreshKey((value) => value + 1);
        }
        finally {
          setBusy(null);
        }
      },
      [
        busy,
        closingCanClose,
        closingState?.status,
        reloadAll,
        reportDate,
        stateLoading,
        supabase,
      ]
    );


  const handleReopen =
    useCallback(
      async () => {
        if (
          busy ||
          stateLoading ||
          closingState?.status !== "closed"
        ) {
          return;
        }

        if (
          !window.confirm(
            `${formatDateText(reportDate)} 마감을 수정 모드로 전환할까요?\n\n수정 모드에서는 해당 날짜의 일실적·전산실적·카드실적을 다시 변경할 수 있습니다. 변경 후 반드시 다시 마감해주세요.`
          )
        ) {
          return;
        }

        setBusy("reopen");
        setMessage(null);
        setErrorMessage(null);

        try {
          const result =
            await supabase.rpc(
              "reopen_daily_closing",
              {
                p_closing_date: reportDate,
              }
            );

          if (result.error) {
            throw result.error;
          }

          setClosingState(
            result.data as ClosingState
          );
          setMessage(
            "수정 모드로 전환했습니다. 필요한 자료를 변경한 뒤 다시 마감해주세요."
          );
          reloadAll();
        }
        catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "수정 모드 전환 중 오류가 발생했습니다."
          );
        }
        finally {
          setBusy(null);
        }
      },
      [
        busy,
        closingState?.status,
        reloadAll,
        reportDate,
        stateLoading,
        supabase,
      ]
    );


  const isFutureDate = reportDate > today;
  const isPastDate = reportDate < today;
  const isClosed =
    closingState?.status === "closed";
  const isEditing =
    closingState?.status === "editing";

  const canRunClose =
    !stateLoading &&
    !busy &&
    !isClosed &&
    !isFutureDate &&
    closingCanClose &&
    (!isPastDate || isEditing);

  const statusInfo =
    getStatusInfo(closingState);
  const StatusIcon = statusInfo.Icon;


  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white">
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-black tracking-[0.14em] text-[#A50034]">
                DAILY CLOSING REPORT
              </p>
              <h2 className="mt-2 text-[27px] font-black tracking-[-0.045em] text-[#202226] sm:text-[31px]">
                마감보고
              </h2>
              <p className="mt-2 max-w-[690px] text-[13px] leading-6 text-[#7C8189]">
                일실적·전산실적·카드실적의 준비상태와 판매시재 확정 여부를 확인하고 최종 마감을 확정합니다. 판매시재가 미확정이면 마감보고를 확정할 수 없습니다.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex h-[42px] items-center gap-2 rounded-[13px] border border-[#DDE0E4] bg-[#FAFAFB] px-3">
                <CalendarDays
                  size={15}
                  className="text-[#777C84]"
                />
                <input
                  type="date"
                  value={reportDate}
                  max={today}
                  onChange={(event) =>
                    changeReportDate(event.target.value)
                  }
                  className="bg-transparent text-[12px] font-bold text-[#40444A] outline-none"
                />
              </label>

              {reportDate !== today && (
                <button
                  type="button"
                  onClick={() => changeReportDate(today)}
                  className="h-[42px] rounded-[13px] border border-[#DDE0E4] bg-white px-4 text-[11px] font-black text-[#666B73] transition hover:border-[#C6CBD1] hover:bg-[#FAFAFB]"
                >
                  오늘
                </button>
              )}
            </div>
          </div>
        </div>
      </section>


      <section
        className={`rounded-[20px] border p-5 sm:p-6 ${statusInfo.panelClassName}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-white p-2.5 text-[#A50034] shadow-sm">
              {stateLoading ? (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <StatusIcon size={18} />
              )}
            </div>

            <div>
              <p className="text-[11px] font-black text-[#888D95]">
                {formatDateText(reportDate)} 마감상태
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-[20px] font-black tracking-[-0.03em] text-[#2B2F35]">
                  {stateLoading
                    ? "상태 확인 중"
                    : statusInfo.label}
                </h3>

                {!stateLoading && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusInfo.badgeClassName}`}
                  >
                    {statusInfo.label}
                  </span>
                )}
              </div>

              <p className="mt-1 text-[12px] leading-5 text-[#7D828A]">
                {stateLoading
                  ? "daily_closings 상태를 확인하고 있습니다."
                  : statusInfo.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={reloadAll}
            disabled={stateLoading || busy !== null}
            className="inline-flex h-[38px] items-center justify-center gap-1.5 self-start rounded-[12px] border border-[#DDE0E4] bg-white px-3.5 text-[11px] font-black text-[#6A6F77] transition hover:bg-[#FAFAFB] disabled:cursor-not-allowed disabled:opacity-50 sm:self-center"
          >
            <RefreshCw size={13} />
            새로고침
          </button>
        </div>

        {!stateLoading && closingState?.exists && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] border border-[#E8EAED] bg-white px-4 py-3">
              <p className="text-[10px] font-black text-[#91969D]">
                최초 마감
              </p>
              <p className="mt-1.5 text-[12px] font-bold text-[#4B5057]">
                {formatDateTime(closingState.first_closed_at)}
              </p>
            </div>

            <div className="rounded-[14px] border border-[#E8EAED] bg-white px-4 py-3">
              <p className="text-[10px] font-black text-[#91969D]">
                마지막 마감
              </p>
              <p className="mt-1.5 text-[12px] font-bold text-[#4B5057]">
                {formatDateTime(closingState.last_closed_at)}
              </p>
            </div>

            <div className="rounded-[14px] border border-[#E8EAED] bg-white px-4 py-3">
              <p className="text-[10px] font-black text-[#91969D]">
                수정 후 재마감
              </p>
              <p className="mt-1.5 text-[12px] font-bold text-[#4B5057]">
                {closingState.revision_no}회
              </p>
            </div>
          </div>
        )}
      </section>


      {message && (
        <section className="flex items-start gap-2.5 rounded-[16px] border border-[#D6E9DC] bg-[#F5FBF7] px-4 py-3.5 text-[12px] font-bold leading-5 text-[#287348]">
          <CheckCircle2
            size={16}
            className="mt-0.5 shrink-0"
          />
          {message}
        </section>
      )}

      {errorMessage && (
        <section className="flex items-start gap-2.5 rounded-[16px] border border-[#F0CDD3] bg-[#FFF5F6] px-4 py-3.5 text-[12px] font-bold leading-5 text-[#A50034]">
          <CircleAlert
            size={16}
            className="mt-0.5 shrink-0"
          />
          {errorMessage}
        </section>
      )}


      <ClosingReadinessPanel
        key={`${reportDate}-${refreshKey}`}
        reportDate={reportDate}
        refreshKey={refreshKey}
        onCanCloseChange={setClosingCanClose}
      />


      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/daily-performance"
          className="group rounded-[18px] border border-[#E5E7EA] bg-white p-4 transition hover:border-[#D7DADF] hover:shadow-sm"
        >
          <div className="flex items-center gap-2 text-[#A50034]">
            <FileCheck2 size={16} />
            <span className="text-[12px] font-black">일실적 확인</span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[#8A8F97]">
            매니저별 입력완료·무실적 확정·휴무 상태를 확인합니다.
          </p>
        </Link>

        <Link
          href="/system-performance"
          className="group rounded-[18px] border border-[#E5E7EA] bg-white p-4 transition hover:border-[#D7DADF] hover:shadow-sm"
        >
          <div className="flex items-center gap-2 text-[#A50034]">
            <Database size={16} />
            <span className="text-[12px] font-black">전산실적 확인</span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[#8A8F97]">
            판매·매출의 전일누적/당일실적 4개 항목을 확인합니다.
          </p>
        </Link>

        <Link
          href="/card-management"
          className="group rounded-[18px] border border-[#E5E7EA] bg-white p-4 transition hover:border-[#D7DADF] hover:shadow-sm"
        >
          <div className="flex items-center gap-2 text-[#A50034]">
            <ShieldCheck size={16} />
            <span className="text-[12px] font-black">카드실적 확인</span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[#8A8F97]">
            승인·취소 2개 필수 자료의 최종 적용 상태를 확인합니다.
          </p>
        </Link>

        <Link
          href="/cash-ledger"
          className="group rounded-[18px] border border-[#E5E7EA] bg-white p-4 transition hover:border-[#D7DADF] hover:shadow-sm"
        >
          <div className="flex items-center gap-2 text-[#A50034]">
            <WalletCards size={16} />
            <span className="text-[12px] font-black">판매시재 확인</span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[#8A8F97]">
            당일 판매시재 입력과 실금액·차액보전을 확인하고 시재를 확정합니다.
          </p>
        </Link>
      </section>


      <section className="rounded-[20px] border border-[#E5E7EA] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-[#FFF1F4] p-2.5 text-[#A50034]">
            <ShieldCheck size={17} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-black tracking-[-0.025em] text-[#282C31]">
              최종 마감
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-[#858A92]">
              화면의 준비상태와 판매시재 확정 여부를 DB에서 한 번 더 검증한 뒤 마감합니다. 판매시재가 미확정이면 마감할 수 없으며, 먼저 판매시재를 확정해야 합니다.
            </p>

            {isPastDate && !isEditing && !isClosed && (
              <div className="mt-3 rounded-[13px] border border-[#F1DFC0] bg-[#FFF9EF] px-3.5 py-3 text-[11px] font-bold leading-5 text-[#87621E]">
                과거 날짜는 신규 마감을 만들 수 없습니다. 기존 마감이 있는 날짜는 [수정]으로 연 경우에만 다시 마감할 수 있습니다.
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {isClosed ? (
                <button
                  type="button"
                  onClick={() => void handleReopen()}
                  disabled={busy !== null || stateLoading}
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[13px] border border-[#A50034] bg-white px-5 text-[12px] font-black text-[#A50034] transition hover:bg-[#FFF7F9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === "reopen" ? (
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                  ) : (
                    <PencilLine size={15} />
                  )}
                  수정
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleClose()}
                  disabled={!canRunClose}
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[13px] bg-[#A50034] px-5 text-[12px] font-black text-white shadow-sm transition hover:bg-[#8E002D] disabled:cursor-not-allowed disabled:bg-[#D9DADD] disabled:text-[#8D9197] disabled:shadow-none"
                >
                  {busy === "close" ? (
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  {isEditing
                    ? "마감 재확정"
                    : reportDate === today
                      ? "오늘 마감 확정"
                      : "마감 확정"}
                </button>
              )}
            </div>

            {!isClosed && !closingCanClose && !stateLoading && (
              <p className="mt-2 text-[10px] font-bold text-[#969AA2]">
                일실적·전산실적·카드실적과 당일 판매시재 확정까지 모두 완료되면 마감 버튼이 자동으로 활성화됩니다.
              </p>
            )}
          </div>
        </div>
      </section>


      <ClosingReportCard
        reportDate={reportDate}
        isClosed={isClosed}
        refreshKey={refreshKey}
      />
    </div>
  );
}
