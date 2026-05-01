export type SourceSite = {
  key: string;
  label: string;
  baseUrl: string;
};

export const SOURCE_SITES: SourceSite[] = [
  {
    key: 'admissions',
    label: 'Admissions website',
    baseUrl: 'https://admissions.byuh.edu',
  },
  {
    key: 'financialaid',
    label: 'Financial aid website',
    baseUrl: 'https://financialaid.byuh.edu',
  },
  {
    key: 'housing',
    label: 'Housing website',
    baseUrl: 'https://housing.byuh.edu',
  },
  {
    key: 'oit',
    label: 'OIT website',
    baseUrl: 'https://oit.byuh.edu',
  },
];

export const LIVE_CHAT_PRIORITY_KEYS = ['admissions', 'financialaid', 'oit'] as const;

export const LIVE_CHAT_PRIORITY_SITES = SOURCE_SITES.filter((site) =>
  LIVE_CHAT_PRIORITY_KEYS.includes(site.key as typeof LIVE_CHAT_PRIORITY_KEYS[number]),
);

export const DEFAULT_SOURCE_SITE = SOURCE_SITES[0];

export function normalizeUrl(url: string) {
  return new URL(url).href.replace(/\/$/, '');
}

export function getSourceSiteByKey(key: string) {
  return SOURCE_SITES.find((site) => site.key === key);
}

export function getDepartmentLabel(key: string) {
  switch (key) {
    case 'admissions':
      return 'Admissions';
    case 'financialaid':
      return 'Financial Aid';
    case 'oit':
      return 'OIT';
    default:
      return getSourceSiteByKey(key)?.label.replace(/\s+website$/i, '') ?? key;
  }
}

export function resolveSourceSite(input?: string | null) {
  if (!input) {
    return DEFAULT_SOURCE_SITE;
  }

  const site = getSourceSiteByKey(input);
  if (site) {
    return site;
  }

  const normalizedUrl = normalizeUrl(input);

  return {
    key: 'custom',
    label: `${new URL(normalizedUrl).hostname} website`,
    baseUrl: normalizedUrl,
  } satisfies SourceSite;
}

export function getSourceLabel(url: string) {
  const normalizedUrl = normalizeUrl(url);

  const matchingSite = SOURCE_SITES.find((site) =>
    normalizedUrl.startsWith(normalizeUrl(site.baseUrl)),
  );

  return matchingSite?.label ?? `${new URL(normalizedUrl).hostname} website`;
}
