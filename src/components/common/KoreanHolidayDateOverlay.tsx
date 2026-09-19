"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import {
  getKoreanHoliday,
} from "@/lib/korean-holidays";


type CalendarCell = {
  date: Date;
  dateKey: string;
  day: number;
  isCurrentMonth: boolean;
};


type Position = {
  top: number;
  left: number;
};


const WEEK_LABELS = [
  "일",
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
];


function pad2(value: number) {
  return String(value).padStart(2, "0");
}


function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}


function parseDateKey(
  value: string | null | undefined
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value ?? ""
    );

  if (!match) {
    const today = new Date();
    return new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}


function monthTitle(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}


function getCalendarCells(
  viewDate: Date
): CalendarCell[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(
    year,
    month,
    1
  ).getDay();
  const currentMonthDays = new Date(
    year,
    month + 1,
    0
  ).getDate();
  const previousMonthDays = new Date(
    year,
    month,
    0
  ).getDate();

  return Array.from(
    { length: 42 },
    (_, index) => {
      const rawDay =
        index - firstDay + 1;
      let cellDate: Date;
      let day: number;
      let isCurrentMonth = true;

      if (rawDay <= 0) {
        day =
          previousMonthDays + rawDay;
        cellDate = new Date(
          year,
          month - 1,
          day
        );
        isCurrentMonth = false;
      }
      else if (
        rawDay > currentMonthDays
      ) {
        day =
          rawDay - currentMonthDays;
        cellDate = new Date(
          year,
          month + 1,
          day
        );
        isCurrentMonth = false;
      }
      else {
        day = rawDay;
        cellDate = new Date(
          year,
          month,
          day
        );
      }

      return {
        date: cellDate,
        dateKey:
          formatDateKey(cellDate),
        day,
        isCurrentMonth,
      };
    }
  );
}


function isDateInput(
  target: EventTarget | null
): target is HTMLInputElement {
  return (
    target instanceof HTMLInputElement &&
    target.type === "date"
  );
}


function isSelectable(
  input: HTMLInputElement,
  dateKey: string
) {
  if (
    input.disabled ||
    input.readOnly
  ) {
    return false;
  }

  if (
    input.min &&
    dateKey < input.min
  ) {
    return false;
  }

  if (
    input.max &&
    dateKey > input.max
  ) {
    return false;
  }

  return true;
}


function updateReactDateInput(
  input: HTMLInputElement,
  value: string
) {
  const descriptor =
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    );

  descriptor?.set?.call(
    input,
    value
  );
  input.dispatchEvent(
    new Event(
      "input",
      { bubbles: true }
    )
  );
  input.dispatchEvent(
    new Event(
      "change",
      { bubbles: true }
    )
  );
}


function resolvePosition(
  input: HTMLInputElement
): Position {
  const rect =
    input.getBoundingClientRect();
  const preferredWidth = 440;
  const actualWidth = Math.min(
    preferredWidth,
    Math.max(
      300,
      window.innerWidth - 24
    )
  );
  const estimatedHeight = 545;
  const margin = 12;

  let left = rect.left;

  if (
    left + actualWidth >
    window.innerWidth - margin
  ) {
    left = Math.max(
      margin,
      window.innerWidth -
        actualWidth -
        margin
    );
  }
  else {
    left = Math.max(
      margin,
      left
    );
  }

  const enoughBelow =
    rect.bottom +
      margin +
      estimatedHeight <=
    window.innerHeight;

  const top = enoughBelow
    ? rect.bottom + margin
    : Math.max(
        margin,
        rect.top -
          estimatedHeight -
          margin
      );

  return {
    top,
    left,
  };
}


