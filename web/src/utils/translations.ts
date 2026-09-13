export type SupportedLanguage = 'en' | 'es';

export const LANGUAGES: Array<{ code: SupportedLanguage; name: string; nativeName: string }> = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
];

export const UI_TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    patientSummary: 'Patient Summary',
    visitDate: 'Visit Date',
    provider: 'Provider',
    clinic: 'Clinic',
    whatWeDiscussed: 'What We Discussed',
    yourNextSteps: 'Your Next Steps',
    medicationChanges: 'Medication Changes',
    whenToSeekCare: 'When to Seek Care',
    followUp: 'Follow-up',
    questions: 'Questions?',
    contactUs: 'Contact your care team if you have questions.',
    printedOn: 'Printed on',
    generateSummary: 'Generate Patient Summary',
    generating: 'Generating...',
    regenerate: 'Regenerate',
    downloadPdf: 'Download PDF',
    print: 'Print',
    languageSelect: 'Language',
  },
  es: {
    patientSummary: 'Resumen del Paciente',
    visitDate: 'Fecha de la Visita',
    provider: 'Proveedor',
    clinic: 'Clínica',
    whatWeDiscussed: 'Lo Que Discutimos',
    yourNextSteps: 'Sus Próximos Pasos',
    medicationChanges: 'Cambios en Medicamentos',
    whenToSeekCare: 'Cuándo Buscar Atención',
    followUp: 'Seguimiento',
    questions: '¿Preguntas?',
    contactUs: 'Comuníquese con su equipo de atención si tiene preguntas.',
    printedOn: 'Impreso el',
    generateSummary: 'Generar Resumen del Paciente',
    generating: 'Generando...',
    regenerate: 'Regenerar',
    downloadPdf: 'Descargar PDF',
    print: 'Imprimir',
    languageSelect: 'Idioma',
  },
};

export function getTranslation(lang: SupportedLanguage, key: string): string {
  return UI_TRANSLATIONS[lang]?.[key] ?? UI_TRANSLATIONS.en[key] ?? key;
}

export function getLanguageName(code: SupportedLanguage): string {
  return LANGUAGES.find((l) => l.code === code)?.nativeName ?? code;
}
