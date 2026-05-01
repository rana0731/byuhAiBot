import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Database,
  FileInput,
  Link2,
  MousePointerClick,
  Settings2,
  ToggleRight,
} from 'lucide-react';

const sidebarItems = [
  { label: 'Analytics', icon: BarChart3, href: '#analytics', active: false },
  { label: 'Agent', icon: Bot, href: '#agent', active: true },
  { label: 'Data Sources', icon: Database, href: '#data-sources', active: false },
];

const actionFields = [
  { label: 'First name', value: 'From chat profile' },
  { label: 'Last name', value: 'From chat profile' },
  { label: 'Email', value: 'From chat session' },
  { label: 'Student type', value: 'Ask before redirect' },
];

const sourceStatuses = [
  { label: 'Admissions website', status: 'Synced', detail: 'Ready for admission action routing' },
  { label: 'Financial Aid website', status: 'Synced', detail: 'Scholarship and aid answers available' },
  { label: 'OIT website', status: 'Synced', detail: 'Technology support answers available' },
];

export default function BackendAdminPage() {
  return (
    <main className="min-h-screen bg-[#f6f1e8] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-byuh-gold">
              BYUH Bot
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-byuh-crimson">Backend Admin</h1>
          </div>

          <nav className="flex-1 px-4 py-5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.label}
                  href={item.href}
                  className={[
                    'mb-2 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition',
                    item.active
                      ? 'bg-byuh-crimson text-white shadow-lg shadow-byuh-crimson/15'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-byuh-crimson',
                  ].join(' ')}
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span className="flex size-9 items-center justify-center rounded-lg bg-green-50 text-green-700">
                <CheckCircle2 className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">Bot online</p>
                <p className="text-xs">Actions available</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-byuh-gold">Agent control center</p>
                <h2 className="mt-1 text-3xl font-semibold text-byuh-crimson">Bot Actions</h2>
              </div>
              <a
                href="/admin"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-byuh-crimson/20 bg-white px-4 py-2 text-sm font-semibold text-byuh-crimson transition hover:bg-byuh-crimson hover:text-white"
              >
                Live Admin
                <ArrowUpRight className="size-4" />
              </a>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            <section id="analytics" className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-500">Action Runs</p>
                  <Activity className="size-5 text-byuh-gold" />
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">1</p>
                <p className="mt-1 text-sm text-slate-500">Configured action</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-500">Admissions Flow</p>
                  <MousePointerClick className="size-5 text-byuh-gold" />
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">On</p>
                <p className="mt-1 text-sm text-slate-500">Redirect with prefill</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-500">Data Sources</p>
                  <Database className="size-5 text-byuh-gold" />
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">3</p>
                <p className="mt-1 text-sm text-slate-500">Synced departments</p>
              </div>
            </section>

            <section id="agent" className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-byuh-gold">Actions the bot can perform</p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-950">Admission Application</h3>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                      <ToggleRight className="size-4" />
                      Enabled
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <div className="rounded-lg border border-byuh-crimson/15 bg-[#fffaf5] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="flex size-11 items-center justify-center rounded-lg bg-byuh-crimson text-white">
                            <FileInput className="size-5" />
                          </span>
                          <div>
                            <h4 className="text-lg font-semibold text-byuh-crimson">
                              Apply for admission
                            </h4>
                            <p className="mt-1 text-sm text-slate-600">
                              Opens a prefilled local application form before continuing to the official system.
                            </p>
                          </div>
                        </div>
                      </div>

                      <a
                        href="/apply"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-byuh-crimson px-4 py-2 text-sm font-semibold text-white transition hover:bg-byuh-burgundy"
                      >
                        Open target
                        <ArrowUpRight className="size-4" />
                      </a>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                          <Link2 className="size-4 text-byuh-gold" />
                          Redirect URL
                        </div>
                        <p className="mt-3 break-all rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          /apply?name=&email=
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                          <Settings2 className="size-4 text-byuh-gold" />
                          Trigger
                        </div>
                        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          User asks to apply, start an application, or submit admission form.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <span>Prefill field</span>
                      <span>Value source</span>
                    </div>
                    {actionFields.map((field) => (
                      <div
                        key={field.label}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-t border-slate-200 px-4 py-3 text-sm"
                      >
                        <span className="font-semibold text-slate-900">{field.label}</span>
                        <span className="text-slate-600">{field.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-byuh-gold">Bot instruction preview</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Action Behavior</h3>
                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  <p className="rounded-lg bg-slate-50 p-3">
                    When a student wants to apply for admission, collect missing basics first.
                  </p>
                  <p className="rounded-lg bg-slate-50 p-3">
                    If enough details are known, prefill the local application form.
                  </p>
                  <p className="rounded-lg bg-slate-50 p-3">
                    Include prefill values only from conversation or authenticated profile data.
                  </p>
                </div>
              </aside>
            </section>

            <section id="data-sources" className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-sm font-semibold text-byuh-gold">Data Sources</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Connected Knowledge</h3>
              </div>
              <div className="divide-y divide-slate-200">
                {sourceStatuses.map((source) => (
                  <div
                    key={source.label}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-950">{source.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{source.detail}</p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                      <CheckCircle2 className="size-4" />
                      {source.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
