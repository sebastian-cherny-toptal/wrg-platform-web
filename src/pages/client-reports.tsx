import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  MessageSquareText,
  Search,
  Sparkles,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { routeMap } from '../app/metadata'
import { Button, Card, PageHeader, cn } from '../components/ui'
import { useSelectedProgram } from '../store/app-store'

const focusAreas = [
  'Leadership',
  'Corporate Culture and Communications',
  'Role Satisfaction',
  'Work Environment',
  'Supervisor Relationship',
  'Training, Development and Resources',
  'Pay and Benefits',
  'Overall Engagement',
]

const questions = [
  { label: 'I understand how my role contributes to the success of the organization.', positive: 89, neutral: 7, negative: 4 },
  { label: 'I would recommend this organization as a great place to work.', positive: 84, neutral: 10, negative: 6 },
  { label: 'My supervisor provides the support I need to be successful.', positive: 78, neutral: 12, negative: 10 },
  { label: 'I receive useful feedback about my performance.', positive: 67, neutral: 17, negative: 16 },
]

function ReportHeader({
  title,
  description,
  action = true,
}: {
  title: string
  description: string
  action?: boolean
}) {
  const program = useSelectedProgram()
  const yearTitle = `${title} ${program?.year ?? ''}`.trim()
  return (
    <PageHeader
      actions={action ? (
        <Button className="gap-2 rounded-md" type="button">
          <Download className="size-4" /> Download Report
        </Button>
      ) : undefined}
      breadcrumbs={[{ label: 'My Reports', path: routeMap.dashboard }, { label: yearTitle }]}
      description={description}
      title={yearTitle}
    />
  )
}

