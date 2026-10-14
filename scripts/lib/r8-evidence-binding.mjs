export const SOURCE_BINDING_EXEMPTIONS = {};

export const SOURCE_BINDING_EXEMPTION_NOTE = 'Artifak yang diizinkan tanpa source fingerprint. Setiap key harus berupa id evidence dan value berupa alasan minimal 20 karakter. Saat ini tidak ada satu pun: seluruh probe yang dibaca ci-r8-release-evidence-probe.mjs menulis sourceIdentity pada outputnya (ci-r1 s/d ci-r7, ci-r8-reporting-security-probe, ci-w3-cash-postgres-probe, run-built-browser-uat, browser-uat, ci-runtime-api-sweep, ci-notification-provider-probe, ci-worker-runtime-probe, run-postgres-dr-drill, run-payroll-adjustment-postgres-stage, run-stage20-release-readiness).';

export function hasDocumentedExemption(exemptions, id) {
  const rationale = exemptions?.[id];
  return typeof rationale === 'string' && rationale.trim().length >= 20;
}

export function sourceOf(value) {
  return value?.sourceIdentity?.value || value?.sourceIdentityAfter?.value || value?.sourceIdentityBefore?.value || null;
}

export function assertSourceBinding(evidence, sourceValue, exemptions = SOURCE_BINDING_EXEMPTIONS) {
  const unbound = [];
  for (const [id, value] of Object.entries(evidence)) {
    const fingerprint = sourceOf(value);
    if (!fingerprint) {
      if (!hasDocumentedExemption(exemptions, id)) unbound.push(`${id} (tanpa sourceIdentity dan tanpa exemption terdokumentasi)`);
      continue;
    }
    if (fingerprint !== sourceValue) throw new Error(`R8 ${id} stale source: ${fingerprint}`);
  }
  if (unbound.length) {
    throw new Error(`R8 evidence gagal terikat ke source fingerprint: ${unbound.join(', ')}. Setiap artifact wajib membawa sourceIdentity atau terdaftar di SOURCE_BINDING_EXEMPTIONS dengan alasan.`);
  }
}

export function artifactIsBound(id, evidence, sourceValue, exemptions = SOURCE_BINDING_EXEMPTIONS) {
  const value = evidence?.[id];
  if (!value) return false;
  if (value.status !== 'PASS') return false;
  const fingerprint = sourceOf(value);
  if (!fingerprint) return hasDocumentedExemption(exemptions, id);
  return fingerprint === sourceValue;
}

export function evaluateScenarioCoverage(scenarios, evidence, sourceValue, exemptions = SOURCE_BINDING_EXEMPTIONS) {
  const rows = scenarios.map((scenario) => {
    const refs = Array.isArray(scenario.executedEvidence) ? scenario.executedEvidence : [];
    const covered = refs.length > 0 && refs.every((ref) => artifactIsBound(ref, evidence, sourceValue, exemptions));
    const missing = refs.filter((ref) => !evidence?.[ref]);
    const unbound = refs.filter((ref) => evidence?.[ref] && !artifactIsBound(ref, evidence, sourceValue, exemptions));
    return { id: scenario.id, refs, covered, missing, unbound };
  });
  return rows;
}

export function declaredProductionTouched(evidence) {
  return Object.entries(evidence)
    .filter(([, value]) => value?.productionTouched === true)
    .map(([id]) => id);
}
