import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  FileChartColumn,
  FileText,
  MessageSquareText,
  PackageCheck,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { routeMap } from '../app/metadata'
import { Badge, Button, Card, PageHeader, StatePanel, cn } from '../components/ui'
import { useAppStore, useSelectedProgram } from '../store/app-store'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const reportCards = [
  {
    entitlement: 'WFR_Access',
    title: 'Workforce Feedback Results',
    description: 'Quantitative survey perceptions, both system-wide and segmented within respondent demographics.',
    path: routeMap.wfr,
    icon: BarChart3,
  },
  {
    entitlement: 'EV_Access',
    title: 'Employee Verbatims',
    description: 'Responses to open-ended survey questions, organized for review.',
    path: routeMap.employeeVerbatims,
    icon: MessageSquareText,
  },
  {
    entitlement: 'WBC_Access',
    title: 'Workforce Benchmark Comparisons',
    description: 'Compare positive response averages with participating award winners and non-winners.',
    path: routeMap.benchmarkData,
    icon: TrendingUp,
  },
  {
    entitlement: 'BBP_Access',
    title: 'Benefits & Best Practices',
    description: 'See which employee benefits and workplace practices are offered across benchmark groups.',
    path: routeMap.benefitsBestPractices,
    icon: FileChartColumn,
  },
] as const

