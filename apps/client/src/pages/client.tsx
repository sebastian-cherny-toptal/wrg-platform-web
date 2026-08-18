import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Cake,
  CheckCircle2,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileChartColumn,
  FileText,
  Globe2,
  LineChart,
  MessageSquareText,
  MapPin,
  Network,
  PackageCheck,
  PieChart,
  ShoppingCart,
  SlidersVertical,
  Trash2,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { routeMap } from '../app/metadata'
import { ImageDownloadMenu } from '../components/image-download-menu'
import { Badge, Button, Card, PageHeader, StatePanel, cn } from '../components/ui'
import { useAppStore, useSelectedProgram } from '../store/app-store'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const demographicIcons = {
  Gender: Users,
  'Age Generation': Cake,
  'Race/Ethnicity': Globe2,
  'Employment Length': Clock3,
  'Job Status': BriefcaseBusiness,
  'Workplace Setting': Building2,
  'Job Level': Tags,
  Department: Network,
  'Functional Title': BriefcaseBusiness,
  Location: MapPin,
} as const

const reportCards = [
  {
    entitlement: 'WFR_Access',
    title: 'Workforce Feedback Results',
    description: 'This quantitative report reflects the perceptions of respondents to each question on the employee survey, both system-wide and segmented within various demographics of the population.',
    path: routeMap.wfr,
    icon: PieChart,
  },
  {
    entitlement: 'EV_Access',
    title: 'Employee Verbatims',
    description: 'Any responses to open-ended survey questions are contained in this report.',
    path: routeMap.employeeVerbatims,
    icon: BarChart3,
  },
  {
    entitlement: 'WBC_Access',
    title: 'Workforce Benchmark Comparisons',
    description: 'This report averages the percentage of employees’ positive responses to each survey question from all participating organizations, presented in aggregate by all competitors that did and did not make the list.',
    path: routeMap.benchmarkData,
    icon: SlidersVertical,
  },
  {
    entitlement: 'BBP_Access',
    title: 'Benefits & Best Practices',
    description: 'This report provides the percentage of winning and non-winning organizations that offer various employee benefits and workplace practices.',
    path: routeMap.benefitsBestPractices,
    icon: LineChart,
  },
] as const

function surveyDateDescription(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return 'Survey collection dates are unavailable.'
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const start = startDate ? formatter.format(new Date(startDate)) : null
  const end = endDate ? formatter.format(new Date(endDate)) : null
  if (start && end) return `Survey data collected via paper and online methods between ${start} and ${end}.`
  return `Survey data collected via paper and online methods on ${start ?? end}.`
}

