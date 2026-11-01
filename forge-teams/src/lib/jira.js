// Thin Jira REST helpers (Forge asApp / asUser).
import api, { route } from '@forge/api';
import { adfToText } from './parse.js';

export async function getIssue(issueKey) {
  const res = await api.asApp().requestJira(
    route`/rest/api/3/issue/${issueKey}?fields=summary,description,reporter,labels,issuetype,project,created`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Could not read ${issueKey} (${res.status})`);
  const j = await res.json();
  const f = j.fields || {};
  return {
    key: j.key,
    id: j.id,
    summary: f.summary || '',
    description: adfToText(f.description).trim(),
    reporterId: f.reporter?.accountId || null,
    reporterName: f.reporter?.displayName || '',
    labels: f.labels || [],
    issueType: f.issuetype?.name || '',
    projectKey: f.project?.key || '',
    url: `/browse/${j.key}`,
  };
}

const p = (text, marks) => ({ type: 'text', text, ...(marks ? { marks } : {}) });

/** Post a structured Chai Pot decision comment on the issue. */
export async function commentDecision(issueKey, { title, lines, footer }) {
  const body = {
    type: 'doc', version: 1,
    content: [
      { type: 'paragraph', content: [p('🫖 Chai Pot: ', [{ type: 'strong' }]), p(title, [{ type: 'strong' }])] },
      { type: 'bulletList', content: lines.map((l) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [p(l)] }] })) },
      ...(footer ? [{ type: 'paragraph', content: [p(footer, [{ type: 'em' }])] }] : []),
    ],
  };
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  return res.ok;
}

export async function setDecisionLabel(issueKey, decision) {
  const all = ['chaipot-auto-approved', 'chaipot-approved', 'chaipot-pending', 'chaipot-rejected'];
  const want = `chaipot-${decision.replace('_', '-')}`;
  const update = { labels: [...all.filter((l) => l !== want).map((l) => ({ remove: l })), { add: want }] };
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ update }),
  });
  return res.ok;
}

export async function createIssue(projectKey, summary, description, labels = []) {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: 'Task' },
        labels,
        description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] },
      },
    }),
  });
  if (!res.ok) throw new Error(`Create issue failed (${res.status}): ${await res.text()}`);
  return (await res.json()).key;
}

export async function displayName(accountId) {
  if (!accountId) return '';
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/user?accountId=${accountId}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    return (await res.json()).displayName || '';
  } catch { return ''; }
}
