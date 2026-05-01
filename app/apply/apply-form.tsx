'use client';

import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { FormEvent, useState } from 'react';

type ApplyFormProps = {
  initialName: string;
  initialEmail: string;
};

type FieldErrors = Partial<Record<'name' | 'email' | 'studentType' | 'entryTerm', string>>;

const STUDENT_TYPES = [
  'Freshman',
  'Transfer',
  'International',
  'Returning student',
];

const ENTRY_TERMS = [
  'Fall',
  'Winter',
  'Spring',
  'Summer',
];

export function ApplyForm({ initialName, initialEmail }: ApplyFormProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [studentType, setStudentType] = useState('');
  const [entryTerm, setEntryTerm] = useState('');
  const [major, setMajor] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setErrors({});

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          studentType,
          entryTerm,
          major,
        }),
      });

      const data = (await response.json()) as {
        errors?: FieldErrors;
        message?: string;
        redirectUrl?: string;
      };

      if (!response.ok) {
        setErrors(data.errors ?? {});
        setSubmitError(data.message ?? 'Review the highlighted fields and try again.');
        return;
      }

      setSubmitted(true);
      setRedirectUrl(data.redirectUrl ?? 'https://apply.byuh.edu/');
    } catch {
      setSubmitError('Unable to submit right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Full name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-byuh-crimson"
            placeholder="Jane Doe"
          />
          {errors.name ? <span className="text-xs text-red-700">{errors.name}</span> : null}
        </label>

        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-byuh-crimson"
            placeholder="jane@example.com"
          />
          {errors.email ? <span className="text-xs text-red-700">{errors.email}</span> : null}
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Student type
          <select
            value={studentType}
            onChange={(event) => setStudentType(event.target.value)}
            className="rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-byuh-crimson"
          >
            <option value="">Select one</option>
            {STUDENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.studentType ? (
            <span className="text-xs text-red-700">{errors.studentType}</span>
          ) : null}
        </label>

        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Entry term
          <select
            value={entryTerm}
            onChange={(event) => setEntryTerm(event.target.value)}
            className="rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-byuh-crimson"
          >
            <option value="">Select one</option>
            {ENTRY_TERMS.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
          {errors.entryTerm ? (
            <span className="text-xs text-red-700">{errors.entryTerm}</span>
          ) : null}
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Intended major
        <input
          value={major}
          onChange={(event) => setMajor(event.target.value)}
          className="rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-byuh-crimson"
          placeholder="Optional"
        />
      </label>

      {submitError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {submitError}
        </div>
      ) : null}

      {submitted ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Your application details are ready.</p>
              <a
                href={redirectUrl}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-byuh-crimson px-4 py-2 text-sm font-semibold text-white transition hover:bg-byuh-burgundy"
              >
                Continue to official application
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-byuh-crimson px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-byuh-crimson/15 transition hover:bg-byuh-burgundy disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Submit application details'}
        <ArrowRight className="size-4" />
      </button>
    </form>
  );
}
