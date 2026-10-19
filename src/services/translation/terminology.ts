import { db } from '../db';
import { TerminologyGlossaryEntry } from './types';

/**
 * Applies user-approved terminology overrides to a translated sentence.
 * Case-insensitive word boundary replacement.
 */
export function applyGlossaryOverrides(text: string, entries: TerminologyGlossaryEntry[]): string {
  if (!entries || entries.length === 0 || !text) return text;

  let result = text;
  for (const entry of entries) {
    if (!entry.sourceTerm || !entry.targetTerm) continue;

    // Escape regex special chars in term
    const escaped = entry.sourceTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    result = result.replace(regex, entry.targetTerm);
  }

  return result;
}

export async function getGlossaryEntries(seriesId?: string): Promise<TerminologyGlossaryEntry[]> {
  if (seriesId) {
    return db.glossary.where('seriesId').equals(seriesId).toArray();
  }
  return db.glossary.toArray();
}

export async function saveGlossaryEntry(
  sourceTerm: string,
  targetTerm: string,
  seriesId?: string,
  notes?: string
): Promise<TerminologyGlossaryEntry> {
  const entry: TerminologyGlossaryEntry = {
    id: crypto.randomUUID(),
    seriesId,
    sourceTerm: sourceTerm.trim(),
    targetTerm: targetTerm.trim(),
    notes,
    createdAt: Date.now(),
  };

  await db.glossary.put(entry);
  return entry;
}

export async function deleteGlossaryEntry(id: string): Promise<void> {
  await db.glossary.delete(id);
}
