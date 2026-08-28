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
import { toPng } from "html-to-image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { SearchableSelect } from "@wrg/platform-ui";
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
  const cartCount = useAppStore((state) => state.cart.reduce((total, item) => total + item.quantity, 0));
  const yearTitle = customBreadcrumb
    ? title
    : `${title} ${program?.year ?? ""}`.trim();
  return (
    <>
      <PageHeader
        actions={
          <Button
            className="relative gap-2 pr-8 font-medium"
            onClick={() => setCartOpen(true)}
            variant="secondary"
          >
            <ShoppingCart className="size-4" /> Cart
            <span className="absolute right-2 grid min-w-5 place-items-center rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{cartCount}</span>
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

function ResponseDetailDownloadMenu({
  onDownloadFull,
  onDownloadFiltered,
  filteredDisabled,
}: {
  onDownloadFull: () => Promise<void> | void;
  onDownloadFiltered: () => Promise<void> | void;
  filteredDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<"full" | "filtered" | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const download = async (
    type: "full" | "filtered",
    action: () => Promise<void> | void,
  ) => {
    setDownloading(type);
    try {
      await action();
      setOpen(false);
    } finally {
      setDownloading(null);
    }
  };
  return (
    <div className="relative" ref={rootRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        className="gap-2 rounded-md"
        disabled={downloading !== null}
        onClick={() => setOpen((value) => !value)}
      >
        <Download className="size-4" />
        {downloading ? "Preparing…" : "Download Report"}
        <ChevronDown className="size-4" />
      </Button>
      {open ? (
        <div
          aria-label="Download report options"
          className="absolute right-0 top-12 z-30 min-w-56 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
          role="menu"
        >
          <button
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-violet-50 disabled:cursor-wait disabled:text-zinc-400"
            disabled={downloading !== null}
            onClick={() => download("full", onDownloadFull)}
            role="menuitem"
            type="button"
          >
            <Download className="size-4" />
            {downloading === "full" ? "Preparing…" : "Download full report"}
          </button>
          <button
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-zinc-400"
            disabled={filteredDisabled || downloading !== null}
            onClick={() => download("filtered", onDownloadFiltered)}
            role="menuitem"
            type="button"
          >
            <Download className="size-4" />
            {downloading === "filtered"
              ? "Preparing…"
              : "Download filtered report"}
          </button>
        </div>
      ) : null}
    </div>
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
            <SearchableSelect
              ariaLabel="Compare by demographic"
              disabled={loading}
              onChange={onChange}
              options={filters.map((filter) => ({ value: filter.questionId, label: filter.label }))}
              placeholder="Select a demographic"
              searchPlaceholder="Search demographics…"
              value={value}
            />
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
  gridStyle,
}: CategoryResult & {
  selected: boolean;
  onSelect: () => void;
  gridStyle?: CSSProperties;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const pie = `conic-gradient(#7c3aed 0 ${agreement}%, #a99bea ${agreement}% ${agreement + neutral}%, #ef4444 ${agreement + neutral}% 100%)`;
  return (
    <div
      ref={cardRef}
      aria-pressed={selected}
      aria-controls={selected ? "detailed-results-breakdown" : undefined}
      className="cursor-pointer [grid-row:var(--mobile-row)] md:[grid-row:var(--tablet-row)] xl:[grid-row:var(--desktop-row)]"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      style={gridStyle}
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
  gridStyle,
}: {
  title: string;
  data: DetailReport | undefined;
  error: string | undefined;
  loading: boolean;
  onClose: () => void;
  gridStyle?: CSSProperties;
}) {
  return (
    <section
      className="col-span-full rounded-2xl border-2 border-violet-200 bg-violet-50 p-5 [grid-row:var(--mobile-row)] md:[grid-row:var(--tablet-row)] xl:[grid-row:var(--desktop-row)]"
      id="detailed-results-breakdown"
      style={gridStyle}
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
  const selectedIndex = report.categoryResults.findIndex(
    (result) => result.title === selectedTitle,
  );
  const selectedGridRows =
    selectedIndex < 0
      ? null
      : {
          mobile: selectedIndex + 1,
          tablet: Math.floor(selectedIndex / 2) + 1,
          desktop: Math.floor(selectedIndex / 3) + 1,
        };
  const gridStyleForCard = (index: number) => {
    const rowWithDetail = (columns: number, selectedRow: number | undefined) => {
      const row = Math.floor(index / columns) + 1;
      return selectedRow !== undefined && row > selectedRow ? row + 1 : row;
    };
    return {
      "--mobile-row": rowWithDetail(1, selectedGridRows?.mobile),
      "--tablet-row": rowWithDetail(2, selectedGridRows?.tablet),
      "--desktop-row": rowWithDetail(3, selectedGridRows?.desktop),
    } as CSSProperties;
  };
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
                {report.categoryResults.map((result, index) => {
                  const selected = result.title === selectedTitle;
                  return (
                    <PieChartCard
                      {...result}
                      gridStyle={gridStyleForCard(index)}
                      key={result.title}
                      onSelect={() =>
                        setSelectedTitle((current) =>
                          current === result.title ? null : result.title,
                        )
                      }
                      selected={selected}
                    />
                  );
                })}
                {selectedResult && selectedGridRows ? (
                  <DetailPanel
                    data={detailReport.data}
                    error={
                      detailReport.isError
                        ? detailReport.error.message
                        : undefined
                    }
                    gridStyle={
                      {
                        "--mobile-row": selectedGridRows.mobile + 1,
                        "--tablet-row": selectedGridRows.tablet + 1,
                        "--desktop-row": selectedGridRows.desktop + 1,
                      } as CSSProperties
                    }
                    loading={detailReport.isPending}
                    onClose={() => setSelectedTitle(null)}
                    title={selectedResult.title}
                  />
                ) : null}
              </div>
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

type AnnualDistribution = {
  ResponseCaption: string;
  percentage: number;
};

const annualDistributionLabels = {
  Agree: "Agreement",
  Neutral: "Neutral",
  Disagree: "Disagreement",
} as const;

function DistributionDonut({
  year,
  distribution,
  previous = false,
}: {
  year: string;
  distribution: AnnualDistribution[];
  previous?: boolean;
}) {
  const palette = previous
    ? { Agree: "#9278e8", Neutral: "#b4a5ef", Disagree: "#ddd6fe" }
    : { Agree: "#4c1d95", Neutral: "#7c3aed", Disagree: "#b5a7ef" };
  const values = (["Agree", "Neutral", "Disagree"] as const).map((caption) => ({
    caption,
    value:
      distribution.find((item) => item.ResponseCaption === caption)
        ?.percentage ?? 0,
  }));
  let cumulative = 0;
  const segments = values.map((item) => {
    const offset = cumulative;
    cumulative += item.value;
    const angle = ((offset + item.value / 2) / 100) * Math.PI * 2 - Math.PI / 2;
    return {
      ...item,
      offset,
      labelX: 120 + Math.cos(angle) * 98,
      labelY: 105 + Math.sin(angle) * 98,
    };
  });

  return (
    <div className="grid min-w-0 flex-1 place-items-center px-4 py-7">
      <svg
        aria-label={`${year}: ${values
          .map(
            ({ caption, value }) =>
              `${Math.round(value)}% ${annualDistributionLabels[caption]}`,
          )
          .join(", ")}`}
        className="h-[260px] w-full max-w-[360px] overflow-visible"
        role="img"
        viewBox="0 0 240 220"
      >
        <circle
          cx="120"
          cy="105"
          fill="none"
          r="70"
          stroke="#f4f4f5"
          strokeWidth="32"
        />
        {segments.map(({ caption, value, offset }) => (
          <circle
            cx="120"
            cy="105"
            fill="none"
            key={caption}
            pathLength="100"
            r="70"
            stroke={palette[caption]}
            strokeDasharray={`${value} ${100 - value}`}
            strokeDashoffset={-offset}
            strokeWidth="32"
            transform="rotate(-90 120 105)"
          />
        ))}
        <text
          fill="#71717a"
          fontSize="13"
          fontWeight="600"
          textAnchor="middle"
          x="120"
          y="110"
        >
          {year}
        </text>
        {segments.map(({ caption, value, labelX, labelY }) =>
          value > 0 ? (
            <text
              fill="#18181b"
              fontSize="11"
              fontWeight="700"
              key={`${caption}-label`}
              textAnchor={
                labelX < 102 ? "end" : labelX > 138 ? "start" : "middle"
              }
              x={labelX}
              y={labelY}
            >
              {Math.round(value)}%
            </text>
          ) : null,
        )}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-zinc-600">
        {values.map(({ caption }) => (
          <span className="inline-flex items-center gap-2" key={caption}>
            <i
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: palette[caption] }}
            />
            {annualDistributionLabels[caption]}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuestionTrendBars({
  currentYear,
  previousYear,
  currentValue,
  previousValue,
}: {
  currentYear: string;
  previousYear: string;
  currentValue: number | null;
  previousValue: number | null;
}) {
  const bar = (year: string, value: number | null, previous: boolean) => {
    const rounded = value === null ? null : Math.round(value);
    const width = rounded === null ? 0 : Math.max(rounded, rounded > 0 ? 4 : 0);
    return (
      <div
        aria-label={`${year}: ${rounded === null ? "no data" : `${rounded}%`}`}
        className="relative h-9 rounded-md bg-zinc-50"
        role="img"
      >
        {rounded === null ? (
          <span className="absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-zinc-400">
            No data
          </span>
        ) : (
          <>
            <div
              className="h-full rounded-md"
              style={{
                backgroundColor: previous ? "#9b87e5" : "#4c1d95",
                width: `${width}%`,
              }}
            />
            <span
              className={cn(
                "absolute inset-y-0 flex items-center text-xs font-semibold",
                rounded >= 8 ? "left-3 text-white" : "text-zinc-700",
              )}
              style={
                rounded >= 8 ? undefined : { left: `calc(${width}% + 8px)` }
              }
            >
              {rounded}%
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-2">
      {bar(currentYear, currentValue, false)}
      {bar(previousYear, previousValue, true)}
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
                <div className="mt-4 grid md:grid-cols-2 md:divide-x md:divide-zinc-200">
                  {[currentSnapshot, previousSnapshot].map(
                    (yearSnapshot, index) => {
                      const year = index === 0 ? currentYear : previousYear;
                      return (
                        <DistributionDonut
                          distribution={yearSnapshot?.data ?? []}
                          key={year}
                          previous={index === 1}
                          year={year}
                        />
                      );
                    },
                  )}
                </div>
              </Card>
            </div>
            <div className="mt-4" ref={questionTrendsRef}>
              <Card className="shadow-none">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-5">
                  <div>
                    <h2 className="font-semibold">Question trends</h2>
                    <div className="mt-4 flex rounded-xl bg-violet-50 p-1">
                      {(["Agree", "Neutral", "Disagree"] as const).map(
                        (item) => (
                          <button
                            className={cn(
                              "rounded-lg px-5 py-2 text-sm font-semibold",
                              metric === item
                                ? "bg-white text-zinc-900 shadow-sm"
                                : "text-zinc-500",
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
                        ),
                      )}
                    </div>
                    <div className="mt-4 flex gap-5 text-xs font-semibold text-zinc-600">
                      <span className="inline-flex items-center gap-2">
                        <i className="size-2.5 rounded-sm bg-[#4c1d95]" />
                        {currentYear}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <i className="size-2.5 rounded-sm bg-[#9b87e5]" />
                        {previousYear}
                      </span>
                    </div>
                  </div>
                  <div>
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
                          className="grid gap-4 p-5 text-sm md:grid-cols-[minmax(220px,340px)_1fr] md:items-center"
                          key={question.questionId}
                        >
                          <span className="leading-5 text-zinc-600">
                            {question.question}
                          </span>
                          <QuestionTrendBars
                            currentValue={valueFor(currentYear)}
                            currentYear={currentYear}
                            previousValue={valueFor(previousYear)}
                            previousYear={previousYear}
                          />
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
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get("demo") === "report-verbatims-sorted";
  const program = useSelectedProgram();
  const isDummy = useAppStore(
    (state) => state.session?.user.role === "promotional",
  ) || isDemo;
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
  const selectedPurchasedFilter = sortedVerbatims?.selection ?? "";
  const effectiveSortingFilter = filter || (isDemo ? availableFilters.data?.[0]?.questionId ?? "" : "");
  return (
    <>
      <ReportHeader
        description="Any responses to open-ended survey questions are contained in this report"
        title="Employee Verbatims"
      />
      {isDemo && sortedVerbatims ? (
        <div className="fixed right-5 top-5 z-[65] flex max-w-md items-center gap-4 rounded-xl border border-violet-200 bg-white p-4 shadow-xl" role="status">
          <div className="min-w-0 flex-1"><strong className="text-sm text-violet-700">Viewing demo</strong><p className="mt-1 text-xs text-zinc-500">You&apos;re viewing fake Employee Verbatims data.</p></div>
          <Button disabled={inCart || sortedVerbatims.owned || !effectiveSortingFilter || sortedVerbatims.priceCents == null} onClick={() => addToCart({ productId: sortedVerbatims.id, name: sortedVerbatims.name, priceCents: sortedVerbatims.priceCents ?? 0, keys: { EV_Sorting_Filter: effectiveSortingFilter } })}>{inCart ? "Added" : "Add to cart"}</Button>
        </div>
      ) : null}
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
              {sortedVerbatims?.priceCents != null
                ? `$ ${(sortedVerbatims.priceCents / 100).toLocaleString()}`
                : "—"}
            </strong>
            <p className="mt-3 text-xs font-medium text-zinc-700">
              {sortedVerbatims?.owned ? "Sorted by" : "Select one of these options"}
            </p>
            {sortedVerbatims?.owned ? (
              <SearchableSelect
                ariaLabel="Purchased sorting filter"
                className="mt-3 text-sm"
                disabled
                onChange={() => undefined}
                options={[{
                  value: selectedPurchasedFilter,
                  label: (availableFilters.data?.find((item) => item.questionId === selectedPurchasedFilter)?.label ?? selectedPurchasedFilter) || "Purchased filter",
                }]}
                value={selectedPurchasedFilter}
              />
            ) : <SearchableSelect
              ariaLabel="Filtering report"
              className="mt-3 text-sm"
              onChange={setFilter}
              options={(availableFilters.data ?? []).map((item) => ({ value: item.questionId, label: item.label }))}
              placeholder="Select filtering report"
              searchPlaceholder="Search reports…"
              value={effectiveSortingFilter}
            />}
            {!sortedVerbatims?.owned ? <Button
              className="mt-3 w-full"
              disabled={!filter || inCart || (sortedVerbatims?.owned ?? false) || sortedVerbatims?.priceCents == null}
              onClick={() =>
                addToCart({
                  productId: "report-verbatims-sorted",
                  name: sortedVerbatims?.name ?? "Sorted Employee Verbatims",
                  priceCents: sortedVerbatims?.priceCents ?? 0,
                  keys: { EV_Sorting_Filter: filter },
                })
              }
            >
              {sortedVerbatims?.owned
                ? "Purchased"
                : inCart
                  ? "Added to Cart"
                  : "Add to Cart"}
            </Button> : null}
            {sortedVerbatims?.owned && sortedVerbatims.selection ? (
              <Button
                className="mt-2 w-full"
                onClick={() =>
                  api.reports.downloadVerbatimsWorkbook(
                    program?.id ?? "",
                    isDummy,
                    sortedVerbatims.selection,
                  )
                }
                variant="secondary"
              >
                Download sorted report
              </Button>
            ) : null}
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
  const [open, setOpen] = useState(false);
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
    enabled: Boolean(programId) && open,
  });
  return (
    <details className="group overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 bg-white p-4 text-sm font-semibold leading-6 text-zinc-800">
        <span className="flex-1">{question.caption}</span><ChevronRight className="size-4 transition group-open:rotate-90" />
      </summary>
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
    </details>
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
    queryFn: () => api.reports.workforceComparison(program?.id ?? "", isDummy),
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
              api.reports.downloadBenchmarkWorkbook(program?.id ?? "", isDummy)
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
    queryFn: () => api.reports.employerBenchmark(program?.id ?? "", isDummy),
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
              api.reports.downloadBenefitsWorkbook(program?.id ?? "", isDummy)
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
  isDummy,
}: {
  programId: string;
  filterQuestion: string;
  question: { QuestionId: string | number; Caption: string };
  isDummy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const result = useQuery({
    queryKey: [
      "response-detail-result",
      programId,
      question.QuestionId,
      filterQuestion,
      isDummy,
    ],
    queryFn: () =>
      api.reports.responseDetailResult(
        programId,
        String(question.QuestionId),
        filterQuestion,
        isDummy,
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
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get("demo") === "report-response-detail";
  const addToCart = useAppStore((state) => state.addToCart);
  const inCart = useAppStore((state) => state.cart.some((item) => item.productId === "report-response-detail"));
  const catalog = useQuery({ queryKey: ["report-catalog", program?.id], queryFn: () => api.reports.catalog(program?.id), enabled: Boolean(program) });
  const responseDetailProduct = catalog.data?.find((product) => product.id === "report-response-detail");
  const [filterQuestion, setFilterQuestion] = useState("");
  const filters = useQuery({
    queryKey: ["survey-filters", program?.id, isDemo],
    queryFn: () => api.reports.surveyFilters(program?.id ?? "", isDemo),
    enabled: Boolean(program),
  });
  const sections = useQuery({
    queryKey: ["response-detail-sections", program?.id, isDemo],
    queryFn: () => api.reports.responseDetailSections(program?.id ?? "", isDemo),
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
      {isDemo && responseDetailProduct ? (
        <div className="fixed right-5 top-5 z-[65] flex max-w-md items-center gap-4 rounded-xl border border-violet-200 bg-white p-4 shadow-xl" role="status"><div className="min-w-0 flex-1"><strong className="text-sm text-violet-700">Viewing demo</strong><p className="mt-1 text-xs text-zinc-500">You&apos;re viewing fake Response Detail data.</p></div><Button disabled={inCart || responseDetailProduct.owned || responseDetailProduct.priceCents == null} onClick={() => addToCart({ productId: responseDetailProduct.id, name: responseDetailProduct.name, priceCents: responseDetailProduct.priceCents ?? 0 })}>{inCart ? "Added" : "Add to cart"}</Button></div>
      ) : null}
      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <FilterButton
            filters={filters.data ?? []}
            loading={filters.isPending}
            onChange={setFilterQuestion}
            value={effectiveFilterQuestion}
          />
          {!isDemo ? <ResponseDetailDownloadMenu
            filteredDisabled={!effectiveFilterQuestion}
            onDownloadFiltered={() =>
              api.reports.downloadResponseDetailWorkbook(
                program?.id ?? "",
                effectiveFilterQuestion,
              )
            }
            onDownloadFull={() =>
              api.reports.downloadResponseDetailWorkbook(program?.id ?? "")
            }
          /> : null}
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
                        isDummy={isDemo}
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

type KeyImpactBubble = {
  category: string;
  percentage: number;
  question: string;
};

const keyImpactBubblePositions = [
  { x: 235, y: 195 },
  { x: 540, y: 190 },
  { x: 815, y: 215 },
  { x: 370, y: 475 },
  { x: 635, y: 465 },
  { x: 865, y: 475 },
  { x: 135, y: 455 },
  { x: 225, y: 675 },
  { x: 460, y: 670 },
  { x: 675, y: 665 },
] as const;

const keyImpactColors = [
  "#7c3aed",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#ddd6fe",
  "#ede9fe",
  "#f0edff",
  "#f3f0ff",
  "#f5f3ff",
  "#f7f5ff",
];

function bubbleLabel(category: string): string[] {
  if (category === "Communication and Workplace Culture") {
    return ["Communication and", "Workplace Culture"];
  }
  if (category === "Employee Benefits") return ["Employee", "Benefits"];
  return [category];
}

function KeyImpactBubbleChart({
  bubbles,
  onSelect,
}: {
  bubbles: KeyImpactBubble[];
  onSelect: (bubble: KeyImpactBubble) => void;
}) {
  return (
    <div className="overflow-x-auto" data-testid="key-impact-chart">
      <svg
        aria-label="Key impact contribution bubbles"
        className="mx-auto h-auto min-w-[760px] max-w-[1080px]"
        role="img"
        viewBox="0 0 1000 790"
      >
        {bubbles.map((bubble, index) => {
          const position = keyImpactBubblePositions[index];
          if (!position) return null;
          const radius = 55 + bubble.percentage * 7;
          const lines = bubbleLabel(bubble.category);
          return (
            <g
              aria-label={`${bubble.question}, ${bubble.percentage.toFixed(2)}% of contribution`}
              className="cursor-pointer outline-none [&>circle]:transition [&>circle]:duration-200 hover:[&>circle]:brightness-95 focus-visible:[&>circle]:stroke-violet-900 focus-visible:[&>circle]:stroke-[5px]"
              key={bubble.question}
              onClick={() => onSelect(bubble)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(bubble);
                }
              }}
              role="button"
              tabIndex={0}
              transform={`translate(${position.x} ${position.y})`}
            >
              <circle fill={keyImpactColors[index]} r={radius} />
              <text
                className="pointer-events-none fill-zinc-950 text-[15px] font-bold"
                textAnchor="middle"
              >
                {lines.map((line, lineIndex) => (
                  <tspan
                    dy={lineIndex === 0 ? `${-(lines.length - 1) * 0.55}em` : "1.1em"}
                    key={line}
                    x="0"
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function KeyImpactDialog({
  bubble,
  onClose,
}: {
  bubble: KeyImpactBubble;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/75 p-6"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-labelledby="key-impact-dialog-title"
        aria-modal="true"
        className="relative w-full max-w-md animate-fade-in rounded-2xl bg-white px-8 py-10 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Close contribution details"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
        <h2 className="text-xl font-semibold text-zinc-950" id="key-impact-dialog-title">
          {bubble.category}
        </h2>
        <p className="mt-4 text-base leading-6 text-zinc-500">
          {bubble.question} –{" "}
          <strong className="font-semibold text-violet-600">
            {bubble.percentage.toFixed(2)}% of contribution
          </strong>
          .
        </p>
      </section>
    </div>,
    document.body,
  );
}

export function KeyImpactAnalysisPage() {
  const program = useSelectedProgram();
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get("demo") === "report-kia";
  const addToCart = useAppStore((state) => state.addToCart);
  const inCart = useAppStore((state) => state.cart.some((item) => item.productId === "report-kia"));
  const catalog = useQuery({
    queryKey: ["report-catalog", program?.id],
    queryFn: () => api.reports.catalog(program?.id),
    enabled: Boolean(program),
  });
  const keyImpactProduct = catalog.data?.find((product) => product.id === "report-kia");
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedBubble, setSelectedBubble] = useState<KeyImpactBubble | null>(
    null,
  );
  const analysis = useQuery({
    queryKey: ["key-impact-analysis", program?.id, isDemo],
    queryFn: () => api.reports.keyImpactAnalysis(program?.id ?? "", isDemo),
    enabled: Boolean(program),
  });
  const report = analysis.data?.data.report ?? [];
  const bubbles = Object.entries(analysis.data?.data.mapping ?? {}).map(
    ([question, percentage]) => ({
      question,
      percentage,
      category:
        report.find((item) => item.key === question)?.label ?? "Key Impact",
    }),
  );
  return (
    <>
      <ReportHeader
        description="This report identifies key motivators of employee engagement within your unique population. This information is vital to knowing what workplace attributes are most important to retain your top talent and drive high productivity among all staff."
        title="Key Impact Analysis"
      />
      {isDemo && keyImpactProduct ? (
        <div className="fixed right-5 top-5 z-[65] flex max-w-md items-center gap-4 rounded-xl border border-violet-200 bg-white p-4 shadow-xl" role="status">
          <div className="min-w-0 flex-1"><strong className="text-sm text-violet-700">Viewing demo</strong><p className="mt-1 text-xs text-zinc-500">You&apos;re viewing fake Key Impact Analysis data.</p></div>
          <Button disabled={inCart || keyImpactProduct.owned || keyImpactProduct.priceCents == null} onClick={() => addToCart({ productId: keyImpactProduct.id, name: keyImpactProduct.name, priceCents: keyImpactProduct.priceCents ?? 0 })}>{inCart ? "Added" : "Add to cart"}</Button>
        </div>
      ) : null}
      <div className="p-6">
        {analysis.data && !isDemo ? (
          <DownloadReportButton
            onDownload={async () => {
              const signedUrl = analysis.data.data.data.signedUrl;
              if (signedUrl) {
                await api.reports.downloadCustomReport(
                  signedUrl,
                  analysis.data.data.fileName ?? "Key_Impact_Analysis.pdf",
                );
                return;
              }
              if (!chartRef.current) return;
              const image = await toPng(chartRef.current, {
                backgroundColor: "#ffffff",
                pixelRatio: 2,
              });
              const link = document.createElement("a");
              link.download = `Key_Impact_Analysis_${program?.year ?? "report"}.png`;
              link.href = image;
              link.click();
            }}
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
        ) : bubbles.length === 0 ? (
          <StatePanel
            kind="empty"
            title="No key impact analysis"
            message="The backend returned no key-impact results for this program."
          />
        ) : (
          <Card className="mt-10 overflow-hidden p-4 shadow-none sm:p-8">
            <div ref={chartRef}>
              <KeyImpactBubbleChart
                bubbles={bubbles}
                onSelect={setSelectedBubble}
              />
            </div>
          </Card>
        )}
      </div>
      {selectedBubble ? (
        <KeyImpactDialog
          bubble={selectedBubble}
          onClose={() => setSelectedBubble(null)}
        />
      ) : null}
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
