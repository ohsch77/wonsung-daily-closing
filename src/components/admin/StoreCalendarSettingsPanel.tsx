"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Store,
  Trash2,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/client";


type StoreDayRow = {
  business_date: string;
  day_status:
    | "store_holiday"
    | "holiday_open";
  holiday_name: string | null;
  updated_at: string | null;
};


type MonthRange = {
  start: string;
  end: string;
};


type RangeBlockedItem = {
  businessDate: string;
  reason: string;
};


type RangeValidation = {
  checking: boolean;
  blockedItems: RangeBlockedItem[];
  error: string;
};


function pad2(
  value: number
) {
  return String(value).padStart(
    2,
    "0"
  );
}


function kstToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const map = new Map(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  );

  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
}


function currentKstMonth() {
  return kstToday().slice(0, 7);
}


function getMonthRange(
  month: string
): MonthRange {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      month
    );

  if (!match) {
    const fallback =
      currentKstMonth();

    return getMonthRange(
      fallback
    );
  }

  const year = Number(match[1]);
  const monthNo = Number(match[2]);
  const lastDay =
    new Date(
      Date.UTC(
        year,
        monthNo,
        0
      )
    ).getUTCDate();

  return {
    start:
      `${year}-${pad2(monthNo)}-01`,
    end:
      `${year}-${pad2(monthNo)}-${pad2(lastDay)}`,
  };
}


function formatDate(
  value: string
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value
    );

  if (!match) {
    return value;
  }

  return `${Number(match[2])}/${Number(match[3])}`;
}


function formatUpdatedAt(
  value: string | null
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}


function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (
      error as {
        message?: unknown;
      }
    ).message === "string"
  ) {
    return (
      error as {
        message: string;
      }
    ).message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}


