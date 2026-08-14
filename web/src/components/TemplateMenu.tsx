import { useState } from 'react';
import { addTemplate, getTemplates, removeTemplate, type TemplateField } from '../utils/templates';

export function TemplateMenu({
  field,
  currentText,
  onInsert,
  disabled,
}: {
  field: TemplateField;
  currentText: string;
  onInsert: (text: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phrases, setPhrases] = useState(() => getTemplates(field));

  if (disabled) return null;

  function handleInsert(phrase: string) {
    onInsert(phrase);
    setOpen(false);
  }

  function handleSaveCurrent() {
    if (!currentText.trim()) return;
    setPhrases(addTemplate(field, currentText));
  }

  function handleRemove(phrase: string) {
    setPhrases(removeTemplate(field, phrase));
  }

  return (
    <div className="template-menu">
      <button type="button" className="link-button template-menu-toggle" onClick={() => setOpen((o) => !o)}>
        Insert phrase ▾
      </button>
      {open && (
        <div className="template-menu-panel card">
          {phrases.length === 0 && <p className="status-line">No saved phrases for this field yet.</p>}
          {phrases.map((phrase) => (
            <div key={phrase} className="template-menu-item">
              <button type="button" className="template-menu-item-text" onClick={() => handleInsert(phrase)}>
                {phrase}
              </button>
              <button
                type="button"
                className="template-menu-item-remove"
                aria-label={`Delete phrase: ${phrase}`}
                onClick={() => handleRemove(phrase)}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="link-button template-menu-save" onClick={handleSaveCurrent}>
            + Save current text as a phrase
          </button>
        </div>
      )}
    </div>
  );
}
