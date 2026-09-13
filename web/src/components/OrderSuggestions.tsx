import { useMemo, useState } from 'react';

interface OrderSuggestionsProps {
  assessment: string;
  plan: string;
  onAddOrder: (order: string) => void;
}

interface OrderSuggestion {
  id: string;
  name: string;
  type: 'lab' | 'imaging' | 'referral' | 'procedure';
  triggers: string[];
  description: string;
}

const ORDER_SUGGESTIONS: OrderSuggestion[] = [
  {
    id: 'cbc',
    name: 'CBC with Differential',
    type: 'lab',
    triggers: ['anemia', 'infection', 'fatigue', 'bleeding', 'weakness', 'fever'],
    description: 'Complete blood count to evaluate blood cells',
  },
  {
    id: 'cmp',
    name: 'Comprehensive Metabolic Panel',
    type: 'lab',
    triggers: ['diabetes', 'kidney', 'liver', 'electrolyte', 'fatigue', 'nausea'],
    description: 'Assess glucose, electrolytes, kidney and liver function',
  },
  {
    id: 'lipid',
    name: 'Lipid Panel',
    type: 'lab',
    triggers: ['cholesterol', 'hyperlipidemia', 'cardiovascular', 'heart disease', 'statin'],
    description: 'Measure cholesterol and triglyceride levels',
  },
  {
    id: 'tsh',
    name: 'TSH',
    type: 'lab',
    triggers: ['thyroid', 'fatigue', 'weight gain', 'weight loss', 'hypothyroid', 'hyperthyroid'],
    description: 'Screen for thyroid dysfunction',
  },
  {
    id: 'a1c',
    name: 'Hemoglobin A1C',
    type: 'lab',
    triggers: ['diabetes', 'glucose', 'blood sugar', 'prediabetes', 'hyperglycemia'],
    description: 'Monitor long-term glucose control',
  },
  {
    id: 'ua',
    name: 'Urinalysis',
    type: 'lab',
    triggers: ['uti', 'urinary', 'dysuria', 'hematuria', 'proteinuria', 'kidney'],
    description: 'Evaluate urine for infection or kidney issues',
  },
  {
    id: 'urine-culture',
    name: 'Urine Culture',
    type: 'lab',
    triggers: ['uti', 'urinary tract infection', 'dysuria', 'frequency'],
    description: 'Identify bacteria and sensitivities',
  },
  {
    id: 'chest-xray',
    name: 'Chest X-ray',
    type: 'imaging',
    triggers: ['cough', 'pneumonia', 'shortness of breath', 'chest pain', 'lung', 'respiratory'],
    description: 'Evaluate lungs and heart silhouette',
  },
  {
    id: 'ekg',
    name: 'EKG',
    type: 'procedure',
    triggers: ['chest pain', 'palpitations', 'arrhythmia', 'shortness of breath', 'cardiac', 'heart'],
    description: 'Assess heart rhythm and electrical activity',
  },
  {
    id: 'echo',
    name: 'Echocardiogram',
    type: 'imaging',
    triggers: ['heart failure', 'murmur', 'chf', 'cardiomyopathy', 'valve', 'ef'],
    description: 'Evaluate heart structure and function',
  },
  {
    id: 'ct-head',
    name: 'CT Head',
    type: 'imaging',
    triggers: ['headache', 'head injury', 'stroke', 'tia', 'altered mental status'],
    description: 'Evaluate for intracranial pathology',
  },
  {
    id: 'mri-brain',
    name: 'MRI Brain',
    type: 'imaging',
    triggers: ['headache', 'seizure', 'ms', 'multiple sclerosis', 'tumor', 'stroke'],
    description: 'Detailed brain imaging',
  },
  {
    id: 'ultrasound-abdomen',
    name: 'Ultrasound Abdomen',
    type: 'imaging',
    triggers: ['abdominal pain', 'gallbladder', 'liver', 'kidney', 'right upper quadrant'],
    description: 'Evaluate abdominal organs',
  },
  {
    id: 'xray-spine',
    name: 'X-ray Spine',
    type: 'imaging',
    triggers: ['back pain', 'lumbar', 'cervical', 'spine', 'radiculopathy'],
    description: 'Evaluate spinal alignment and bony structures',
  },
  {
    id: 'mri-spine',
    name: 'MRI Spine',
    type: 'imaging',
    triggers: ['radiculopathy', 'herniated disc', 'stenosis', 'back pain', 'sciatica'],
    description: 'Detailed spine imaging for soft tissue',
  },
  {
    id: 'ref-cardiology',
    name: 'Refer to Cardiology',
    type: 'referral',
    triggers: ['chest pain', 'heart failure', 'arrhythmia', 'murmur', 'palpitations'],
    description: 'Cardiology evaluation',
  },
  {
    id: 'ref-gi',
    name: 'Refer to Gastroenterology',
    type: 'referral',
    triggers: ['gerd', 'abdominal pain', 'gi bleed', 'colonoscopy', 'egd', 'ibs'],
    description: 'GI specialist evaluation',
  },
  {
    id: 'ref-neuro',
    name: 'Refer to Neurology',
    type: 'referral',
    triggers: ['headache', 'seizure', 'neuropathy', 'stroke', 'ms', 'tremor'],
    description: 'Neurology evaluation',
  },
  {
    id: 'ref-ortho',
    name: 'Refer to Orthopedics',
    type: 'referral',
    triggers: ['fracture', 'joint pain', 'arthritis', 'knee', 'shoulder', 'hip'],
    description: 'Orthopedic evaluation',
  },
  {
    id: 'ref-psych',
    name: 'Refer to Psychiatry',
    type: 'referral',
    triggers: ['depression', 'anxiety', 'bipolar', 'psychosis', 'suicidal'],
    description: 'Mental health specialist evaluation',
  },
];

