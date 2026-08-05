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
import { toJpeg, toPng, toSvg } from "html-to-image";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
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

type DownloadFormat = "jpg" | "png" | "svg";

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
    // html-to-image types filter nodes as HTMLElement, but it walks childNodes
    // and also passes Text/Comment nodes that have no classList.
    filter: (node: HTMLElement) => {
      if (node === element) return true;
      const domNode: Node = node;
      return !(
        domNode instanceof Element &&
        domNode.classList.contains("download-exclude")
      );
    },
  };
  const dataUrl =
    format === "svg"
      ? await toSvg(element, options)
      : format === "jpg"
        ? await toJpeg(element, { ...options, quality: 0.95 })
        : await toPng(element, options);
  const anchor = document.createElement("a");
  anchor.download = `${filename}.${format}`;
  anchor.href = dataUrl;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

const responseQuestions = [
  "This organization's culture allows me to do my best work",
  "I typically go above and beyond for this organization",
  "I would endorse this organization's products/services",
  "I am typically enthusiastic about my work",
  "I feel satisfied with this organization",
  "I intend to remain at this organization for the foreseeable future",
  "I feel pride in saying I work for this organization",
  "I would endorse this organization as an employer",
  "I find purpose in my work",
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
  onDownload,
}: {
  label?: string;
  filename?: string;
  onDownload?: () => Promise<void> | void;
}) {
  const [downloading, setDownloading] = useState(false);
  return (
    <Button
      className="gap-2 rounded-md"
      disabled={downloading}
      onClick={async () => {
        setDownloading(true);
        try {
          if (onDownload) await onDownload();
          else
            downloadText(filename, [
              "Demo User",
              "Sanitized demonstration report data",
            ]);
        } finally {
          setDownloading(false);
        }
      }}
    >
      <Download className="size-4" /> {downloading ? "Preparing…" : label}
    </Button>
  );
}

