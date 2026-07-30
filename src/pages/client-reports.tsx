import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Minus,
  ShoppingCart,
  SlidersHorizontal,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import { toPng, toSvg } from "html-to-image";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { routeMap } from "../app/metadata";
import { Button, Card, PageHeader, StatePanel, cn } from "../components/ui";
import { useAppStore, useSelectedProgram } from "../store/app-store";

type CategoryResult = {
  title: string;
  agreement: number;
  neutral: number;
  disagreement: number;
  questionRange: string[];
};

function categoryResultsFromResponse(
  data: Awaited<ReturnType<typeof api.reports.responseBreakdownBySection>>,
): CategoryResult[] {
  return data.data.flatMap((section) =>
    Object.entries(section).map(([title, responses]) => {
      const percentageFor = (caption: "Agree" | "Neutral" | "Disagree") => {
        const response = responses.find(
          (item) =>
            "ResponseCaption" in item && item.ResponseCaption === caption,
        );
        return response && "percentage" in response ? response.percentage : 0;
      };
      return {
        title,
        agreement: percentageFor("Agree"),
        neutral: percentageFor("Neutral"),
        disagreement: percentageFor("Disagree"),
        questionRange: (() => {
          const totals = responses.find((item) => "questionRange" in item);
          return totals && "questionRange" in totals
            ? totals.questionRange.map(String)
            : [];
        })(),
      };
    }),
  );
}

function useCategoryResults() {
  const program = useSelectedProgram();
  const report = useQuery({
    queryKey: ["employee-response-breakdown-by-section", program?.id],
    queryFn: () => api.reports.responseBreakdownBySection(program?.id ?? ""),
    enabled: Boolean(program),
  });
  return {
    ...report,
    categoryResults: report.data
      ? categoryResultsFromResponse(report.data)
      : [],
    programId: program?.id,
  };
}

type DownloadFormat = "png" | "svg";

