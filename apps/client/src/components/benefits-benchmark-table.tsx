import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "./ui";

type BenefitsHeader = {
  title: string;
  subTitle?: string | undefined;
  type?: string | undefined;
};

type BenefitsResponse = {
  title: string;
  type?: string | undefined;
  dataValues?: (number | string)[] | undefined;
};

export type BenefitsQuestion = {
  id?: string | number | undefined;
  title: string;
  type?: string | undefined;
  dataValues?: (number | string)[] | undefined;
  nestedData?: BenefitsResponse[] | undefined;
};

function WinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 15 15"
      width="16"
    >
      <path
        d="M3.41667 5.41667H2.41667C1.97464 5.41667 1.55072 5.24107 1.23816 4.92851C0.925595 4.61595 0.75 4.19203 0.75 3.75C0.75 3.30797 0.925595 2.88405 1.23816 2.57149C1.55072 2.25893 1.97464 2.08333 2.41667 2.08333H3.41667M3.41667 5.41667V0.75H11.4167V5.41667M3.41667 5.41667C3.41667 6.47753 3.83809 7.49495 4.58824 8.24509C5.33838 8.99524 6.3558 9.41667 7.41667 9.41667C8.47753 9.41667 9.49495 8.99524 10.2451 8.24509C10.9952 7.49495 11.4167 6.47753 11.4167 5.41667M11.4167 5.41667H12.4167C12.8587 5.41667 13.2826 5.24107 13.5952 4.92851C13.9077 4.61595 14.0833 4.19203 14.0833 3.75C14.0833 3.30797 13.9077 2.88405 13.5952 2.57149C13.2826 2.25893 12.8587 2.08333 12.4167 2.08333H11.4167M2.08333 14.0833H12.75M6.08333 9.18994V10.7499C6.08333 11.1166 5.77 11.4033 5.43667 11.5566C4.65 11.9166 4.08333 12.9099 4.08333 14.0833M8.75 9.18994V10.7499C8.75 11.1166 9.06333 11.4033 9.39667 11.5566C10.1833 11.9166 10.75 12.9099 10.75 14.0833"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function NonWinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 15 15"
      width="16"
    >
      <path
        d="M14.0833 0.75L0.75 14.0833M14.0833 7.41667C14.0833 11.0986 11.0986 14.0833 7.41667 14.0833C3.73477 14.0833 0.75 11.0986 0.75 7.41667C0.75 3.73477 3.73477 0.75 7.41667 0.75C11.0986 0.75 14.0833 3.73477 14.0833 7.41667Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function isWinner(header: BenefitsHeader): boolean {
  return header.type?.endsWith("_No") !== true;
}

function headerTitle(title: string): string {
  return title
    .replace(/\s+Size Categories$/u, "")
    .replace(/\s+Employers$/u, "");
}

function HeaderIcon({ header }: { header: BenefitsHeader }) {
  return isWinner(header) ? (
    <WinnerIcon className="text-[#4c1d95]" />
  ) : (
    <NonWinnerIcon className="text-[#a78bfa]" />
  );
}

function HeaderItem({ header }: { header: BenefitsHeader }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center px-0.5 text-center">
      <HeaderIcon header={header} />
      <span className="mt-2 text-[10px] font-semibold leading-tight text-zinc-900">
        {headerTitle(header.title)}
      </span>
      <span className="mt-0.5 text-[8px] font-medium leading-tight text-zinc-500">
        {header.subTitle ?? (isWinner(header) ? "Winners" : "Non-Winners")}
      </span>
    </div>
  );
}

function isYesNoQuestion(responses: BenefitsResponse[]): boolean {
  const labels = responses.map(({ title }) => title.trim().toLowerCase());
  return labels.length === 2 && labels.includes("yes") && labels.includes("no");
}

function visibleResponses(question: BenefitsQuestion): BenefitsResponse[] {
  const responses = question.nestedData ?? [];
  if (!isYesNoQuestion(responses)) return responses;
  return responses.filter(({ title }) => title.trim().toLowerCase() === "yes");
}

function formatValue(
  value: number | string | undefined,
  type: string | undefined,
): string {
  if (value === undefined || value === "") return "—";
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return "—";
    if (normalized.toLowerCase() === "x") return "x";
    return normalized;
  }
  const displayed = Number.isInteger(value)
    ? String(value)
    : String(Math.round(value * 10) / 10);
  return type === "%" ? `${displayed}%` : displayed;
}

function ValueColumns({
  headers,
  response,
}: {
  headers: BenefitsHeader[];
  response: BenefitsResponse;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center">
      {headers.map((header, index) => (
        <div
          className={cn(
            "flex min-h-10 min-w-0 flex-1 items-center justify-center text-center text-[13px] font-semibold text-zinc-900 lg:text-sm",
            index > 0 && index % 2 === 0 && "border-l border-[#e9e4ff]",
          )}
          key={`${header.type ?? header.title}-${index}`}
        >
          {formatValue(response.dataValues?.[index], response.type)}
        </div>
      ))}
    </div>
  );
}

