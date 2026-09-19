"use client";

export type AnalyticsBarChartItem = {
  key: string;
  label: string;
  value: number | null;
  subLabel?: string;
};

export default function AnalyticsBarChart({
  items,
  valueFormatter,
  onSelectKey,
  selectedKey,
}: {
  items: AnalyticsBarChartItem[];
  valueFormatter: (value: number) => string;
  onSelectKey?: (key: string) => void;
  selectedKey?: string;
}) {
  const values = items
    .map((item) => item.value)
    .filter((value): value is number =>
      value !== null && Number.isFinite(value)
    );

  const max = values.length > 0
    ? Math.max(...values.map((value) => Math.abs(value)), 1)
    : 1;

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = item.value === null
          ? 0
          : Math.max(2, Math.min(100, Math.abs(item.value) / max * 100));
        const selected = item.key === selectedKey;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectKey?.(item.key)}
            className={[
              "grid w-full grid-cols-[92px_minmax(0,1fr)_120px] items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition",
              onSelectKey ? "cursor-pointer hover:bg-[#FFF8FA]" : "cursor-default",
              selected ? "bg-[#FFF5F8]" : "bg-white",
            ].join(" ")}
          >
            <div className="min-w-0">
              <p className={[
                "truncate text-[11px] font-black",
                selected ? "text-[#A50034]" : "text-[#41464D]",
              ].join(" ")}>
                {item.label}
              </p>
              {item.subLabel && (
                <p className="mt-0.5 truncate text-[9px] font-semibold text-[#A0A4AA]">
                  {item.subLabel}
                </p>
              )}
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-[#F0F1F3]">
              <div
                className="h-full rounded-full bg-[#A50034] transition-all duration-300"
                style={{ width: `${width}%` }}
              />
            </div>

            <p className="text-right text-[10px] font-black tabular-nums text-[#4A4F56]">
              {item.value === null ? "-" : valueFormatter(item.value)}
            </p>
          </button>
        );
      })}

      {items.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-[#DDE0E5] px-4 py-8 text-center text-[11px] font-bold text-[#9A9EA5]">
          비교할 매니저 실적이 없습니다.
        </div>
      )}
    </div>
  );
}
