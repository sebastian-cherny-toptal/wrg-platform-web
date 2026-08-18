import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  ShoppingCart,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  api,
  type ReportQueryFilter,
  type ResponsePatternRanges,
  type SurveyFilter,
} from "../api/client";
import { routeMap } from "../app/metadata";
import { BenefitsBenchmarkTable } from "../components/benefits-benchmark-table";
import { ImageDownloadMenu } from "../components/image-download-menu";
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

function useCategoryResults(queryFilter: ReportQueryFilter = {}) {
  const program = useSelectedProgram();
  const report = useQuery({
    queryKey: [
      "employee-response-breakdown-by-section",
      program?.id,
      queryFilter,
    ],
    queryFn: () =>
      api.reports.responseBreakdownBySection(program?.id ?? "", queryFilter),
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
  onDownload,
}: {
  label?: string;
  onDownload: () => Promise<void> | void;
}) {
  const [downloading, setDownloading] = useState(false);
  return (
    <Button
      className="gap-2 rounded-md"
      disabled={downloading}
      onClick={async () => {
        setDownloading(true);
        try {
          await onDownload();
        } finally {
          setDownloading(false);
        }
      }}
    >
      <Download className="size-4" /> {downloading ? "Preparing…" : label}
    </Button>
  );
}

type SelectedFilter = SurveyFilter["options"][number] & {
  questionId: string;
};

function selectedFilterKey(filter: SelectedFilter) {
  return JSON.stringify([filter.questionId, filter.label]);
}

function useMobileFilterLayout() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1024,
  );

  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 1024);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return mobile;
}