function MobileResponse({
  headers,
  response,
}: {
  headers: BenefitsHeader[];
  response: BenefitsResponse;
}) {
  return (
    <div className="rounded-2xl border border-[#e9e4ff] bg-[#f6f4ff] p-5">
      {response.title ? (
        <h3 className="mb-6 text-base font-bold text-zinc-900">
          {response.title}
        </h3>
      ) : null}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6">
        {headers.map((header, index) => (
          <div
            className={cn(
              "flex flex-col items-center text-center",
              index >= 2 && "border-t border-[#e9e4ff] pt-5",
            )}
            key={`${header.type ?? header.title}-${index}`}
          >
            <HeaderIcon header={header} />
            <span className="mt-2 text-xs font-semibold text-zinc-900">
              {headerTitle(header.title)}
            </span>
            <span className="mt-0.5 text-[10px] text-zinc-500">
              {header.subTitle ??
                (isWinner(header) ? "Winners" : "Non-Winners")}
            </span>
            <strong className="mt-2 text-sm text-zinc-900">
              {formatValue(response.dataValues?.[index], response.type)}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BenefitsQuestionRow({
  headers,
  question,
}: {
  headers: BenefitsHeader[];
  question: BenefitsQuestion;
}) {
  const [expanded, setExpanded] = useState(false);
  const responses = visibleResponses(question);
  const flatResponse =
    question.dataValues && question.dataValues.length > 0
      ? [{ title: "", type: question.type, dataValues: question.dataValues }]
      : [];
  const rows = responses.length > 0 ? responses : flatResponse;
  const expandable = rows.length > 0;
  const toggle = () => {
    if (expandable) setExpanded((value) => !value);
  };
  const disclosure = (children: ReactNode) => (
    <button
      aria-expanded={expanded}
      className="flex w-full items-start justify-between gap-8 px-5 py-6 text-left transition hover:bg-zinc-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
      onClick={toggle}
      type="button"
    >
      {children}
      {expandable ? (
        <ChevronDown
          className={cn(
            "mt-0.5 size-5 shrink-0 text-zinc-400 transition-transform duration-200",
            expanded && "rotate-180 text-zinc-600",
          )}
        />
      ) : null}
    </button>
  );
  return (
    <article className="border-t border-zinc-200 first:border-t-0">
      <div className="hidden md:block">
        {disclosure(
          <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-zinc-900">
            {question.title}
          </span>,
        )}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            expanded ? "opacity-100" : "opacity-0",
          )}
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="px-5 pb-7">
              <div className="rounded-2xl border border-[#e9e4ff] bg-[#f6f4ff] px-4 py-3">
                {rows.map((response, index) => (
                  <div
                    className={cn(
                      "flex min-h-14 items-center",
                      index > 0 && "border-t border-[#e9e4ff]",
                    )}
                    key={`${response.title}-${index}`}
                  >
                    <strong className="w-[100px] shrink-0 break-words px-2 text-sm text-zinc-900">
                      {response.title}
                    </strong>
                    <ValueColumns headers={headers} response={response} />
                    <div className="w-10 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        {disclosure(
          <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-zinc-900">
            {question.title}
          </span>,
        )}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            expanded ? "opacity-100" : "opacity-0",
          )}
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="grid gap-4 px-4 pb-6">
              {rows.map((response, index) => (
                <MobileResponse
                  headers={headers}
                  key={`${response.title}-${index}`}
                  response={response}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function BenefitsBenchmarkTable({
  headers,
  questions,
}: {
  headers: BenefitsHeader[];
  questions: BenefitsQuestion[];
}) {
  return (
    <section className="relative mt-6 rounded-[24px] border border-zinc-200 bg-white">
      <div className="sticky top-0 z-30 hidden rounded-t-[24px] border-b border-zinc-200 bg-white shadow-[0_12px_24px_rgba(255,255,255,0.98)] md:block">
        <div className="px-5 pb-5 pt-4">
          <span className="text-xs font-bold uppercase tracking-[0.05em] text-zinc-400">
            Metric Category
          </span>
        </div>
        <div className="flex items-center px-5 pb-8">
          <div className="w-[100px] shrink-0" />
          <div className="flex min-w-0 flex-1 items-start">
            {headers.map((header, index) => (
              <div
                className={cn(
                  "flex min-w-0 flex-1",
                  index > 0 && index % 2 === 0 && "border-l border-zinc-100",
                )}
                key={`${header.type ?? header.title}-${index}`}
              >
                <HeaderItem header={header} />
              </div>
            ))}
          </div>
          <div className="w-10 shrink-0" />
        </div>
      </div>
      <div>
        {questions.map((question, index) => (
          <BenefitsQuestionRow
            headers={headers}
            key={`${question.id ?? question.title}-${index}`}
            question={question}
          />
        ))}
      </div>
    </section>
  );
}
