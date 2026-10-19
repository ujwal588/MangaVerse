import { PageTranslationResult, TranslationEngineConfig, DetectedTextRegion } from './types';
import { hashImageUrl } from './cache';

export interface TranslationProvider {
  id: string;
  name: string;
  translateImage(
    imageDataUrl: string,
    config: TranslationEngineConfig
  ): Promise<PageTranslationResult>;
}

export class MockTranslationProvider implements TranslationProvider {
  id = 'mock';
  name = 'MangaVerse Local Simulator';

  async translateImage(
    imageDataUrl: string,
    config: TranslationEngineConfig
  ): Promise<PageTranslationResult> {
    // Simulate lightweight network/processing latency (300ms)
    await new Promise((resolve) => setTimeout(resolve, 300));

    const pageHash = hashImageUrl(imageDataUrl);

    // Realistic speech bubbles matching top-right to bottom-left manga reading flow
    const mockRegions: DetectedTextRegion[] = [
      {
        id: 'bubble-1',
        boundingBox: { x: 62.0, y: 12.0, width: 26.0, height: 18.0 },
        sourceText: '何が起こったんだ…！？',
        translatedText: 'What on earth just happened...?!',
        confidence: 0.96,
        readingOrder: 1,
      },
      {
        id: 'bubble-2',
        boundingBox: { x: 14.0, y: 28.0, width: 28.0, height: 20.0 },
        sourceText: '逃げろ！早くここから離れるんだ！',
        translatedText: 'Run! We have to get away from here right now!',
        confidence: 0.94,
        readingOrder: 2,
      },
      {
        id: 'bubble-3',
        boundingBox: { x: 50.0, y: 64.0, width: 34.0, height: 22.0 },
        sourceText: '心配いらない…俺が絶対に守ってみせる。',
        translatedText: "Don't worry... I promise I will protect you.",
        confidence: 0.98,
        readingOrder: 3,
      },
    ];

    return {
      pageHash,
      imageUrl: imageDataUrl.substring(0, 80) + '...',
      sourceLanguage: config.sourceLang || 'ja',
      targetLanguage: config.targetLang || 'en',
      regions: mockRegions,
      providerUsed: 'MangaVerse Simulator (Offline)',
      createdAt: Date.now(),
      costTokensEstimate: 0,
    };
  }
}

export class OpenAIProvider implements TranslationProvider {
  id = 'openai';
  name = 'OpenAI Vision (GPT-4o)';