function FilterToolbar({ children }: { children?: ReactNode }) {
  const [filterOpen, setFilterOpen] = useState(false)
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative">
        <Button className="gap-2" onClick={() => setFilterOpen((value) => !value)} variant="secondary">
          <Filter className="size-4" /> Filters <ChevronDown className="size-4" />
        </Button>
        {filterOpen ? (
          <div className="absolute left-0 top-12 z-10 w-64 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl">
            <label className="grid gap-2 text-xs font-semibold text-zinc-600">
              Compare by
              <select className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900">
                <option>All respondents</option>
                <option>Department</option>
                <option>Job level</option>
                <option>Workplace setting</option>
              </select>
            </label>
            <Button className="mt-3 w-full">Apply Filter</Button>
          </div>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
      <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-violet-600" /> Positive</span>
      <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-violet-300" /> Neutral</span>
      <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-rose-400" /> Negative</span>
    </div>
  )
}

function StackedResult({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100" aria-label={`${positive}% positive, ${neutral}% neutral, ${negative}% negative`}>
      <span className="bg-violet-600" style={{ width: `${positive}%` }} />
      <span className="bg-violet-300" style={{ width: `${neutral}%` }} />
      <span className="bg-rose-400" style={{ width: `${negative}%` }} />
    </div>
  )
}

export function DetailedResultsPage() {
  const [activeArea, setActiveArea] = useState(focusAreas[0])
  return (
    <>
      <ReportHeader
        action={false}
        description="Filter survey feedback by various demographics within your respondent population and dig into employee perspectives of each of the nine focus areas of the workplace."
        title="Detailed Results"
      />
      <div className="p-5 lg:p-6">
        <Card className="p-4 md:p-5">
          <FilterToolbar><Legend /></FilterToolbar>
          <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
            <nav className="grid content-start gap-1 border-r-0 border-zinc-200 pr-0 xl:border-r xl:pr-5" aria-label="Focus areas">
              {focusAreas.map((area) => (
                <button
                  className={cn('rounded-lg px-3 py-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-100', activeArea === area && 'bg-violet-50 font-semibold text-violet-700')}
                  key={area}
                  onClick={() => setActiveArea(area)}
                >
                  {area}
                </button>
              ))}
            </nav>
            <div>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Focus area</p>
                  <h2 className="mt-1 text-xl font-semibold">{activeArea}</h2>
                </div>
                <Button className="gap-2" variant="secondary"><Download className="size-4" /> Download Chart</Button>
              </div>
              <div className="grid gap-5">
                {questions.map((question) => (
                  <div key={question.label}>
                    <div className="mb-2 flex items-end justify-between gap-4 text-sm">
                      <p className="max-w-2xl text-zinc-700">{question.label}</p>
                      <strong>{question.positive}%</strong>
                    </div>
                    <StackedResult {...question} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

const patternConfigs = [
  { title: 'High Agreement', subtitle: 'Workplace strengths', color: 'bg-emerald-500', from: 80, to: 100, checked: true },
  { title: 'Moderate Agreement', subtitle: 'Areas to monitor', color: 'bg-amber-400', from: 60, to: 79, checked: true },
  { title: 'High Disagreement', subtitle: 'Opportunities to improve', color: 'bg-rose-500', from: 10, to: 20, checked: true },
]

export function ResponsePatternsPage() {
  const [preview, setPreview] = useState(false)
  return (
    <>
      <ReportHeader
        action={false}
        description="Set custom parameters for high and low survey scores to generate a color-coded report highlighting workplace strengths and opportunities for improvement."
        title="Response Patterns"
      />
      <div className="p-5 lg:p-6">
        <Card className="p-4 sm:p-5">
          <div className="grid gap-5 xl:grid-cols-3">
            {patternConfigs.map((config) => (
              <div className="rounded-2xl border border-zinc-200 p-4" key={config.title}>
                <div className="flex items-start gap-3">
                  <span className={cn('mt-1 size-3 rounded-full', config.color)} />
                  <div className="flex-1">
                    <h2 className="font-semibold">{config.title}</h2>
                    <p className="text-sm text-zinc-500">{config.subtitle}</p>
                  </div>
                  <span className="grid size-5 place-items-center rounded bg-violet-600 text-white"><Check className="size-3" /></span>
                </div>
                <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <label className="grid gap-1 text-xs text-zinc-500">From<input className="h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900" defaultValue={config.from} /></label>
                  <span className="mt-5 text-zinc-400">–</span>
                  <label className="grid gap-1 text-xs text-zinc-500">To<input className="h-10 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900" defaultValue={config.to} /></label>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button className="gap-2" disabled={!preview} variant="secondary"><Download className="size-4" /> Download Report</Button>
            <Button className="gap-2" onClick={() => setPreview(true)}><Sparkles className="size-4" /> Generate Preview</Button>
          </div>
        </Card>
        {preview ? (
          <Card className="mt-5 overflow-hidden">
            <div className="border-b border-zinc-200 p-5"><h2 className="font-semibold">Response pattern preview</h2></div>
            <div className="divide-y divide-zinc-100">
              {questions.map((question, index) => (
                <div className="grid gap-3 p-4 sm:grid-cols-[1fr_130px] sm:items-center" key={question.label}>
                  <p className="text-sm">{question.label}</p>
                  <span className={cn('rounded-full px-3 py-1 text-center text-xs font-semibold', index < 2 ? 'bg-emerald-100 text-emerald-700' : index === 2 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>
                    {index < 2 ? 'High agreement' : index === 2 ? 'Moderate' : 'High disagreement'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  )
}

export function AnnualTrendsPage() {
  const trendData = [
    { label: 'Leadership', current: 84, previous: 78 },
    { label: 'Role Satisfaction', current: 81, previous: 80 },
    { label: 'Work Environment', current: 77, previous: 71 },
    { label: 'Pay and Benefits', current: 65, previous: 69 },
  ]
  return (
    <>
      <ReportHeader
        description="Compare current levels of workforce engagement and satisfaction with the scores from your previous employee survey."
        title="Annual Trends"
      />
      <div className="grid gap-5 p-5 lg:grid-cols-3 lg:p-6">
        <Card className="p-5">
          <p className="text-sm text-zinc-500">Survey average</p>
          <div className="mt-3 flex items-end gap-3"><strong className="text-4xl">78%</strong><span className="mb-1 flex items-center text-sm font-semibold text-emerald-600"><ArrowUpRight className="size-4" /> 4%</span></div>
          <p className="mt-5 text-xs text-zinc-500">Compared with 74% in the previous survey.</p>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Category trends</h2><span className="text-xs text-zinc-500">2025 vs 2026</span></div>
          <div className="grid gap-5">
            {trendData.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex justify-between text-sm"><span>{item.label}</span><span className={item.current >= item.previous ? 'text-emerald-600' : 'text-rose-600'}>{item.current >= item.previous ? '+' : ''}{item.current - item.previous}%</span></div>
                <div className="grid gap-1.5"><div className="h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-violet-300" style={{ width: `${item.previous}%` }} /></div><div className="h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-violet-600" style={{ width: `${item.current}%` }} /></div></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}

export function EmployeeVerbatimsPage() {
  const [query, setQuery] = useState('')
  const verbatims = [
    { question: 'What makes this organization a great place to work?', count: 126, preview: 'The people, the mission, and the flexibility to do my best work.' },
    { question: 'What could this organization do to improve?', count: 98, preview: 'More transparent communication around decisions and career paths.' },
    { question: 'Is there anything else you would like us to know?', count: 54, preview: 'I appreciate the investment in our teams this year.' },
  ].filter((item) => item.question.toLowerCase().includes(query.toLowerCase()))
  return (
    <>
      <ReportHeader
        description="Any responses to open-ended survey questions are contained in this report."
        title="Employee Verbatims"
      />
      <div className="p-5 lg:p-6">
        <FilterToolbar>
          <label className="relative block w-full sm:w-72">
            <Search className="absolute left-3 top-3 size-4 text-zinc-400" />
            <input className="h-10 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Search questions" value={query} />
          </label>
        </FilterToolbar>
        <div className="grid gap-4">
          {verbatims.map((item) => (
            <Card className="p-5" key={item.question}>
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><MessageSquareText className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{item.question}</h2><span className="text-sm font-medium text-violet-700">{item.count} responses</span></div>
                  <p className="mt-2 text-sm text-zinc-500">“{item.preview}”</p>
                  <button className="mt-4 text-sm font-semibold text-violet-600">View responses →</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}

const benchmarkRows = [
  { label: 'Leadership', organization: 84, winners: 88, nonWinners: 72 },
  { label: 'Corporate Culture', organization: 79, winners: 86, nonWinners: 70 },
  { label: 'Role Satisfaction', organization: 81, winners: 84, nonWinners: 73 },
  { label: 'Work Environment', organization: 77, winners: 82, nonWinners: 68 },
  { label: 'Pay and Benefits', organization: 65, winners: 75, nonWinners: 61 },
]

function BenchmarkBars({ comparison = false }: { comparison?: boolean }) {
  return (
    <div className="grid gap-6">
      {benchmarkRows.map((row) => (
        <div key={row.label}>
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span>{row.label}</span><strong>{row.organization}%</strong></div>
          <div className="grid gap-1.5">
            <div className="h-3 rounded-full bg-zinc-100"><div className="h-3 rounded-full bg-violet-600" style={{ width: `${row.organization}%` }} /></div>
            <div className="h-3 rounded-full bg-zinc-100"><div className="h-3 rounded-full bg-violet-300" style={{ width: `${comparison ? row.nonWinners : row.winners}%` }} /></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function BenchmarkDataPage() {
  return (
    <>
      <ReportHeader description="Compare your organization’s results against benchmark groups across key workplace categories." title="Benchmark Data" />
      <div className="p-5 lg:p-6">
        <FilterToolbar><span className="text-sm text-zinc-500">Your organization vs award winners</span></FilterToolbar>
        <Card className="p-5 md:p-6"><BenchmarkBars /></Card>
      </div>
    </>
  )
}

export function ComparisonDataPage() {
  return (
    <>
      <ReportHeader description="Compare your survey results against other organizations in your industry and size." title="Comparison Data" />
      <div className="p-5 lg:p-6">
        <FilterToolbar><span className="text-sm text-zinc-500">Industry · 250–999 employees</span></FilterToolbar>
        <Card className="p-5 md:p-6">
          <div className="mb-5 flex flex-wrap gap-4 text-xs text-zinc-500"><span className="flex items-center gap-2"><i className="size-2.5 bg-violet-600" /> Your organization</span><span className="flex items-center gap-2"><i className="size-2.5 bg-violet-300" /> Comparison group</span></div>
          <BenchmarkBars comparison />
        </Card>
      </div>
    </>
  )
}

export function BenefitsBestPracticesPage() {
  const rows = [
    ['Flexible work arrangements', '92%', '76%', '63%'],
    ['Paid volunteer time', '61%', '48%', '29%'],
    ['Tuition reimbursement', '74%', '65%', '51%'],
    ['Employee wellness program', '89%', '72%', '58%'],
    ['Formal recognition program', '83%', '71%', '55%'],
  ]
  return (
    <>
      <ReportHeader description="Review benefits and workplace practices offered by winning and non-winning organizations." title="Benefits & Best Practices" />
      <div className="p-5 lg:p-6">
        <FilterToolbar />
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="p-4">Benefit or practice</th><th className="p-4">Your organization</th><th className="p-4">Winners</th><th className="p-4">Non-winners</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">{rows.map((row) => <tr key={row[0]}><td className="p-4 font-medium">{row[0]}</td>{row.slice(1).map((cell) => <td className="p-4" key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </Card>
      </div>
    </>
  )
}

export function ResponseDetailPage() {
  return (
    <>
      <ReportHeader description="This in-depth report reflects, by each survey question and for each demographic, the percentage of responses distributed across the entire 6-point scale." title="Response Detail Report" />
      <div className="p-5 lg:p-6">
        <FilterToolbar />
        <div className="grid gap-3">
          {focusAreas.slice(0, 6).map((area, index) => (
            <details className="group rounded-2xl border border-zinc-200 bg-white" key={area} open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-semibold"><span>{area}</span><ChevronDown className="size-5 transition group-open:rotate-180" /></summary>
              <div className="border-t border-zinc-100 p-5">
                <p className="mb-5 text-sm text-zinc-600">{questions[index % questions.length]?.label ?? ''}</p>
                <div className="grid grid-cols-6 gap-2 text-center">
                  {[3, 4, 7, 12, 29, 45].map((value, score) => <div key={score}><div className="flex h-36 items-end rounded-lg bg-zinc-50 p-1"><div className="w-full rounded-md bg-violet-500" style={{ height: `${Math.max(value * 2, 8)}%` }} /></div><strong className="mt-2 block text-sm">{value}%</strong><span className="text-[10px] text-zinc-500">{score + 1}</span></div>)}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </>
  )
}

const impactBubbles = [
  { label: 'Trust in leadership', score: 91, size: 'size-44', position: 'left-[38%] top-[8%]', color: 'bg-violet-600 text-white' },
  { label: 'Growth opportunities', score: 84, size: 'size-36', position: 'left-[16%] top-[34%]', color: 'bg-violet-400 text-white' },
  { label: 'Recognition', score: 79, size: 'size-32', position: 'left-[58%] top-[44%]', color: 'bg-fuchsia-300 text-zinc-900' },
  { label: 'Manager support', score: 75, size: 'size-28', position: 'left-[42%] top-[63%]', color: 'bg-indigo-300 text-zinc-900' },
  { label: 'Pay fairness', score: 62, size: 'size-24', position: 'left-[5%] top-[66%]', color: 'bg-violet-200 text-zinc-900' },
]

export function KeyImpactAnalysisPage() {
  return (
    <>
      <ReportHeader description="This report identifies key motivators of employee engagement within your unique population. This information is vital to knowing what workplace attributes are most important to retain your top talent and drive high productivity among all staff." title="Key Impact Analysis" />
      <div className="p-5 lg:p-6">
        <Card className="p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Engagement drivers</h2><p className="mt-1 text-sm text-zinc-500">Larger circles indicate a stronger relationship with overall engagement.</p></div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">Impact score</span></div>
          <div className="relative mx-auto h-[620px] max-w-3xl overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-white">
            {impactBubbles.map((bubble) => <button className={cn('absolute grid -translate-x-1/2 place-items-center rounded-full p-4 text-center shadow-md transition hover:scale-105', bubble.size, bubble.position, bubble.color)} key={bubble.label}><span><strong className="block text-2xl">{bubble.score}</strong><span className="text-xs">{bubble.label}</span></span></button>)}
          </div>
        </Card>
      </div>
    </>
  )
}

export function CustomReportsPage() {
  return (
    <>
      <ReportHeader action={false} description="In addition to the standard reporting package offered, more in-depth reporting is available." title="Custom Reports" />
      <div className="p-5 lg:p-6">
        <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
          For information about advanced reporting, contact <a className="font-semibold text-violet-700" href="mailto:SurveyPro@workforcerg.com">SurveyPro@workforcerg.com</a>.
        </div>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_1.4fr_150px_100px] gap-4 bg-zinc-100 p-4 text-xs font-semibold uppercase tracking-wide text-zinc-500"><span>Report name</span><span>Description</span><span>Upload date</span><span>Action</span></div>
          <div className="grid min-h-56 place-items-center p-8 text-center">
            <div><FileSpreadsheet className="mx-auto size-10 text-violet-400" /><h2 className="mt-3 font-semibold">No custom reports yet</h2><p className="mt-1 text-sm text-zinc-500">Your custom reports will be available for download here.</p></div>
          </div>
        </Card>
      </div>
    </>
  )
}
