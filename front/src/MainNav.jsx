import { memo } from 'react';

const BASE_STYLE = {
  padding: '0.6rem 1.5rem',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.95rem',
  fontWeight: 'bold',
  transition: 'background-color 0.2s, color 0.2s',
};

function navButtonStyle({ active, disabled }) {
  if (disabled) {
    return { ...BASE_STYLE, backgroundColor: '#f1f3f5', color: '#adb5bd', cursor: 'not-allowed' };
  }
  if (active) {
    return { ...BASE_STYLE, backgroundColor: '#212529', color: 'white', cursor: 'pointer' };
  }
  return { ...BASE_STYLE, backgroundColor: '#e9ecef', color: '#333', cursor: 'pointer' };
}

function MainNav({ currentSection, onSectionChange, planId }) {
  const planDisabled = !planId;

  return (
    <nav style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', padding: '1rem 1rem 0' }}>
      <button
        type="button"
        onClick={() => onSectionChange('ideas')}
        style={navButtonStyle({ active: currentSection === 'ideas', disabled: false })}
      >
        Ideas
      </button>
      <button
        type="button"
        onClick={() => onSectionChange('plan')}
        disabled={planDisabled}
        title={planDisabled ? 'Todavía no hay un plan de trabajo para esta idea' : undefined}
        style={navButtonStyle({ active: currentSection === 'plan', disabled: planDisabled })}
      >
        Plan
      </button>
    </nav>
  );
}

export default memo(MainNav);
