import OpenAI from 'openai';
import type { DraftTemplate } from './draft.templates.js';
import { DRAFT_TEMPLATES } from './draft.templates.js';

export async function* streamDraftDocument(
  openai: OpenAI,
  template: DraftTemplate,
  situationDescription: string,
  additionalFacts: Record<string, string>,
): AsyncGenerator<string> {
  const slotsDescription = template.slots
    .map(s => `${s.name}: ${s.label} (${s.description})`)
    .join('\n');

  const extractionResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          "You are a legal document assistant. Extract specific facts from the user's situation description to fill a legal document. Return ONLY a JSON object where keys are slot names and values are extracted strings. If a fact is not mentioned, return an empty string for that slot.",
      },
      {
        role: 'user',
        content:
          `Template slots needed:\n${slotsDescription}\n\nSituation: ${situationDescription}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const rawContent = extractionResponse.choices[0]?.message?.content ?? '{}';
  let extracted: Record<string, string> = {};
  try {
    extracted = JSON.parse(rawContent) as Record<string, string>;
  } catch {
    // malformed JSON — proceed with empty extraction
  }

  const merged: Record<string, string> = { ...extracted, ...additionalFacts };

  const slotValues: Record<string, string> = {};
  for (const slot of template.slots) {
    slotValues[slot.name] = merged[slot.name] || `[${slot.label} - to be filled]`;
  }

  let filledTemplate = template.structure;
  for (const [name, value] of Object.entries(slotValues)) {
    filledTemplate = filledTemplate.replaceAll(`{{${name}}}`, value);
  }

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      {
        role: 'system',
        content: `You are a senior Indian advocate. You have received a draft legal document that has been auto-generated from a template. Your task:
1. Fix any grammatical or legal language issues
2. Ensure all Indian legal formalities and correct court address formats
3. Do NOT change the structure or add new sections
4. Output the complete, polished document text only — no preamble, no explanation, just the document.`,
      },
      {
        role: 'user',
        content: `Please polish this draft:\n\n${filledTemplate}`,
      },
    ],
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

export function findTemplate(templateId: string): DraftTemplate | undefined {
  return DRAFT_TEMPLATES.find(t => t.id === templateId);
}
