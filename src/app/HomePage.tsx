import { Link } from 'react-router';
import { dashboardModules } from './modules';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_#f8fafc_45%,_#f1f5f9_100%)] text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Bojovic Transport
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Operations Control Modules
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
            Choose where you want to work. Route Planner is live. The other modules are prepared as placeholders so navigation is already in place.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboardModules.map((module) => (
            <Link
              key={module.path}
              to={module.path}
              className="group rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  {module.title}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    module.ready
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {module.ready ? 'Live' : 'Planned'}
                </span>
              </div>

              <p className="min-h-14 text-sm leading-relaxed text-slate-600">
                {module.description}
              </p>

              <div className="mt-5 text-sm font-medium text-slate-800 transition group-hover:text-slate-950">
                {module.ready ? 'Open module' : 'View placeholder'}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