export default function KoreanHolidayDateOverlay() {
  const [targetInput, setTargetInput] =
    useState<HTMLInputElement | null>(
      null
    );
  const [viewDate, setViewDate] =
    useState(
      () => new Date()
    );
  const [position, setPosition] =
    useState<Position>({
      top: 80,
      left: 80,
    });

  const selectedKey =
    targetInput?.value ?? "";

  const openForInput =
    useCallback(
      (
        input: HTMLInputElement
      ) => {
        if (
          input.disabled ||
          input.readOnly
        ) {
          return;
        }

        const selected =
          parseDateKey(
            input.value || null
          );

        setTargetInput(input);
        setViewDate(
          new Date(
            selected.getFullYear(),
            selected.getMonth(),
            1
          )
        );
        setPosition(
          resolvePosition(input)
        );
      },
      []
    );

  const close = useCallback(
    () => {
      setTargetInput(null);
    },
    []
  );

  useEffect(() => {
    const handlePointerDown =
      (event: PointerEvent) => {
        if (
          !isDateInput(
            event.target
          )
        ) {
          return;
        }

        event.preventDefault();
        openForInput(
          event.target
        );
      };

    const handleClick =
      (event: MouseEvent) => {
        if (
          !isDateInput(
            event.target
          )
        ) {
          return;
        }

        event.preventDefault();
      };

    const handleKeyDown =
      (event: KeyboardEvent) => {
        if (
          event.key === "Escape" &&
          targetInput
        ) {
          close();
          return;
        }

        if (
          isDateInput(
            event.target
          ) &&
          [
            "Enter",
            " ",
            "ArrowDown",
          ].includes(event.key)
        ) {
          event.preventDefault();
          openForInput(
            event.target
          );
        }
      };

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
      true
    );
    document.addEventListener(
      "click",
      handleClick,
      true
    );
    document.addEventListener(
      "keydown",
      handleKeyDown,
      true
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
        true
      );
      document.removeEventListener(
        "click",
        handleClick,
        true
      );
      document.removeEventListener(
        "keydown",
        handleKeyDown,
        true
      );
    };
  }, [
    close,
    openForInput,
    targetInput,
  ]);

  useEffect(() => {
    if (!targetInput) {
      return;
    }

    const reposition = () => {
      if (
        !document.contains(
          targetInput
        )
      ) {
        setTargetInput(null);
        return;
      }

      setPosition(
        resolvePosition(
          targetInput
        )
      );
    };

    window.addEventListener(
      "resize",
      reposition
    );
    window.addEventListener(
      "scroll",
      reposition,
      true
    );

    return () => {
      window.removeEventListener(
        "resize",
        reposition
      );
      window.removeEventListener(
        "scroll",
        reposition,
        true
      );
    };
  }, [targetInput]);

  const cells = useMemo(
    () =>
      getCalendarCells(
        viewDate
      ),
    [viewDate]
  );

  if (!targetInput) {
    return null;
  }

  const moveMonth =
    (offset: number) => {
      setViewDate(
        (current) =>
          new Date(
            current.getFullYear(),
            current.getMonth() +
              offset,
            1
          )
      );
    };

  const moveYear =
    (offset: number) => {
      setViewDate(
        (current) =>
          new Date(
            current.getFullYear() +
              offset,
            current.getMonth(),
            1
          )
      );
    };

  const selectDate =
    (dateKey: string) => {
      if (
        !isSelectable(
          targetInput,
          dateKey
        )
      ) {
        return;
      }

      updateReactDateInput(
        targetInput,
        dateKey
      );
      targetInput.focus();
      close();
    };

  const selectToday = () => {
    const todayKey =
      formatDateKey(
        new Date()
      );

    if (
      isSelectable(
        targetInput,
        todayKey
      )
    ) {
      selectDate(todayKey);
    }
  };

  return (
    <div
      className="fixed z-[2147483000] overflow-hidden rounded-[20px] border border-[#D8D8D8] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.25)]"
      style={{
        top: position.top,
        left: position.left,
        width:
          "min(440px, calc(100vw - 24px))",
      }}
      onPointerDown={
        (event) =>
          event.stopPropagation()
      }
      role="dialog"
      aria-label="날짜 선택 달력"
    >
      <div
        className="items-center gap-3 border-b border-[#ECECEC] px-5 py-5"
        style={{
          display: "grid",
          gridTemplateColumns:
            "96px minmax(0, 1fr) 96px",
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              moveYear(-1)
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E2E2] bg-white text-[#9A9A9A] transition hover:border-[#CFCFCF] hover:text-[#A50034]"
            aria-label="이전 해"
          >
            <ChevronsLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() =>
              moveMonth(-1)
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E2E2] bg-white text-[#9A9A9A] transition hover:border-[#CFCFCF] hover:text-[#A50034]"
            aria-label="이전 달"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="min-w-0 text-center">
          <p className="text-[21px] font-black tracking-[-0.04em] text-[#111111]">
            {monthTitle(viewDate)}
          </p>
          <p className="mt-1 text-[10px] font-black tracking-[0.22em] text-[#A50034]">
            LG PREMIUM DATE
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              moveMonth(1)
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E2E2] bg-white text-[#9A9A9A] transition hover:border-[#CFCFCF] hover:text-[#A50034]"
            aria-label="다음 달"
          >
            <ChevronRight size={16} />
          </button>

          <button
            type="button"
            onClick={() =>
              moveYear(1)
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E2E2] bg-white text-[#9A9A9A] transition hover:border-[#CFCFCF] hover:text-[#A50034]"
            aria-label="다음 해"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>

      <div className="px-5 pb-3 pt-4">
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(7, minmax(0, 1fr))",
          }}
        >
          {WEEK_LABELS.map(
            (label, index) => (
              <div
                key={label}
                className={[
                  "py-2 text-center text-[12px] font-black",
                  index === 0
                    ? "text-[#C8003A]"
                    : index === 6
                      ? "text-[#0068C9]"
                      : "text-[#9B9B9B]",
                ].join(" ")}
              >
                {label}
              </div>
            )
          )}
        </div>

        <div
          className="mt-1"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(7, minmax(0, 1fr))",
            rowGap: "6px",
          }}
        >
          {cells.map((cell) => {
            const holiday =
              getKoreanHoliday(
                cell.dateKey
              );
            const dayOfWeek =
              cell.date.getDay();
            const selected =
              selectedKey ===
              cell.dateKey;
            const selectable =
              isSelectable(
                targetInput,
                cell.dateKey
              );
            const isRed =
              Boolean(holiday) ||
              dayOfWeek === 0;
            const isBlue =
              !isRed &&
              dayOfWeek === 6;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() =>
                  selectDate(
                    cell.dateKey
                  )
                }
                disabled={!selectable}
                title={
                  holiday ??
                  undefined
                }
                className={[
                  "relative flex min-h-[56px] flex-col items-center justify-start rounded-[14px] px-0.5 pt-1.5 text-center transition",
                  selectable
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-35",
                  !selected &&
                  cell.isCurrentMonth
                    ? "hover:bg-[#FFF6F8]"
                    : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-9 min-w-9 items-center justify-center rounded-[12px] px-2 text-[14px] font-black tabular-nums transition",
                    selected
                      ? "shadow-[0_8px_20px_rgba(196,0,58,0.26)]"
                      : "",
                  ].join(" ")}
                  style={{
                    backgroundColor:
                      selected
                        ? "#C4003A"
                        : "transparent",
                    color:
                      selected
                        ? "#FFFFFF"
                        : !cell.isCurrentMonth
                          ? "#B9BDC3"
                          : isRed
                            ? "#C8003A"
                            : isBlue
                              ? "#0068C9"
                              : "#171717",
                    opacity:
                      cell.isCurrentMonth
                        ? 1
                        : 0.48,
                  }}
                >
                  {cell.day}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#ECECEC] bg-[#FCFCFC] px-5 py-3.5">
        <button
          type="button"
          onClick={close}
          className="h-10 rounded-[8px] border border-[#DADADA] bg-white px-4 text-[12px] font-black text-[#666666] transition hover:bg-[#F7F7F7]"
        >
          닫기
        </button>

        <div className="text-center text-[9px] font-bold text-[#A3A3A3]">
          공휴일·일요일 빨강 · 토요일 파랑
        </div>

        <button
          type="button"
          onClick={selectToday}
          className="h-10 rounded-[8px] bg-[#C4003A] px-5 text-[12px] font-black text-white shadow-[0_7px_18px_rgba(196,0,58,0.2)] transition hover:bg-[#A90032]"
        >
          오늘
        </button>
      </div>
    </div>
  );
}