function DashboardBars() {
  return (
    <div className="mt-5 grid grid-cols-2 gap-6">
      {[
        { label: 'Average Positive Response', value: 78, color: 'bg-violet-600' },
        { label: 'Average Negative Response', value: 12, color: 'bg-violet-300' },
      ].map((item) => (
        <div className="grid grid-rows-[250px_auto] gap-3 text-center" key={item.label}>
          <div className="flex items-end justify-center border-b border-l border-zinc-200 px-4">
            <div className={cn('relative w-16 rounded-t-xl', item.color)} style={{ height: `${item.value * 2.3}px` }}>
              <strong className="absolute -top-7 inset-x-0 text-sm text-zinc-800">{item.value}%</strong>
            </div>
          </div>
          <div className="flex items-start justify-center gap-2 text-xs text-zinc-500">
            <span className={cn('mt-1 size-2.5 shrink-0 rounded-sm', item.color)} />{item.label}
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const session = useAppStore((state) => state.session)
  const program = useSelectedProgram()
  const programs = session?.user.programs ?? []
  const selectProgram = useAppStore((state) => state.selectProgram)
  const cartCount = useAppStore((state) => state.cart.reduce((total, item) => total + item.quantity, 0))
  const visibleReports = reportCards.filter((report) => program?.entitlements[report.entitlement] === 'yes')

  return (
    <div className="bg-white">
      <div className="flex items-start justify-between gap-4 px-5 pb-5 pt-6 lg:px-6">
        <div>
          <h1 aria-label={`Welcome, ${session?.user.displayName ?? 'client'}`} className="text-[30px] font-bold leading-tight text-zinc-950">{program?.name ?? 'Dashboard'}</h1>
          <p className="mt-1 text-sm text-zinc-500">Welcome, {program?.organizationName ?? session?.user.displayName}!</p>
        </div>
        <Link className="hidden h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 lg:inline-flex" to={routeMap.cart}>
          <ShoppingCart className="size-4" /> Cart
          {cartCount ? <span className="grid min-w-5 place-items-center rounded-full bg-violet-600 px-1.5 text-[11px] text-white">{cartCount}</span> : null}
        </Link>
      </div>

      <div className="mx-5 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 p-3 lg:mx-6">
        <button className="grid size-10 shrink-0 place-items-center text-zinc-400" disabled aria-label="Previous program"><ChevronLeft /></button>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {programs.map((item) => (
            <button
              className={cn('h-10 rounded-xl border px-4 text-sm font-medium', item.id === program?.id ? 'border-violet-200 bg-violet-200 text-zinc-900' : 'border-zinc-300 bg-white')}
              key={item.id}
              onClick={() => selectProgram(item.id)}
            >
              {item.year}
            </button>
          ))}
        </div>
        <button className="grid size-10 shrink-0 place-items-center text-zinc-400" disabled aria-label="Next program"><ChevronRight /></button>
      </div>

      <div className="mt-6 border-t border-zinc-200 bg-[#fbfbfb] p-5 lg:p-6">
        <div className="grid gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
          <Card className="relative p-5">
            <h2 className="max-w-[85%] font-semibold">Average Positive and Average Negative Response</h2>
            <p className="mt-2 text-sm leading-5 text-zinc-500">Survey data collected via paper and online methods during the selected program.</p>
            <button className="absolute right-4 top-4 rounded-md p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Download response chart"><Download className="size-4" /></button>
            <DashboardBars />
            <button className="absolute bottom-4 right-4 grid size-6 place-items-center rounded-full border-2 border-violet-500 text-xs font-semibold text-violet-600" aria-label="About this chart"><CircleHelp className="size-4" /></button>
          </Card>

          <div className="grid gap-4">
            <section className="rounded-[20px] bg-slate-100 p-5">
              <h2 className="font-semibold">Response Rate Overview</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[['# of Surveys Completed', '263'], ['# of Surveys Sent', '318'], ['Response Rate', '83%']].map(([label, value], index) => (
                  <div className={cn('rounded-xl bg-white p-4', index === 2 && 'bg-violet-600 text-white')} key={label}>
                    <strong className="text-2xl">{value}</strong><p className={cn('mt-1 text-xs text-zinc-500', index === 2 && 'text-violet-100')}>{label}</p>
                  </div>
                ))}
              </div>
            </section>
            <Card className="p-5">
              <h2 className="font-semibold">What are your employees saying?</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">Highest scoring</p><p className="text-sm text-zinc-700">“I understand how my role contributes to the success of the organization.”</p><strong className="mt-2 block text-emerald-600">89% Agree</strong></div>
                <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-600">Opportunity</p><p className="text-sm text-zinc-700">“I receive useful feedback about my performance.”</p><strong className="mt-2 block text-rose-600">67% Agree</strong></div>
              </div>
            </Card>
          </div>
        </div>

        {visibleReports.length ? (
          <section className="mt-5 rounded-[20px] border border-zinc-200 bg-slate-50 p-4 md:p-6">
            <h2 className="text-xl font-bold">My Reports</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {visibleReports.map(({ icon: Icon, ...report }) => (
                <Card className="flex min-h-60 flex-col p-5" key={report.path}>
                  <span className="grid size-12 place-items-center rounded-xl bg-violet-100 text-violet-700"><Icon className="size-6" /></span>
                  <h3 className="mt-4 font-medium">{report.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-5 text-zinc-500">{report.description}</p>
                  <Link className="mt-4 inline-flex items-center text-sm font-medium text-violet-600" to={report.path}>View Report <ArrowRight className="ml-1 size-4" /></Link>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </div>
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
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-5">
              <div><h2 className="font-semibold">Completed surveys by demographic</h2><p className="mt-1 text-sm text-zinc-500">263 total responses</p></div>
              <Button className="gap-2" variant="secondary"><Download className="size-4" /> Download Chart</Button>
            </div>
            <div className="grid gap-6 p-5 md:grid-cols-2">
              {(['personal', 'workplace'] as const).map((group) => (
                <section key={group}>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-violet-600">{group} demographics</h2>
                  <div className="grid gap-3">
                    {report.data.filter((item) => item.group === group).map((item) => (
                      <details className="group rounded-xl border border-zinc-200 bg-white" key={item.category} open>
                        <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                          <span className="grid size-9 place-items-center rounded-lg bg-violet-50 text-violet-600"><Users className="size-4" /></span>
                          <h3 className="flex-1 font-medium">{item.category}</h3>
                          <ChevronRight className="size-4 transition group-open:rotate-90" />
                        </summary>
                        <dl className="divide-y divide-zinc-100 border-t border-zinc-100 px-4">{item.values.map((value) => <div className="flex justify-between py-3 text-sm" key={value.label}><dt className="text-zinc-600">{value.label}</dt><dd className="font-semibold">{value.count}</dd></div>)}</dl>
                      </details>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  )
}

export function CatalogPage() {
  const catalog = useQuery({ queryKey: ['report-catalog'], queryFn: api.reports.catalog })
  const addToCart = useAppStore((state) => state.addToCart)
  const cart = useAppStore((state) => state.cart)
  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'My Reports', path: routeMap.dashboard }, { label: 'Reports Store' }]} title="Reports Store" description="Purchase additional reports and data segmented by demographics to gain deeper insights into your workforce." />
      <div className="p-5 lg:p-6">
        {catalog.isPending ? <StatePanel kind="loading" title="Loading catalog" message="Checking currently available reports." /> : null}
        {catalog.isError ? <StatePanel kind="error" title="Catalog unavailable" message={catalog.error.message} /> : null}
        <div className="grid gap-5 md:grid-cols-2">
          {catalog.data?.map((product, index) => {
            const inCart = cart.some((item) => item.productId === product.id)
            return (
              <Card className={cn('flex flex-col p-5', index === 0 && 'md:col-span-2')} key={product.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <span className="grid size-12 place-items-center rounded-full bg-violet-100 text-violet-700">{index === 0 ? <PackageCheck /> : index === 1 ? <MessageSquareText /> : <FileChartColumn />}</span>
                  <div className="flex items-center gap-3">
                    <p className="text-sm">{product.priceCents ? <>Price <strong className="text-red-600">{money.format(product.priceCents / 100)}</strong></> : <strong className="text-red-600">Pricing varies</strong>}</p>
                    {product.available && product.priceCents ? <Button disabled={inCart} onClick={() => addToCart({ productId: product.id, name: product.name, priceCents: product.priceCents })}>{inCart ? 'Added to Cart' : 'Add to Cart'}</Button> : null}
                  </div>
                </div>
                <h2 className="mt-4 font-bold">{product.name}</h2>
                <p className="mt-2 flex-1 text-sm leading-5 text-zinc-500">{product.description}</p>
                {index === 0 ? (
                  <ul className="mt-4 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                    {['30-minute Survey Specialist phone call', 'Online data dashboard', 'Workforce Feedback Results', 'Employee Verbatims', 'Workforce Benchmark Comparisons', 'Benefits & Best Practices'].map((item) => <li className="flex gap-2" key={item}><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-600" />{item}</li>)}
                  </ul>
                ) : null}
                {!product.priceCents ? <a className="mt-5 text-sm font-semibold text-red-600" href="mailto:SurveyPro@workforcerg.com">Contact Sales →</a> : null}
              </Card>
            )
          })}
        </div>
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
  const total = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
  return (
    <>
      <PageHeader title="Checkout" description="Confirm the reports and billing summary for the selected survey program." />
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
        <Card className="p-6">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-6 text-violet-600" /><div><h2 className="text-xl font-bold">Secure checkout</h2><p className="mt-1 text-sm text-zinc-500">Payment collection is not connected in this preview.</p></div></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Billing name<input className="h-11 rounded-lg border border-zinc-300 px-3" placeholder="Name on card" /></label>
            <label className="grid gap-2 text-sm font-medium">Billing email<input className="h-11 rounded-lg border border-zinc-300 px-3" placeholder="name@company.com" type="email" /></label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">Card information<input className="h-11 rounded-lg border border-zinc-300 px-3" disabled placeholder="Payment provider connection required" /></label>
          </div>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No card details are collected and no order can be submitted from this frontend preview.</div>
          <Button className="mt-6" disabled>Complete Purchase</Button>
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
