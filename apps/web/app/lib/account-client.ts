export async function accountRequest(
  action: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(`/api/account/${action}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({
    message: "Account request failed. Please reload and retry.",
  }));
  if (!response.ok)
    throw Object.assign(
      new Error(
        typeof result.message === "string"
          ? result.message
          : "Unable to complete request.",
      ),
      { status: response.status },
    );
  return result;
}
