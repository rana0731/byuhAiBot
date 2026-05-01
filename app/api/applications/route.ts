const OFFICIAL_APPLICATION_URL = 'https://apply.byuh.edu/';

type ApplicationPayload = {
  name?: unknown;
  email?: unknown;
  studentType?: unknown;
  entryTerm?: unknown;
  major?: unknown;
};

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateApplicationPayload(payload: ApplicationPayload) {
  const name = getStringValue(payload.name);
  const email = getStringValue(payload.email);
  const studentType = getStringValue(payload.studentType);
  const entryTerm = getStringValue(payload.entryTerm);
  const major = getStringValue(payload.major);
  const errors: Record<string, string> = {};

  if (!name) {
    errors.name = 'Enter your full name.';
  }

  if (!email) {
    errors.email = 'Enter your email address.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!studentType) {
    errors.studentType = 'Choose a student type.';
  }

  if (!entryTerm) {
    errors.entryTerm = 'Choose an entry term.';
  }

  return {
    values: {
      name,
      email,
      studentType,
      entryTerm,
      major,
    },
    errors,
  };
}

export async function POST(req: Request) {
  const payload = (await req.json()) as ApplicationPayload;
  const { values, errors } = validateApplicationPayload(payload);

  if (Object.keys(errors).length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const applicationApiUrl = process.env.APPLICATION_API_URL;

  if (applicationApiUrl) {
    const response = await fetch(applicationApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      return Response.json(
        { message: 'The application system did not accept the submission.' },
        { status: 502 },
      );
    }
  }

  return Response.json({
    redirectUrl: OFFICIAL_APPLICATION_URL,
  });
}
