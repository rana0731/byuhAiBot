import { ApplyForm } from './apply-form';

type ApplyPageProps = {
  searchParams: Promise<{
    name?: string | string[];
    email?: string | string[];
  }>;
};

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function ApplyPage({ searchParams }: ApplyPageProps) {
  const params = await searchParams;
  const initialName = getSearchValue(params.name);
  const initialEmail = getSearchValue(params.email);

  return (
    <main className="min-h-screen bg-[#f8f4ed] px-4 py-8 text-slate-900 sm:px-6">
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-byuh-burgundy/15 bg-white p-6 shadow-xl shadow-slate-900/5">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-byuh-gold">
            BYU-Hawaii Admissions
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-byuh-crimson">
            Start your application
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Review the information from chat, add the missing details, then continue to the
            official BYU-Hawaii application system.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-[#fffdf8] p-6 shadow-xl shadow-slate-900/5">
          <ApplyForm initialName={initialName} initialEmail={initialEmail} />
        </div>
      </section>
    </main>
  );
}
