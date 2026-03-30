// Ashby ATS API client
// Docs: https://developers.ashbyhq.com
// All endpoints are POST. Auth: Basic auth with API key as username, empty password.

const ASHBY_API_BASE = "https://api.ashbyhq.com";

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function ashbyRequest<T>(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`${ASHBY_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(apiKey),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ashby API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- Validate API key ---

interface ApiKeyInfoResponse {
  success: boolean;
  results: {
    organizationName: string;
  };
}

export async function validateApiKey(
  apiKey: string
): Promise<{ valid: boolean; organizationName?: string }> {
  try {
    const data = await ashbyRequest<ApiKeyInfoResponse>(
      "apiKey.info",
      apiKey
    );
    return {
      valid: data.success,
      organizationName: data.results?.organizationName,
    };
  } catch {
    return { valid: false };
  }
}

// --- List jobs ---

interface AshbyJobRaw {
  id: string;
  title: string;
  status: string;
  departmentId: string | null;
  locationId: string | null;
}

interface JobListResponse {
  success: boolean;
  results: AshbyJobRaw[];
}

export async function listJobs(apiKey: string) {
  const data = await ashbyRequest<JobListResponse>("job.list", apiKey);
  return data.results.filter((j) => j.status === "Open" || j.status === "Published");
}

// --- Job details ---

interface AshbyJobDetails {
  id: string;
  title: string;
  status: string;
  employmentType: string | null;
  department: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  compensationTier: {
    id: string;
    title: string;
    min: { value: number; currencyCode: string } | null;
    max: { value: number; currencyCode: string } | null;
  } | null;
  customFields: Array<{
    id: string;
    title: string;
    value: string | string[] | null;
  }>;
  hiringTeam: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    role: string;
  }>;
}

interface JobInfoResponse {
  success: boolean;
  results: AshbyJobDetails;
}

export async function getJobDetails(apiKey: string, jobId: string) {
  // Use loose typing to handle whatever Ashby returns
  const data = await ashbyRequest<{ success: boolean; results: Record<string, unknown> }>("job.info", apiKey, { jobId });
  const job = data.results as Record<string, any>;

  console.log("[ashby] job.info raw keys:", Object.keys(job));

  // Extract compensation — Ashby uses different field names across versions
  let compensationMin: number | null = null;
  let compensationMax: number | null = null;
  let currency = "USD";

  // Try compensationTier (newer API)
  if (job.compensationTier) {
    compensationMin = job.compensationTier.min?.value || null;
    compensationMax = job.compensationTier.max?.value || null;
    currency = job.compensationTier.min?.currencyCode || "USD";
  }
  // Try compensation (older API)
  if (!compensationMin && job.compensation) {
    compensationMin = job.compensation.min || job.compensation.low || null;
    compensationMax = job.compensation.max || job.compensation.high || null;
  }
  // Try customFields for compensation
  if (!compensationMin && Array.isArray(job.customFields)) {
    const compField = job.customFields.find((f: any) =>
      f.title?.toLowerCase().includes("salary") ||
      f.title?.toLowerCase().includes("compensation") ||
      f.title?.toLowerCase().includes("pay")
    );
    if (compField?.value) {
      const nums = String(compField.value).match(/\d[\d,]+/g);
      if (nums && nums.length >= 2) {
        compensationMin = parseInt(nums[0].replace(/,/g, ""), 10);
        compensationMax = parseInt(nums[1].replace(/,/g, ""), 10);
      }
    }
  }

  // Location — try multiple paths
  const location = job.location?.name
    || job.locationName
    || (Array.isArray(job.customFields) ? job.customFields.find((f: any) => f.title?.toLowerCase().includes("location"))?.value : null)
    || null;

  return {
    id: job.id,
    title: job.title,
    department: job.department?.name || job.departmentName || null,
    location,
    employmentType: job.employmentType || null,
    compensationMin,
    compensationMax,
    currency,
    customFields: Array.isArray(job.customFields) ? job.customFields : [],
    hiringTeam: Array.isArray(job.hiringTeam) ? job.hiringTeam : [],
  };
}

// --- Sources ---

interface AshbySource {
  id: string;
  title: string;
}

interface SourceListResponse {
  success: boolean;
  results: AshbySource[];
}

export async function findOrCreateSource(apiKey: string): Promise<string> {
  const list = await ashbyRequest<SourceListResponse>(
    "source.list",
    apiKey
  );
  const existing = list.results.find(
    (s) => s.title === "Scout"
  );
  if (existing) return existing.id;

  const created = await ashbyRequest<{
    success: boolean;
    results: AshbySource;
  }>("source.create", apiKey, { title: "Scout" });

  return created.results.id;
}

// --- Create candidate ---

interface CandidateCreateResponse {
  success: boolean;
  results: {
    id: string;
    name: string;
  };
}

export async function createCandidate(
  apiKey: string,
  params: {
    name: string;
    email?: string | null;
    phone?: string | null;
    linkedInUrl?: string | null;
    githubUrl?: string | null;
    sourceId?: string | null;
  }
): Promise<{ candidateId: string }> {
  const socialLinks: Array<{ type: string; url: string }> = [];
  if (params.linkedInUrl) {
    socialLinks.push({ type: "LinkedIn", url: params.linkedInUrl });
  }
  if (params.githubUrl) {
    socialLinks.push({ type: "GitHub", url: params.githubUrl });
  }

  const body: Record<string, unknown> = {
    name: params.name,
    socialLinks,
  };
  if (params.email) body.email = params.email;
  if (params.phone) body.phoneNumber = params.phone;
  if (params.sourceId) body.sourceId = params.sourceId;

  const data = await ashbyRequest<CandidateCreateResponse>(
    "candidate.create",
    apiKey,
    body
  );

  return { candidateId: data.results.id };
}

// --- Create application ---

interface ApplicationCreateResponse {
  success: boolean;
  results: {
    id: string;
  };
}

export async function createApplication(
  apiKey: string,
  params: {
    candidateId: string;
    jobId: string;
    sourceId?: string | null;
  }
): Promise<{ applicationId: string }> {
  const body: Record<string, unknown> = {
    candidateId: params.candidateId,
    jobId: params.jobId,
  };
  if (params.sourceId) body.sourceId = params.sourceId;

  const data = await ashbyRequest<ApplicationCreateResponse>(
    "application.create",
    apiKey,
    body
  );

  return { applicationId: data.results.id };
}

// --- Create note on a candidate ---

interface NoteCreateResponse {
  success: boolean;
  results: {
    id: string;
  };
}

export async function createNote(
  apiKey: string,
  params: {
    candidateId: string;
    note: string;
  }
): Promise<{ noteId: string }> {
  const data = await ashbyRequest<NoteCreateResponse>(
    "candidate.createNote",
    apiKey,
    {
      candidateId: params.candidateId,
      note: params.note,
    }
  );

  return { noteId: data.results.id };
}
