export type Item = Record<string, unknown>;
export const base =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
export async function api(path: string, org = "", options: RequestInit = {}) {
  const csrf =
    document.cookie
      .split("; ")
      .find((v) => v.startsWith("cc_csrf="))
      ?.split("=")[1] || "";
  const response = await fetch(base + path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "X-Organization-Id": org,
      "X-CSRF-Token": csrf,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(`${response.status}: ${body.detail || "Request failed"}`);
  }
  if (response.status === 204) return {};
  return response.json();
}
export function write(
  method: string,
  body: unknown,
  etag?: string,
): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
    headers: {
      "Idempotency-Key": crypto.randomUUID(),
      ...(etag ? { "If-Match": etag } : {}),
    },
  };
}

export async function downloadReport(id: string, org: string) {
  const response = await fetch(base + `/reports/${id}/download`, {
    credentials: "include",
    headers: { "X-Organization-Id": org },
  });
  if (!response.ok)
    throw new Error(`${response.status}: report is unavailable`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `decision-report-${id}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
