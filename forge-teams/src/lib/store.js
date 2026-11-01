// Forge Key-Value Store persistence. One record per pot (`pot:<id>`) plus an index.
import { kvs } from '@forge/kvs';

const INDEX = 'pots:index';
const MAX_ENTRIES = 400;

export async function listPotIds() {
  return (await kvs.get(INDEX)) || [];
}

export async function getPot(id) {
  return (await kvs.get(`pot:${id}`)) || null;
}

export async function savePot(pot) {
  if ((pot.entries || []).length > MAX_ENTRIES) pot.entries = pot.entries.slice(-MAX_ENTRIES);
  pot.updatedAt = Date.now();
  await kvs.set(`pot:${pot.id}`, pot);
  const ids = await listPotIds();
  if (!ids.includes(pot.id)) await kvs.set(INDEX, [...ids, pot.id]);
  return pot;
}

export async function deletePot(id) {
  await kvs.delete(`pot:${id}`);
  const ids = await listPotIds();
  await kvs.set(INDEX, ids.filter((x) => x !== id));
}

export async function listPots() {
  const ids = await listPotIds();
  const pots = await Promise.all(ids.map(getPot));
  return pots.filter(Boolean);
}
