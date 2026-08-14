const STORAGE_KEY = 'havenote.templates.v1';

export type TemplateField = 'subjective' | 'objective' | 'assessment' | 'plan';

const DEFAULT_TEMPLATES: Record<TemplateField, string[]> = {
  subjective: ['Patient reports symptoms began gradually. Denies fever, chest pain, or shortness of breath.'],
  objective: ['Vitals stable, well-appearing, no acute distress.', 'Alert and oriented x3. No acute distress.'],
  assessment: [],
  plan: [
    'Follow up in 2 weeks if symptoms persist.',
    'Return precautions discussed — patient advised to seek urgent care for worsening symptoms.',
  ],
};

type TemplateStore = Record<TemplateField, string[]>;

function readStore(): TemplateStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_TEMPLATES);
    const parsed = JSON.parse(raw) as Partial<TemplateStore>;
    return {
      subjective: parsed.subjective ?? DEFAULT_TEMPLATES.subjective,
      objective: parsed.objective ?? DEFAULT_TEMPLATES.objective,
      assessment: parsed.assessment ?? DEFAULT_TEMPLATES.assessment,
      plan: parsed.plan ?? DEFAULT_TEMPLATES.plan,
    };
  } catch {
    return structuredClone(DEFAULT_TEMPLATES);
  }
}

function writeStore(store: TemplateStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best-effort — a full/blocked localStorage shouldn't break note editing.
  }
}

export function getTemplates(field: TemplateField): string[] {
  return readStore()[field];
}

export function addTemplate(field: TemplateField, text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return getTemplates(field);
  const store = readStore();
  if (!store[field].includes(trimmed)) {
    store[field] = [...store[field], trimmed];
    writeStore(store);
  }
  return store[field];
}

export function removeTemplate(field: TemplateField, text: string): string[] {
  const store = readStore();
  store[field] = store[field].filter((t) => t !== text);
  writeStore(store);
  return store[field];
}
