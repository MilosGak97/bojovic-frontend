import { Link } from 'react-router';
import type { ModuleDefinition } from './modules';
import { ThinModuleMenu } from './components/ThinModuleMenu';

interface ModulePlaceholderPageProps {
  module: ModuleDefinition;
}

export default function ModulePlaceholderPage({ module }: ModulePlaceholderPageProps) {
  return (
    <main className="min-h-screen bg-slate-100">
      <ThinModuleMenu />
      <div className="flex items-center justify-center px-6 py-10">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Module Placeholder
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {module.title}
          </h1>
          <p className="mt-4 text-slate-600">
            {module.description}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            This page is ready in routing, but feature implementation is pending.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Back to modules
            </Link>
            <Link
              to="/route-planner"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Open Route Planner
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
