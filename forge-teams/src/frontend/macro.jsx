import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Stack, Text, Heading, Spinner, SectionMessage, Strong } from '@forge/react';
import { call, PotBar, Card } from './common';

function App() {
  const [pots, setPots] = useState(null);
  const [pending, setPending] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    call('listPots').then(setPots).catch((e) => setErr(e.message));
    call('pending').then(setPending).catch(() => {});
  }, []);
  if (err) return <SectionMessage appearance="error"><Text>{err}</Text></SectionMessage>;
  if (!pots) return <Spinner label="Loading team pots" />;
  if (!pots.length) return <Text>No Chai Pot budgets yet — create one from Jira → Apps → Chai Pot for Teams.</Text>;
  return (
    <Card>
      <Stack space="space.200">
        <Heading size="small">🫖 Team pots</Heading>
        {pots.map((p) => <PotBar key={p.id} pot={p} />)}
        {pending.length ? (
          <Stack space="space.050">
            <Text><Strong>Waiting for approval</Strong></Text>
            {pending.slice(0, 5).map((e) => <Text key={e.id}>• {e.issueKey} — {e.amountText} — {e.summary}</Text>)}
          </Stack>
        ) : <Text size="small">Nothing waiting for approval.</Text>}
        <Text size="small">Live from Chai Pot for Teams · updated {new Date().toLocaleString()}</Text>
      </Stack>
    </Card>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
