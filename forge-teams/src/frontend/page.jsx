import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Stack, Inline, Text, Strong, Heading, Button, ButtonGroup, Select, Textfield, SectionMessage, Spinner, Label,
  Tabs, TabList, Tab, TabPanel, DynamicTable, DonutChart, Link, Box,
} from '@forge/react';
import { call, StatusLozenge, PotBar, Card, CURRENCIES, CATEGORY_OPTIONS } from './common';

const minorToMajor = (n) => n / 100;

function Overview({ pots, onOpen }) {
  if (!pots.length) return <SectionMessage appearance="information" title="No pots yet"><Text>Create a pot in the Setup tab, or seed the demo data.</Text></SectionMessage>;
  return (
    <Stack space="space.200">
      {pots.map((p) => {
        const cats = Object.entries(p.raw.byCategory).map(([k, v]) => ({ category: k, amount: minorToMajor(v) }));
        return (
          <Card key={p.id}>
            <Stack space="space.150">
              <PotBar pot={p} />
              <Text size="small">Auto-approve ≤ {p.policy.autoApproveLimit} · hard cap {p.policy.hardCap}{p.policy.blockedCategories.length ? ` · blocked: ${p.policy.blockedCategories.join(', ')}` : ''}</Text>
              <Text size="small">{p.counts.total} requests · {p.counts.pending} waiting · {p.counts.rejected} rejected · {p.counts.flagged} flagged</Text>
              {cats.length ? <DonutChart data={cats} colorAccessor="category" valueAccessor="amount" labelAccessor="category" title="Spent by category" height={220} /> : null}
              <Button onClick={() => onOpen(p.id)}>Open ledger</Button>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}

function Ledger({ pots, potId, setPotId, siteUrl }) {
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (potId) call('getPot', { potId }).then(setDetail).catch((e) => setErr(e.message)); }, [potId]);
  const opts = pots.map((p) => ({ label: p.name, value: p.id }));
  const head = { cells: ['Work item', 'Request', 'Amount', 'Category', 'Requester', 'Status', 'Flags'].map((c) => ({ key: c, content: c, isSortable: c === 'Amount' })) };
  const rows = (detail?.entries || []).map((e) => ({
    key: e.id,
    cells: [
      { key: 'k', content: <Link href={`${siteUrl}/browse/${e.issueKey}`} openNewTab>{e.issueKey}</Link> },
      { key: 's', content: e.summary },
      { key: 'Amount', content: e.amountText },
      { key: 'c', content: e.category },
      { key: 'r', content: e.requesterName || '—' },
      { key: 'st', content: <StatusLozenge status={e.status} /> },
      { key: 'f', content: e.flags.length ? `⚠️ ${e.flags.length}` : '—' },
    ],
  }));
  return (
    <Stack space="space.200">
      <Box><Select options={opts} value={opts.find((o) => o.value === potId)} onChange={(o) => setPotId(o.value)} placeholder="Choose a pot" /></Box>
      {err ? <SectionMessage appearance="error"><Text>{err}</Text></SectionMessage> : null}
      {detail ? <PotBar pot={detail} /> : null}
      <DynamicTable head={head} rows={rows} rowsPerPage={10} emptyView={<Text>No requests logged in this pot yet.</Text>} />
    </Stack>
  );
}

function Approvals({ siteUrl, refresh }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const load = () => call('pending').then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const decide = async (issueKey, decision) => {
    setErr('');
    try { const r = await call('decide', { issueKey, decision }); if (r.ok === false) setErr(`${issueKey}: ${r.why}`); await load(); refresh(); } catch (e) { setErr(e.message); }
  };
  if (!list) return <Spinner />;
  return (
    <Stack space="space.200">
      {err ? <SectionMessage appearance="warning"><Text>{err}</Text></SectionMessage> : null}
      {!list.length ? <Text>Nothing is waiting for approval. 🎉</Text> : list.map((e) => (
        <Card key={e.id}>
          <Stack space="space.100">
            <Inline spread="space-between">
              <Text><Link href={`${siteUrl}/browse/${e.issueKey}`} openNewTab>{e.issueKey}</Link> · <Strong>{e.amountText}</Strong> · {e.pot}</Text>
              <Text size="small">Risk {e.riskScore}/10</Text>
            </Inline>
            <Text>{e.summary}</Text>
            <Text size="small">{e.reasons.join('; ')}</Text>
            {e.flags.map((f) => <Text key={f} size="small">⚠️ {f}</Text>)}
            <ButtonGroup>
              <Button appearance="primary" onClick={() => decide(e.issueKey, 'approved')}>Approve</Button>
              <Button appearance="danger" onClick={() => decide(e.issueKey, 'rejected')}>Reject</Button>
            </ButtonGroup>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

function Policy({ pots, potId, setPotId, refresh }) {
  const pot = pots.find((p) => p.id === potId);
  const [auto, setAuto] = useState('');
  const [cap, setCap] = useState('');
  const [budget, setBudget] = useState('');
  const [blocked, setBlocked] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!pot) return;
    setAuto(String(minorToMajor(pot.raw.autoApproveLimit)));
    setCap(String(minorToMajor(pot.raw.hardCap)));
    setBudget(String(minorToMajor(pot.raw.budget)));
    setBlocked(pot.policy.blockedCategories);
  }, [potId, pots]);
  const opts = pots.map((p) => ({ label: p.name, value: p.id }));
  if (!pot) return <Text>Create a pot first.</Text>;
  const save = async () => {
    setMsg('');
    try {
      await call('updatePolicy', { potId, patch: { autoApproveLimit: Number(auto), hardCap: Number(cap), budget: Number(budget), blockedCategories: blocked } });
      setMsg('Policy saved.'); refresh();
    } catch (e) { setMsg(e.message); }
  };
  return (
    <Stack space="space.150">
      <Select options={opts} value={opts.find((o) => o.value === potId)} onChange={(o) => setPotId(o.value)} />
      <Label labelFor="b">Budget ({pot.currency})</Label>
      <Textfield id="b" value={budget} onChange={(e) => setBudget(e.target.value)} />
      <Label labelFor="a">Auto-approve up to ({pot.currency})</Label>
      <Textfield id="a" value={auto} onChange={(e) => setAuto(e.target.value)} />
      <Label labelFor="c">Hard cap per request ({pot.currency})</Label>
      <Textfield id="c" value={cap} onChange={(e) => setCap(e.target.value)} />
      <Label labelFor="bl">Blocked categories</Label>
      <Select inputId="bl" isMulti options={CATEGORY_OPTIONS} value={CATEGORY_OPTIONS.filter((o) => blocked.includes(o.value))} onChange={(v) => setBlocked((v || []).map((o) => o.value))} />
      <Text size="small">Always on: split-purchase detection (same requester + vendor in 7 days), duplicate detection (same amount + vendor in 30 days), cash-like / urgency wording flags, no self-approval.</Text>
      <Button appearance="primary" onClick={save}>Save policy</Button>
      {msg ? <Text>{msg}</Text> : null}
    </Stack>
  );
}

function Setup({ refresh }) {
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [projectKey, setProjectKey] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Stack space="space.300">
      <Card>
        <Stack space="space.100">
          <Heading size="small">New pot</Heading>
          <Label labelFor="n">Name</Label>
          <Textfield id="n" placeholder="e.g. Q4 Offsite" value={name} onChange={(e) => setName(e.target.value)} />
          <Inline space="space.100">
            <Stack><Label labelFor="bb">Budget</Label><Textfield id="bb" value={budget} onChange={(e) => setBudget(e.target.value)} /></Stack>
            <Stack><Label labelFor="cc">Currency</Label><Select inputId="cc" options={CURRENCIES} value={CURRENCIES.find((c) => c.value === currency)} onChange={(o) => setCurrency(o.value)} /></Stack>
          </Inline>
          <Button appearance="primary" isDisabled={busy} onClick={async () => { setBusy(true); try { await call('createPot', { name, budget: Number(budget), currency }); setMsg(`Created "${name}".`); setName(''); setBudget(''); refresh(); } catch (e) { setMsg(e.message); } setBusy(false); }}>Create pot</Button>
          <Text size="small">Tip: add the label pot-&lt;pot-name&gt; to a work item to route it to a specific pot. New work items labelled "expense" are reviewed automatically.</Text>
        </Stack>
      </Card>
      <Card>
        <Stack space="space.100">
          <Heading size="small">Demo data</Heading>
          <Text>Creates two INR pots and six realistic expense requests in a Jira project, then reviews each one.</Text>
          <Label labelFor="pk">Jira project key</Label>
          <Textfield id="pk" placeholder="TEAM" value={projectKey} onChange={(e) => setProjectKey(e.target.value.toUpperCase())} />
          <Button isDisabled={busy} onClick={async () => { setBusy(true); setMsg('Seeding…'); try { const r = await call('seedDemo', { projectKey }); setMsg(`Seeded ${r.created.length} requests: ${r.created.map((c) => `${c.key} ${c.decision}`).join(', ')}`); refresh(); } catch (e) { setMsg(e.message); } setBusy(false); }}>Seed demo</Button>
        </Stack>
      </Card>
      {msg ? <SectionMessage appearance="information"><Text>{msg}</Text></SectionMessage> : null}
    </Stack>
  );
}

function App() {
  const [pots, setPots] = useState(null);
  const [err, setErr] = useState('');
  const [potId, setPotId] = useState(null);
  const [tab, setTab] = useState(0);
  const [siteUrl, setSiteUrl] = useState('');
  const refresh = () => call('listPots').then((p) => { setPots(p); if (!potId && p.length) setPotId(p[0].id); }).catch((e) => setErr(e.message));
  useEffect(() => { refresh(); call('whoami').then(() => {}).catch(() => {}); }, []);
  if (err) return <SectionMessage appearance="error"><Text>{err}</Text></SectionMessage>;
  if (!pots) return <Spinner label="Loading pots" />;
  return (
    <Stack space="space.200">
      <Heading size="large">🫖 Chai Pot for Teams</Heading>
      <Text>Shared team budgets with a policy engine and a Rovo treasurer. Ask Rovo: “How much is left in our offsite pot?”</Text>
      <Tabs id="tabs" selected={tab} onChange={setTab}>
        <TabList>
          <Tab>Pots</Tab>
          <Tab>Ledger</Tab>
          <Tab>Approvals</Tab>
          <Tab>Policy</Tab>
          <Tab>Setup</Tab>
        </TabList>
        <TabPanel><Box padding="space.200"><Overview pots={pots} onOpen={(id) => { setPotId(id); setTab(1); }} /></Box></TabPanel>
        <TabPanel><Box padding="space.200"><Ledger pots={pots} potId={potId} setPotId={setPotId} siteUrl={siteUrl} /></Box></TabPanel>
        <TabPanel><Box padding="space.200"><Approvals siteUrl={siteUrl} refresh={refresh} /></Box></TabPanel>
        <TabPanel><Box padding="space.200"><Policy pots={pots} potId={potId} setPotId={setPotId} refresh={refresh} /></Box></TabPanel>
        <TabPanel><Box padding="space.200"><Setup refresh={refresh} /></Box></TabPanel>
      </Tabs>
    </Stack>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
