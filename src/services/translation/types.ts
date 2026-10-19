export interface BoundingBox {
  x: number; // percentage (0.0 to 100.0)
  y: number; // percentage (0.0 to 100.0)
  width: number; // percentage (0.0 to 100.0)
  height: number; // percentage (0.0 to 100.0)
}

export interface DetectedTextRegion {
  id: string;
  boundingBox: BoundingBox;
  sourceText: string;
  translatedText: string;
  confidence: number; // 0.0 to 1.0
  isSoundEffect?: boolean;
  readingOrder: number;
}

export interface PageTranslationResult {
  pageHash: string; // Hash or normalized URL
  imageUrl: string;
  sourceLanguage: string;
  targetLanguage: string;
  regions: DetectedTextRegion[];
  providerUsed: string;
  createdAt: number;
  costTokensEstimate?: number;
}

export interface TerminologyGlossaryEntry {
  id: string;
  seriesId?: string; // Optional: applies globally if undefined
  sourceTerm: string;
  targetTerm: string;
  notes?: string;
  createdAt: number;
}

export interface TranslationEngineConfig {
  provider: 'mock' | 'openai' | 'anthropic' | 'deepl' | 'google';
  apiKey?: string;
  sourceLang: string;
  targetLang: string;
  preserveSoundEffects: boolean;
  confidenceThreshold: number; // e.g. 0.65
}
