'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { Panel } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const CHANGELOG_URL = 'https://github.com/reyvo1/selin/blob/main/CHANGELOG.md';
const RELEASE_NOTES_URL = 'https://github.com/reyvo1/selin/blob/main/RELEASE-NOTES.md';

type Release = {
  version?: string;
  sourceFingerprint?: string | null;
  buildId?: string | null;
  buildArtifactId?: string | null;
  databaseTarget?: { profile?: string | null; hostHash?: string | null; databaseHash?: string | null } | null;
};

type Health = {
  status?: string;
  service?: string;
  timestamp?: string;
  environment?: string;
  uptimeSeconds?: number;
  nodeVersion?: string;
  release?: Release;
};

export default function InfoProgramView({ token }: { token: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  async function refresh() {
    setMessage('');
    setCopied(false);
    try {
      const response = await authFetch(`${API}/health`, token);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? 'Gagal memuat info program.');
      setHealth(body as Health);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memuat info program.');
    }
  }

  useEffect(() => {
    void refresh();
  }, [token]);

  const release = health?.release;

  async function copySummary() {
    const lines = [
      'Toko360 - Info Program',
      `Aplikasi: Toko360`,
      `Versi aplikasi: ${release?.version ?? '-'}`,
      `Service: ${health?.service ?? '-'}`,
      `Status runtime: ${health?.status ?? '-'}`,
      `Lingkungan: ${health?.environment ?? '-'}`,
      `Waktu server: ${health?.timestamp ?? '-'}`,
      `Uptime server (detik): ${health?.uptimeSeconds ?? '-'}`,
      `Versi Node.js: ${health?.nodeVersion ?? '-'}`,
      `Build ID: ${release?.buildId ?? '-'}`,
      `Build artifact ID: ${release?.buildArtifactId ?? '-'}`,
      `Source fingerprint: ${release?.sourceFingerprint ?? '-'}`,
      `Database profile: ${release?.databaseTarget?.profile ?? '-'}`,
      `Database host hash: ${release?.databaseTarget?.hostHash ?? '-'}`,
      `Database hash: ${release?.databaseTarget?.databaseHash ?? '-'}`,
      `Endpoint API: ${API}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
    } catch {
      setMessage('Gagal menyalin info program ke clipboard.');
    }
  }

  return (
    <section className="stack">
      <Panel eyebrow="INFO PROGRAM" title="Informasi aplikasi" badge={release?.version ? `v${release.version}` : '-'}>
        <p className="sectionHelp">Versi, build, identitas deployment, dan detail rilis runtime. Data bersumber dari endpoint health publik tanpa mengubah state.</p>
        {message && <p className="notice">{message}</p>}
        <div className="grid2">
          <div><strong>Nama aplikasi</strong><div>Toko360</div></div>
          <div><strong>Versi aplikasi</strong><div>{release?.version ?? '-'}</div></div>
          <div><strong>Service</strong><div>{health?.service ?? '-'}</div></div>
          <div><strong>Status runtime</strong><div>{health?.status ?? '-'}</div></div>
          <div><strong>Lingkungan runtime</strong><div>{health?.environment ?? '-'}</div></div>
          <div><strong>Waktu server</strong><div>{health?.timestamp ?? '-'}</div></div>
          <div><strong>Uptime server (detik)</strong><div>{health?.uptimeSeconds ?? '-'}</div></div>
          <div><strong>Versi Node.js</strong><div>{health?.nodeVersion ?? '-'}</div></div>
          <div><strong>Build ID</strong><div>{release?.buildId ?? '-'}</div></div>
          <div><strong>Build artifact ID</strong><div>{release?.buildArtifactId ?? '-'}</div></div>
          <div><strong>Source fingerprint</strong><div>{release?.sourceFingerprint ?? '-'}</div></div>
          <div><strong>Database profile</strong><div>{release?.databaseTarget?.profile ?? '-'}</div></div>
          <div><strong>Database host hash</strong><div>{release?.databaseTarget?.hostHash ?? '-'}</div></div>
          <div><strong>Database hash</strong><div>{release?.databaseTarget?.databaseHash ?? '-'}</div></div>
          <div><strong>Endpoint API</strong><div>{API}</div></div>
        </div>
        <div className="actionRow">
          <a className="secondary" href={CHANGELOG_URL} target="_blank" rel="noreferrer">Buka changelog</a>
          <a className="secondary" href={RELEASE_NOTES_URL} target="_blank" rel="noreferrer">Buka release notes</a>
          <button type="button" className="secondary" onClick={() => void copySummary()}>{copied ? 'Tersalin' : 'Salin info program'}</button>
          <button type="button" className="secondary" onClick={() => void refresh()}>Muat ulang</button>
        </div>
      </Panel>
    </section>
  );
}
