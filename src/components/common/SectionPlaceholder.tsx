type Props = {
  title: string;
  description: string;
  stage: string;
};

export default function SectionPlaceholder({
  title,
  description,
  stage,
}: Props) {
  return (
    <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
            WONSUNG DAILY
          </p>

          <h2 className="mt-2 text-[26px] font-bold tracking-[-0.04em] text-[#22252A]">
            {title}
          </h2>

          <p className="mt-3 max-w-[680px] text-[14px] leading-6 text-[#777C84]">
            {description}
          </p>
        </div>

        <span className="w-fit shrink-0 rounded-full bg-[#F1F2F4] px-3 py-1.5 text-[11px] font-bold text-[#62666E]">
          {stage}
        </span>
      </div>

      <div className="mt-8 rounded-[16px] border border-dashed border-[#D8DBE0] bg-[#FAFAFB] px-5 py-10 text-center">
        <p className="text-[14px] font-semibold text-[#777C84]">
          화면 구조 준비 완료
        </p>

        <p className="mt-2 text-[12px] text-[#9A9EA5]">
          해당 단계에서 Supabase 데이터와 실제 기능을 연결합니다.
        </p>
      </div>
    </section>
  );
}