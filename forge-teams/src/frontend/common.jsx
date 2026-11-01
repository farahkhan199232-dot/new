import React from 'react';
import { Box, Inline, Stack, Text, Lozenge, ProgressBar, Strong, xcss } from '@forge/react';
import { invoke } from '@forge/bridge';

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD'].map((c) => ({ label: c, value: c }));
export const CATEGORY_OPTIONS = ['meals', 'travel', 'software', 'events', 'equipment', 'gifts', 'training', 'other'].map((c) => ({ label: c, value: c }));

export async function call(name, payload = {}) {
  const r = await invoke(name, payload);
  if (!r || !r.ok) throw new Error(r?.error || 'Something went wrong');
  return r.data;
}

const LOZ = { auto_approved: 'success', approved: 'success', pending: 'moved', rejected: 'removed' };
const LBL = { auto_approved: 'Auto-approved', approved: 'Approved', pending: 'Needs approval', rejected: 'Rejected' };
export const StatusLozenge = ({ status }) => <Lozenge appearance={LOZ[status] || 'default'} isBold>{LBL[status] || status}</Lozenge>;

export const card = xcss({
  padding: 'space.200', borderRadius: 'radius.medium', borderWidth: 'border.width', borderStyle: 'solid', borderColor: 'color.border', backgroundColor: 'elevation.surface.raised',
});

export function PotBar({ pot }) {
  const pct = Math.max(0, Math.min(100, pot.usedPct)) / 100;
  return (
    <Stack space="space.050">
      <Inline spread="space-between">
        <Text><Strong>{pot.name}</Strong></Text>
        <Text>{pot.remaining} left of {pot.budget}</Text>
      </Inline>
      <ProgressBar value={pct} appearance={pot.usedPct >= 90 ? 'default' : 'success'} ariaLabel={`${pot.usedPct}% of budget used`} />
      <Text size="small">{pot.spent} spent · {pot.pending} pending approval · {pot.usedPct}% committed</Text>
    </Stack>
  );
}

export const Checks = ({ checks }) => (
  <Stack space="space.050">
    {checks.map((c) => (
      <Text key={c.name}>{c.ok ? '✅' : '❌'} <Strong>{c.name}</Strong> — {c.detail}</Text>
    ))}
  </Stack>
);

export const Card = ({ children }) => <Box xcss={card}>{children}</Box>;
