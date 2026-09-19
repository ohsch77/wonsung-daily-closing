"use client";


export type AnalyticsLineChartPoint = {
  key: string;
  label: string;
  values: Record<
    string,
    number | null
  >;
};


export type AnalyticsLineChartSeries = {
  key: string;
  label: string;
  color: string;
};


type AnalyticsLineChartProps = {
  points: AnalyticsLineChartPoint[];
  series: AnalyticsLineChartSeries[];
  axisFormatter: (
    value: number
  ) => string;
  valueFormatter: (
    value: number
  ) => string;
  selectedKey?: string;
  onSelectKey?: (
    key: string
  ) => void;
  emptyMessage?: string;
};


export default function AnalyticsLineChart({
  points,
  series,
  axisFormatter,
  valueFormatter,
  selectedKey,
  onSelectKey,
  emptyMessage =
    "선택한 기간에 표시할 실적이 없습니다.",
}: AnalyticsLineChartProps) {
  const width = 920;
  const height = 310;

  const padding = {
    left: 74,
    right: 24,
    top: 28,
    bottom: 52,
  };

  const validValues =
    points.flatMap(
      (point) =>
        series.flatMap(
          (item) => {
            const value =
              point.values[
                item.key
              ];

            return value ===
                null ||
              !Number.isFinite(
                value
              )
              ? []
              : [value];
          }
        )
    );

  const hasData =
    validValues.length > 0;

  const rawMin =
    hasData
      ? Math.min(
          0,
          ...validValues
        )
      : 0;

  const rawMax =
    hasData
      ? Math.max(
          0,
          ...validValues
        )
      : 1;

  const rawRange =
    rawMax - rawMin;

  const extra =
    rawRange === 0
      ? Math.max(
          1,
          Math.abs(
            rawMax
          ) * 0.1
        )
      : rawRange * 0.1;

  const min =
    rawMin < 0
      ? rawMin - extra
      : 0;

  const max =
    rawMax + extra;

  const plotWidth =
    width -
    padding.left -
    padding.right;

  const plotHeight =
    height -
    padding.top -
    padding.bottom;

  const xAt = (
    index: number
  ) => {
    if (
      points.length <= 1
    ) {
      return (
        padding.left +
        plotWidth / 2
      );
    }

    return (
      padding.left +
      index /
        (points.length - 1) *
        plotWidth
    );
  };

  const yAt = (
    value: number
  ) => {
    if (max === min) {
      return (
        padding.top +
        plotHeight / 2
      );
    }

    return (
      padding.top +
      (max - value) /
        (max - min) *
        plotHeight
    );
  };

  const yTicks =
    Array.from(
      { length: 5 },
      (_, index) => {
        const ratio =
          index / 4;

        return (
          max -
          ratio *
            (max - min)
        );
      }
    );

  const labelStep =
    points.length <= 12
      ? 1
      : points.length <= 20
        ? 2
        : 5;

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 px-1">
          {series.map(
            (item) => (
              <div
                key={
                  item.key
                }
                className="flex items-center gap-2 text-[10px] font-black text-[#656A72]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      item.color,
                  }}
                />
                {item.label}
              </div>
            )
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[760px] w-full"
          role="img"
          aria-label="실적 추이 선형 차트"
        >
          {yTicks.map(
            (
              tick,
              index
            ) => {
              const y =
                yAt(tick);

              return (
                <g
                  key={`${tick}-${index}`}
                >
                  <line
                    x1={
                      padding.left
                    }
                    x2={
                      width -
                      padding.right
                    }
                    y1={y}
                    y2={y}
                    stroke="#ECEEF1"
                    strokeWidth="1"
                  />

                  <text
                    x={
                      padding.left -
                      10
                    }
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fontWeight="700"
                    fill="#8C9198"
                  >
                    {axisFormatter(
                      tick
                    )}
                  </text>
                </g>
              );
            }
          )}

          {min < 0 &&
            max > 0 && (
              <line
                x1={
                  padding.left
                }
                x2={
                  width -
                  padding.right
                }
                y1={yAt(0)}
                y2={yAt(0)}
                stroke="#AEB2B8"
                strokeWidth="1.2"
              />
            )}

          {series.map(
            (item) => {
              const linePoints =
                points.flatMap(
                  (
                    point,
                    index
                  ) => {
                    const value =
                      point.values[
                        item.key
                      ];

                    if (
                      value ===
                        null ||
                      !Number.isFinite(
                        value
                      )
                    ) {
                      return [];
                    }

                    return [
                      {
                        x:
                          xAt(
                            index
                          ),
                        y:
                          yAt(
                            value
                          ),
                      },
                    ];
                  }
                );

              if (
                linePoints.length ===
                0
              ) {
                return null;
              }

              return (
                <polyline
                  key={
                    item.key
                  }
                  fill="none"
                  stroke={
                    item.color
                  }
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={linePoints
                    .map(
                      (point) =>
                        `${point.x},${point.y}`
                    )
                    .join(" ")}
                />
              );
            }
          )}

          {points.map(
            (
              point,
              index
            ) => {
              const x =
                xAt(index);
              const selected =
                point.key ===
                selectedKey;

              return (
                <g
                  key={
                    point.key
                  }
                >
                  {series.map(
                    (item) => {
                      const value =
                        point.values[
                          item.key
                        ];

                      if (
                        value ===
                          null ||
                        !Number.isFinite(
                          value
                        )
                      ) {
                        return null;
                      }

                      return (
                        <circle
                          key={
                            item.key
                          }
                          cx={x}
                          cy={yAt(
                            value
                          )}
                          r={
                            selected
                              ? 5.5
                              : 3.8
                          }
                          fill={
                            selected
                              ? item.color
                              : "#FFFFFF"
                          }
                          stroke={
                            item.color
                          }
                          strokeWidth={
                            selected
                              ? 2.5
                              : 2
                          }
                          className={
                            onSelectKey
                              ? "cursor-pointer"
                              : ""
                          }
                          onClick={() => {
                            onSelectKey?.(
                              point.key
                            );
                          }}
                        >
                          <title>
                            {`${point.label} · ${item.label}: ${valueFormatter(
                              value
                            )}`}
                          </title>
                        </circle>
                      );
                    }
                  )}

                  {index %
                    labelStep ===
                    0 ||
                  index ===
                    points.length -
                      1 ? (
                    <text
                      x={x}
                      y={
                        height -
                        18
                      }
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight={
                        selected
                          ? "900"
                          : "700"
                      }
                      fill={
                        selected
                          ? "#A50034"
                          : "#858A92"
                      }
                      className={
                        onSelectKey
                          ? "cursor-pointer"
                          : ""
                      }
                      onClick={() => {
                        onSelectKey?.(
                          point.key
                        );
                      }}
                    >
                      {
                        point.label
                      }
                    </text>
                  ) : null}
                </g>
              );
            }
          )}

          {!hasData && (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              fontSize="13"
              fontWeight="800"
              fill="#A1A5AB"
            >
              {emptyMessage}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
