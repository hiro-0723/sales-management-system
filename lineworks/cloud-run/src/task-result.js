export function mapAppsScriptResultToHttp(result) {
  if (!result || typeof result !== 'object') {
    return {
      status: 503,
      body: { ok: false, code: 'INVALID_APPS_SCRIPT_RESPONSE' }
    };
  }
  if (result.ok === true) {
    return { status: 200, body: result };
  }
  if (result.retryable === true) {
    return { status: 503, body: result };
  }
  return { status: 200, body: result };
}

export async function callAppsScriptInternal({
  url,
  envelope,
  fetchImpl = fetch
}) {
  if (!url) throw new Error('Apps Script internal URL is not configured');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(envelope),
    redirect: 'follow'
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch (error) {
    return {
      status: 503,
      body: { ok: false, code: 'INVALID_APPS_SCRIPT_RESPONSE' }
    };
  }
  return mapAppsScriptResultToHttp(result);
}