async function downloadElement(
  element: HTMLElement | null,
  filename: string,
  format: DownloadFormat,
) {
  if (!element) return;
  const options = {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    skipFonts: true,
    filter: (node: HTMLElement) =>
      node === element || (!node.classList || !node.classList.contains("download-exclude")),
  };
  const dataUrl =
    format === "svg"
      ? await toSvg(element, options)
      : await toPng(element, options);
  const anchor = document.createElement("a");
  anchor.download = `${filename}.${format}`;
  anchor.href = dataUrl;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

const responseQuestions = [
  "The culture of this organization allows me to do my best work.",
  "I am willing to go above and beyond to help this organization succeed.",
  "I would endorse this organization’s products and services.",
  "I feel enthusiastic about the work I do.",
  "Overall, I am satisfied with this organization.",
  "I intend to remain with this organization for the foreseeable future.",
  "I am proud to tell others I work for this organization.",
  "I would recommend this organization as a great place to work.",
  "I find purpose in the work I do.",
];

function downloadText(filename: string, lines: string[]) {
  const url = URL.createObjectURL(
    new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useAppStore((state) => state.cart);
  const total = cart.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <aside
        aria-label="Cart"
        className="absolute inset-y-0 right-0 flex w-[350px] flex-col bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Close cart"
          className="absolute right-5 top-5 text-zinc-500"
          onClick={onClose}
        >
          <X className="size-5" />
        </button>
        <h2 className="px-6 pt-12 text-xl font-semibold">Cart</h2>
        <div className="flex-1 px-6 py-5">
          {cart.length ? (
            cart.map((item) => (
              <div
                className="border-b border-zinc-100 py-3 text-sm"
                key={item.productId}
              >
                <strong className="block">{item.name}</strong>
                <span className="text-zinc-500">
                  ${(item.priceCents / 100).toLocaleString()}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">Your cart is empty.</p>
          )}
        </div>
        <div className="border-t border-zinc-200 p-6">
          <div className="mb-5 flex justify-between">
            <span>Total:</span>
            <span>$ {Math.round(total / 100).toLocaleString()}</span>
          </div>
          {cart.length ? (
            <Link
              className="flex h-10 items-center justify-center rounded-md bg-violet-600 text-sm font-semibold text-white"
              to={routeMap.cart}
            >
              View Cart
            </Link>
          ) : (
            <button
              className="h-10 w-full bg-zinc-200 text-sm font-medium text-white"
              disabled
            >
              Total Amount is 0
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function ReportHeader({
  title,
  description,
  customBreadcrumb = false,
}: {
  title: string;
  description?: string;
  customBreadcrumb?: boolean;
}) {
  const program = useSelectedProgram();
  const [cartOpen, setCartOpen] = useState(false);
  const yearTitle = customBreadcrumb
    ? title
    : `${title} ${program?.year ?? ""}`.trim();
  return (
    <>
      <PageHeader
        actions={
          <Button
            className="gap-2 font-medium"
            onClick={() => setCartOpen(true)}
            variant="secondary"
          >
            <ShoppingCart className="size-4" /> Cart
          </Button>
        }
        breadcrumbs={[
          { label: "My Reports", path: routeMap.dashboard },
          { label: yearTitle },
        ]}
        {...(description ? { description } : {})}
        title={yearTitle}
      />
      <CartDrawer onClose={() => setCartOpen(false)} open={cartOpen} />
    </>
  );
}

function DownloadReportButton({
  label = "Download Report",
  filename = "demo-report.txt",
}: {
  label?: string;
  filename?: string;
}) {
  return (
    <Button
      className="gap-2 rounded-md"
      onClick={() =>
        downloadText(filename, [
          "Demo User",
          "Sanitized demonstration report data",
        ])
      }
    >
      <Download className="size-4" /> {label}
    </Button>
  );
}

function ImageDownloadMenu({
  targetRef,
  name,
  label = "Download Report",
  iconOnly = false,
  disabled = false,
}: {
  targetRef: { current: HTMLElement | null };
  name: string;
  label?: string;
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function download(format: DownloadFormat) {
    setOpen(false);
    setDownloading(true);
    try {
      await downloadElement(targetRef.current, name, format);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="download-exclude relative"
      onClick={(event) => event.stopPropagation()}
    >
      {iconOnly ? (
        <button
          aria-label={`Download ${name}`}
          className="p-1 text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
          disabled={disabled || downloading}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <Download className="size-4" />
        </button>
      ) : (
        <Button
          className="gap-2 rounded-md"
          disabled={disabled || downloading}
          onClick={() => setOpen((value) => !value)}
        >
          <Download className="size-4" /> {downloading ? "Preparing…" : label}
        </Button>
      )}
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl">
          <button
            className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100"
            onClick={() => void download("png")}
            type="button"
          >
            Download as PNG
          </button>
          <button
            className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100"
            onClick={() => void download("svg")}
            type="button"
          >
            Download as SVG
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FilterButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        className="gap-2"
        onClick={() => setOpen((value) => !value)}
        variant="secondary"
      >
        <SlidersHorizontal className="size-4" /> Filters
      </Button>
      {open ? (
        <div className="absolute left-0 top-12 z-20 w-64 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
          <label className="grid gap-2 text-xs font-semibold text-zinc-600">
            Compare by
            <select className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900">
              <option>All respondents</option>
              <option>Age Generation</option>
              <option>Department</option>
              <option>Job Level</option>
              <option>Workplace Setting</option>
            </select>
          </label>
          <Button className="mt-3 w-full" onClick={() => setOpen(false)}>
            Apply Filter
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PieChartCard({
  title,
  agreement,
  neutral,
  disagreement,
  selected,
  onSelect,
}: CategoryResult & { selected: boolean; onSelect: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const pie = `conic-gradient(#7c3aed 0 ${agreement}%, #a99bea ${agreement}% ${agreement + neutral}%, #ef4444 ${agreement + neutral}% 100%)`;
  return (
    <div
      ref={cardRef}
      aria-pressed={selected}
      className="cursor-pointer"
      onClick={() => {
        if (!selected) onSelect();
      }}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !selected) {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Card
        className={cn(
          "relative flex min-h-[388px] flex-col p-5 shadow-none",
          selected && "border-violet-200 bg-violet-50",
        )}
      >
        <div className="flex min-h-[46px] items-start justify-between gap-3">
          <div>
            <h2 className="max-w-[270px] text-[15px] font-semibold leading-5">
              {title}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">Category Averages</p>
          </div>
          <ImageDownloadMenu iconOnly name={title} targetRef={cardRef} />
        </div>
        <div
          className="mx-auto mt-5 grid size-[205px] place-items-center rounded-full"
          style={{ background: pie }}
        >
          <div className="grid size-[102px] place-items-center rounded-full bg-white text-center">
            <span>
              <strong className="block text-[28px] leading-8">
                {agreement}%
              </strong>
              <span className="text-[11px] text-zinc-500">Agreement</span>
            </span>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap justify-center gap-x-4 gap-y-1 pt-5 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-violet-600" />
            Agreement {agreement}%
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-[#a99bea]" />
            Neutral {neutral}%
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-red-500" />
            Disagreement {disagreement}%
          </span>
        </div>
      </Card>
    </div>
  );
}

type DetailReport = Awaited<ReturnType<typeof api.reports.responseBreakdown>>;

function DetailPanel({
  title,
  data,
  error,
  loading,
  onClose,
}: {
  title: string;
  data: DetailReport | undefined;
  error: string | undefined;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <section
      className="mt-5 rounded-2xl border-2 border-violet-200 bg-violet-50 p-5"
      id="detailed-results-breakdown"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zinc-950">{title}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Question-level response details
          </p>
        </div>
        <button
          aria-label="Close question details"
          className="rounded-md p-2 text-zinc-500 hover:bg-white hover:text-zinc-900"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>
      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">Loading question details…</p>
      ) : null}
      {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
      {!loading && !error && data?.data.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          No question details are available.
        </p>
      ) : null}
      {!loading && !error && data?.data.length ? (
        <div className="mt-5 divide-y divide-violet-100">
          {data.data.map((question) => (
            <div
              className="py-4 first:pt-0 last:pb-0"
              key={question.questionId}
            >
              <p className="text-sm font-medium text-zinc-800">
                {question.question}
              </p>
              <div
                className="mt-3 flex h-8 overflow-hidden rounded-lg bg-white"
                role="img"
                aria-label={`${question.question} response distribution`}
              >
                {question.responses.map((response) => {
                  const percentage =
                    response.percent <= 1
                      ? response.percent * 100
                      : response.percent;
                  return percentage > 0 ? (
                    <div
                      className="flex items-center justify-center text-[10px] font-semibold text-white"
                      key={response.ResponseCaption}
                      style={{
                        backgroundColor: response.colorCode,
                        width: `${Math.min(100, percentage)}%`,
                      }}
                    >
                      {Math.round(percentage)}%
                    </div>
                  ) : null;
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                {question.responses.map((response) => {
                  const percentage =
                    response.percent <= 1
                      ? response.percent * 100
                      : response.percent;
                  return (
                    <span key={response.ResponseCaption}>
                      {response.ResponseCaption}: {Math.round(percentage)}% (
                      {response.numberOfResponses} responses)
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function DetailedResultsPage() {
  const report = useCategoryResults();
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const selectedResult = report.categoryResults.find(
    (result) => result.title === selectedTitle,
  );
  const detailReport = useQuery({
    queryKey: [
      "employee-response-breakdown",
      report.programId,
      selectedResult?.title,
      selectedResult?.questionRange,
    ],
    queryFn: () =>
      api.reports.responseBreakdown(
        report.programId ?? "",
        selectedResult?.questionRange ?? [],
      ),
    enabled: Boolean(report.programId && selectedResult),
  });
  return (
    <>
      <ReportHeader
        description="Filter survey feedback by various demographics within your respondent population and dig into employee perspectives of each of the nine focus areas of the workplace."
        title="Detailed Results"
      />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <FilterButton />
          <ImageDownloadMenu
            disabled={!report.data || report.isPending}
            name={`detailed-results-${report.programId ?? "demo"}`}
            targetRef={reportRef}
          />
        </div>
        <div ref={reportRef}>
          {report.isPending ? (
            <StatePanel
              kind="loading"
              title="Loading detailed results"
              message="Preparing category averages for the selected program."
            />
          ) : report.isError ? (
            <StatePanel
              kind="error"
              title="Detailed results unavailable"
              message={report.error.message}
              action={
                <Button onClick={() => void report.refetch()}>Try again</Button>
              }
            />
          ) : report.data.isConfidential ? (
            <StatePanel
              kind="empty"
              title="Results are confidential"
              message={report.data.message}
            />
          ) : report.categoryResults.length === 0 ? (
            <StatePanel
              kind="empty"
              title="No responses yet"
              message={report.data.message}
            />
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {report.categoryResults.map((result) => (
                  <PieChartCard
                    key={result.title}
                    {...result}
                    onSelect={() => setSelectedTitle(result.title)}
                    selected={result.title === selectedTitle}
                  />
                ))}
              </div>
              {selectedResult ? (
                <DetailPanel
                  data={detailReport.data}
                  error={
                    detailReport.isError
                      ? detailReport.error.message
                      : undefined
                  }
                  loading={detailReport.isPending}
                  onClose={() => setSelectedTitle(null)}
                  title={selectedResult.title}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}

const patternConfigs = [
  {
    title: "High % Agreement",
    description:
      "Download a report that highlights responses that have high percentage of agreement. WRG recommends the 80–100% range.",
    placeholder: "e.g., 80–100%",
  },
  {
    title: "Moderate % Agreement",
    description:
      "Download a report that highlights responses that have a moderate percentage of agreement. WRG recommends the 60–79% range.",
    placeholder: "e.g., 60–79%",
  },
  {
    title: "High % Disagreement",
    description:
      "Download a report that highlights responses that have a high percentage of disagreement. WRG recommends the 10–20% range.",
    placeholder: "e.g., 10–20%",
  },
];

export function ResponsePatternsPage() {
  const [enabled, setEnabled] = useState<boolean[]>([false, false, false]);
  const [ranges, setRanges] = useState(["", "", ""]);
  const [preview, setPreview] = useState(false);
  const valid =
    enabled.some(Boolean) &&
    enabled.every((value, index) => !value || ranges[index]?.trim());
  return (
    <>
      <ReportHeader
        description="Set custom parameters for high and low survey scores to generate a color-coded report highlighting workplace strengths and opportunities for improvement."
        title="Response Patterns"
      />
      <div className="p-6">
        <Card className="p-5 shadow-none">
          <div className="grid gap-5 lg:grid-cols-3">
            {patternConfigs.map((config, index) => (
              <div
                className="flex min-h-[254px] flex-col rounded-xl bg-zinc-100 p-5"
                key={config.title}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[16px] font-semibold">{config.title}</h2>
                  <button
                    aria-label={`Enable ${config.title}`}
                    aria-pressed={enabled[index]}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition",
                      enabled[index] ? "bg-violet-600" : "bg-zinc-300",
                    )}
                    onClick={() =>
                      setEnabled((values) =>
                        values.map((value, itemIndex) =>
                          itemIndex === index ? !value : value,
                        ),
                      )
                    }
                  >
                    <span
                      className={cn(
                        "absolute top-1 size-4 rounded-full bg-white transition",
                        enabled[index] ? "left-6" : "left-1",
                      )}
                    />
                  </button>
                </div>
                <p className="mt-3 flex-1 text-[13px] leading-5 text-zinc-500">
                  {config.description}
                </p>
                <label className="border-t border-zinc-300 pt-4 text-xs font-medium text-zinc-500">
                  Percentage
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-500"
                    disabled={!enabled[index]}
                    onChange={(event) =>
                      setRanges((values) =>
                        values.map((value, itemIndex) =>
                          itemIndex === index ? event.target.value : value,
                        ),
                      )
                    }
                    placeholder={config.placeholder}
                    value={ranges[index]}
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <Button
              className="gap-2"
              disabled={!valid}
              onClick={() => downloadText("response-patterns-demo.txt", ranges)}
              variant="secondary"
            >
              <Download className="size-4" /> Download Report
            </Button>
            <Button disabled={!valid} onClick={() => setPreview(true)}>
              Preview the Report
            </Button>
          </div>
        </Card>
        {preview ? (
          <Card className="mt-5 overflow-hidden shadow-none">
            <div className="border-b border-zinc-200 p-5">
              <h2 className="font-semibold">Response Pattern Preview</h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {responseQuestions.slice(0, 5).map((question, index) => (
                <div
                  className="flex items-center justify-between gap-4 p-4 text-sm"
                  key={question}
                >
                  <span>{question}</span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      index < 2
                        ? "bg-emerald-100 text-emerald-700"
                        : index < 4
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700",
                    )}
                  >
                    {index < 2
                      ? "High agreement"
                      : index < 4
                        ? "Moderate agreement"
                        : "High disagreement"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function DonutScore({
  value,
  year,
  delta,
}: {
  value: number;
  year: number;
  delta?: number;
}) {
  return (
    <div className="grid flex-1 place-items-center px-8 py-9">
      <div
        className="relative grid size-[238px] place-items-center rounded-full"
        style={{
          background: `conic-gradient(#7c3aed 0 ${value}%, #eee ${value}% 100%)`,
        }}
      >
        <div className="grid size-[168px] place-items-center rounded-full bg-white text-center">
          <span>
            <strong className="block text-[42px] leading-none">{value}%</strong>
            <span className="mt-2 block text-sm text-zinc-500">{year}</span>
            {delta ? (
              <span className="mt-3 inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500">
                {delta}% vs last year
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AnnualTrendsPage() {
  return (
    <>
      <ReportHeader
        description="Compare current levels of workforce engagement and satisfaction with the scores from your previous employee survey."
        title="Annual Trends"
      />
      <div className="p-6">
        <DownloadReportButton filename="annual-trends-demo.txt" />
        <Card className="relative mt-6 overflow-hidden p-5 shadow-none">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Survey Average</h2>
            <button
              aria-label="Download survey average"
              className="p-1 text-zinc-500"
              onClick={() =>
                downloadText("survey-average-demo.txt", [
                  "2025 82%",
                  "2024 83%",
                ])
              }
            >
              <Download className="size-4" />
            </button>
          </div>
          <div className="mt-3 grid lg:grid-cols-2 lg:divide-x lg:divide-zinc-200">
            <DonutScore delta={-1} value={82} year={2025} />
            <DonutScore value={83} year={2024} />
          </div>
        </Card>
      </div>
    </>
  );
}

export function EmployeeVerbatimsPage() {
  const [filter, setFilter] = useState("");
  const addToCart = useAppStore((state) => state.addToCart);
  const inCart = useAppStore((state) =>
    state.cart.some((item) => item.productId === "report-verbatims-sorted"),
  );
  const questions = [
    "What are the top two or three reasons people like working for this organization? (2000 character limit)",
    "What two or three things can this organization add or change to improve employee engagement and success? (2000 character limit)",
  ];
  return (
    <>
      <ReportHeader
        description="Any responses to open-ended survey questions are contained in this report"
        title="Employee Verbatims"
      />
      <div className="p-6">
        <section className="grid min-h-[225px] gap-6 rounded-2xl bg-violet-600 p-7 text-white md:grid-cols-[160px_minmax(0,1fr)_230px] md:items-center">
          <div className="mx-auto grid size-32 place-items-center rounded-full bg-white/15">
            <Filter className="size-14" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Sorting your report</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-violet-100">
              Sorting the employees&apos; open-ended responses by a demographic
              will allow you to better identify where the comments originated
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 text-zinc-900">
            <p className="text-[13px] text-zinc-500">Price</p>
            <strong className="text-2xl">$ 425</strong>
            <select
              className="mt-3 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              onChange={(event) => setFilter(event.target.value)}
              value={filter}
            >
              <option value="">Select filtering report</option>
              <option>Age Generation</option>
              <option>Department</option>
              <option>Job Level</option>
            </select>
            <Button
              className="mt-3 w-full"
              disabled={!filter || inCart}
              onClick={() =>
                addToCart({
                  productId: "report-verbatims-sorted",
                  name: "Sorted Employee Verbatims",
                  priceCents: 42500,
                })
              }
            >
              {inCart ? "Added to Cart" : "Add to Cart"}
            </Button>
          </div>
        </section>
        <Card className="mt-6 overflow-hidden shadow-none">
          <div className="flex items-center justify-between border-b border-zinc-200 p-5">
            <h2 className="font-semibold">Question Details</h2>
            <DownloadReportButton filename="employee-verbatims-demo.txt" />
          </div>
          <div className="grid gap-3 p-5">
            {questions.map((question, index) => (
              <details className="group rounded-xl bg-zinc-100" key={question}>
                <summary className="flex cursor-pointer items-center gap-4 p-5 text-sm font-medium">
                  <span className="flex-1">{question}</span>
                  <ChevronRight className="size-5 transition group-open:rotate-90" />
                </summary>
                <div className="border-t border-zinc-200 px-5 py-4 text-sm leading-6 text-zinc-600">
                  {index === 0
                    ? "The supportive team, flexible working options, and meaningful projects make this a rewarding place to work."
                    : "Continue improving cross-team communication and make career-development paths easier to understand."}
                </div>
              </details>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

const benchmarks = [
  ["All Size Categories", 87],
  ["Small Employers", 92],
  ["Medium Employers", 90],
  ["Large Employers", 88],
  ["Major Employers", 86],
  ["Super Employers", 84],
] as const;

function BenchmarkCategoryCard({
  title,
  base,
}: {
  title: string;
  base: number;
}) {
  const values = [base, base + 5, base + 3, base + 1, base - 1, base - 3];
  return (
    <Card className="relative min-h-[390px] p-5 shadow-none">
      <div className="flex items-start justify-between gap-4">
        <h2 className="max-w-[350px] text-[15px] font-semibold">{title}</h2>
        <button
          aria-label={`Download ${title}`}
          className="text-zinc-500"
          onClick={() =>
            downloadText(
              `${title}-benchmark-demo.txt`,
              values.map((value) => `${value}%`),
            )
          }
        >
          <Download className="size-4" />
        </button>
      </div>
      <div className="mt-8 flex h-[250px] items-end justify-around border-b border-zinc-200 px-2">
        {values.map((value, index) => (
          <div
            className="flex h-full w-12 flex-col justify-end text-center"
            key={`${value}-${index}`}
          >
            <span className="mb-1 text-xs font-semibold">{value}%</span>
            <div
              className="w-full rounded-t-lg bg-violet-600"
              style={{ height: `${value}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-6 text-center text-[9px] leading-3 text-zinc-500">
        {["All", "Small", "Medium", "Large", "Major", "Super"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </Card>
  );
}

export function BenchmarkDataPage() {
  const { categoryResults } = useCategoryResults();
  return (
    <>
      <ReportHeader
        description="Compare your organization’s survey results to workplace award winners across employer size categories."
        title="Benchmark Data"
      />
      <div className="p-6">
        <DownloadReportButton filename="benchmark-data-demo.txt" />
        <Card className="mt-6 p-5 shadow-none">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {benchmarks.map(([label, value]) => (
              <div
                className="rounded-xl bg-zinc-100 p-4 text-center"
                key={label}
              >
                <h2 className="min-h-10 text-[13px] font-semibold">{label}</h2>
                <p className="mt-3 text-xs text-zinc-500">Survey Average</p>
                <strong className="mt-1 block text-2xl">{value}%</strong>
                <div className="mt-3 flex justify-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Check className="size-4" /> Winners
                  </span>
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle className="size-4" /> x
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {categoryResults.map((item, index) => (
            <BenchmarkCategoryCard
              base={Math.max(72, 89 - index)}
              key={item.title}
              title={item.title}
            />
          ))}
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          x – Insufficient data to provide meaningful feedback.
        </p>
      </div>
    </>
  );
}

const comparisonTabs = [
  "All Winners",
  "Small Winners",
  "Medium Winners",
  "Large Winners",
  "Major Winners",
  "Super Winners",
];

export function ComparisonDataPage() {
  const [active, setActive] = useState(0);
  return (
    <>
      <ReportHeader
        description="Compare your organization’s results against benchmark groups by employer size."
        title="Comparison Data"
      />
      <div className="p-6">
        <DownloadReportButton filename="comparison-data-demo.txt" />
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-violet-50 p-3">
          <button
            aria-label="Previous comparison group"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-zinc-500"
            onClick={() => setActive((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {comparisonTabs.map((tab, index) => (
              <button
                className={cn(
                  "h-10 rounded-lg px-2 text-xs font-medium",
                  active === index
                    ? "bg-violet-600 text-white"
                    : "bg-white text-zinc-600",
                )}
                key={tab}
                onClick={() => setActive(index)}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            aria-label="Next comparison group"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-zinc-500"
            onClick={() =>
              setActive((value) =>
                Math.min(comparisonTabs.length - 1, value + 1),
              )
            }
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-6 gap-3">
          {comparisonTabs.map((tab) => (
            <div
              className="h-9 animate-pulse rounded-full bg-zinc-200"
              key={tab}
            />
          ))}
        </div>
        <Card className="mt-6 min-h-[430px] p-6 shadow-none">
          <div className="h-6 w-52 animate-pulse rounded bg-zinc-200" />
          <div className="mt-12 grid gap-10 md:grid-cols-2 md:divide-x md:divide-zinc-200">
            {[0, 1].map((item) => (
              <div className="grid place-items-center" key={item}>
                <div className="size-56 animate-pulse rounded-full bg-zinc-200" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

const practiceQuestions = [
  ["Does your organization coordinate “Fun” activities?", 86, 61],
  [
    "Does your organization have a structured system for recognizing achievements, attendance, or safety goals?",
    78,
    53,
  ],
  [
    "Does your organization formally recognize individual employee milestones?",
    91,
    72,
  ],
  ["Do you have a strategy to recruit and retain a diverse workforce?", 84, 65],
  [
    "Does your organization offer flexible or hybrid work arrangements?",
    89,
    74,
  ],
  [
    "Does your organization provide paid time for volunteer activities?",
    57,
    34,
  ],
  [
    "Does your organization offer tuition or professional certification assistance?",
    73,
    49,
  ],
  [
    "Does your organization provide a formal employee wellness program?",
    81,
    58,
  ],
] as const;

const metricTabs = [
  "All Winners",
  "All Non-Winners",
  "Small Winners (20–49)",
  "Medium Winners (50–99)",
  "Large Winners (100–499)",
  "Major Winners (500–999)",
  "Super Winners (1000+)",
];

export function BenefitsBestPracticesPage() {
  const [active, setActive] = useState(0);
  return (
    <>
      <ReportHeader title="Benefits & Best Practices" />
      <div className="p-6">
        <DownloadReportButton filename="benefits-best-practices-demo.txt" />
        <Card className="mt-6 overflow-hidden shadow-none">
          <div className="border-b border-zinc-200 p-5">
            <p className="mb-3 text-[11px] font-semibold tracking-wider text-zinc-500">
              METRIC CATEGORY
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {metricTabs.map((tab, index) => (
                <button
                  className={cn(
                    "flex min-w-[150px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
                    active === index
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-zinc-200 bg-white text-zinc-600",
                  )}
                  key={tab}
                  onClick={() => setActive(index)}
                >
                  {tab.includes("Non") ? (
                    <Minus className="size-4" />
                  ) : (
                    <Trophy className="size-4" />
                  )}{" "}
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 p-5">
            {practiceQuestions.map(([question, winner, nonWinner]) => (
              <details className="group rounded-xl bg-zinc-100" key={question}>
                <summary className="flex cursor-pointer items-center gap-4 p-5 text-sm font-medium">
                  <span className="flex-1">{question}</span>
                  <ChevronDown className="size-5 transition group-open:rotate-180" />
                </summary>
                <div className="grid gap-3 border-t border-zinc-200 bg-white p-5 sm:grid-cols-2">
                  <div className="rounded-lg bg-emerald-50 p-4">
                    <span className="text-xs text-zinc-500">
                      Winning organizations
                    </span>
                    <strong className="mt-1 block text-2xl text-emerald-700">
                      {winner}%
                    </strong>
                  </div>
                  <div className="rounded-lg bg-zinc-100 p-4">
                    <span className="text-xs text-zinc-500">
                      Non-winning organizations
                    </span>
                    <strong className="mt-1 block text-2xl">
                      {nonWinner}%
                    </strong>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function DistributionChart() {
  const values = [3, 4, 7, 12, 29, 45];
  return (
    <div className="grid grid-cols-6 gap-3 pt-4 text-center">
      {values.map((value, index) => (
        <div key={value}>
          <div className="flex h-36 items-end rounded-lg bg-zinc-100 p-1">
            <div
              className="w-full rounded-md bg-violet-500"
              style={{ height: `${Math.max(value * 2, 8)}%` }}
            />
          </div>
          <strong className="mt-2 block text-sm">{value}%</strong>
          <span className="text-[10px] text-zinc-500">{index + 1}</span>
        </div>
      ))}
    </div>
  );
}

export function ResponseDetailPage() {
  const { categoryResults } = useCategoryResults();
  return (
    <>
      <ReportHeader
        description="This in-depth report reflects, by each survey question and for each demographic, the percentage of responses distributed across the entire 6-point scale."
        title="Response Detail"
      />
      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <FilterButton />
          <DownloadReportButton filename="response-detail-demo.txt" />
        </div>
        <span className="mt-4 inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
          Filter: Age Generation
        </span>
        <div className="mt-5 grid gap-3">
          {categoryResults.map((area, areaIndex) => (
            <details
              className="group rounded-xl border border-zinc-200 bg-white"
              key={area.title}
            >
              <summary className="flex cursor-pointer items-center justify-between p-5 font-semibold">
                <span>{area.title}</span>
                <span className="grid size-8 place-items-center rounded-full border border-zinc-300">
                  <ChevronDown className="size-4 transition group-open:rotate-180" />
                </span>
              </summary>
              <div className="grid gap-2 border-t border-zinc-200 bg-zinc-50 p-4">
                {(areaIndex === 0
                  ? responseQuestions
                  : responseQuestions.slice(0, 4)
                ).map((question) => (
                  <details
                    className="group/question rounded-lg bg-white"
                    key={question}
                  >
                    <summary className="flex cursor-pointer items-center gap-3 p-4 text-sm">
                      <span className="flex-1">{question}</span>
                      <ChevronRight className="size-4 transition group-open/question:rotate-90" />
                    </summary>
                    <div className="border-t border-zinc-100 px-4 pb-5">
                      <DistributionChart />
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}

export function KeyImpactAnalysisPage() {
  return (
    <>
      <ReportHeader
        customBreadcrumb
        description="This report identifies key motivators of employee engagement within your unique population. This information is vital to knowing what workplace attributes are most important to retain your top talent and drive high productivity among all staff."
        title="Key Impact Analysis 2025 (Demo)"
      />
      <div className="p-6">
        <DownloadReportButton filename="key-impact-analysis-demo.txt" />
        <Card className="mt-10 min-h-[520px] shadow-none">
          <div />
        </Card>
      </div>
    </>
  );
}

export function CustomReportsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "My Reports", path: routeMap.dashboard },
          { label: "Custom Reports" },
        ]}
        title="Custom Reports"
      />
      <div className="p-6">
        <p className="mb-6 max-w-4xl text-sm leading-6 text-zinc-500">
          In addition to the standard reporting package offered, more in-depth
          reporting is available. For information about advanced reporting,
          contact{" "}
          <a
            className="font-semibold text-violet-600"
            href="mailto:SurveyPro@workforcerg.com"
          >
            SurveyPro@workforcerg.com
          </a>
          .
        </p>
        <Card className="overflow-hidden shadow-none">
          <div className="grid grid-cols-[1fr_1.4fr_130px_100px] gap-4 bg-zinc-100 p-4 text-xs font-semibold text-zinc-500">
            <span>Report Name</span>
            <span>Description</span>
            <span>Upload Date</span>
            <span>Action</span>
          </div>
          <div className="grid grid-cols-[1fr_1.4fr_130px_100px] items-center gap-4 p-4 text-sm">
            <strong>Demo Organization - Response Detail Report</strong>
            <span className="leading-5 text-zinc-500">
              Response Detail Report using sanitized employee survey data from
              the Demo Workplace 2025 program.
            </span>
            <span className="text-zinc-500">05/12/2025</span>
            <button
              className="h-9 rounded bg-red-600 px-3 text-xs font-semibold text-white"
              onClick={() =>
                downloadText("demo-custom-report.txt", [
                  "Sanitized Demo Organization response detail report",
                ])
              }
            >
              DOWNLOAD
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