function DashboardBars({ positive, negative }: { positive: number; negative: number }) {
  const bars = [
    { label: 'Average Positive Response', value: positive, color: '#7c3aed' },
    { label: 'Average Negative Response', value: negative, color: '#a99bea' },
  ]
  return (
    <div className="mt-[35px]">
      <div className="relative ml-[38px] mr-[9px] h-[313px] border-b border-zinc-200">
        {[100, 80, 60, 40, 20].map((value, index) => (
          <div className="absolute inset-x-0 border-t border-zinc-200" key={value} style={{ top: `${index * 20}%` }}>
            <span className="absolute -left-8 -top-[10px] w-6 text-right text-[12px] text-zinc-500">{value}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 flex h-full items-end justify-around">
          {bars.map((bar) => (
            <div className="relative flex h-full w-[92px] items-end justify-center" key={bar.label}>
              <div className="relative w-[67px] rounded-t-[11px]" style={{ height: `${bar.value}%`, background: bar.color }}>
                <strong className="absolute inset-x-0 -top-6 text-center text-[14px] font-semibold text-zinc-900">{bar.value}%</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-[13px] text-zinc-500">
        {bars.map((bar) => (
          <div className="flex items-center gap-2" key={bar.label}>
            <span className="size-[10px] rounded-[2px]" style={{ background: bar.color }} />
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const [helpOpen, setHelpOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [programWindowStart, setProgramWindowStart] = useState(0)
  const responseChartRef = useRef<HTMLDivElement>(null)
  const responseRateRef = useRef<HTMLElement>(null)
  const statementsRef = useRef<HTMLDivElement>(null)
  const session = useAppStore((state) => state.session)
  const isPromotional = session?.user.role === 'promotional'
  const [promotionalModalOpen, setPromotionalModalOpen] = useState(isPromotional)
  useEffect(() => {
    if (!isPromotional || !promotionalModalOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPromotionalModalOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isPromotional, promotionalModalOpen])
  const program = useSelectedProgram()
  const programs = session?.user.programs ?? []
  const programWindowSize = 4
  const showProgramNavigation = programs.length > programWindowSize
  const visiblePrograms = showProgramNavigation
    ? programs.slice(programWindowStart, programWindowStart + programWindowSize)
    : programs
  const lastProgramWindowStart = Math.max(0, programs.length - programWindowSize)
  const selectProgram = useAppStore((state) => state.selectProgram)
  const visibleReports = isPromotional
    ? []
    : reportCards.filter((report) => program?.entitlements[report.entitlement] === 'yes')
  const dashboard = useQuery({
    queryKey: ['dashboard-overview', program?.id],
    queryFn: () => {
      if (!program) throw new Error('A program is required to load dashboard data')
      return api.dashboard.overview(program.id)
    },
    enabled: Boolean(program),
  })

  return (
    <div className="mr-2 min-h-full bg-white">
      <div className="flex h-[104px] items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h1 aria-label={`Welcome, ${session?.user.displayName ?? 'client'}`} className="text-[30px] font-bold leading-[36px] text-[#111111]">{program?.name ?? 'Dashboard'}</h1>
          <p className="mt-0.5 text-[16px] leading-6 text-zinc-500">Welcome, {program?.organizationName ?? session?.user.displayName}!</p>
        </div>
        <button className="hidden h-10 w-[89px] items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50 lg:inline-flex" onClick={() => setCartOpen(true)}>
          <ShoppingCart className="size-4" /> Cart
        </button>
      </div>

      <div className="mx-6 flex h-[70px] items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 p-3">
        {showProgramNavigation ? (
          <button
            className="grid size-10 shrink-0 place-items-center text-zinc-600 disabled:text-zinc-300"
            disabled={programWindowStart === 0}
            aria-label="Previous programs"
            onClick={() => setProgramWindowStart((start) => Math.max(0, start - programWindowSize))}
          >
            <ChevronLeft />
          </button>
        ) : null}
        <div
          className="grid min-w-0 flex-1 gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(visiblePrograms.length, 1)}, minmax(0, 1fr))` }}
        >
          {visiblePrograms.sort((a, b) => b.year - a.year).map((item) => (
            <button
              className={cn(
                'h-10 min-w-0 rounded-xl border px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                item.id === program?.id ? 'border-violet-200 bg-violet-200 text-zinc-900' : 'border-zinc-300 bg-white',
              )}
              key={item.id}
              onClick={() => selectProgram(item.id)}
            >
              {item.year}
            </button>
          ))}
        </div>
        {showProgramNavigation ? (
          <button
            className="grid size-10 shrink-0 place-items-center text-zinc-600 disabled:text-zinc-300"
            disabled={programWindowStart >= lastProgramWindowStart}
            aria-label="Next programs"
            onClick={() => setProgramWindowStart((start) => Math.min(lastProgramWindowStart, start + programWindowSize))}
          >
            <ChevronRight />
          </button>
        ) : null}
      </div>

      <div className="mt-6 border-t border-zinc-200 bg-[#fbfbfb] px-6 pb-6 pt-3">
        {!program ? (
          <StatePanel kind="empty" title="No program selected" message="Your account does not currently have access to a reporting program." />
        ) : dashboard.isPending ? (
          <StatePanel kind="loading" title="Loading dashboard" message="Retrieving survey results for the selected program." />
        ) : dashboard.isError ? (
          <StatePanel
            kind="error"
            title="Dashboard data unavailable"
            message="The survey results could not be loaded from the server. No sample data has been substituted."
            action={<Button variant="secondary" onClick={() => void dashboard.refetch()}>Try again</Button>}
          />
        ) : (
        <div className="grid gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div ref={responseChartRef}>
            <Card className="relative h-[727px] p-4">
              <h2 className="max-w-[317px] pr-8 text-[16px] font-semibold leading-6">Average Positive and Average Negative Response</h2>
              <p className="mt-2 text-[14px] leading-5 text-zinc-500">{surveyDateDescription(dashboard.data.agreement.StartDate, dashboard.data.agreement.EndDate)}</p>
              {!isPromotional ? (
                <ImageDownloadMenu
                  className="absolute right-4 top-4"
                  iconOnly
                  name="Average Positive and Average Negative Response"
                  targetRef={responseChartRef}
                />
              ) : null}
              <div className={cn(isPromotional && 'pointer-events-none select-none blur-xl')}>
                <DashboardBars positive={Math.round(dashboard.data.agreement.percentage)} negative={Math.round(dashboard.data.agreement.negativePercentage)} />
              </div>
              {isPromotional ? (
                <Link className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 rounded-md bg-red-600 px-4 py-2 text-center text-sm font-medium text-white shadow" to={routeMap.catalog}>
                  Click here to see your survey average
                </Link>
              ) : null}
              <button
                className="absolute bottom-4 right-4 grid size-6 place-items-center rounded-full border-2 border-violet-500 text-xs font-semibold text-violet-600"
                aria-label="Help"
                aria-expanded={helpOpen}
                onClick={() => setHelpOpen((open) => !open)}
              >
                ?
              </button>
              {helpOpen ? (
                <div className="absolute bottom-12 right-4 z-10 w-[360px] rounded-lg border border-zinc-200 bg-white p-4 text-[12px] leading-5 text-zinc-600 shadow-xl" role="tooltip">
                  <p>The Average Positive Response is the average percentage of agreement among your survey population. It averages each survey question to arrive at an overall average percentage for the entire survey.</p>
                  <p className="mt-2">The Average Negative Response is the average percentage of disagreement among your population.</p>
                  <p className="mt-2"><strong>Note:</strong> These percentages will not always add to 100 as they do not account for respondents who selected a neutral response.</p>
                </div>
              ) : null}
            </Card>
          </div>

          <div className="grid gap-3">
            <section className="relative h-[166px] rounded-[20px] bg-slate-100 p-3" ref={responseRateRef}>
              <h2 className="text-[16px] font-semibold">Response Rate Overview</h2>
              {!isPromotional ? (
                <ImageDownloadMenu
                  className="absolute right-3 top-3"
                  iconOnly
                  name="Response Rate Overview"
                  targetRef={responseRateRef}
                />
              ) : null}
              <div className={cn('mt-3 grid grid-cols-3 gap-2', isPromotional && 'pointer-events-none select-none blur-xl')}>
                {[
                  ['# of Surveys Completed', String(dashboard.data.responseRate.completedSurvey)],
                  ['# of Surveys Sent', String(dashboard.data.responseRate.sendSurvey)],
                  ['Response Rate', `${Math.round(dashboard.data.responseRate.responseRate)}%`],
                ].map(([label, value], index) => (
                  <div className={cn('flex h-[106px] flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-2 text-center', index === 2 && 'border-violet-100 bg-violet-100')} key={label}>
                    <p className="order-1 text-[12px] font-semibold leading-4 text-zinc-900">{label}</p>
                    <strong className="order-2 mt-1 text-[36px] leading-10 text-violet-600">{value}</strong>
                  </div>
                ))}
              </div>
              {isPromotional ? (
                <Link className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-md bg-red-600 px-4 py-2 text-center text-sm font-medium text-white shadow" to={routeMap.catalog}>
                  Click here to see your survey average
                </Link>
              ) : null}
            </section>
            <div ref={statementsRef}>
            <Card className="relative h-[549px] p-4">
              <h2 className="pr-8 text-[15px] font-semibold">What are your employees saying?</h2>
              {!isPromotional ? (
                <ImageDownloadMenu
                  className="absolute right-3 top-3"
                  iconOnly
                  name="What are your employees saying"
                  targetRef={statementsRef}
                />
              ) : null}
              <div className={cn(isPromotional && 'pointer-events-none select-none blur-xl')}>
              <div className="mt-2 grid grid-cols-2 gap-3 text-center text-[12px] text-zinc-700">
                <p className="whitespace-nowrap">Top Three Rated Survey Statements</p>
                <p className="whitespace-nowrap">Bottom Three Rated Survey Statements</p>
              </div>
              <div className="mt-[14px] grid grid-cols-2 gap-3">
                <div className="grid gap-3">
                  {dashboard.data.statements.top.map((statement) => (
                    <div className="flex min-h-[118px] flex-col items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-center" key={statement.title}>
                      <p className="text-[13px] leading-[18px] text-emerald-950">{statement.title}</p>
                      <span className="mt-2 rounded-lg bg-emerald-100 px-2 py-1 text-[13px] text-emerald-700">{Math.round(statement.percentage)}% Agree</span>
                    </div>
                  ))}
                  {dashboard.data.statements.top.length === 0 ? <p className="py-10 text-sm text-zinc-500">Not enough responses to display statements.</p> : null}
                </div>
                <div className="grid gap-3">
                  {dashboard.data.statements.bottom.map((statement) => (
                    <div className="flex min-h-[118px] flex-col items-center justify-center rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-center" key={statement.title}>
                      <p className="text-[13px] leading-[18px] text-orange-950">{statement.title}</p>
                      <span className="mt-2 rounded-lg bg-orange-100 px-2 py-1 text-[13px] text-orange-600">{Math.round(statement.percentage)}% Agree</span>
                    </div>
                  ))}
                  {dashboard.data.statements.bottom.length === 0 ? <p className="py-10 text-sm text-zinc-500">Not enough responses to display statements.</p> : null}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-center text-[9px] leading-[13px] text-zinc-500">
                <p>{dashboard.data.statements.noteTop}</p>
                <p>{dashboard.data.statements.noteBottom}</p>
              </div>
              </div>
              {isPromotional ? (
                <Link className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-md bg-red-600 px-4 py-2 text-center text-sm font-medium text-white shadow" to={routeMap.catalog}>
                  Click here to see your survey average
                </Link>
              ) : null}
            </Card>
            </div>
          </div>
        </div>
        )}

        {visibleReports.length ? (
          <section className="mt-3 rounded-[20px] border border-zinc-200 bg-slate-50 p-6">
            <h2 className="text-xl font-bold leading-[25px]">My Reports</h2>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {visibleReports.map(({ icon: Icon, ...report }) => (
                <Card className="flex h-[257px] flex-col p-5" key={report.path}>
                  <span className="grid size-12 place-items-center rounded-xl bg-violet-100 text-violet-600"><Icon className="size-6" /></span>
                  <h3 className="mt-4 text-[16px] font-medium">{report.title}</h3>
                  <p className="mt-1 flex-1 text-[14px] leading-5 text-zinc-500">{report.description}</p>
                  <Link className="mt-3 inline-flex items-center text-[14px] font-medium text-violet-600" to={report.path}>View Report <ArrowRight className="ml-1 size-4" /></Link>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {cartOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45" role="presentation" onClick={() => setCartOpen(false)}>
          <aside className="absolute inset-y-0 right-0 flex w-[340px] flex-col bg-white" aria-label="Cart" onClick={(event) => event.stopPropagation()}>
            <button className="absolute right-5 top-5 text-zinc-500 hover:text-zinc-900" aria-label="close" onClick={() => setCartOpen(false)}>
              <X className="size-5" />
            </button>
            <h2 className="px-5 pt-12 text-[20px] font-semibold">Cart</h2>
            <div className="flex-1" />
            <div className="border-t border-zinc-200 px-5 py-5">
              <div className="flex items-center justify-between text-[16px]"><span>Total:</span><span>$ 0</span></div>
            </div>
            <button className="mx-5 mb-5 h-9 bg-zinc-200 text-[14px] font-medium text-white" disabled aria-label="Total Amount is 0">Total Amount is 0</button>
          </aside>
        </div>
      ) : null}
      {isPromotional && promotionalModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="presentation" onClick={() => setPromotionalModalOpen(false)}>
          <section className="w-full max-w-[450px] bg-white px-10 py-9 text-center shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="promotional-results-title" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-xl font-semibold" id="promotional-results-title">The results are in!</h2>
            <p className="mt-8">Find out what your employees had to say.</p>
            <p className="mt-7">
              <Link className="font-medium text-red-600" to={routeMap.catalog}>Click here</Link>{' '}
              to discover the various reporting options we offer!
            </p>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export function ProgramsPage() {
  const session = useAppStore((state) => state.session)
  const selectedProgramId = useAppStore((state) => state.selectedProgramId)
  const selectProgram = useAppStore((state) => state.selectProgram)
  const navigate = useNavigate()
  const programs = session?.user.programs ?? []
  return (
    <>
      <PageHeader title="Choose a program" description="Report access and data are scoped to the selected program." />
      <div className="grid gap-4 p-5 lg:grid-cols-2 lg:p-6">
        {programs.map((program) => (
          <Card className="p-5" key={program.id}>
            <div className="flex items-start justify-between">
              <div><h2 className="font-bold">{program.name}</h2><p className="mt-1 text-sm text-zinc-600">{program.organizationName}</p></div>
              {program.id === selectedProgramId ? <Badge tone="success">Selected</Badge> : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">{Object.entries(program.entitlements).map(([key, value]) => <Badge key={key} tone={value === 'yes' ? 'success' : 'neutral'}>{key.replace('_Access', '')}</Badge>)}</div>
            <Button className="mt-5" variant={program.id === selectedProgramId ? 'secondary' : 'primary'} onClick={() => { selectProgram(program.id); void navigate(routeMap.dashboard) }}>
              {program.id === selectedProgramId ? 'Continue with program' : 'Select program'}
            </Button>
          </Card>
        ))}
      </div>
    </>
  )
}

export function WorkforceFeedbackPage() {
  const program = useSelectedProgram()
  const report = useQuery({
    queryKey: ['wfr-demographics', program?.id],
    queryFn: () => api.reports.demographics(program?.id ?? ''),
    enabled: Boolean(program),
  })
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'My Reports', path: routeMap.dashboard }, { label: `Employee Response Breakdown ${program?.year ?? ''}` }]}
        title={`Employee Response Breakdown ${program?.year ?? ''}`}
        description="Review the number of surveys completed within each demographic of your respondent population."
      />
      <div className="p-5 lg:p-6">
        {report.isPending ? (
          <StatePanel kind="loading" title="Loading response data" message="Preparing demographic categories for the selected program." />
        ) : report.isError ? (
          <StatePanel kind="error" title="Response data unavailable" message={report.error.message} action={<Button onClick={() => void report.refetch()}>Try again</Button>} />
        ) : report.data.length === 0 ? (
          <StatePanel kind="empty" title="No responses yet" message="This program does not have demographic response data." />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Total Number of Survey Responses by Demographic Category</h2>
              <Button
                className="gap-2"
                onClick={() => void api.reports.downloadFeedbackWorkbook(program?.id ?? '')}
              >
                <Download className="size-4" /> Download Report
              </Button>
            </div>
            <div className="grid gap-8">
              {(['personal', 'workplace'] as const).map((group) => (
                <section key={group}>
                  <h2 className="mb-4 text-base font-semibold capitalize">{group} Demographics</h2>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {report.data.filter((item) => item.group === group).map((item) => {
                      const DemographicIcon = item.category in demographicIcons
                        ? demographicIcons[item.category as keyof typeof demographicIcons]
                        : Users
                      return (
                        <details className="group overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm" key={item.category}>
                          <summary className="flex min-h-[72px] cursor-pointer list-none items-center gap-3 px-4">
                            <span className="grid size-6 place-items-center text-violet-600"><DemographicIcon className="size-6" /></span>
                            <h3 className="flex-1 text-left text-base font-semibold">{item.category}</h3>
                            <span className="grid size-8 place-items-center rounded-full border border-zinc-200 bg-white"><ChevronRight className="size-4 transition group-open:rotate-90" /></span>
                          </summary>
                          <dl className="divide-y divide-zinc-100 border-t border-zinc-200 bg-white px-4">{item.values.map((value) => <div className="flex justify-between py-3 text-sm" key={value.label}><dt className="text-zinc-700">{value.label}</dt><dd className="rounded-full bg-violet-200 px-2 py-0.5 text-xs font-semibold">{value.count}</dd></div>)}</dl>
                        </details>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}

export function CatalogPage() {
  const program = useSelectedProgram()
  const catalog = useQuery({
    queryKey: ['report-catalog', program?.id],
    queryFn: () => api.reports.catalog(program?.id),
    enabled: Boolean(program),
  })
  const surveyFilters = useQuery({
    queryKey: ['survey-filters', program?.id],
    queryFn: () => api.reports.surveyFilters(program?.id ?? ''),
    enabled: Boolean(program),
  })
  const addToCart = useAppStore((state) => state.addToCart)
  const cart = useAppStore((state) => state.cart)
  const [verbatimFilter, setVerbatimFilter] = useState('')
  const products = catalog.data ?? []
  const sortedVerbatims = products.find((product) => product.id === 'report-verbatims-sorted')
  const keyImpact = products.find((product) => product.id === 'report-kia')
  const resorted = products.find((product) => product.id === 'report-resort')
  return (
    <>
      <PageHeader
        actions={<Link to={routeMap.cart}><Button className="gap-2" variant="secondary"><ShoppingCart className="size-4" /> Cart</Button></Link>}
        breadcrumbs={[{ label: 'My Reports', path: routeMap.dashboard }, { label: 'Reports Store' }]}
        title="Reports Store"
        description="Purchase additional reports and data segmented by demographics to gain deeper insights into your workforce."
      />
      <div className="p-5 lg:p-6">
        <Card className="mb-5 p-6 shadow-none lg:p-8">
          <div className="max-w-5xl">
            <h2 className="text-2xl font-semibold">Employee Feedback Data Dashboard</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              This report identifies key motivators of employee engagement within your unique population. This information is vital to knowing what workplace attributes are most important. <strong className="text-zinc-900">Here&apos;s what you get:</strong>
            </p>
            <ul className="mt-6 grid gap-5">
              <li className="text-sm leading-6 text-zinc-600">
                <strong className="text-zinc-900">Phone Call.</strong> A 30-minute phone call with our Survey Specialist will help you go through the results and get answers to questions.
              </li>
              <li className="text-sm leading-6 text-zinc-600">
                <strong className="text-zinc-900">Online Data Dashboard.</strong> This is a place where you can get all your data in the ways you need it, including downloading it in charts and graphs.
              </li>
              {reportCards.map((report) => (
                <li className="border-t border-zinc-100 pt-5 text-sm leading-6 text-zinc-600" key={report.path}>
                  <strong className="text-zinc-900">{report.title}{report.title === 'Benefits & Best Practices' ? ' Report' : ''}.</strong>{' '}
                  {report.description}{' '}
                  <Link className="ml-2 inline-flex items-center whitespace-nowrap font-semibold text-red-600" to={report.path}>
                    View Report <ArrowRight className="ml-1 size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        {catalog.isPending ? <StatePanel kind="loading" title="Loading catalog" message="Checking currently available reports." /> : null}
        {catalog.isError ? <StatePanel kind="error" title="Catalog unavailable" message={catalog.error.message} /> : null}
        {catalog.data?.length === 0 ? (
          <StatePanel
            kind="empty"
            title="No report products configured"
            message="There are no additional reports available for this program yet. Please contact a Survey Professional at SurveyPro@workforcerg.com for assistance."
            action={<a href="mailto:SurveyPro@workforcerg.com"><Button>Contact a Survey Professional</Button></a>}
          />
        ) : null}
        {catalog.data ? (
          <div className="grid gap-5 md:grid-cols-2">
            {sortedVerbatims ? (
              <Card className="flex min-h-[360px] flex-col p-6 shadow-none">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-14 place-items-center rounded-full bg-violet-100 text-violet-700"><MessageSquareText /></span>
                  <strong className="text-xl text-red-600">{money.format(sortedVerbatims.priceCents / 100)}</strong>
                </div>
                <h2 className="mt-5 text-lg font-semibold">{sortedVerbatims.name}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{sortedVerbatims.description}</p>
                <select className="mt-5 h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm" onChange={(event) => setVerbatimFilter(event.target.value)} value={verbatimFilter}>
                  <option value="">Select filtering report</option>{(surveyFilters.data ?? []).map((filter) => <option key={filter.questionId} value={filter.label}>{filter.label}</option>)}
                </select>
                <Button
                  className="mt-3 bg-red-600 hover:bg-red-700"
                  disabled={!verbatimFilter || cart.some((item) => item.productId === sortedVerbatims.id)}
                  onClick={() => addToCart({ productId: sortedVerbatims.id, name: sortedVerbatims.name, priceCents: sortedVerbatims.priceCents })}
                >
                  {cart.some((item) => item.productId === sortedVerbatims.id) ? 'Added to Cart' : 'Add to Cart'}
                </Button>
                <p className="mt-3 text-xs text-zinc-500">Instant access after purchase.</p>
              </Card>
            ) : null}
            {keyImpact ? (
              <Card className="flex min-h-[360px] flex-col p-6 shadow-none">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-14 place-items-center rounded-full bg-violet-100 text-violet-700"><FileChartColumn /></span>
                  <strong className="text-xl text-red-600">{money.format(keyImpact.priceCents / 100)}</strong>
                </div>
                <h2 className="mt-5 text-lg font-semibold">{keyImpact.name}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{keyImpact.description}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <Link className="text-sm font-semibold text-red-600" to={routeMap.keyImpactAnalysis}>View Report →</Link>
                  <Button
                    className="bg-red-600 hover:bg-red-700"
                    disabled={cart.some((item) => item.productId === keyImpact.id)}
                    onClick={() => addToCart({ productId: keyImpact.id, name: keyImpact.name, priceCents: keyImpact.priceCents })}
                  >
                    {cart.some((item) => item.productId === keyImpact.id) ? 'Added to Cart' : 'Add to Cart'}
                  </Button>
                </div>
              </Card>
            ) : null}
            {resorted ? (
              <Card className="flex min-h-[230px] flex-col p-6 shadow-none md:col-span-2 md:flex-row md:items-start md:gap-6">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700"><PackageCheck /></span>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">{resorted.name}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{resorted.description}</p>
                  <a className="mt-5 inline-block text-sm font-semibold text-red-600" href="mailto:SurveyPro@workforcerg.com">Contact a Survey Professional →</a>
                </div>
                <strong className="text-sm text-red-600">Pricing: VARIES</strong>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}

export function CartPage() {
  const cart = useAppStore((state) => state.cart)
  const remove = useAppStore((state) => state.removeFromCart)
  const clear = useAppStore((state) => state.clearCart)
  const total = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
  return (
    <>
      <PageHeader title="Cart" description="Review optional reports before checkout." />
      <div className="p-5 lg:p-6">
        <div className="mb-4 flex items-center justify-between"><p className="text-sm text-zinc-500">{cart.length} item{cart.length === 1 ? '' : 's'}</p><Link to={routeMap.catalog}><Button variant="secondary">Go to Reports Store</Button></Link></div>
        {cart.length === 0 ? <StatePanel kind="empty" title="Your cart is empty" message="Browse the reports store to add a report." action={<Link to={routeMap.catalog}><Button>Browse reports</Button></Link>} /> : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="overflow-hidden">
              <ul className="divide-y divide-zinc-200">{cart.map((item) => <li className="flex items-center gap-4 p-5" key={item.productId}><span className="grid size-11 place-items-center rounded-xl bg-violet-100 text-violet-700"><FileText className="size-5" /></span><div className="min-w-0 flex-1"><strong>{item.name}</strong><p className="text-sm text-zinc-500">Report for selected program</p></div><strong>{money.format(item.priceCents * item.quantity / 100)}</strong><button className="p-2 text-zinc-400 hover:text-red-600" onClick={() => remove(item.productId)} aria-label={`Remove ${item.name}`}><Trash2 className="size-4" /></button></li>)}</ul>
              <div className="flex justify-end gap-3 p-4"><Button onClick={clear} variant="ghost">Remove all</Button><Button variant="ghost">Save for later</Button></div>
            </Card>
            <aside className="h-fit rounded-2xl bg-slate-900 p-6 text-white">
              <h2 className="text-lg font-bold">Summary</h2>
              <div className="mt-5 grid gap-3">{cart.map((item) => <div className="flex justify-between gap-3 text-sm text-slate-300" key={item.productId}><span>{item.name}</span><span>{money.format(item.priceCents / 100)}</span></div>)}</div>
              <div className="mt-6 flex justify-between border-t border-slate-700 pt-5 font-bold"><span>Total</span><span>{money.format(total / 100)}</span></div>
              <Link to={routeMap.checkout}><Button className="mt-6 w-full bg-red-600 hover:bg-red-700">Go To Checkout</Button></Link>
            </aside>
          </div>
        )}
      </div>
    </>
  )
}

export function CheckoutPage() {
  const cart = useAppStore((state) => state.cart)
  const program = useSelectedProgram()
  const total = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
  const paymentKey = `${program?.id ?? 'none'}:${cart.map((item) => `${item.productId}:${item.quantity}:${item.priceCents}`).join(',')}`
  const [paymentState, setPaymentState] = useState<{
    key: string
    clientSecret: string | null
    error: string | null
  } | null>(null)
  const currentPayment = paymentState?.key === paymentKey ? paymentState : null
  const clientSecret = currentPayment?.clientSecret ?? null
  const error = currentPayment?.error ?? null

  useEffect(() => {
    if (!program || total <= 0) return
    let active = true
    api.commerce.createPaymentIntent({
      programId: program.id,
      amount: total / 100,
      currency: 'USD',
      items: cart.map((item) => ({
        title: item.name,
        amount: item.priceCents * item.quantity / 100,
        keys: { productId: item.productId },
      })),
    }).then((intent) => {
      if (active) setPaymentState({ key: paymentKey, clientSecret: intent.client_secret, error: null })
    }).catch((reason: unknown) => {
      if (active) setPaymentState({
        key: paymentKey,
        clientSecret: null,
        error: reason instanceof Error ? reason.message : 'Unable to start secure checkout',
      })
    })
    return () => { active = false }
  }, [cart, paymentKey, program, total])

  if (cart.length === 0) {
    return <div className="p-6"><StatePanel kind="empty" title="Your cart is empty" message="Add a report before checking out." action={<Link to={routeMap.catalog}><Button>Browse reports</Button></Link>} /></div>
  }
  return (
    <>
      <PageHeader title="Checkout" description="Confirm the reports and billing summary for the selected survey program." />
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
        <Card className="p-6">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-6 text-violet-600" /><div><h2 className="text-xl font-bold">Secure checkout</h2><p className="mt-1 text-sm text-zinc-500">Credit and debit card details are collected securely by Stripe.</p></div></div>
          {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
          {!clientSecret && !error ? <div className="mt-6"><StatePanel kind="loading" title="Preparing payment" message="Opening the secure card form." /></div> : null}
          {clientSecret && stripePromise ? <Elements stripe={stripePromise} options={{ clientSecret }}><StripeCheckoutForm /></Elements> : null}
          {!stripePromise ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY to enable card payments.</div> : null}
        </Card>
        <aside className="h-fit rounded-2xl bg-slate-900 p-6 text-white">
          <h2 className="font-bold">Order summary</h2>
          <p className="mt-2 text-sm text-slate-400">{cart.length} report product{cart.length === 1 ? '' : 's'}</p>
          <div className="mt-5 flex justify-between border-t border-slate-700 pt-5 text-lg font-bold"><span>Total</span><span>{money.format(total / 100)}</span></div>
        </aside>
      </div>
    </>
  )
}

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

function StripeCheckoutForm() {
  const stripe = useStripe()
  const elements = useElements()
  const clearCart = useAppStore((state) => state.clearCart)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stripe || !elements) return
    setPaying(true)
    setError(null)
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${routeMap.dashboard}` },
      redirect: 'if_required',
    })
    if (result.error) {
      setError(result.error.message ?? 'Payment could not be completed')
      setPaying(false)
      return
    }
    if (result.paymentIntent.status === 'succeeded' || result.paymentIntent.status === 'processing') {
      clearCart()
      window.location.assign(routeMap.dashboard)
    }
  }

  return <form className="mt-6" onSubmit={submit}>
    <PaymentElement />
    {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
    <Button className="mt-6" disabled={!stripe || paying} type="submit">{paying ? 'Processing…' : 'Complete Purchase'}</Button>
  </form>
}
