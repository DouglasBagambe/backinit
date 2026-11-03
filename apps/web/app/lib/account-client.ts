export async function accountRequest(
  action: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(`/api/account/${action}`, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({
    message: "Account request failed. Please reload and retry.",
  }));
  if (!response.ok)
    throw Object.assign(
      new Error(
        response.status >= 500
          ? "Accounts are temporarily unavailable. Please try again later."
          : typeof result.message === "string"
            ? result.message
            : "Unable to complete request.",
      ),
      { status: response.status },
    );
  return result;
}
