import CardPerformanceOverview from "@/components/card/CardPerformanceOverview";


type PageProps = {
  searchParams:
    Promise<{
      date?: string;
    }>;
};


function getKstTodayString() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
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
        part.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type ===
        "day"
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "기준일을 계산하지 못했습니다."
    );
  }

  return `${year}-${month}-${day}`;
}


function normalizeReportDate(
  value:
    string | undefined
) {
  if (
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return value;
  }

  return getKstTodayString();
}


export default async function CardPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const reportDate =
    normalizeReportDate(
      params.date
    );

  return (
    <CardPerformanceOverview
      reportDate={
        reportDate
      }
    />
  );
}