function findMatchingOrders(assessment: string, plan: string): OrderSuggestion[] {
  const text = `${assessment} ${plan}`.toLowerCase();
  const matched = ORDER_SUGGESTIONS.filter((order) =>
    order.triggers.some((trigger) => text.includes(trigger))
  );

  const seen = new Set<string>();
  return matched.filter((order) => {
    if (seen.has(order.id)) return false;
    seen.add(order.id);
    return true;
  });
}

export function OrderSuggestions({ assessment, plan, onAddOrder }: OrderSuggestionsProps) {
  const [dismissedOrders, setDismissedOrders] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const suggestions = useMemo(
    () => findMatchingOrders(assessment, plan),
    [assessment, plan]
  );

  const visibleSuggestions = suggestions.filter((s) => !dismissedOrders.has(s.id));

  function handleDismiss(orderId: string) {
    setDismissedOrders((prev) => new Set([...prev, orderId]));
  }

  function handleAddOrder(order: OrderSuggestion) {
    onAddOrder(`- Order: ${order.name}`);
    handleDismiss(order.id);
  }

  if (visibleSuggestions.length === 0) {
    return null;
  }

  const previewSuggestions = visibleSuggestions.slice(0, 4);
  const remainingCount = visibleSuggestions.length - 4;

  const groupedByType = visibleSuggestions.reduce(
    (acc, order) => {
      if (!acc[order.type]) acc[order.type] = [];
      acc[order.type].push(order);
      return acc;
    },
    {} as Record<string, OrderSuggestion[]>
  );

  return (
    <div className="order-suggestions">
      <div className="order-suggestions-header">
        <h3>Suggested Orders</h3>
        {visibleSuggestions.length > 4 && (
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : `Show all (${visibleSuggestions.length})`}
          </button>
        )}
      </div>

      {expanded ? (
        <div className="order-suggestions-grouped">
          {Object.entries(groupedByType).map(([type, orders]) => (
            <div key={type} className="order-group">
              <h4 className="order-group-title">
                {type === 'lab' && '🧪 Labs'}
                {type === 'imaging' && '📷 Imaging'}
                {type === 'referral' && '👨‍⚕️ Referrals'}
                {type === 'procedure' && '🩺 Procedures'}
              </h4>
              <div className="order-group-items">
                {orders.map((order) => (
                  <div key={order.id} className="order-suggestion-item">
                    <div className="order-suggestion-content">
                      <span className="order-suggestion-name">{order.name}</span>
                      <span className="order-suggestion-desc">{order.description}</span>
                    </div>
                    <div className="order-suggestion-actions">
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        onClick={() => handleAddOrder(order)}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => handleDismiss(order.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="order-suggestions-list">
          {previewSuggestions.map((order) => (
            <div key={order.id} className="order-suggestion-chip">
              <span className="order-chip-icon">
                {order.type === 'lab' && '🧪'}
                {order.type === 'imaging' && '📷'}
                {order.type === 'referral' && '👨‍⚕️'}
                {order.type === 'procedure' && '🩺'}
              </span>
              <span className="order-chip-name">{order.name}</span>
              <button
                type="button"
                className="btn btn-xs btn-primary"
                onClick={() => handleAddOrder(order)}
              >
                Add
              </button>
              <button
                type="button"
                className="order-chip-dismiss"
                onClick={() => handleDismiss(order.id)}
              >
                ×
              </button>
            </div>
          ))}
          {remainingCount > 0 && (
            <button
              type="button"
              className="order-suggestion-more"
              onClick={() => setExpanded(true)}
            >
              +{remainingCount} more
            </button>
          )}
        </div>
      )}

      <p className="order-suggestions-disclaimer">
        Suggestions based on note content. Verify clinical appropriateness before ordering.
      </p>
    </div>
  );
}