export function DetailedResultsFilters({
  filters,
  selectedFilters,
  loading,
  error,
  onToggle,
}: {
  filters: SurveyFilter[];
  selectedFilters: SelectedFilter[];
  loading: boolean;
  error?: string | undefined;
  onToggle: (filter: SelectedFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [openMobileCategories, setOpenMobileCategories] = useState<string[]>(
    [],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const mobile = useMobileFilterLayout();
  const selectedKeys = new Set(selectedFilters.map(selectedFilterKey));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    if (!mobile) document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobile, open]);

  const activeFilter =
    activeCategory === null ? undefined : filters[activeCategory];

  return (
    <div className="relative w-full lg:w-auto" ref={rootRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Filters${selectedFilters.length ? ` (${selectedFilters.length})` : ""}`}
        className="w-full gap-2 lg:w-auto"
        onClick={() => setOpen((value) => !value)}
        variant="secondary"
      >
        <Filter className="size-4" /> Filters
        {selectedFilters.length ? (
          <span className="text-violet-600">({selectedFilters.length})</span>
        ) : null}
      </Button>
      {open && !mobile ? (
        <div
          aria-label="Detailed results filters"
          className="absolute left-0 top-12 z-40 flex w-[min(900px,calc(100vw-4rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
          role="dialog"
        >
          <div className="w-64 shrink-0 border-r border-zinc-200 py-2">
            {loading ? (
              <p className="px-4 py-3 text-sm text-zinc-500">
                Loading filters…
              </p>
            ) : error ? (
              <p className="px-4 py-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : (
              filters.map((filter, index) => (
                <button
                  aria-pressed={activeCategory === index}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-violet-50 hover:text-violet-600",
                    activeCategory === index && "bg-violet-50 text-violet-600",
                  )}
                  key={filter.questionId}
                  onClick={() => setActiveCategory(index)}
                  onMouseEnter={() => setActiveCategory(index)}
                  type="button"
                >
                  {filter.label}
                  <ChevronRight className="size-4 shrink-0" />
                </button>
              ))
            )}
          </div>
          <div className="max-h-[450px] min-h-32 flex-1 overflow-y-auto py-2">
            {activeFilter ? (
              activeFilter.options.length ? (
                activeFilter.options.map((option) => {
                  const selection = {
                    ...option,
                    questionId: activeFilter.questionId,
                  };
                  const selected = selectedKeys.has(
                    selectedFilterKey(selection),
                  );
                  return (
                    <button
                      aria-pressed={selected}
                      className="group flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50"
                      key={option.label}
                      onClick={() => onToggle(selection)}
                      type="button"
                    >
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded border border-zinc-300",
                          selected && "border-violet-600 bg-violet-600",
                        )}
                      >
                        {selected ? (
                          <Check className="size-3 text-white" />
                        ) : null}
                      </span>
                      <span
                        className={cn(selected && "font-bold text-violet-600")}
                      >
                        {option.label}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="px-5 py-4 text-sm italic text-zinc-400">
                  No options available
                </p>
              )
            ) : (
              <div className="grid min-h-32 place-items-center px-5 text-center text-sm text-zinc-400">
                <span>
                  <Filter className="mx-auto mb-2 size-6 opacity-30" />
                  Select a category to view filters
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {open && mobile
        ? createPortal(
            <div
              aria-label="Detailed results filters"
              aria-modal="true"
              className="fixed inset-0 z-[100] flex flex-col bg-white"
              role="dialog"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900">
                    Filters
                  </h2>
                  {selectedFilters.length ? (
                    <p className="mt-1 text-xs text-violet-600">
                      {selectedFilters.length} selected
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label="Close filters"
                  className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  <X className="size-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pb-28">
                {loading ? (
                  <p className="px-6 py-5 text-sm text-zinc-500">
                    Loading filters…
                  </p>
                ) : error ? (
                  <p className="px-6 py-5 text-sm text-red-600" role="alert">
                    {error}
                  </p>
                ) : filters.length ? (
                  filters.map((filter) => {
                    const expanded = openMobileCategories.includes(
                      filter.questionId,
                    );
                    return (
                      <section
                        className="border-b border-zinc-200"
                        key={filter.questionId}
                      >
                        <button
                          aria-expanded={expanded}
                          className="flex w-full items-center justify-between px-6 py-5 text-left font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
                          onClick={() =>
                            setOpenMobileCategories((current) =>
                              expanded
                                ? current.filter(
                                    (questionId) =>
                                      questionId !== filter.questionId,
                                  )
                                : [...current, filter.questionId],
                            )
                          }
                          type="button"
                        >
                          <span>{filter.label}</span>
                          {expanded ? (
                            <ChevronDown className="size-5 rotate-180 text-zinc-500" />
                          ) : (
                            <ChevronDown className="size-5 text-zinc-500" />
                          )}
                        </button>
                        {expanded ? (
                          <div className="grid gap-1 px-3 pb-5">
                            {filter.options.length ? (
                              filter.options.map((option) => {
                                const selection = {
                                  ...option,
                                  questionId: filter.questionId,
                                };
                                const selected = selectedKeys.has(
                                  selectedFilterKey(selection),
                                );
                                return (
                                  <button
                                    aria-pressed={selected}
                                    className={cn(
                                      "flex w-full items-center gap-4 rounded-lg px-5 py-4 text-left text-sm transition-colors",
                                      selected
                                        ? "bg-violet-50 font-bold text-violet-600"
                                        : "text-zinc-900 hover:bg-zinc-50",
                                    )}
                                    key={option.label}
                                    onClick={() => onToggle(selection)}
                                    type="button"
                                  >
                                    <span
                                      className={cn(
                                        "grid size-5 shrink-0 place-items-center rounded border border-zinc-300",
                                        selected &&
                                          "border-violet-600 bg-violet-600",
                                      )}
                                    >
                                      {selected ? (
                                        <Check className="size-3.5 text-white" />
                                      ) : null}
                                    </span>
                                    <span>{option.label}</span>
                                  </button>
                                );
                              })
                            ) : (
                              <p className="px-5 py-4 text-sm italic text-zinc-400">
                                No options available
                              </p>
                            )}
                          </div>
                        ) : null}
                      </section>
                    );
                  })
                ) : (
                  <p className="px-6 py-5 text-sm text-zinc-500">
                    No filters available
                  </p>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 border-t border-zinc-200 bg-white p-6 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                <Button
                  className="h-14 w-full rounded-xl text-base font-bold"
                  onClick={() => setOpen(false)}
                >
                  Apply filters
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function FilterButton({
  filters,
  value,
  onChange,
  loading,
}: {
  filters: SurveyFilter[];
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
}) {
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
            <select
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900"
              disabled={loading}
              onChange={(event) => onChange(event.target.value)}
              value={value}
            >
              <option value="">Select a demographic</option>
              {filters.map((filter) => (
                <option key={filter.questionId} value={filter.questionId}>
                  {filter.label}
                </option>
              ))}
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
                {Math.round(agreement)}%
              </strong>
              <span className="text-[11px] text-zinc-500">Agreement</span>
            </span>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap justify-center gap-x-4 gap-y-1 pt-5 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-violet-600" />
            Agreement {Math.round(agreement)}%
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-[#a99bea]" />
            Neutral {Math.round(neutral)}%
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-red-500" />
            Disagreement {Math.round(disagreement)}%
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
  const program = useSelectedProgram();
  const [filterSelection, setFilterSelection] = useState<{
    programId: string | undefined;
    filters: SelectedFilter[];
  }>({ programId: program?.id, filters: [] });
  const selectedFilters = useMemo(
    () =>
      filterSelection.programId === program?.id ? filterSelection.filters : [],
    [filterSelection, program?.id],
  );
  const queryFilter = useMemo<ReportQueryFilter>(() => {
    const grouped = new Map<string, string[]>();
    for (const filter of selectedFilters) {
      grouped.set(filter.questionId, [
        ...new Set([
          ...(grouped.get(filter.questionId) ?? []),
          ...filter.values,
        ]),
      ]);
    }
    return Object.fromEntries(grouped);
  }, [selectedFilters]);
  const report = useCategoryResults(queryFilter);
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const filterOptions = useQuery({
    queryKey: ["survey-filters", program?.id],
    queryFn: () => api.reports.surveyFilters(program?.id ?? ""),
    enabled: Boolean(program),
  });

  const toggleFilter = (selection: SelectedFilter) => {
    const key = selectedFilterKey(selection);
    setFilterSelection((current) => {
      const filters = current.programId === program?.id ? current.filters : [];
      return {
        programId: program?.id,
        filters: filters.some((item) => selectedFilterKey(item) === key)
          ? filters.filter((item) => selectedFilterKey(item) !== key)
          : [...filters, selection],
      };
    });
  };
  const selectedResult = report.categoryResults.find(
    (result) => result.title === selectedTitle,
  );
  const detailReport = useQuery({
    queryKey: [
      "employee-response-breakdown",
      report.programId,
      selectedResult?.title,
      selectedResult?.questionRange,
      queryFilter,
    ],
    queryFn: () =>
      api.reports.responseBreakdown(
        report.programId ?? "",
        selectedResult?.questionRange ?? [],
        queryFilter,
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
        <div className="mb-6 flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
          <DetailedResultsFilters
            error={
              filterOptions.isError ? filterOptions.error.message : undefined
            }
            filters={filterOptions.data ?? []}
            loading={filterOptions.isPending}
            onToggle={toggleFilter}
            selectedFilters={selectedFilters}
          />
          <ImageDownloadMenu
            disabled={!report.data || report.isPending}
            name={`detailed-results-${report.programId ?? "unselected"}`}
            onDownloadXlsx={() =>
              api.reports.downloadDetailedWorkbook(
                report.programId ?? "",
                queryFilter,
              )
            }
            targetRef={reportRef}
          />
        </div>
        {selectedFilters.length ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-zinc-200 pb-4">
            <span className="text-sm font-semibold text-zinc-900">
              {selectedFilters.length}
            </span>
            <span className="text-sm text-zinc-500">filters applied</span>
            <span className="h-4 w-px bg-zinc-200" />
            <button
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm text-zinc-900 transition-colors hover:bg-zinc-200"
              onClick={() =>
                setFilterSelection({ programId: program?.id, filters: [] })
              }
              type="button"
            >
              Clear all filters
            </button>
          </div>
        ) : null}
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
    defaultRange: "80-100%",
    rangeKey: "positive" as const,
  },
  {
    title: "Moderate % Agreement",
    description:
      "Download a report that highlights responses that have a moderate percentage of agreement. WRG recommends the 60–79% range.",
    placeholder: "e.g., 60–79%",
    defaultRange: "60-79%",
    rangeKey: "neutral" as const,
  },
  {
    title: "High % Disagreement",
    description:
      "Download a report that highlights responses that have a high percentage of disagreement. WRG recommends the 10–20% range.",
    placeholder: "e.g., 10–20%",
    defaultRange: "10-20%",
    rangeKey: "negative" as const,
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
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof api.reports.previewResponsePatterns>
  > | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const parsedRanges = ranges.map(parsePercentageRange);
  const valid =
    enabled.some(Boolean) &&
    enabled.every((value, index) => !value || parsedRanges[index] !== null);
  const selectedRanges = enabled.reduce<ResponsePatternRanges>(
    (selection, isEnabled, index) => {
      const range = parsedRanges[index];
      const config = patternConfigs[index];
      if (isEnabled && range && config) selection[config.rangeKey] = range;
      return selection;
    },
    {},
  );
  const resetPreview = () => {
    setPreview(null);
    setPreviewError(null);
  };
  const previewReport = async () => {
    if (!valid || !report.programId) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      setPreview(
        await api.reports.previewResponsePatterns(
          report.programId,
          selectedRanges,
        ),
      );
    } catch (error) {
      setPreview(null);
      setPreviewError(
        error instanceof Error ? error.message : "Unable to preview the report",
      );
    } finally {
      setPreviewing(false);
    }
  };
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
                    onClick={() => {
                      resetPreview();
                      const nextEnabled = !enabled[index];
                      setEnabled((values) =>
                        values.map((value, itemIndex) =>
                          itemIndex === index ? nextEnabled : value,
                        ),
                      );
                      if (nextEnabled) {
                        setRanges((currentRanges) =>
                          currentRanges.map((range, itemIndex) =>
                            itemIndex === index ? config.defaultRange : range,
                          ),
                        );
                      } else {
                        setRanges((currentRanges) =>
                          currentRanges.map((range, itemIndex) =>
                            itemIndex === index ? "" : range,
                          ),
                        );
                      }
                    }}
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
                    onChange={(event) => {
                      resetPreview();
                      setRanges((values) =>
                        values.map((value, itemIndex) =>
                          itemIndex === index ? event.target.value : value,
                        ),
                      );
                    }}
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
              disabled={!preview || !valid || !report.programId}
              onClick={() =>
                void api.reports.downloadResponsePatternsWorkbook(
                  report.programId ?? "",
                  selectedRanges,
                )
              }
              variant="secondary"
            >
              <Download className="size-4" /> Download Report
            </Button>
            <Button
              disabled={!valid || previewing}
              onClick={() => void previewReport()}
            >
              Preview the Report
            </Button>
          </div>
          {previewError ? (
            <p className="mt-4 text-right text-sm text-red-600" role="alert">
              {previewError}
            </p>
          ) : null}
        </Card>
        {preview ? (
          <Card className="mt-5 p-5 shadow-none">
            <h2 className="font-semibold">Response Patterns Report</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {patternConfigs.map((config, index) => {
                if (!enabled[index]) return null;
                const percentages = preview.data.percentage;
                const percentage =
                  config.rangeKey === "positive"
                    ? (percentages.positivePercentage ??
                      percentages.greenPercentage ??
                      0)
                    : config.rangeKey === "neutral"
                      ? (percentages.neutralPercentage ??
                        percentages.bluePercentage ??
                        0)
                      : (percentages.negativePercentage ??
                        percentages.redPercentage ??
                        0);
                return (
                  <div
                    className="rounded-lg bg-zinc-100 p-4 text-sm"
                    key={config.title}
                  >
                    <span className="block text-zinc-600">{config.title}</span>
                    <strong className="mt-1 block text-xl">
                      {Math.round(percentage)}%
                    </strong>
                  </div>
                );
              })}
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
  const surveyAverageRef = useRef<HTMLDivElement>(null);
  const categoryTrendsRef = useRef<HTMLDivElement>(null);
  const questionTrendsRef = useRef<HTMLDivElement>(null);
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
  const percentage = (yearSnapshot: typeof currentSnapshot, caption: string) =>
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
        <div className="mt-6" ref={surveyAverageRef}>
          <Card className="relative overflow-hidden p-5 shadow-none">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Survey Average</h2>
              <ImageDownloadMenu
                iconOnly
                name="Survey Average"
                targetRef={surveyAverageRef}
              />
            </div>
            {averages.isPending ? (
              <StatePanel
                kind="loading"
                title="Loading survey averages"
                message="Comparing overall agreement for both survey years."
              />
            ) : averages.isError ? (
              <StatePanel
                kind="error"
                title="Survey averages unavailable"
                message={averages.error.message}
              />
            ) : averages.data.data === null ? (
              <StatePanel
                kind="empty"
                title="No prior survey average"
                message="A prior year is required for the annual comparison."
              />
            ) : (
              <div className="mt-3 grid lg:grid-cols-2 lg:divide-x lg:divide-zinc-200">
                <DonutScore
                  delta={Math.round(currentAverage - previousAverage)}
                  value={Math.round(currentAverage)}
                  year={Number(currentYear)}
                />
                <DonutScore
                  value={Math.round(previousAverage)}
                  year={Number(previousYear)}
                />
              </div>
            )}
          </Card>
        </div>
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
            <div className="mt-4" ref={categoryTrendsRef}>
              <Card className="p-5 shadow-none">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{selectedCategory}</h2>
                  <ImageDownloadMenu
                    iconOnly
                    name={`${selectedCategory} annual trends`}
                    targetRef={categoryTrendsRef}
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {[currentSnapshot, previousSnapshot].map(
                    (yearSnapshot, index) => {
                      const year = index === 0 ? currentYear : previousYear;
                      return (
                        <div className="rounded-xl bg-zinc-50 p-5" key={year}>
                          <h3 className="font-semibold">{year}</h3>
                          <div className="mt-4 flex flex-wrap gap-4 text-sm">
                            <span>
                              {Math.round(percentage(yearSnapshot, "Agree"))}%
                              Agreement
                            </span>
                            <span>
                              {Math.round(percentage(yearSnapshot, "Neutral"))}%
                              Neutral
                            </span>
                            <span>
                              {Math.round(percentage(yearSnapshot, "Disagree"))}
                              % Disagreement
                            </span>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </Card>
            </div>
            <div className="mt-4" ref={questionTrendsRef}>
              <Card className="shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-5">
                  <h2 className="font-semibold">Question trends</h2>
                  <div className="flex items-center gap-2">
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
                        {item === "Agree"
                          ? "Agreement"
                          : item === "Disagree"
                            ? "Disagreement"
                            : item}
                      </button>
                    ))}
                    <ImageDownloadMenu
                      iconOnly
                      name={`${selectedCategory} question trends`}
                      targetRef={questionTrendsRef}
                    />
                  </div>
                </div>
                {details.isPending ? (
                  <p className="p-5 text-sm text-zinc-500">
                    Loading question trends…
                  </p>
                ) : details.data?.data.length ? (
                  <div className="divide-y divide-zinc-100">
                    {details.data.data.map((question) => {
                      const valueFor = (year: string) => {
                        const yearData = (question as Record<string, unknown>)[
                          year
                        ];
                        if (
                          !yearData ||
                          typeof yearData !== "object" ||
                          !("responses" in yearData)
                        )
                          return null;
                        const responses = (
                          yearData as {
                            responses: {
                              ResponseCaption: string;
                              percentage: number;
                            }[];
                          }
                        ).responses;
                        return (
                          responses.find(
                            (response) => response.ResponseCaption === metric,
                          )?.percentage ?? 0
                        );
                      };
                      return (
                        <div
                          className="grid gap-2 p-4 text-sm md:grid-cols-[1fr_80px_80px]"
                          key={question.questionId}
                        >
                          <span>{question.question}</span>
                          <span className="font-semibold">
                            {valueFor(currentYear)
                              ? Math.round(valueFor(currentYear) ?? 0)
                              : "—"}
                            %
                          </span>
                          <span className="font-semibold text-zinc-500">
                            {valueFor(previousYear)
                              ? Math.round(valueFor(previousYear) ?? 0)
                              : "—"}
                            {valueFor(previousYear) === null ? "" : "%"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="p-5 text-sm text-zinc-500">
                    No question-level comparison is available for this category.
                  </p>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function EmployeeVerbatimsPage() {
  const [filter, setFilter] = useState("");
  const program = useSelectedProgram();
  const isDummy = useAppStore(
    (state) => state.session?.user.role === "promotional",
  );
  const addToCart = useAppStore((state) => state.addToCart);
  const inCart = useAppStore((state) =>
    state.cart.some((item) => item.productId === "report-verbatims-sorted"),
  );
  const questions = useQuery({
    queryKey: ["open-response-questions", program?.id, isDummy],
    queryFn: () =>
      api.reports.openResponseQuestions(program?.id ?? "", isDummy),
    enabled: Boolean(program),
  });
  const catalog = useQuery({
    queryKey: ["report-catalog", program?.id],
    queryFn: () => api.reports.catalog(program?.id),
    enabled: Boolean(program),
  });
  const availableFilters = useQuery({
    queryKey: ["survey-filters", program?.id, isDummy],
    queryFn: () => api.reports.surveyFilters(program?.id ?? "", isDummy),
    enabled: Boolean(program),
  });
  const sortedVerbatims = catalog.data?.find(
    (product) => product.id === "report-verbatims-sorted",
  );
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
              will allow you to better identify where the comments originated.
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 text-zinc-900">
            <p className="text-[13px] text-zinc-500">Price</p>
            <strong className="text-2xl">
              {sortedVerbatims
                ? `$ ${(sortedVerbatims.priceCents / 100).toLocaleString()}`
                : "—"}
            </strong>
            <p className="mt-3 text-xs font-medium text-zinc-700">
              Select one of these options
            </p>
            <select
              className="mt-3 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              onChange={(event) => setFilter(event.target.value)}
              value={filter}
            >
              <option value="">Select filtering report</option>
              {(availableFilters.data ?? []).map((item) => (
                <option key={item.questionId} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
            <Button
              className="mt-3 w-full"
              disabled={!filter || inCart || !sortedVerbatims}
              onClick={() =>
                addToCart({
                  productId: "report-verbatims-sorted",
                  name: sortedVerbatims?.name ?? "Sorted Employee Verbatims",
                  priceCents: sortedVerbatims?.priceCents ?? 0,
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
            <DownloadReportButton
              onDownload={() =>
                api.reports.downloadVerbatimsWorkbook(
                  program?.id ?? "",
                  isDummy,
                )
              }
            />
          </div>
          <div className="grid gap-3 p-5">
            {questions.isPending ? (
              <StatePanel
                kind="loading"
                title="Loading questions"
                message="Retrieving open-ended survey questions."
              />
            ) : questions.isError ? (
              <StatePanel
                kind="error"
                title="Questions unavailable"
                message={questions.error.message}
                action={
                  <Button onClick={() => void questions.refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : questions.data.data.length === 0 ? (
              <StatePanel
                kind="empty"
                title="No verbatim questions"
                message="This program has no open-ended response questions."
              />
            ) : (
              questions.data.data.map((question) => (
                <EmployeeVerbatimQuestion
                  key={String(question.id)}
                  programId={program?.id ?? ""}
                  question={question}
                  isDummy={isDummy}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function EmployeeVerbatimQuestion({
  programId,
  question,
  isDummy,
}: {
  programId: string;
  question: { caption: string; id: string | number };
  isDummy: boolean;
}) {
  const answers = useQuery({
    queryKey: ["open-response-answers", programId, question.id, isDummy],
    queryFn: () =>
      isDummy
        ? api.reports.openResponseAnswers(
            programId,
            String(question.id),
            {},
            true,
          )
        : api.reports.openResponseAnswers(programId, String(question.id)),
    enabled: Boolean(programId),
  });
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
      <h3 className="border-b border-zinc-200 bg-white p-4 text-sm font-semibold leading-6 text-zinc-800">
        {question.caption}
      </h3>
      <div className="grid gap-3 p-4">
        {answers.isPending ? (
          <p className="text-sm text-zinc-500">Loading employee responses…</p>
        ) : answers.isError ? (
          <StatePanel
            action={
              <Button onClick={() => void answers.refetch()}>Try again</Button>
            }
            kind="error"
            message={answers.error.message}
            title="Employee responses unavailable"
          />
        ) : answers.data.data.respondentData.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No employees answered this question.
          </p>
        ) : (
          answers.data.data.respondentData.map((respondent, index) => (
            <blockquote
              className="rounded-xl border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-700"
              key={
                respondent._id ??
                `${respondent.RespondentId ?? "response"}-${index}`
              }
            >
              <span className="mr-2 text-xl leading-none text-violet-500">
                “
              </span>
              {respondent.responses.Value}
              <footer className="mt-3 text-xs font-medium text-zinc-400">
                Employee response {index + 1}
              </footer>
            </blockquote>
          ))
        )}
      </div>
    </section>
  );
}

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

function benchmarkValue(value: number | string | undefined): number | "x" {
  if (typeof value === "number") return Math.round(value);
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? Math.round(parsed) : "x";
}

function benchmarkPairs(category: BenchmarkCategory) {
  return Array.from(
    { length: Math.ceil(category.dataValues.length / 2) },
    (_, index) => ({
      winner: benchmarkValue(category.dataValues[index * 2]),
      nonWinner: benchmarkValue(category.dataValues[index * 2 + 1]),
    }),
  );
}

function BenchmarkCategoryCard({
  category,
  employerLabels,
  selected,
  onSelect,
}: {
  category: BenchmarkCategory;
  employerLabels: string[];
  selected: boolean;
  onSelect: () => void;
}) {
  const values = benchmarkPairs(category);
  const cardRef = useRef<HTMLElement>(null);
  return (
    <section
      ref={cardRef}
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
        <h2 className="max-w-[350px] text-[15px] font-semibold">
          {category.title}
        </h2>
        <ImageDownloadMenu iconOnly name={category.title} targetRef={cardRef} />
      </div>
      <div className="mt-6 flex flex-1 items-end gap-2">
        {values.map((value, index) => (
          <div
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
            key={`${value.winner}-${value.nonWinner}-${index}`}
          >
            <div className="flex h-[180px] items-end gap-1.5">
              <div className="flex h-full flex-col items-center justify-end gap-1">
                <span className="shrink-0 whitespace-nowrap text-xs">
                  {typeof value.winner === "number"
                    ? `${Math.round(value.winner)}%`
                    : "x"}
                </span>
                <div
                  className="w-7 shrink-0 rounded-t-lg bg-violet-900"
                  style={{
                    height: `${typeof value.winner === "number" ? Math.round((value.winner / 100) * 160) : 0}px`,
                  }}
                />
              </div>
              <div className="flex h-full flex-col items-center justify-end gap-1">
                <span className="shrink-0 text-xs">
                  {typeof value.nonWinner === "number"
                    ? `${Math.round(value.nonWinner)}%`
                    : "x"}
                </span>
                <div
                  className="w-7 shrink-0 rounded-t-lg bg-violet-400"
                  style={{
                    height: `${typeof value.nonWinner === "number" ? Math.round((value.nonWinner / 100) * 160) : 0}px`,
                  }}
                />
              </div>
            </div>
            <span className="min-h-6 text-center text-[10px] leading-3 text-zinc-600">
              {employerLabels[index] ?? `Employer group ${index + 1}`}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-center gap-6 text-xs text-zinc-700">
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-sm bg-violet-900" />
          Winners
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-sm bg-violet-400" />
          Non-Winners
        </span>
      </div>
    </section>
  );
}

function BenchmarkDetailsTable({
  category,
  employerLabels,
  onClose,
}: {
  category: BenchmarkCategory;
  employerLabels: string[];
  onClose: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-violet-300 bg-violet-50 shadow-sm">
      <div className="flex items-center justify-between px-6 py-5">
        <h2 className="font-semibold">{category.title}</h2>
        <button
          aria-label="Close"
          className="grid size-8 place-items-center rounded-full hover:bg-white"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-[300px] px-6 py-3 text-left" rowSpan={2}>
                Question
              </th>
              {employerLabels.map((label) => (
                <th className="px-2 py-3 text-center" colSpan={2} key={label}>
                  {label}
                </th>
              ))}
            </tr>
            <tr>
              {employerLabels.flatMap((label) => [
                <th
                  className="whitespace-nowrap px-2 py-3 font-medium"
                  key={`${label}-winner`}
                >
                  <span className="inline-flex items-center gap-1">
                    <i className="size-2 rounded-sm bg-violet-900" />
                    Winners
                  </span>
                </th>,
                <th
                  className="whitespace-nowrap px-2 py-3 font-medium"
                  key={`${label}-non-winner`}
                >
                  <span className="inline-flex items-center gap-1">
                    <i className="size-2 rounded-sm bg-violet-400" />
                    Non-Winners
                  </span>
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {category.nestedData.map((row, rowIndex) => (
              <tr
                className={cn(
                  "border-t border-violet-200",
                  rowIndex % 2 === 0 && "bg-white/45",
                )}
                key={row.id ?? row.title}
              >
                <td className="px-6 py-4 leading-5 text-zinc-600">
                  {row.title}
                </td>
                {employerLabels.flatMap((label, groupIndex) => {
                  const winners = row.dataValues[groupIndex * 2];
                  const nonWinners = row.dataValues[groupIndex * 2 + 1];
                  return [
                    <td
                      className="px-2 py-4 text-center font-semibold"
                      key={`${label}-winner`}
                    >
                      {typeof winners === "number"
                        ? `${Math.round(winners)}%`
                        : (winners ?? "x")}
                    </td>,
                    <td
                      className="border-r border-violet-200 px-2 py-4 text-center font-semibold last:border-r-0"
                      key={`${label}-non-winner`}
                    >
                      {typeof nonWinners === "number"
                        ? `${Math.round(nonWinners)}%`
                        : (nonWinners ?? "x")}
                    </td>,
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
  const program = useSelectedProgram();
  const isDummy = useAppStore(
    (state) => state.session?.user.role === "promotional",
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const comparison = useQuery({
    queryKey: ["workforce-comparison", program?.id, isDummy],
    queryFn: () =>
      api.reports.workforceComparison(program?.id ?? "", isDummy),
    enabled: Boolean(program),
  });
  const categories: BenchmarkCategory[] = comparison.data?.data.data ?? [];
  const employerLabels = (comparison.data?.data.tableHeaders ?? [])
    .filter((header) => header.type.includes("Yes"))
    .map((header) => header.title);
  const averages = (comparison.data?.data.surveyAverage ?? []).map(
    (average) => {
      const yes = average.Yes;
      const no = average.No;
      const winner =
        yes && typeof yes === "object" && "value" in yes ? yes.value : "x";
      const nonWinner =
        no && typeof no === "object" && "value" in no ? no.value : "x";
      return {
        title:
          typeof average.title === "string" ? average.title : "Employer group",
        subTitle:
          typeof average.subTitle === "string"
            ? average.subTitle
            : "Survey Average",
        winner:
          typeof winner === "number" || typeof winner === "string"
            ? winner
            : "x",
        nonWinner:
          typeof nonWinner === "number" || typeof nonWinner === "string"
            ? nonWinner
            : "x",
      };
    },
  );
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
        <div className="flex justify-end">
          <DownloadReportButton
            onDownload={() =>
              api.reports.downloadBenchmarkWorkbook(
                program?.id ?? "",
                isDummy,
              )
            }
          />
        </div>
        {comparison.isPending ? (
          <StatePanel
            kind="loading"
            title="Loading benchmark data"
            message="Retrieving comparison results for the selected program."
          />
        ) : comparison.isError ? (
          <StatePanel
            kind="error"
            title="Benchmark data unavailable"
            message={comparison.error.message}
            action={
              <Button onClick={() => void comparison.refetch()}>
                Try again
              </Button>
            }
          />
        ) : categories.length === 0 ? (
          <StatePanel
            kind="empty"
            title="No benchmark data"
            message="The backend returned no benchmark results for this program."
          />
        ) : (
          <>
            <Card className="mt-6 p-5 shadow-none">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                {averages.map((average) => (
                  <div
                    className="rounded-xl bg-zinc-100 p-4 text-center"
                    key={average.title}
                  >
                    <h2 className="min-h-10 text-[13px] font-semibold">
                      {average.title}
                    </h2>
                    <p className="mt-3 text-xs text-zinc-500">
                      {average.subTitle}
                    </p>
                    <strong className="mt-1 block text-2xl">
                      {typeof average.winner === "number"
                        ? `${Math.round(average.winner)}%`
                        : average.winner}
                    </strong>
                    <div className="mt-3 flex justify-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Check className="size-4" /> Winners
                      </span>
                      <span className="flex items-center gap-1 text-red-500">
                        <XCircle className="size-4" />{" "}
                        {typeof average.nonWinner === "number"
                          ? `${Math.round(average.nonWinner)}%`
                          : average.nonWinner}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <div className="mt-6 grid gap-5">
              {categoryRows.map((row) => {
                const selected = row.find(
                  (category) => category.title === selectedCategory,
                );
                return (
                  <div
                    className="grid gap-5"
                    key={row.map(({ title }) => title).join("-")}
                  >
                    <div className="grid gap-5 lg:grid-cols-2">
                      {row.map((category) => (
                        <BenchmarkCategoryCard
                          category={category}
                          employerLabels={employerLabels}
                          key={category.title}
                          onSelect={() =>
                            setSelectedCategory((current) =>
                              current === category.title
                                ? null
                                : category.title,
                            )
                          }
                          selected={selectedCategory === category.title}
                        />
                      ))}
                    </div>
                    {selected ? (
                      <BenchmarkDetailsTable
                        category={selected}
                        employerLabels={employerLabels}
                        onClose={() => setSelectedCategory(null)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              x – Insufficient data to provide meaningful feedback.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function AgreementDonut({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  const numeric = typeof value === "number" ? Math.round(value) : 0;
  return (
    <div className="grid justify-items-center gap-3">
      <div
        className="relative grid size-44 place-items-center rounded-full"
        style={{
          background: `conic-gradient(#7c3aed ${numeric * 3.6}deg, #ede9fe 0deg)`,
        }}
      >
        <div className="grid size-32 place-items-center rounded-full bg-white text-center shadow-inner">
          <div>
            <strong className="block text-3xl">
              {typeof value === "number" && value > 0 ? `${value}%` : "x"}
            </strong>
            <span className="text-[11px] text-zinc-500">Agreement</span>
          </div>
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
  const detailRef = useRef<HTMLElement>(null);
  return (
    <section className="border-t border-zinc-200 bg-white" ref={detailRef}>
      <div className="flex items-center justify-between gap-4 px-5 py-5">
        <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-zinc-700">
          <span className="flex items-center gap-2">
            <i className="size-2.5 rounded-sm bg-violet-900" />
            Your Results
          </span>
          <span className="flex items-center gap-2">
            <i className="size-2.5 rounded-sm bg-violet-400" />
            {compareLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ImageDownloadMenu
            iconOnly
            name={`${title} comparison details`}
            targetRef={detailRef}
          />
          <button
            aria-label="Close chart"
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="grid gap-4 border-t border-zinc-200 p-5">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              className="h-24 animate-pulse rounded-xl bg-zinc-100"
              key={index}
            />
          ))}
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
                  const numericValue = Math.round(Number(value));
                  return (
                    <div
                      aria-label={`${label}: ${numericValue}%`}
                      className="h-9 overflow-hidden rounded-xl bg-zinc-50"
                      key={String(label)}
                    >
                      {numericValue > 0 ? (
                        <div
                          className={cn(
                            "flex h-full items-center rounded-r-xl px-3 text-[11px] font-semibold text-white",
                            String(color),
                          )}
                          style={{ width: `${numericValue}%` }}
                        >
                          {numericValue}%
                        </div>
                      ) : (
                        <span className="flex h-full items-center px-3 text-xs text-zinc-500">
                          x
                        </span>
                      )}
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

function ComparisonCategoryCard({
  title,
  benchmark,
  currentValue,
  compareLabel,
  selected,
  onToggle,
  details,
}: {
  title: string;
  benchmark: number;
  currentValue: number;
  compareLabel: string;
  selected: boolean;
  onToggle: () => void;
  details: UseQueryResult<
    Awaited<ReturnType<typeof api.reports.comparisonQuestions>>
  >;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={cardRef}>
      <Card
        className={cn(
          "shadow-none transition",
          selected && "border-violet-300 shadow-md",
        )}
      >
        <div
          aria-expanded={selected}
          className={cn(
            "cursor-pointer transition",
            selected && "bg-violet-50",
          )}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggle();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold">{title}</h2>
            <ImageDownloadMenu iconOnly name={title} targetRef={cardRef} />
          </div>
          <div className="grid gap-8 p-7 md:grid-cols-2 md:divide-x md:divide-zinc-200">
            <AgreementDonut label="Your Results" value={currentValue} />
            <div className="md:pl-8">
              <AgreementDonut label={compareLabel} value={benchmark} />
            </div>
          </div>
        </div>
        {selected ? (
          <ComparisonQuestionDetails
            compareLabel={compareLabel}
            loading={details.isLoading}
            onClose={onToggle}
            rows={details.data?.data.questionResponse ?? []}
            title={title}
          />
        ) : null}
      </Card>
    </div>
  );
}

export function ComparisonDataPage() {
  const [active, setActive] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categoryReport = useCategoryResults();
  const { categoryResults } = categoryReport;
  const program = useSelectedProgram();
  const comparison = useQuery({
    queryKey: ["workforce-comparison", program?.id],
    queryFn: () => api.reports.workforceComparison(program?.id ?? ""),
    enabled: Boolean(program),
  });
  const cohorts = (comparison.data?.data.tableHeaders ?? [])
    .map((header, index) => ({
      label: header.title,
      key: header.type.replace("_", ""),
      index,
    }))
    .filter((cohort) => cohort.key.endsWith("Yes"));
  const categories = categoryResults.filter(
    ({ title }) => title !== "Supplementary Questions",
  );
  const selectedCohort = cohorts[active];
  const details = useQuery({
    queryKey: [
      "comparison-question-details",
      program?.id,
      selectedCategory,
      active,
    ],
    queryFn: () =>
      api.reports.comparisonQuestions(
        program?.id ?? "",
        selectedCategory ?? "",
        selectedCohort?.key ?? "",
      ),
    enabled: Boolean(program && selectedCategory && selectedCohort),
  });
  return (
    <>
      <ReportHeader
        description="Compare your survey results against other organizations in your industry and size."
        title="Comparison Data"
      />
      <div className="p-6">
        <div className="flex justify-end">
          <DownloadReportButton
            onDownload={() =>
              api.reports.downloadBenchmarkWorkbook(program?.id ?? "")
            }
          />
        </div>
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-violet-50 p-3">
          <button
            aria-label="Previous comparison group"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-zinc-500"
            onClick={() => setActive((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {cohorts.map((cohort, index) => (
              <button
                className={cn(
                  "h-10 rounded-lg px-2 text-xs font-medium",
                  active === index
                    ? "bg-violet-600 text-white"
                    : "bg-white text-zinc-600",
                )}
                key={cohort.key}
                onClick={() => setActive(index)}
              >
                {cohort.label}
              </button>
            ))}
          </div>
          <button
            aria-label="Next comparison group"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-zinc-500"
            onClick={() =>
              setActive((value) => Math.min(cohorts.length - 1, value + 1))
            }
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        {categoryReport.isPending || comparison.isPending ? (
          <StatePanel
            kind="loading"
            title="Loading comparison data"
            message="Retrieving your results and comparison cohorts."
          />
        ) : categoryReport.isError || comparison.isError ? (
          <StatePanel
            kind="error"
            title="Comparison data unavailable"
            message={
              (categoryReport.error ?? comparison.error)?.message ??
              "The comparison could not be loaded."
            }
          />
        ) : categories.length === 0 || cohorts.length === 0 ? (
          <StatePanel
            kind="empty"
            title="No comparison data"
            message="The backend returned no comparison results for this program."
          />
        ) : (
          <div className="mt-6 grid gap-5">
            {categories.map((category) => {
              const benchmarkCategory = comparison.data.data.data.find(
                (item) => item.title === category.title,
              );
              const rawBenchmark = selectedCohort
                ? benchmarkCategory?.dataValues[selectedCohort.index]
                : undefined;
              const benchmark =
                typeof rawBenchmark === "number"
                  ? rawBenchmark
                  : Number.parseFloat(rawBenchmark ?? "") || 0;
              const selected = selectedCategory === category.title;
              return (
                <ComparisonCategoryCard
                  benchmark={Math.round(benchmark)}
                  compareLabel={selectedCohort?.label ?? "Comparison group"}
                  currentValue={Math.round(category.agreement)}
                  details={details}
                  key={category.title}
                  onToggle={() =>
                    setSelectedCategory((current) =>
                      current === category.title ? null : category.title,
                    )
                  }
                  selected={selected}
                  title={category.title}
                />
              );
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-zinc-500">
          x – Insufficient data to provide meaningful feedback.
        </p>
      </div>
    </>
  );
}

export function BenefitsBestPracticesPage() {
  const program = useSelectedProgram();
  const isDummy = useAppStore(
    (state) => state.session?.user.role === "promotional",
  );
  const report = useQuery({
    queryKey: ["employer-benchmark", program?.id, isDummy],
    queryFn: () =>
      api.reports.employerBenchmark(program?.id ?? "", isDummy),
    enabled: Boolean(program),
  });
  const headers = report.data?.data.tableHeaders ?? [];
  const questions = (report.data?.data.tableData ?? []).flatMap(
    (section) => section.nestedData,
  );
  return (
    <>
      <ReportHeader title="Benefits & Best Practices" />
      <div className="p-6">
        <div className="flex justify-end">
          <DownloadReportButton
            onDownload={() =>
              api.reports.downloadBenefitsWorkbook(
                program?.id ?? "",
                isDummy,
              )
            }
          />
        </div>
        {report.isPending ? (
          <StatePanel
            kind="loading"
            title="Loading benefits and practices"
            message="Retrieving employer benchmark data."
          />
        ) : report.isError ? (
          <StatePanel
            kind="error"
            title="Benefits data unavailable"
            message={report.error.message}
            action={
              <Button onClick={() => void report.refetch()}>Try again</Button>
            }
          />
        ) : questions.length === 0 ? (
          <StatePanel
            kind="empty"
            title="No benefits data"
            message="The backend returned no benefits or best-practice results."
          />
        ) : (
          <BenefitsBenchmarkTable headers={headers} questions={questions} />
        )}
      </div>
    </>
  );
}

type ResponseDetailData = Awaited<
  ReturnType<typeof api.reports.responseDetailResult>
>["data"];

function ResponseDetailTable({ data }: { data: ResponseDetailData }) {
  const [headerRow, ...rows] = data;
  const cellText = (cell: ResponseDetailData[number][number] | undefined) =>
    typeof cell === "string" || typeof cell === "number" ? String(cell) : "";
  const headers = headerRow?.slice(1).map(cellText) ?? [];
  const renderCell = (cell: ResponseDetailData[number][number]) => {
    if (typeof cell === "object") {
      const value = cell.percentile ?? cell.average ?? "—";
      return (
        <>
          <strong>{value}</strong>
          <span className="ml-1 text-zinc-400">({cell.respondentCount})</span>
        </>
      );
    }
    return <strong>{cell}</strong>;
  };
  return (
    <div className="overflow-x-auto py-2">
      <table className="min-w-[690px] w-full text-xs">
        <thead>
          <tr className="bg-zinc-100 text-zinc-600">
            <th className="px-3 py-3 text-left">Response</th>
            {headers.map((header) => (
              <th className="px-3 py-3 text-center" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              className={cn(
                "border-t border-zinc-100",
                cellText(row[0]) === "Question Total" &&
                  "border-t-2 border-zinc-200 bg-violet-50",
              )}
              key={`${cellText(row[0])}-${rowIndex}`}
            >
              <td className="px-3 py-3 font-medium">{cellText(row[0])}</td>
              {row.slice(1).map((cell, column) => (
                <td
                  className="px-3 py-3 text-center"
                  key={`${headers[column] ?? column}-${column}`}
                >
                  {renderCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResponseDetailQuestion({
  programId,
  filterQuestion,
  question,
}: {
  programId: string;
  filterQuestion: string;
  question: { QuestionId: string | number; Caption: string };
}) {
  const [open, setOpen] = useState(false);
  const result = useQuery({
    queryKey: [
      "response-detail-result",
      programId,
      question.QuestionId,
      filterQuestion,
    ],
    queryFn: () =>
      api.reports.responseDetailResult(
        programId,
        String(question.QuestionId),
        filterQuestion,
      ),
    enabled: open,
  });
  return (
    <details
      className="group/question rounded-lg bg-white"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer items-center gap-3 p-4 text-sm">
        <span className="flex-1">{question.Caption}</span>
        <ChevronRight className="size-4 transition group-open/question:rotate-90" />
      </summary>
      <div className="border-t border-zinc-100 px-4 pb-5">
        {result.isPending ? (
          <p className="py-5 text-sm text-zinc-500">
            Loading response distribution…
          </p>
        ) : result.isError ? (
          <p className="py-5 text-sm text-red-600">{result.error.message}</p>
        ) : result.data.data.length ? (
          <ResponseDetailTable data={result.data.data} />
        ) : (
          <p className="py-5 text-sm text-zinc-500">
            No response distribution is available.
          </p>
        )}
      </div>
    </details>
  );
}

export function ResponseDetailPage() {
  const program = useSelectedProgram();
  const [filterQuestion, setFilterQuestion] = useState("");
  const filters = useQuery({
    queryKey: ["survey-filters", program?.id],
    queryFn: () => api.reports.surveyFilters(program?.id ?? ""),
    enabled: Boolean(program),
  });
  const sections = useQuery({
    queryKey: ["response-detail-sections", program?.id],
    queryFn: () => api.reports.responseDetailSections(program?.id ?? ""),
    enabled: Boolean(program),
  });
  const effectiveFilterQuestion =
    filterQuestion !== ""
      ? filterQuestion
      : (filters.data?.[0]?.questionId ?? "");
  const selectedFilter = filters.data?.find(
    (filter) => filter.questionId === effectiveFilterQuestion,
  );
  return (
    <>
      <ReportHeader
        description="This in-depth report reflects, by each survey question and for each demographic, the percentage of responses distributed across the entire 6-point scale."
        title="Response Detail"
      />
      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <FilterButton
            filters={filters.data ?? []}
            loading={filters.isPending}
            onChange={setFilterQuestion}
            value={effectiveFilterQuestion}
          />
          <DownloadReportButton
            onDownload={() =>
              api.reports.downloadResponseDetailWorkbook(program?.id ?? "")
            }
          />
        </div>
        {selectedFilter ? (
          <span className="mt-4 inline-flex rounded-full bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
            Filter: {selectedFilter.label}
          </span>
        ) : null}
        <div className="mt-5 grid gap-3">
          {filters.isError || sections.isError ? (
            <StatePanel
              kind="error"
              title="Response detail unavailable"
              message={
                (filters.error ?? sections.error)?.message ??
                "The response detail could not be loaded."
              }
            />
          ) : filters.isPending || sections.isPending ? (
            <StatePanel
              kind="loading"
              title="Loading response detail"
              message="Retrieving questions and demographic filters."
            />
          ) : !effectiveFilterQuestion ? (
            <StatePanel
              kind="empty"
              title="No demographic filters"
              message="The backend returned no demographics to compare."
            />
          ) : sections.data.data.length === 0 ? (
            <StatePanel
              kind="empty"
              title="No response detail"
              message={sections.data.message}
            />
          ) : (
            sections.data.data
              .flatMap((section) => Object.entries(section))
              .map(([title, questions]) => (
                <details
                  className="group rounded-xl border border-zinc-200 bg-white"
                  key={title}
                >
                  <summary className="flex cursor-pointer items-center justify-between p-5 font-semibold">
                    <span>{title}</span>
                    <span className="grid size-8 place-items-center rounded-full border border-zinc-300">
                      <ChevronDown className="size-4 transition group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="grid gap-2 border-t border-zinc-200 bg-zinc-50 p-4">
                    {questions.map((question) => (
                      <ResponseDetailQuestion
                        filterQuestion={effectiveFilterQuestion}
                        key={String(question.QuestionId)}
                        programId={program?.id ?? ""}
                        question={question}
                      />
                    ))}
                  </div>
                </details>
              ))
          )}
        </div>
      </div>
    </>
  );
}

export function KeyImpactAnalysisPage() {
  const program = useSelectedProgram();
  const analysis = useQuery({
    queryKey: ["key-impact-analysis", program?.id],
    queryFn: () => api.reports.keyImpactAnalysis(program?.id ?? ""),
    enabled: Boolean(program),
  });
  const report = analysis.data?.data.report ?? [];
  const maxValue = Math.max(
    1,
    ...report.map((item) => Number(item.value) || 0),
  );
  return (
    <>
      <ReportHeader
        description="This report identifies key motivators of employee engagement within your unique population. This information is vital to knowing what workplace attributes are most important to retain your top talent and drive high productivity among all staff."
        title="Key Impact Analysis"
      />
      <div className="p-6">
        {analysis.data?.data.data.signedUrl ? (
          <DownloadReportButton
            onDownload={() =>
              api.reports.downloadCustomReport(
                analysis.data.data.data.signedUrl ?? "",
                analysis.data.data.fileName ?? "Key_Impact_Analysis.pdf",
              )
            }
          />
        ) : null}
        {analysis.isPending ? (
          <StatePanel
            kind="loading"
            title="Loading key impact analysis"
            message="Retrieving the analysis for the selected program."
          />
        ) : analysis.isError ? (
          <StatePanel
            kind="error"
            title="Key impact analysis unavailable"
            message={analysis.error.message}
            action={
              <Button onClick={() => void analysis.refetch()}>Try again</Button>
            }
          />
        ) : report.length === 0 ? (
          <StatePanel
            kind="empty"
            title="No key impact analysis"
            message="The backend returned no key-impact results for this program."
          />
        ) : (
          <Card className="mt-10 p-6 shadow-none">
            <div className="grid gap-5">
              {report.map((item) => {
                const value = Number(item.value) || 0;
                return (
                  <div key={`${item.label}-${item.key}`}>
                    <div className="mb-2 flex items-start justify-between gap-4 text-sm">
                      <div>
                        <strong>{item.label}</strong>
                        <p className="mt-1 text-zinc-500">{item.key}</p>
                      </div>
                      <strong>{value}</strong>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-violet-600"
                        style={{
                          width: `${Math.max(0, Math.min(100, (value / maxValue) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

export function CustomReportsPage() {
  const program = useSelectedProgram();
  const reports = useQuery({
    queryKey: ["custom-reports", program?.id],
    queryFn: () => api.reports.customReports(program?.id ?? ""),
    enabled: Boolean(program),
  });
  const formatDate = (value: string | Date | undefined) =>
    value
      ? new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(value))
      : "—";
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
        {reports.isPending ? (
          <StatePanel
            kind="loading"
            title="Loading custom reports"
            message="Retrieving files for the selected program."
          />
        ) : reports.isError ? (
          <StatePanel
            kind="error"
            title="Custom reports unavailable"
            message={reports.error.message}
            action={
              <Button onClick={() => void reports.refetch()}>Try again</Button>
            }
          />
        ) : reports.data.data.length === 0 ? (
          <StatePanel
            kind="empty"
            title="No custom reports"
            message="Your custom reports will appear here when they are available."
          />
        ) : (
          <Card className="overflow-hidden shadow-none">
            <div className="grid grid-cols-[1fr_1.4fr_130px_100px] gap-4 bg-zinc-100 p-4 text-xs font-semibold text-zinc-500">
              <span>Report Name</span>
              <span>Description</span>
              <span>Upload Date</span>
              <span>Action</span>
            </div>
            {reports.data.data.map((report) => (
              <div
                className="grid grid-cols-[1fr_1.4fr_130px_100px] items-center gap-4 border-t border-zinc-100 p-4 text-sm first:border-t-0"
                key={report._id}
              >
                <strong>{report.ReportTitle}</strong>
                <span className="leading-5 text-zinc-500">
                  {report.ReportDescription}
                </span>
                <span className="text-zinc-500">
                  {formatDate(report.createAt ?? report.createdAt)}
                </span>
                <div className="grid gap-2">
                  {report.reportFormats.map((format, index) => {
                    const url =
                      format.signedUrl ?? format.fileUrl ?? format.url;
                    const filename =
                      format.fileName ??
                      format.filename ??
                      `${report.ReportTitle}-${index + 1}`;
                    return url ? (
                      <button
                        className="h-9 rounded bg-red-600 px-3 text-xs font-semibold text-white"
                        key={format._id ?? `${url}-${index}`}
                        onClick={() =>
                          void api.reports.downloadCustomReport(url, filename)
                        }
                      >
                        DOWNLOAD
                      </button>
                    ) : null;
                  })}
                  {report.reportFormats.length === 0 ? (
                    <span className="text-xs text-zinc-500">Pending</span>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
