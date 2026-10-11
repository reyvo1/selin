import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const WORK_ITEM_DIRECTORIES = ['work-items/active', 'work-items/completed'];

export function workItemCandidates(fileName) {
  return WORK_ITEM_DIRECTORIES.map((directory) => `${directory}/${fileName}`);
}

export function resolveWorkItemPath(fileName) {
  const candidates = workItemCandidates(fileName);
  const found = candidates.filter((candidate) => existsSync(`${ROOT}${candidate}`));
  if (!found.length) {
    throw new Error(`Work item tidak ditemukan di ${WORK_ITEM_DIRECTORIES.join(' atau ')}: ${fileName}`);
  }
  if (found.length > 1) {
    throw new Error(`Work item ambigu, harus berada pada tepat satu direktori: ${fileName} (${found.join(', ')})`);
  }
  return `${ROOT}${found[0]}`;
}

export function readWorkItem(fileName) {
  return JSON.parse(readFileSync(resolveWorkItemPath(fileName), 'utf8'));
}

export const DELIVERED_PHASES = ['RELEASE_READY', 'RELEASED', 'CLOSED'];

export function assertDeliveredWorkItem(workItem, releaseEvidenceRoot = 'handoff/release-evidence') {
  if (!DELIVERED_PHASES.includes(workItem.phase)) {
    throw new Error(`Work item ${workItem.id} belum berada pada fase terkirim: ${workItem.phase}`);
  }
  if (!workItem.releasedAt || !workItem.closedAt) {
    throw new Error(`Work item ${workItem.id} tidak mencatat releasedAt/closedAt pada fase ${workItem.phase}`);
  }
  const evidence = Array.isArray(workItem.releaseEvidence) ? workItem.releaseEvidence : [workItem.releaseEvidence];
  const files = evidence.filter((entry) => typeof entry === 'string' && entry.startsWith(`${releaseEvidenceRoot}/`));
  if (!files.length) {
    throw new Error(`Work item ${workItem.id} tidak menunjuk release evidence di ${releaseEvidenceRoot}`);
  }
  for (const file of files) {
    if (!existsSync(`${ROOT}${file}`)) {
      throw new Error(`Release evidence work item ${workItem.id} tidak ditemukan: ${file}`);
    }
  }
}