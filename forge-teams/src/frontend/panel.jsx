import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Stack, Inline, Text, Strong, Button, ButtonGroup, Select, Textfield, SectionMessage, Spinner, Label, Heading, Badge,
} from '@forge/react';
import { call, StatusLozenge, PotBar, Checks, CURRENCIES } from './common';

function QuickSetup({ onDone }) {
  const [name, setName] = useState('Team Lunches & Offsites');
  const [budget, setBudget] = useState('60000');
  const [currency, setCurrency] = useState('INR');
  const [err, setErr] = useState('');
  return (
    <SectionMessage title="Create your team's first pot" appearance="information">
      <Stack space="space.100">
        <Text>Chai Pot tracks a shared team budget and reviews every expense request against your spend policy.</Text>
        <Label labelFor="pn">Pot name</Label>
        <Textfield id="pn" value={name} onChange={(e) => setName(e.target.value)} />
        <Inline space="space.100">
          <Stack><Label labelFor="pb">Budget</Label><Textfield id="pb" value={budget} onChange={(e) => setBudget(e.target.value)} /></Stack>
          <Stack><Label labelFor="pc">Currency</Label><Select inputId="pc" options={CURRENCIES} value={CURRENCIES.find((c) => c.value === currency)} onChange={(o) => setCurrency(o.value)} /></Stack>
        </Inline>
        {err ? <Text color="color.text.danger">{err}</Text> : null}
        <Button appearance="primary" onClick={async () => { try { await call('createPot', { name, budget: Number(budget), currency }); onDone(); } catch (e) { setErr(e.message); } }}>Create pot</Button>
      </Stack>
    </SectionMessage>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [potId, setPotId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');

  const load = async (pid = potId) => {
    setErr('');
    try { setData(await call('previewIssue', { potId: pid })); } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const act = async (fn) => {
    setBusy(true); setErr(''); setMsg('');
    try { const r = await fn(); if (r && r.ok === false) setErr(r.why); await load(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (err && !data) return <SectionMessage appearance="error"><Text>{err}</Text></SectionMessage>;
  if (!data) return <Spinner label="Reviewing this request" />;
  if (data.needsSetup) return <QuickSetup onDone={() => load()} />;

  const { parsed, verdict, pot, pots, existing } = data;
  const potOptions = pots.map((p) => ({ label: p.name, value: p.id }));
  const status = existing ? existing.status : verdict.decision;
  const flags = existing ? existing.flags : verdict.flags;
  const reasons = existing ? existing.reasons : verdict.reasons;

  return (
    <Stack space="space.200">
      <Inline spread="space-between" alignBlock="center">
        <Inline space="space.100" alignBlock="center">
          <Heading size="small">{parsed.amountText || 'No amount found'}</Heading>
          <StatusLozenge status={status} />
          {!existing ? <Badge appearance="default">preview</Badge> : null}
        </Inline>
        <Text size="small">Risk {verdict.riskScore}/10</Text>
      </Inline>
      <Text>{parsed.category}{parsed.vendor ? ` · ${parsed.vendor}` : ''} · requested by {data.issue.reporterName || 'unknown'}</Text>
      <Text><Strong>Why:</Strong> {reasons.join('; ')}</Text>
      {flags.length ? (
        <SectionMessage appearance="warning" title={`${flags.length} risk flag${flags.length > 1 ? 's' : ''}`}>
          <Stack space="space.050">{flags.map((f) => <Text key={f}>⚠️ {f}</Text>)}</Stack>
        </SectionMessage>
      ) : null}
      {!existing ? <Checks checks={verdict.checks} /> : null}
      <PotBar pot={pot} />
      {!existing && pots.length > 1 ? (
        <Stack space="space.050">
          <Label labelFor="pot">Pot</Label>
          <Select inputId="pot" options={potOptions} value={potOptions.find((o) => o.value === pot.id)} onChange={(o) => { setPotId(o.value); load(o.value); }} />
        </Stack>
      ) : null}
      {err ? <SectionMessage appearance="error"><Text>{err}</Text></SectionMessage> : null}
      {msg ? <Text>{msg}</Text> : null}
      {!existing ? (
        <Button appearance="primary" isDisabled={busy || !parsed.amountText} onClick={() => act(() => call('logIssue', { potId: pot.id }))}>Log to pot &amp; post decision</Button>
      ) : existing.status === 'pending' ? (
        <Stack space="space.100">
          <Textfield placeholder="Optional note for the requester" value={note} onChange={(e) => setNote(e.target.value)} />
          <ButtonGroup>
            <Button appearance="primary" isDisabled={busy} onClick={() => act(() => call('decide', { decision: 'approved', note }))}>Approve</Button>
            <Button appearance="danger" isDisabled={busy} onClick={() => act(() => call('decide', { decision: 'rejected', note }))}>Reject</Button>
          </ButtonGroup>
          <Text size="small">The requester can't approve their own spend.</Text>
        </Stack>
      ) : (
        <Text size="small">Decided {existing.decidedBy === 'policy' ? 'automatically by policy' : `by ${existing.decidedByName || 'a teammate'}`}.{existing.note ? ` Note: ${existing.note}` : ''}</Text>
      )}
    </Stack>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