  async translateImage(
    imageDataUrl: string,
    config: TranslationEngineConfig
  ): Promise<PageTranslationResult> {
    if (!config.apiKey) {
      throw new Error('OpenAI API Key is required. Please set it in Translation Settings.');
    }

    const pageHash = hashImageUrl(imageDataUrl);

    const systemPrompt = `You are an expert manga/manhwa translator and typesetter.
Analyze the provided comic page image:
1. Detect all speech bubbles, dialogue captions, and sound effects in proper manga reading order (top-right to bottom-left).
2. For each bubble, output boundingBox { x, y, width, height } as percentages (0 to 100) of total image dimensions.
3. Transcribe original text into sourceText, and translate into natural ${config.targetLang.toUpperCase()} as translatedText.
4. Output strictly valid JSON matching:
{
  "regions": [
    {
      "id": "bubble-1",
      "boundingBox": { "x": 10.5, "y": 20.0, "width": 25.0, "height": 15.0 },
      "sourceText": "...",
      "translatedText": "...",
      "confidence": 0.95,
      "readingOrder": 1
    }
  ]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Translate this comic page.' },
              { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
            ],
          },
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const parsed = JSON.parse(content);

    return {
      pageHash,
      imageUrl: imageDataUrl.substring(0, 80) + '...',
      sourceLanguage: config.sourceLang || 'auto',
      targetLanguage: config.targetLang,
      regions: parsed.regions || [],
      providerUsed: 'OpenAI (GPT-4o-mini)',
      createdAt: Date.now(),
      costTokensEstimate: data.usage?.total_tokens || 400,
    };
  }
}

export class AnthropicProvider implements TranslationProvider {
  id = 'anthropic';
  name = 'Anthropic Claude (Vision)';

  async translateImage(
    imageDataUrl: string,
    config: TranslationEngineConfig
  ): Promise<PageTranslationResult> {
    if (!config.apiKey) {
      throw new Error('Anthropic API Key is required. Please set it in Translation Settings.');
    }

    const pageHash = hashImageUrl(imageDataUrl);

    // Extract base64 and media type
    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid image data URL format for Anthropic');
    }
    const mediaType = match[1];
    const base64Data = match[2];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: 'Extract all speech bubbles with boundingBox {x, y, width, height} in percentages (0-100), sourceText, and translatedText in English. Output strictly JSON with key "regions".',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const rawText = data.content[0]?.text || '{}';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

    return {
      pageHash,
      imageUrl: imageDataUrl.substring(0, 80) + '...',
      sourceLanguage: config.sourceLang || 'auto',
      targetLanguage: config.targetLang,
      regions: parsed.regions || [],
      providerUsed: 'Anthropic (Claude 3.5 Haiku)',
      createdAt: Date.now(),
      costTokensEstimate: 500,
    };
  }
}

export class GeminiProvider implements TranslationProvider {
  id = 'gemini';
  name = 'Google Gemini (Free Tier)';

  async translateImage(
    imageDataUrl: string,
    config: TranslationEngineConfig
  ): Promise<PageTranslationResult> {
    if (!config.apiKey) {
      throw new Error('Gemini API Key is required. Get a free key at aistudio.google.com — no billing needed.');
    }

    const pageHash = hashImageUrl(imageDataUrl);

    // Extract base64 data (strip data URL header)
    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid image data URL format for Gemini');
    }
    const mimeType = match[1] as 'image/jpeg' | 'image/png' | 'image/webp';
    const base64Data = match[2];

    const prompt = `You are an expert manga/manhwa/manhua translator and typesetter.
Analyze this comic page image carefully:
1. Detect ALL speech bubbles, thought bubbles, dialogue captions, narration boxes, and sound effects.
2. Follow correct manga reading order (right-to-left, top-to-bottom for Japanese manga; top-to-bottom, left-to-right for Korean manhwa).
3. For each detected region, output its boundingBox as percentages (0–100) of the TOTAL image width and height: { "x": leftEdgePercent, "y": topEdgePercent, "width": regionWidthPercent, "height": regionHeightPercent }.
4. Transcribe the original text into sourceText. Translate it naturally into ${config.targetLang.toUpperCase()} as translatedText.
5. Output ONLY valid JSON in exactly this format, no markdown fences:
{
  "regions": [
    {
      "id": "bubble-1",
      "boundingBox": { "x": 10.5, "y": 5.0, "width": 25.0, "height": 12.0 },
      "sourceText": "original text",
      "translatedText": "translated text",
      "confidence": 0.95,
      "readingOrder": 1
    }
  ]
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Extract JSON robustly (strip any accidental markdown fences)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

    return {
      pageHash,
      imageUrl: imageDataUrl.substring(0, 80) + '...',
      sourceLanguage: config.sourceLang || 'auto',
      targetLanguage: config.targetLang,
      regions: (parsed.regions || []).map((r: any, idx: number) => ({
        id: r.id || `bubble-${idx + 1}`,
        boundingBox: r.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
        sourceText: r.sourceText || '',
        translatedText: r.translatedText || '',
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.9,
        readingOrder: r.readingOrder || idx + 1,
      })),
      providerUsed: 'Google Gemini (gemini-2.0-flash)',
      createdAt: Date.now(),
      costTokensEstimate: data.usageMetadata?.totalTokenCount || 0,
    };
  }
}

export class TranslationProviderFactory {
  public static getProvider(providerId: string): TranslationProvider {
    switch (providerId) {
      case 'gemini':
        return new GeminiProvider();
      case 'openai':
        return new OpenAIProvider();
      case 'anthropic':
        return new AnthropicProvider();
      case 'mock':
        return new MockTranslationProvider();
      default:
        // Default to Gemini (free, no server-side proxy required)
        return new GeminiProvider();
    }
  }
}