export default function StoreCalendarSettingsPanel() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [selectedMonth, setSelectedMonth] =
    useState(
      currentKstMonth
    );
  const [rows, setRows] =
    useState<StoreDayRow[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [busyDate, setBusyDate] =
    useState<string | null>(null);
  const [rangeBusy, setRangeBusy] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [message, setMessage] =
    useState("");

  const initialRange = useMemo(
    () => getMonthRange(
      selectedMonth
    ),
    [selectedMonth]
  );

  const [startDate, setStartDate] =
    useState(
      initialRange.start
    );
  const [endDate, setEndDate] =
    useState(
      initialRange.start
    );
  const [holidayName, setHolidayName] =
    useState("");
  const [rangeValidation, setRangeValidation] =
    useState<RangeValidation>({
      checking: false,
      blockedItems: [],
      error: "",
    });

  const loadMonth = useCallback(
    async (
      showLoading = true
    ) => {
      if (showLoading) {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const range =
          getMonthRange(
            selectedMonth
          );

        const result =
          await supabase.rpc(
            "admin_list_store_calendar",
            {
              p_start_date:
                range.start,
              p_end_date:
                range.end,
            }
          );

        if (result.error) {
          throw result.error;
        }

        setRows(
          (
            result.data ?? []
          ).map((item: unknown) => {
            const row =
              item as Record<
                string,
                unknown
              >;

            return {
              business_date:
                String(
                  row.business_date ??
                    ""
                ),
              day_status:
                row.day_status ===
                "holiday_open"
                  ? "holiday_open"
                  : "store_holiday",
              holiday_name:
                row.holiday_name
                  ? String(
                      row.holiday_name
                    )
                  : null,
              updated_at:
                row.updated_at
                  ? String(
                      row.updated_at
                    )
                  : null,
            };
          })
        );
      }
      catch (error) {
        setErrorMessage(
          getErrorMessage(
            error,
            "지점 운영일을 불러오지 못했습니다."
          )
        );
      }
      finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [
      selectedMonth,
      supabase,
    ]
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void loadMonth();
      },
      0
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadMonth]);

  useEffect(() => {
    const reload = () => {
      void loadMonth(false);
    };

    const channel = supabase
      .channel(
        `admin-store-calendar-${selectedMonth}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "store_daily_calendar",
        },
        reload
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [
    loadMonth,
    selectedMonth,
    supabase,
  ]);

  const validateHolidayRange =
    useCallback(
      async (
        targetStart: string,
        targetEnd: string,
        updateState = true
      ): Promise<RangeBlockedItem[] | null> => {
        if (
          !targetStart ||
          !targetEnd ||
          targetEnd < targetStart
        ) {
          if (updateState) {
            setRangeValidation({
              checking: false,
              blockedItems: [],
              error: "",
            });
          }
          return [];
        }

        if (updateState) {
          setRangeValidation({
            checking: true,
            blockedItems: [],
            error: "",
          });
        }

        try {
          const result =
            await supabase.rpc(
              "admin_check_store_holiday_range",
              {
                p_start_date:
                  targetStart,
                p_end_date:
                  targetEnd,
              }
            );

          if (result.error) {
            throw result.error;
          }

          const payload =
            result.data &&
            typeof result.data === "object" &&
            !Array.isArray(result.data)
              ? result.data as Record<
                  string,
                  unknown
                >
              : {};

          const rawBlocked =
            Array.isArray(
              payload.blocked_dates
            )
              ? payload.blocked_dates
              : [];

          const blockedItems =
            rawBlocked.map(
              (item): RangeBlockedItem => {
                const row =
                  item &&
                  typeof item === "object" &&
                  !Array.isArray(item)
                    ? item as Record<
                        string,
                        unknown
                      >
                    : {};

                return {
                  businessDate:
                    String(
                      row.business_date ??
                        ""
                    ),
                  reason:
                    String(
                      row.reason ??
                        "운영상태를 변경할 수 없습니다."
                    ),
                };
              }
            ).filter(
              (item) =>
                item.businessDate !== ""
            );

          if (updateState) {
            setRangeValidation({
              checking: false,
              blockedItems,
              error: "",
            });
          }

          return blockedItems;
        }
        catch (error) {
          const text = getErrorMessage(
            error,
            "선택한 날짜의 운영상태를 확인하지 못했습니다."
          );

          if (updateState) {
            setRangeValidation({
              checking: false,
              blockedItems: [],
              error: text,
            });
          }

          return null;
        }
      },
      [supabase]
    );

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void validateHolidayRange(
          startDate,
          endDate
        );
      },
      180
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    endDate,
    startDate,
    validateHolidayRange,
  ]);


  const registerHolidayRange =
    useCallback(
      async () => {
        if (
          !startDate ||
          !endDate
        ) {
          setErrorMessage(
            "휴무 시작일과 종료일을 선택해주세요."
          );
          return;
        }

        if (
          endDate < startDate
        ) {
          setErrorMessage(
            "휴무 종료일은 시작일보다 빠를 수 없습니다."
          );
          return;
        }

        const blockedItems =
          await validateHolidayRange(
            startDate,
            endDate
          );

        if (blockedItems === null) {
          setErrorMessage(
            "[등록 실패] 선택한 날짜의 마감상태를 확인하지 못했습니다."
          );
          return;
        }

        if (blockedItems.length > 0) {
          setErrorMessage("");
          return;
        }

        const label =
          holidayName.trim() ||
          "지점휴무";

        if (
          !window.confirm(
            `${startDate} ~ ${endDate}를 지점휴무로 등록할까요?\n\n사유: ${label}\n이미 마감·출근·실적이 있는 날짜는 안전을 위해 등록이 차단됩니다.`
          )
        ) {
          return;
        }

        setRangeBusy(true);
        setErrorMessage("");
        setMessage("");

        try {
          const result =
            await supabase.rpc(
              "admin_set_store_holiday_range",
              {
                p_start_date:
                  startDate,
                p_end_date:
                  endDate,
                p_holiday_name:
                  holidayName.trim() ||
                  null,
              }
            );

          if (result.error) {
            throw result.error;
          }

          setMessage(
            `[등록 성공] ${Number(result.data ?? 0)}일을 지점휴무로 등록했습니다.`
          );
          setHolidayName("");
          await loadMonth(false);
        }
        catch (error) {
          setErrorMessage(
            `[등록 실패] ${getErrorMessage(
              error,
              "지점휴무 등록 중 오류가 발생했습니다."
            )}`
          );
        }
        finally {
          setRangeBusy(false);
        }
      },
      [
        endDate,
        holidayName,
        loadMonth,
        startDate,
        supabase,
        validateHolidayRange,
      ]
    );

  const setHolidayOpen =
    useCallback(
      async (
        row: StoreDayRow
      ) => {
        if (
          !window.confirm(
            `${row.business_date}를 휴일영업으로 전환할까요?\n\n지점휴무 등록은 그대로 유지됩니다.\n이 날짜에서만 출근 매니저 선택과 실적 입력이 가능해지고, 실제 영업일 기준으로 정상 일마감을 진행합니다.`
          )
        ) {
          return;
        }

        setBusyDate(
          row.business_date
        );
        setErrorMessage("");
        setMessage("");

        try {
          const result =
            await supabase.rpc(
              "admin_set_store_day_holiday_open",
              {
                p_business_date:
                  row.business_date,
              }
            );

          if (result.error) {
            throw result.error;
          }

          setMessage(
            `[변경 성공] ${row.business_date}를 휴일영업으로 전환했습니다. 지점휴무 등록은 유지됩니다.`
          );
          await loadMonth(false);
        }
        catch (error) {
          setErrorMessage(
            getErrorMessage(
              error,
              "휴일영업 변경 중 오류가 발생했습니다."
            )
          );
        }
        finally {
          setBusyDate(null);
        }
      },
      [
        loadMonth,
        supabase,
      ]
    );

  const setStoreHoliday =
    useCallback(
      async (
        row: StoreDayRow
      ) => {
        if (
          !window.confirm(
            `${row.business_date}의 휴일영업 상태를 해제하고 지점휴무로 복귀할까요?\n\n지점휴무 등록은 계속 유지됩니다. 출근 또는 실적이 있으면 안전을 위해 복귀가 차단됩니다.`
          )
        ) {
          return;
        }

        setBusyDate(
          row.business_date
        );
        setErrorMessage("");
        setMessage("");

        try {
          const result =
            await supabase.rpc(
              "admin_set_store_holiday_range",
              {
                p_start_date:
                  row.business_date,
                p_end_date:
                  row.business_date,
                p_holiday_name:
                  row.holiday_name,
              }
            );

          if (result.error) {
            throw result.error;
          }

          setMessage(
            `[변경 성공] ${row.business_date}를 지점휴무 상태로 복귀했습니다.`
          );
          await loadMonth(false);
        }
        catch (error) {
          setErrorMessage(
            getErrorMessage(
              error,
              "지점휴무 변경 중 오류가 발생했습니다."
            )
          );
        }
        finally {
          setBusyDate(null);
        }
      },
      [
        loadMonth,
        supabase,
      ]
    );

  const deleteHolidayRegistration = useCallback(
    async (
      row: StoreDayRow
    ) => {
      if (
        !window.confirm(
          `${row.business_date}의 지점휴무 등록 자체를 삭제할까요?\n\n이 작업은 휴일영업이 아닙니다. 등록을 잘못한 경우에만 사용해주세요. 삭제하면 이 날짜는 일반 정상영업일로 돌아갑니다.`
        )
      ) {
        return;
      }

      setBusyDate(
        row.business_date
      );
      setErrorMessage("");
      setMessage("");

      try {
        const result =
          await supabase.rpc(
            "admin_set_store_day_normal",
            {
              p_business_date:
                row.business_date,
            }
          );

        if (result.error) {
          throw result.error;
        }

        setMessage(
          `[삭제 성공] ${row.business_date}의 지점휴무 등록을 삭제했습니다.`
        );
        await loadMonth(false);
      }
      catch (error) {
        setErrorMessage(
          getErrorMessage(
            error,
            "지점휴무 등록 삭제 중 오류가 발생했습니다."
          )
        );
      }
      finally {
        setBusyDate(null);
      }
    },
    [
      loadMonth,
      supabase,
    ]
  );

  const holidayCount =
    rows.filter(
      (row) =>
        row.day_status ===
        "store_holiday"
    ).length;
  const holidayOpenCount =
    rows.filter(
      (row) =>
        row.day_status ===
        "holiday_open"
    ).length;

  const monthRange =
    getMonthRange(
      selectedMonth
    );

  return (
    <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#ECEEF1] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays
              size={18}
              className="text-[#A50034]"
            />
            <h3 className="text-[17px] font-black tracking-[-0.025em] text-[#25282D]">
              지점 운영일 설정
            </h3>
          </div>

          <p className="mt-1 text-[12px] leading-5 text-[#92969D]">
            정상영업일은 별도 등록하지 않습니다. 지점휴무 등록일에 부득이 실적 입력이 필요한 경우 [휴일영업]으로 전환합니다. 휴일영업으로 전환해도 지점휴무 등록은 유지되며, 출근·실적 입력과 정상 일마감만 가능해집니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] font-black">
          <span className="rounded-full bg-[#F2F3F5] px-2.5 py-1 text-[#737881]">
            지점휴무 {holidayCount}일
          </span>
          <span className="rounded-full bg-[#FFF2E2] px-2.5 py-1 text-[#986219]">
            휴일영업 {holidayOpenCount}일
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-3 rounded-[16px] border border-[#ECEEF1] bg-[#FAFAFB] p-4 lg:grid-cols-[160px_minmax(150px,1fr)_minmax(150px,1fr)_minmax(180px,1.3fr)_auto] lg:items-end">
          <div>
            <label
              htmlFor="store-calendar-month"
              className="mb-1.5 block text-[10px] font-black text-[#686D75]"
            >
              조회월
            </label>
            <input
              id="store-calendar-month"
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                const nextMonth =
                  event.target.value;
                const nextRange =
                  getMonthRange(
                    nextMonth
                  );

                setSelectedMonth(
                  nextMonth
                );
                setStartDate(
                  nextRange.start
                );
                setEndDate(
                  nextRange.start
                );
              }}
              disabled={rangeBusy || busyDate !== null}
              className="h-[40px] w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#34383E] outline-none focus:border-[#8A8E95]"
            />
          </div>

          <div>
            <label
              htmlFor="store-holiday-start"
              className="mb-1.5 block text-[10px] font-black text-[#686D75]"
            >
              휴무 시작일
            </label>
            <input
              id="store-holiday-start"
              type="date"
              min={monthRange.start}
              max={monthRange.end}
              value={startDate}
              onChange={(event) => {
                const next =
                  event.target.value;
                setStartDate(next);
                if (
                  endDate < next
                ) {
                  setEndDate(next);
                }
              }}
              disabled={rangeBusy || busyDate !== null}
              className="h-[40px] w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#34383E] outline-none focus:border-[#8A8E95]"
            />
          </div>

          <div>
            <label
              htmlFor="store-holiday-end"
              className="mb-1.5 block text-[10px] font-black text-[#686D75]"
            >
              휴무 종료일
            </label>
            <input
              id="store-holiday-end"
              type="date"
              min={startDate || monthRange.start}
              max={monthRange.end}
              value={endDate}
              onChange={(event) =>
                setEndDate(
                  event.target.value
                )
              }
              disabled={rangeBusy || busyDate !== null}
              className="h-[40px] w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#34383E] outline-none focus:border-[#8A8E95]"
            />
          </div>

          <div>
            <label
              htmlFor="store-holiday-name"
              className="mb-1.5 block text-[10px] font-black text-[#686D75]"
            >
              휴무 사유
            </label>
            <input
              id="store-holiday-name"
              type="text"
              value={holidayName}
              onChange={(event) =>
                setHolidayName(
                  event.target.value
                )
              }
              disabled={rangeBusy || busyDate !== null}
              placeholder="예: 추석 연휴"
              className="h-[40px] w-full rounded-[10px] border border-[#DDE0E5] bg-white px-3 text-[12px] font-bold text-[#34383E] outline-none placeholder:text-[#B0B3B8] focus:border-[#8A8E95]"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              void registerHolidayRange()
            }
            disabled={
              rangeBusy ||
              busyDate !== null ||
              rangeValidation.checking ||
              rangeValidation.blockedItems.length > 0
            }
            className="inline-flex h-[40px] items-center justify-center gap-1.5 rounded-[10px] bg-[#A50034] px-4 text-[11px] font-black text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:bg-[#D7D9DE]"
          >
            {rangeBusy ? (
              <LoaderCircle
                size={14}
                className="animate-spin"
              />
            ) : (
              <Building2 size={14} />
            )}
            지점휴무 등록
          </button>
        </div>

        <div className="mt-3">
          {rangeValidation.checking ? (
            <p className="flex items-center gap-2 rounded-[13px] border border-[#E5E7EA] bg-[#FAFAFB] px-3.5 py-3 text-[11px] font-bold text-[#777C84]">
              <LoaderCircle size={14} className="animate-spin" />
              선택한 기간의 마감상태를 확인하고 있습니다.
            </p>
          ) : rangeValidation.error ? (
            <p className="flex items-start gap-2 rounded-[13px] border border-[#F1DFC0] bg-[#FFF9EF] px-3.5 py-3 text-[11px] font-bold leading-5 text-[#87621E]">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {rangeValidation.error}
            </p>
          ) : rangeValidation.blockedItems.length > 0 ? (
            <p className="flex items-start gap-2 rounded-[13px] border border-[#F0CDD3] bg-[#FFF5F6] px-3.5 py-3 text-[11px] font-bold leading-5 text-[#A50034]">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong className="block">등록 불가 · 변경할 수 없는 날짜 포함</strong>
                {rangeValidation.blockedItems.map(
                  (item) =>
                    `${item.businessDate} · ${item.reason}`
                ).join(" / ")}
              </span>
            </p>
          ) : (
            <p className="flex items-center gap-2 rounded-[13px] border border-[#D6E9DC] bg-[#F5FBF7] px-3.5 py-3 text-[11px] font-bold text-[#287348]">
              <CheckCircle2 size={14} />
              선택한 기간은 지점휴무로 등록할 수 있습니다.
            </p>
          )}
        </div>

        {(errorMessage || message) && (
          <div className="mt-3">
            {errorMessage ? (
              <p className="flex items-start gap-2 whitespace-pre-line rounded-[13px] border border-[#F0CDD3] bg-[#FFF5F6] px-3.5 py-3 text-[11px] font-bold leading-5 text-[#A50034]">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {errorMessage}
              </p>
            ) : message ? (
              <p className="flex items-center gap-2 rounded-[13px] border border-[#D6E9DC] bg-[#F5FBF7] px-3.5 py-3 text-[11px] font-bold text-[#287348]">
                <CheckCircle2 size={14} />
                {message}
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-[16px] border border-[#E5E7EA]">
          <div className="flex items-center justify-between border-b border-[#ECEEF1] bg-white px-4 py-3">
            <div>
              <p className="text-[12px] font-black text-[#44484E]">
                {selectedMonth} 운영일 예외
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-[#989CA3]">
                목록에 없는 날짜는 자동으로 정상영업일입니다.
              </p>
            </div>

            <span className="text-[10px] font-black text-[#777C84]">
              총 {rows.length}일
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-[126px] items-center justify-center bg-white">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold text-[#858A92]">
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                />
                운영일 조회 중
              </span>
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-white px-5 py-10 text-center">
              <CalendarDays
                size={22}
                className="mx-auto text-[#B7BAC0]"
              />
              <p className="mt-3 text-[12px] font-bold text-[#777C84]">
                등록된 지점휴무 또는 휴일영업이 없습니다.
              </p>
              <p className="mt-1 text-[10px] text-[#A0A4AA]">
                이 달은 모든 날짜가 기본적으로 정상영업일로 처리됩니다.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="border-b border-[#ECEEF1] bg-[#FAFAFB] text-[10px] font-black text-[#777C84]">
                    <th className="px-4 py-3 text-left">일자</th>
                    <th className="px-4 py-3 text-center">운영상태</th>
                    <th className="px-4 py-3 text-left">사유</th>
                    <th className="px-4 py-3 text-center">최근변경</th>
                    <th className="px-4 py-3 text-right" style={{ width: 300, minWidth: 300 }}>처리</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => {
                    const busy =
                      busyDate ===
                      row.business_date;
                    const isHoliday =
                      row.day_status ===
                      "store_holiday";

                    return (
                      <tr
                        key={row.business_date}
                        className="border-b border-[#F0F1F3] last:border-b-0"
                      >
                        <td className="px-4 py-3.5 text-[12px] font-black text-[#34383E]">
                          {formatDate(
                            row.business_date
                          )}
                          <span className="ml-2 text-[10px] font-bold text-[#A0A4AA]">
                            {row.business_date}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black",
                              isHoliday
                                ? "bg-[#F2F3F5] text-[#737881]"
                                : "bg-[#FFF2E2] text-[#986219]",
                            ].join(" ")}
                          >
                            {isHoliday ? (
                              <Building2 size={11} />
                            ) : (
                              <Store size={11} />
                            )}
                            {isHoliday
                              ? "지점휴무"
                              : "휴일영업"}
                          </span>
                          {!isHoliday && (
                            <p className="mt-1 text-[8px] font-bold text-[#9A7B43]">
                              지점휴무 등록 유지 · 실적입력 가능
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-[11px] font-bold text-[#686D75]">
                          {row.holiday_name ??
                            "-"}
                        </td>

                        <td className="px-4 py-3.5 text-center text-[10px] font-semibold text-[#989CA3]">
                          {formatUpdatedAt(
                            row.updated_at
                          )}
                        </td>

                        <td
                          className="px-4 py-3.5 text-right"
                          style={{
                            width: 300,
                            minWidth: 300,
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "minmax(108px, 1fr) minmax(90px, 0.85fr)",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            {isHoliday ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void setHolidayOpen(
                                    row
                                  )
                                }
                                disabled={busy || busyDate !== null || rangeBusy}
                                className="inline-flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[9px] px-3 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                  backgroundColor: "#986219",
                                  border: "1px solid #986219",
                                  color: "#FFFFFF",
                                }}
                              >
                                {busy ? (
                                  <LoaderCircle
                                    size={12}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Store size={12} />
                                )}
                                휴일영업
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  void setStoreHoliday(
                                    row
                                  )
                                }
                                disabled={busy || busyDate !== null || rangeBusy}
                                className="inline-flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[9px] px-3 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                  backgroundColor: "#FFFFFF",
                                  border: "1px solid #DDE0E5",
                                  color: "#62676F",
                                }}
                              >
                                {busy ? (
                                  <LoaderCircle
                                    size={12}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Building2 size={12} />
                                )}
                                지점휴무 복귀
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                void deleteHolidayRegistration(
                                  row
                                )
                              }
                              disabled={busy || busyDate !== null || rangeBusy}
                              className="inline-flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[9px] px-3 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-50"
                              style={{
                                backgroundColor: "#FFFFFF",
                                border: "1px solid #F0CDD3",
                                color: "#A50034",
                              }}
                            >
                              <Trash2 size={12} />
                              등록삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-[14px] border border-[#E5E7EA] bg-[#FAFAFB] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-black text-[#5F646C]">
              <CalendarDays size={13} />
              정상영업
            </p>
            <p className="mt-1 text-[10px] font-medium leading-5 text-[#8D9299]">
              목록에 없는 날짜입니다. 출근인원 선택과 일반 일마감을 진행합니다.
            </p>
          </div>

          <div className="rounded-[14px] border border-[#E5E7EA] bg-[#F7F8F9] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-black text-[#5F646C]">
              <Building2 size={13} />
              지점휴무
            </p>
            <p className="mt-1 text-[10px] font-medium leading-5 text-[#8D9299]">
              일마감을 하지 않는 전체 휴무일입니다. 근무일수와 영업일수에서 제외됩니다.
            </p>
          </div>

          <div className="rounded-[14px] border border-[#F1DFC0] bg-[#FFF9EF] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-black text-[#87621E]">
              <Store size={13} />
              휴일영업
            </p>
            <p className="mt-1 text-[10px] font-medium leading-5 text-[#9A7B43]">
              지점휴무 등록은 그대로 유지합니다. [휴일영업]으로 전환한 날짜만 출근 매니저 선택과 실적 입력이 가능하며, 실제 영업일 기준으로 일반 일마감을 진행합니다.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
