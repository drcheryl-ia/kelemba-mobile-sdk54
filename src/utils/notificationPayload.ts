/**
 * Extraction des métadonnées JSON des notifications (API).
 */
import type { Notification } from '@/types/notification.types';

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

export function parseNotificationData(
  n: Notification
): Record<string, unknown> | null {
  const raw = (n as { data?: unknown }).data;
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return asRecord(p);
    } catch {
      return null;
    }
  }
  return asRecord(raw);
}

export function extractTontineUid(n: Notification): string | undefined {
  const d = parseNotificationData(n);
  if (!d) return undefined;
  const u =
    (typeof d.tontineUid === 'string' && d.tontineUid) ||
    (typeof d.tontineId === 'string' && d.tontineId) ||
    undefined;
  return u;
}

export function extractCycleUid(n: Notification): string | undefined {
  const d = parseNotificationData(n);
  if (!d) return undefined;
  const u =
    (typeof d.cycleUid === 'string' && d.cycleUid) ||
    (typeof d.cycleId === 'string' && d.cycleId) ||
    undefined;
  return u;
}

export function extractScoreDelta(n: Notification): number | undefined {
  const d = parseNotificationData(n);
  if (!d) return undefined;
  const v = d.scoreDelta ?? d.delta ?? d.points;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const n0 = Number(v);
    if (Number.isFinite(n0)) return Math.round(n0);
  }
  return undefined;
}
