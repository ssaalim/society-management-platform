export function evaluateFormula(formula: string, variables: Record<string, number>): number {
  let expression = formula.toLowerCase();
  
  // Bind parameters variables values
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    expression = expression.replace(regex, (value || 0).toString());
  }

  // Safety filter containing only mathematical numbers and operators
  const secureRegex = /^[0-9+\-*/().\s]+$/;
  if (!secureRegex.test(expression)) {
    throw new Error('Unsafe mathematical expression detected in maintenance formula.');
  }

  try {
    // Execute safe mathematical evaluation
    const result = new Function(`return (${expression})`)();
    return Number(Number(result).toFixed(2));
  } catch (err) {
    throw new Error('Invalid mathematical syntax in maintenance formula evaluation.');
  }
}
