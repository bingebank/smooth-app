import { fail } from '../../lib/http.js';

/**
 * Download the list as CSV. Set ADMIN_TOKEN as a secret, then:
 *   curl -H "authorization: Bearer $ADMIN_TOKEN" \
 *        "https://myhealthscanner.com/api/export?table=subscribers" -o subscribers.csv
 */
const TABLES = {
  subscribers: ['email', 'name', 'platform', 'source', 'ip_country', 'created_at'],
  messages: ['name', 'email', 'topic', 'message', 'ip_country', 'created_at'],
};

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Prefix formula-triggering characters so spreadsheets treat them as text.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

function tokenMatches(provided, expected) {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function onRequestGet({ request, env }) {
  if (!env.ADMIN_TOKEN) return fail('Export is not configured.', 503);
  if (!tokenMatches(request.headers.get('authorization') || '', `Bearer ${env.ADMIN_TOKEN}`)) {
    return fail('Unauthorized.', 401);
  }
  if (!env.DB) return fail('Database is not bound.', 503);

  const table = new URL(request.url).searchParams.get('table') || 'subscribers';
  const columns = TABLES[table];
  if (!columns) return fail('Unknown table.', 400);

  // `table` and `columns` come from the allowlist above, never from user input.
  const { results } = await env.DB
    .prepare(`SELECT ${columns.join(', ')} FROM ${table} ORDER BY created_at DESC`)
    .all();

  const csv = [
    columns.join(','),
    ...results.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ].join('\n');

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${table}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