function ImageDownloadMenu({
  targetRef,
  name,
  label = "Download Report",
  iconOnly = false,
  disabled = false,
  onDownloadXlsx,
}: {
  targetRef: { current: HTMLElement | null };
  name: string;
  label?: string;
  iconOnly?: boolean;
  disabled?: boolean;
  onDownloadXlsx?: () => Promise<void>;
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
            onClick={() => void download("jpg")}
            type="button"
          >
            Download as JPG
          </button>
          <button
            className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100"
            onClick={() => void download("svg")}
            type="button"
          >
            Download as SVG
          </button>
          {onDownloadXlsx ? (
            <button
              className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100"
              onClick={() => {
                setOpen(false);
                setDownloading(true);
                void onDownloadXlsx().finally(() => setDownloading(false));
              }}
              type="button"
            >
              Download report as XLSX
            </button>
          ) : null}
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
            onDownloadXlsx={() =>
              api.reports.downloadDetailedWorkbook(report.programId ?? "")
            }
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

function parsePercentageRange(value: string): [number, number] | null {
  const matches = value.match(/\d+(?:\.\d+)?/gu)?.map(Number) ?? [];
  if (matches.length !== 2) return null;
  const [minimum, maximum] = matches;
  if (
    minimum === undefined ||
    maximum === undefined ||
    minimum < 0 ||
    maximum > 100 ||
    minimum > maximum
  ) {
    return null;
  }
  return [minimum, maximum];
}

export function ResponsePatternsPage() {
  const report = useCategoryResults();
  const [enabled, setEnabled] = useState<boolean[]>([false, false, false]);
  const [ranges, setRanges] = useState(["", "", ""]);
  const [preview, setPreview] = useState(false);
  const parsedRanges = ranges.map(parsePercentageRange);
  const valid =
    enabled.some(Boolean) &&
    enabled.every((value, index) => !value || parsedRanges[index] !== null);
  const previewRows = useMemo(
    () =>
      report.categoryResults.filter((result) =>
        enabled.some((isEnabled, index) => {
          const range = parsedRanges[index];
          if (!isEnabled || !range) return false;
          const value = index === 2 ? result.disagreement : result.agreement;
          return value >= range[0] && value <= range[1];
        }),
      ),
    [enabled, parsedRanges, report.categoryResults],
  );
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
              disabled={!valid || !report.programId}
              onClick={() =>
                void api.reports.downloadResponsePatternsWorkbook(
                  report.programId ?? "",
                  enabled.flatMap((isEnabled, index) => {
                    const range = parsedRanges[index];
                    return isEnabled && range
                      ? [{
                          metric: index === 2 ? "disagreement" as const : "agreement" as const,
                          minimum: range[0],
                          maximum: range[1],
                        }]
                      : [];
                  }),
                )
              }
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
              {previewRows.length ? previewRows.map((result) => (
                <div
                  className="flex items-center justify-between gap-4 p-4 text-sm"
                  key={result.title}
                >
                  <span>{result.title}</span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      result.agreement >= 80
                        ? "bg-emerald-100 text-emerald-700"
                        : result.agreement >= 60
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700",
                    )}
                  >
                    {result.agreement}% agreement · {result.disagreement}% disagreement
                  </span>
                </div>
              )) : (
                <p className="p-5 text-sm text-zinc-500">
                  No categories fall within the selected ranges.
                </p>
              )}
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
  const program = useSelectedProgram();
  const [selectedCategory, setSelectedCategory] = useState(
    "Core Employee Experience",
  );
  const [metric, setMetric] = useState<"Agree" | "Neutral" | "Disagree">(
    "Agree",
  );
  const averages = useQuery({
    queryKey: ["annual-response-rate", program?.id],
    queryFn: () => api.reports.annualResponseRate(program?.id ?? ""),
    enabled: Boolean(program),
  });
  const categories = useQuery({
    queryKey: ["annual-categories", program?.id],
    queryFn: () => api.reports.annualCategories(program?.id ?? ""),
    enabled: Boolean(program),
  });
  const currentYear = String(program?.year ?? 2025);
  const previousYear = String((program?.year ?? 2025) - 1);
  const category = categories.data?.data.find(
    (item) => item.category.category === selectedCategory,
  );
  const snapshot = (year: string) => {
    const value = (category as Record<string, unknown> | undefined)?.[year];
    if (!value || typeof value !== "object" || !("data" in value)) return null;
    return value as {
      data: { ResponseCaption: string; percentage: number }[];
      questionIds: string[];
    };
  };
  const currentSnapshot = snapshot(currentYear);
  const previousSnapshot = snapshot(previousYear);
  const details = useQuery({
    queryKey: ["annual-details", program?.id, selectedCategory],
    queryFn: () =>
      api.reports.annualDetails(
        program?.id ?? "",
        selectedCategory,
        currentSnapshot?.questionIds ?? [],
        previousSnapshot?.questionIds ?? [],
      ),
    enabled: Boolean(program && currentSnapshot),
  });
  const averageData = averages.data?.data?.[0] ?? {};
  const currentAverage = Number(averageData[currentYear] ?? 0);
  const previousAverage = Number(averageData[previousYear] ?? 0);
  const percentage = (
    yearSnapshot: typeof currentSnapshot,
    caption: string,
  ) =>
    yearSnapshot?.data.find((item) => item.ResponseCaption === caption)
      ?.percentage ?? 0;
  return (
    <>
      <ReportHeader
        description="Compare current levels of workforce engagement and satisfaction with the scores from your previous employee survey."
        title="Annual Trends"
      />
      <div className="p-6">
        <Button
          className="gap-2"
          disabled={!program}
          onClick={() =>
            void api.reports.downloadAnnualWorkbook(program?.id ?? "")
          }
        >
          <Download className="size-4" /> Download Report
        </Button>
        <Card className="relative mt-6 overflow-hidden p-5 shadow-none">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Survey Average</h2>
            <button
              aria-label="Download survey average"
              className="p-1 text-zinc-500"
              onClick={() => void api.reports.downloadAnnualWorkbook(program?.id ?? "")}
            >
              <Download className="size-4" />
            </button>
          </div>
          <div className="mt-3 grid lg:grid-cols-2 lg:divide-x lg:divide-zinc-200">
            <DonutScore
              delta={currentAverage - previousAverage}
              value={currentAverage}
              year={Number(currentYear)}
            />
            <DonutScore value={previousAverage} year={Number(previousYear)} />
          </div>
        </Card>
        {categories.isPending ? (
          <StatePanel
            kind="loading"
            title="Loading annual trends"
            message="Comparing the current and previous survey years."
          />
        ) : categories.isError ? (
          <StatePanel
            kind="error"
            title="Annual trends unavailable"
            message={categories.error.message}
          />
        ) : (
          <>
            <div className="mt-6 flex gap-2 overflow-x-auto rounded-xl bg-violet-50 p-2">
              {categories.data.data.map((item) => (
                <button
                  className={cn(
                    "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium",
                    selectedCategory === item.category.category
                      ? "bg-violet-600 text-white"
                      : "bg-white text-zinc-700",
                  )}
                  key={item.category.category}
                  onClick={() => setSelectedCategory(item.category.category)}
                  type="button"
                >
                  {item.category.category}
                </button>
              ))}
            </div>
            <Card className="mt-4 p-5 shadow-none">
              <h2 className="font-semibold">{selectedCategory}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {[currentSnapshot, previousSnapshot].map((yearSnapshot, index) => {
                  const year = index === 0 ? currentYear : previousYear;
                  return (
                    <div className="rounded-xl bg-zinc-50 p-5" key={year}>
                      <h3 className="font-semibold">{year}</h3>
                      <div className="mt-4 flex flex-wrap gap-4 text-sm">
                        <span>{percentage(yearSnapshot, "Agree")}% Agreement</span>
                        <span>{percentage(yearSnapshot, "Neutral")}% Neutral</span>
                        <span>{percentage(yearSnapshot, "Disagree")}% Disagreement</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card className="mt-4 overflow-hidden shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-5">
                <h2 className="font-semibold">Question trends</h2>
                <div className="flex gap-2">
                  {(["Agree", "Neutral", "Disagree"] as const).map((item) => (
                    <button
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        metric === item
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-100 text-zinc-600",
                      )}
                      key={item}
                      onClick={() => setMetric(item)}
                      type="button"
                    >
                      {item === "Agree" ? "Agreement" : item === "Disagree" ? "Disagreement" : item}
                    </button>
                  ))}
                </div>
              </div>
              {details.isPending ? (
                <p className="p-5 text-sm text-zinc-500">Loading question trends…</p>
              ) : details.data?.data.length ? (
                <div className="divide-y divide-zinc-100">
                  {details.data.data.map((question) => {
                    const valueFor = (year: string) => {
                      const yearData = (question as Record<string, unknown>)[year];
                      if (!yearData || typeof yearData !== "object" || !("responses" in yearData)) return null;
                      const responses = (yearData as { responses: { ResponseCaption: string; percentage: number }[] }).responses;
                      return responses.find((response) => response.ResponseCaption === metric)?.percentage ?? 0;
                    };
                    return (
                      <div className="grid gap-2 p-4 text-sm md:grid-cols-[1fr_80px_80px]" key={question.questionId}>
                        <span>{question.question}</span>
                        <span className="font-semibold">{valueFor(currentYear)}%</span>
                        <span className="font-semibold text-zinc-500">{valueFor(previousYear) ?? "—"}{valueFor(previousYear) === null ? "" : "%"}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="p-5 text-sm text-zinc-500">No question-level comparison is available for this category.</p>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}

export function EmployeeVerbatimsPage() {
  const [filter, setFilter] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);
  const program = useSelectedProgram();
  const addToCart = useAppStore((state) => state.addToCart);
  const inCart = useAppStore((state) =>
    state.cart.some((item) => item.productId === "report-verbatims-sorted"),
  );
  const questions = [
    "What are the top two or three reasons people like working for this organization? (2000 character limit)",
    "What two or three things can this organization add or change to improve employee engagement and success? (2000 character limit)",
  ];
  const responses = [
    [
      "The people, the collaborative culture, and the opportunity to do meaningful work.",
      "Supportive colleagues and managers who trust employees to do their jobs.",
      "The benefits, flexibility, and strong reputation of the organization.",
      "I appreciate the intelligent people I work with and the variety of projects.",
      "The organization is stable, professional, and focused on its clients.",
      "My team communicates well and is willing to help when priorities change.",
    ],
    [
      "Continue improving communication between departments and offices.",
      "Provide clearer career paths and more visibility into advancement opportunities.",
      "Reduce unnecessary processes so teams can make decisions more quickly.",
      "Invest in modern tools and make training easier to access.",
      "Create more opportunities for employees to connect across the organization.",
      "Keep workloads sustainable during the busiest parts of the year.",
    ],
  ];
  if (selectedQuestion !== null) {
    const question = questions[selectedQuestion] ?? questions[0];
    return (
      <>
        <PageHeader
          breadcrumbs={[
            { label: "My Reports", path: routeMap.dashboard },
            { label: `Employee Verbatims ${program?.year ?? ""}`, path: routeMap.employeeVerbatims },
            { label: "Question Details" },
          ]}
          title="Question Details"
        />
        <div className="p-6">
          <button className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-violet-700" onClick={() => setSelectedQuestion(null)}>
            <ChevronLeft className="size-4" /> Back to Employee Verbatims
          </button>
          <Card className="overflow-hidden shadow-none">
            <div className="border-b border-zinc-200 p-5">
              <h2 className="text-base font-semibold leading-6">{question}</h2>
            </div>
            <div className="grid gap-3 bg-zinc-50 p-5">
              {(responses[selectedQuestion] ?? responses[0] ?? []).map((response, index) => (
                <blockquote className="rounded-xl border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-700" key={response}>
                  <span className="mr-2 text-xl leading-none text-violet-500">“</span>{response}
                  <footer className="mt-3 text-xs font-medium text-zinc-400">Employee response {index + 1}</footer>
                </blockquote>
              ))}
            </div>
          </Card>
        </div>
      </>
    );
  }
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
            <p className="mt-3 max-w-xl text-sm leading-6 text-violet-100">Sorting the employees&apos; open-ended responses by a demographic will allow you to better identify where the comments originated.</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-zinc-900">
            <p className="text-[13px] text-zinc-500">Price</p>
            <strong className="text-2xl">$ 425</strong>
            <p className="mt-3 text-xs font-medium text-zinc-700">Select one of these options</p>
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
            <DownloadReportButton onDownload={() => api.reports.downloadVerbatimsWorkbook(program?.id ?? "")} />
          </div>
          <div className="grid gap-3 p-5">
            {questions.map((question, index) => (
              <button className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left text-sm font-medium transition hover:border-violet-300 hover:bg-violet-50" key={question} onClick={() => setSelectedQuestion(index)}>
                <span className="flex-1 truncate">{question}</span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white shadow-sm"><ChevronRight className="size-4" /></span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

const benchmarks = [
  ["All Size Categories", 88],
  ["Small Employers", 93],
  ["Medium Employers", 91],
  ["Large Employers", 89],
  ["Major Employers", 87],
  ["Super Employers", 85],
] as const;

const benchmarkCategoryValues: Record<string, number[]> = {
  "Core Employee Experience": [91, 96, 94, 92, 90, 88],
  "Your Job": [89, 94, 92, 89, 87, 85],
  "Communication and Workplace Culture": [87, 93, 90, 87, 85, 84],
  "Relationship With Your Manager": [93, 96, 94, 93, 92, 91],
  "Training, Technology and Professional Development": [85, 91, 88, 86, 83, 79],
  "Diversity and Inclusion": [92, 94, 91, 92, 91, 91],
  "Leadership of this Organization": [87, 93, 91, 88, 84, 81],
  Leadership: [87, 93, 91, 88, 84, 81],
  "Employee Benefits": [86, 92, 89, 87, 84, 82],
  "Work-Life Balance": [85, 91, 88, 86, 83, 81],
  "Supplementary Questions": [84, 90, 87, 85, 82, 80],
};

type BenchmarkDetailRow = {
  id?: string | number | undefined;
  title: string;
  dataValues: (number | string)[];
};

type BenchmarkCategory = {
  title: string;
  dataValues: (number | string)[];
  nestedData: BenchmarkDetailRow[];
};

const benchmarkEmployerLabels = [
  "All Employers",
  "Small Employers",
  "Medium Employers",
  "Large Employers",
  "Major Employers",
  "Super Employers",
] as const;

function winnerValues(category: BenchmarkCategory): number[] {
  const pairedValues = category.dataValues.filter((_, index) => index % 2 === 0);
  const source = pairedValues.length >= 6
    ? pairedValues
    : benchmarkCategoryValues[category.title] ?? [88, 93, 91, 89, 87, 85];
  return source.slice(0, 6).map((value) =>
    typeof value === "number" ? value : Number.parseFloat(value) || 0,
  );
}

function BenchmarkCategoryCard({
  category,
  selected,
  onSelect,
}: {
  category: BenchmarkCategory;
  selected: boolean;
  onSelect: () => void;
}) {
  const values = winnerValues(category);
  return (
    <section
      aria-expanded={selected}
      className={cn(
        "relative flex min-h-[390px] cursor-pointer flex-col rounded-2xl border p-5 shadow-none transition",
        selected
          ? "border-violet-300 bg-violet-50"
          : "border-zinc-200 bg-white hover:border-violet-200 hover:bg-violet-50/30",
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="max-w-[350px] text-[15px] font-semibold">{category.title}</h2>
        <button
          aria-label={`Download ${category.title}`}
          className="download-exclude rounded p-1 text-zinc-500 hover:bg-white"
          onClick={(event) => {
            event.stopPropagation();
            downloadText(`${category.title}-benchmark.txt`, values.map((value, index) => `${benchmarkEmployerLabels[index]} Winners: ${value}%`));
          }}
        >
          <Download className="size-4" />
        </button>
      </div>
      <div className="mt-6 flex flex-1 items-end gap-2">
        {values.map((value, index) => (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={`${value}-${index}`}>
            <div className="flex h-[180px] items-end gap-1.5">
              <div className="flex h-full flex-col items-center justify-end gap-1">
                <span className="shrink-0 whitespace-nowrap text-xs">{value}%</span>
                <div
                  className="w-7 shrink-0 rounded-t-lg bg-violet-900"
                  style={{ height: `${Math.round((value / 100) * 160)}px` }}
                />
              </div>
              <div className="flex h-full flex-col items-center justify-end gap-1">
                <span className="shrink-0 text-xs">x</span>
                <div className="h-0 w-7 shrink-0 rounded-t-lg bg-violet-400" />
              </div>
            </div>
            <span className="min-h-6 text-center text-[10px] leading-3 text-zinc-600">
              {benchmarkEmployerLabels[index]}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-center gap-6 text-xs text-zinc-700">
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-violet-900" />Winners</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-violet-400" />Non-Winners</span>
      </div>
    </section>
  );
}

function BenchmarkDetailsTable({
  category,
  onClose,
}: {
  category: BenchmarkCategory;
  onClose: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-violet-300 bg-violet-50 shadow-sm">
      <div className="flex items-center justify-between px-6 py-5">
        <h2 className="font-semibold">{category.title}</h2>
        <button aria-label="Close" className="grid size-8 place-items-center rounded-full hover:bg-white" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-[300px] px-6 py-3 text-left" rowSpan={2}>Question</th>
              {benchmarkEmployerLabels.map((label) => (
                <th className="px-2 py-3 text-center" colSpan={2} key={label}>{label}</th>
              ))}
            </tr>
            <tr>
              {benchmarkEmployerLabels.flatMap((label) => [
                <th className="whitespace-nowrap px-2 py-3 font-medium" key={`${label}-winner`}><span className="inline-flex items-center gap-1"><i className="size-2 rounded-sm bg-violet-900" />Winners</span></th>,
                <th className="whitespace-nowrap px-2 py-3 font-medium" key={`${label}-non-winner`}><span className="inline-flex items-center gap-1"><i className="size-2 rounded-sm bg-violet-400" />Non-Winners</span></th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {category.nestedData.map((row, rowIndex) => (
              <tr className={cn("border-t border-violet-200", rowIndex % 2 === 0 && "bg-white/45")} key={row.id ?? row.title}>
                <td className="px-6 py-4 leading-5 text-zinc-600">{row.title}</td>
                {benchmarkEmployerLabels.flatMap((label, groupIndex) => {
                  const winners = row.dataValues[groupIndex * 2];
                  const nonWinners = row.dataValues[groupIndex * 2 + 1];
                  return [
                    <td className="px-2 py-4 text-center font-semibold" key={`${label}-winner`}>{typeof winners === "number" ? `${winners}%` : winners ?? "x"}</td>,
                    <td className="border-r border-violet-200 px-2 py-4 text-center font-semibold last:border-r-0" key={`${label}-non-winner`}>{typeof nonWinners === "number" ? `${nonWinners}%` : nonWinners ?? "x"}</td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BenchmarkDataPage() {
  const { categoryResults } = useCategoryResults();
  const program = useSelectedProgram();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const comparison = useQuery({
    queryKey: ["workforce-comparison", program?.id],
    queryFn: () => api.reports.workforceComparison(program?.id ?? ""),
    enabled: Boolean(program),
  });
  const categories: BenchmarkCategory[] = comparison.data?.data.data ?? categoryResults.map((item) => ({
    title: item.title,
    dataValues: (benchmarkCategoryValues[item.title] ?? [88, 93, 91, 89, 87, 85]).flatMap((value) => [value, "x"]),
    nestedData: [],
  }));
  const categoryRows = Array.from(
    { length: Math.ceil(categories.length / 2) },
    (_, index) => categories.slice(index * 2, index * 2 + 2),
  );
  return (
    <>
      <ReportHeader
        description="Compare your organization’s results against benchmark groups across key workplace categories."
        title="Benchmark Data"
      />
      <div className="p-6">
        <div className="flex justify-end"><DownloadReportButton onDownload={() => api.reports.downloadBenchmarkWorkbook(program?.id ?? "")} /></div>
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
        <div className="mt-6 grid gap-5">
          {categoryRows.map((row) => {
            const selected = row.find((category) => category.title === selectedCategory);
            return (
              <div className="grid gap-5" key={row.map(({ title }) => title).join("-")}>
                <div className="grid gap-5 lg:grid-cols-2">
                  {row.map((category) => (
                    <BenchmarkCategoryCard
                      category={category}
                      key={category.title}
                      onSelect={() => setSelectedCategory((current) => current === category.title ? null : category.title)}
                      selected={selectedCategory === category.title}
                    />
                  ))}
                </div>
                {selected ? <BenchmarkDetailsTable category={selected} onClose={() => setSelectedCategory(null)} /> : null}
              </div>
            );
          })}
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
const comparisonCohortKeys = [
  "AllYes",
  "SmallYes",
  "MediumYes",
  "LargeYes",
  "MajorYes",
  "SuperYes",
] as const;

const cohenComparisonValues: Record<string, number> = {
  "Core Employee Experience": 87,
  "Your Job": 83,
  "Communication and Workplace Culture": 83,
  "Relationship With Your Manager": 89,
  "Training, Technology and Professional Development": 81,
  "Diversity and Inclusion": 88,
  "Leadership of this Organization": 81,
  Leadership: 81,
  "Employee Benefits": 79,
  "Work-Life Balance": 77,
  "Supplementary Questions": 0,
};

function AgreementDonut({ value, label }: { value: number | string; label: string }) {
  const numeric = typeof value === "number" ? value : 0;
  return (
    <div className="grid justify-items-center gap-3">
      <div className="relative grid size-44 place-items-center rounded-full" style={{ background: `conic-gradient(#7c3aed ${numeric * 3.6}deg, #ede9fe 0deg)` }}>
        <div className="grid size-32 place-items-center rounded-full bg-white text-center shadow-inner">
          <div><strong className="block text-3xl">{typeof value === "number" && value > 0 ? `${value}%` : "x"}</strong><span className="text-[11px] text-zinc-500">Agreement</span></div>
        </div>
      </div>
      <span className="text-sm font-semibold text-zinc-700">{label}</span>
    </div>
  );
}

function ComparisonQuestionDetails({
  title,
  compareLabel,
  rows,
  loading,
  onClose,
}: {
  title: string;
  compareLabel: string;
  rows: { question: string; currentOrg: number; otherOrg: number }[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <section className="border-t border-zinc-200 bg-white">
      <div className="flex items-center justify-between gap-4 px-5 py-5">
        <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-zinc-700">
          <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-violet-900" />Your Results</span>
          <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-violet-400" />{compareLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={`Download ${title} comparison details`}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={() => downloadText(`${title}-comparison-details.txt`, rows.flatMap((row) => [row.question, `Your Results: ${row.currentOrg}%`, `${compareLabel}: ${row.otherOrg}%`, ""]))}
          >
            <Download className="size-4" />
          </button>
          <button aria-label="Close chart" className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="grid gap-4 border-t border-zinc-200 p-5">
          {Array.from({ length: 3 }, (_, index) => <div className="h-24 animate-pulse rounded-xl bg-zinc-100" key={index} />)}
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 border-t border-zinc-200">
          {rows.map((row) => (
            <div className="grid md:grid-cols-[380px_1fr]" key={row.question}>
              <p className="flex items-center border-b border-zinc-100 px-5 py-5 text-sm leading-6 text-zinc-600 md:border-b-0 md:border-r md:border-zinc-200">
                {row.question}
              </p>
              <div className="grid gap-3 p-5 md:px-10 md:py-6">
                {[
                  [row.currentOrg, "bg-violet-900", "Your Results"],
                  [row.otherOrg, "bg-violet-400", compareLabel],
                ].map(([value, color, label]) => {
                  const numericValue = Number(value);
                  return (
                    <div aria-label={`${label}: ${numericValue}%`} className="h-9 overflow-hidden rounded-xl bg-zinc-50" key={String(label)}>
                      {numericValue > 0 ? (
                        <div className={cn("flex h-full items-center rounded-r-xl px-3 text-[11px] font-semibold text-white", String(color))} style={{ width: `${numericValue}%` }}>
                          {numericValue}%
                        </div>
                      ) : <span className="flex h-full items-center px-3 text-xs text-zinc-500">x</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ComparisonDataPage() {
  const [active, setActive] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { categoryResults } = useCategoryResults();
  const program = useSelectedProgram();
  const categories = (categoryResults.length ? categoryResults.map(({ title }) => title) : Object.keys(cohenComparisonValues)).filter((title) => title !== "Supplementary Questions");
  const details = useQuery({
    queryKey: ["comparison-question-details", program?.id, selectedCategory, active],
    queryFn: () => api.reports.comparisonQuestions(
      program?.id ?? "",
      selectedCategory ?? "",
      comparisonCohortKeys[active] ?? "AllYes",
    ),
    enabled: Boolean(program && selectedCategory),
  });
  return (
    <>
      <ReportHeader
        description="Compare your survey results against other organizations in your industry and size."
        title="Comparison Data"
      />
      <div className="p-6">
        <div className="flex justify-end"><DownloadReportButton onDownload={() => api.reports.downloadBenchmarkWorkbook(program?.id ?? "")} /></div>
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
        <div className="mt-6 grid gap-5">
          {categories.map((title) => {
            const benchmark = benchmarkCategoryValues[title]?.[active] ?? (title === "Supplementary Questions" ? 0 : 88 - active);
            const selected = selectedCategory === title;
            return (
              <Card className={cn("overflow-hidden shadow-none transition", selected && "border-violet-300 shadow-md")} key={title}>
                <div
                  aria-expanded={selected}
                  className={cn("cursor-pointer transition", selected && "bg-violet-50")}
                  onClick={() => setSelectedCategory((current) => current === title ? null : title)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedCategory((current) => current === title ? null : title);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
                    <h2 className="font-semibold">{title}</h2>
                    <button
                      aria-label={`Download ${title}`}
                      className="rounded p-1 text-zinc-400 hover:bg-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadText(`${title}-comparison.txt`, [`Your Results: ${cohenComparisonValues[title] ?? 0}%`, `${comparisonTabs[active] ?? "All Winners"}: ${benchmark}%`]);
                      }}
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
                  <div className="grid gap-8 p-7 md:grid-cols-2 md:divide-x md:divide-zinc-200">
                    <AgreementDonut label="Your Results" value={cohenComparisonValues[title] ?? 0} />
                    <div className="md:pl-8"><AgreementDonut label={comparisonTabs[active] ?? "All Winners"} value={benchmark} /></div>
                  </div>
                </div>
                {selected ? (
                  <ComparisonQuestionDetails
                    compareLabel={comparisonTabs[active] ?? "All Winners"}
                    loading={details.isLoading}
                    onClose={() => setSelectedCategory(null)}
                    rows={details.data?.data.questionResponse ?? []}
                    title={title}
                  />
                ) : null}
              </Card>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-zinc-500">x – Insufficient data to provide meaningful feedback.</p>
      </div>
    </>
  );
}

const practiceQuestions = [
  ["Does your organization coordinate “Fun” activities?", "Yes", [100, 100, 100, 100, 100, 100]],
  ["Does your organization have a structured system for recognizing achievements, attendance, or safety goals?", "Yes", [86, 83, 80, 88, 89, 100]],
  ["Does your organization formally recognize individual employee milestones?", "Yes", [97, 96, 100, 95, 100, 100]],
  ["Do you have a strategy to recruit and retain a diverse workforce?", "Yes", [89, 91, 84, 91, 100, 80]],
  ["Do you have a strategy specifically focused on recruiting and retaining Generation Z employees?", "Yes", [69, 57, 48, 79, 100, 80]],
  ["Does your organization conduct preemployment screening?", "Yes", [96, 96, 92, 98, 100, 100]],
  ["Which preemployment tools does your organization use?", "Credit history", [61, 32, 74, 63, 78, 80]],
  ["Which preemployment tools does your organization use?", "Criminal background", [99, 95, 100, 100, 100, 100]],
  ["Which preemployment tools does your organization use?", "Driving records", [22, 23, 17, 23, 22, 40]],
  ["Which preemployment tools does your organization use?", "Drug testing", [16, 5, 9, 20, 33, 40]],
  ["Which preemployment tools does your organization use?", "Education verification", [88, 73, 87, 93, 100, 100]],
  ["Which preemployment tools does your organization use?", "Personality/behavioral assessment", [26, 23, 26, 23, 44, 40]],
  ["Which preemployment tools does your organization use?", "Professional reference", [84, 77, 91, 85, 89, 60]],
  ["Which preemployment tools does your organization use?", "Skills assessment", [63, 45, 65, 75, 56, 40]],
  ["Which preemployment tools does your organization use?", "Social media", [19, 27, 26, 13, 22, 0]],
  ["Which preemployment tools does your organization use?", "Work sample", [42, 41, 48, 43, 56, 0]],
] as const;

const metricTabs = [
  "All Winners",
  "All Non-Winners",
  "Small Winners (20–49 US Employees)",
  "Small Non-Winners",
  "Medium Winners (50–99 US Employees)",
  "Medium Non-Winners",
  "Large Winners (100–499 US Employees)",
  "Large Non-Winners",
  "Major Winners (500–999 US Employees)",
  "Major Non-Winners",
  "Super Winners (1,000 or more US Employees)",
  "Super Non-Winners",
];

export function BenefitsBestPracticesPage() {
  const [active, setActive] = useState(0);
  const program = useSelectedProgram();
  const showNonWinners = active % 2 === 1;
  return (
    <>
      <ReportHeader title="Benefits & Best Practices" />
      <div className="p-6">
        <div className="flex justify-end"><DownloadReportButton onDownload={() => api.reports.downloadBenefitsWorkbook(program?.id ?? "")} /></div>
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
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-xs">
              <thead className="bg-zinc-100 text-zinc-600"><tr><th className="w-[390px] px-5 py-4">Question / Response</th>{["All Employers", "Small", "Medium", "Large", "Major", "Super"].map((label) => <th className="px-3 py-4 text-center" key={label}>{label}</th>)}</tr></thead>
              <tbody>
                {practiceQuestions.map(([question, answer, values], index) => (
                  <tr className={cn("border-t border-zinc-100", index % 2 === 1 && "bg-zinc-50/60")} key={`${question}-${answer}`}>
                    <td className="px-5 py-4"><span className="block font-medium leading-5 text-zinc-800">{question}</span><span className="mt-1 block text-zinc-500">{answer}</span></td>
                    {values.map((value, valueIndex) => <td className="px-3 py-4 text-center font-semibold" key={valueIndex}>{showNonWinners ? <span className="text-zinc-400">x</span> : `${value}%`}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {showNonWinners ? <p className="mt-4 text-xs text-zinc-500">x – Insufficient non-winner data to provide meaningful feedback.</p> : null}
      </div>
    </>
  );
}

function ResponseDetailTable({ seed = 0 }: { seed?: number }) {
  const labels = ["Strongly Agree", "Agree", "Slightly Agree", "Slightly Disagree", "Disagree", "Strongly Disagree"];
  const groups = ["Gen Z", "Millennial", "Gen X", "Baby Boomer"];
  return (
    <div className="overflow-x-auto py-2">
      <table className="min-w-[690px] w-full text-xs">
        <thead><tr className="bg-zinc-100 text-zinc-600"><th className="px-3 py-3 text-left">Response</th>{groups.map((group) => <th className="px-3 py-3 text-center" key={group}>{group}</th>)}</tr></thead>
        <tbody>
          {labels.map((label, row) => (
            <tr className="border-t border-zinc-100" key={label}><td className="px-3 py-3 font-medium">{label}</td>{groups.map((group, column) => { const value = Math.max(1, ([45, 31, 12, 6, 4, 2][row] ?? 0) + ((seed + column * 2 + row) % 5) - 2); return <td className="px-3 py-3 text-center" key={group}><strong>{value}%</strong><span className="ml-1 text-zinc-400">({Math.max(5, Math.round(value * 1.9))})</span></td>; })}</tr>
          ))}
          <tr className="border-t-2 border-zinc-200 bg-violet-50"><td className="px-3 py-3 font-semibold">Question Total</td>{groups.map((group, index) => <td className="px-3 py-3 text-center font-semibold text-violet-700" key={group}>{[92, 91, 94, 93][index]}%</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

export function ResponseDetailPage() {
  const { categoryResults } = useCategoryResults();
  const program = useSelectedProgram();
  return (
    <>
      <ReportHeader
        description="This in-depth report reflects, by each survey question and for each demographic, the percentage of responses distributed across the entire 6-point scale."
        title="Response Detail"
      />
      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <FilterButton />
          <DownloadReportButton onDownload={() => api.reports.downloadResponseDetailWorkbook(program?.id ?? "")} />
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
                      <ResponseDetailTable seed={areaIndex} />
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
  const program = useSelectedProgram();
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
            <strong>Cohen &amp; Steers - Response Detail Report</strong>
            <span className="leading-5 text-zinc-500">
              RDR for Cohen &amp; Steers, using employee survey data from the Best
              Places Money Management 2025 program.
            </span>
            <span className="text-zinc-500">05/11/2025</span>
            <button
              className="h-9 rounded bg-red-600 px-3 text-xs font-semibold text-white"
              onClick={() => api.reports.downloadResponseDetailWorkbook(program?.id ?? "")}
            >
              DOWNLOAD
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
