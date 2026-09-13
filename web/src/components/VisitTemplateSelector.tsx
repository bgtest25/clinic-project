import { useState } from 'react';
import {
  getAllTemplates,
  getTemplatesByCategory,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type VisitTemplate,
} from '../utils/visitTemplates';

interface VisitTemplateSelectorProps {
  onApply: (template: VisitTemplate) => void;
  disabled?: boolean;
}

export function VisitTemplateSelector({ onApply, disabled }: VisitTemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [confirmTemplate, setConfirmTemplate] = useState<VisitTemplate | null>(null);

  const templates =
    selectedCategory === 'all'
      ? getAllTemplates()
      : getTemplatesByCategory(selectedCategory);

  function handleSelect(template: VisitTemplate) {
    setConfirmTemplate(template);
  }

  function handleConfirm() {
    if (confirmTemplate) {
      onApply(confirmTemplate);
      setConfirmTemplate(null);
      setOpen(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setConfirmTemplate(null);
    setSelectedCategory('all');
  }

  if (disabled) return null;

  return (
    <div className="visit-template-selector">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen((o) => !o)}
      >
        Apply Template
      </button>

      {open && !confirmTemplate && (
        <div className="visit-template-panel card">
          <div className="visit-template-header">
            <h3>Visit Templates</h3>
            <button
              type="button"
              className="visit-template-close"
              onClick={handleClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="visit-template-category-filter">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as TemplateCategory | 'all')}
              aria-label="Filter by specialty"
            >
              <option value="all">All Specialties ({getAllTemplates().length})</option>
              {TEMPLATE_CATEGORIES.map((cat) => {
                const count = getTemplatesByCategory(cat.value).length;
                return (
                  <option key={cat.value} value={cat.value}>
                    {cat.label} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="visit-template-list">
            {templates.length === 0 ? (
              <p className="visit-template-empty">No templates in this category.</p>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="visit-template-item"
                  onClick={() => handleSelect(template)}
                >
                  <span className="visit-template-item-name">{template.name}</span>
                  <span className="visit-template-item-desc">{template.description}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {confirmTemplate && (
        <div className="visit-template-confirm card">
          <h3>Apply "{confirmTemplate.name}"?</h3>
          <p className="visit-template-warning">
            This will replace the current note content with the template structure. Your existing text will be overwritten.
          </p>
          <div className="visit-template-preview">
            <strong>Preview:</strong>
            <div className="visit-template-preview-section">
              <span className="visit-template-preview-label">Subjective:</span>
              <span className="visit-template-preview-text">
                {confirmTemplate.subjective.slice(0, 100)}...
              </span>
            </div>
          </div>
          <div className="visit-template-actions">
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>
              Apply Template
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmTemplate(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
