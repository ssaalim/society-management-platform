export function evaluateFormula(formula: string, variables: Record<string, number>): number {
  let expression = formula.toLowerCase();
  
  // Sort variable keys by length descending so longer compound keys (e.g. parking_stilt) are replaced before base keys (parking)
  const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    expression = expression.replace(regex, (variables[key] ?? 0).toString());
  }

  // Safety filter containing only mathematical numbers, operators, decimals, parentheses and whitespace
  const secureRegex = /^[0-9+\-*/().\s]+$/;
  if (!secureRegex.test(expression)) {
    throw new Error(`Unrecognized variable or unsafe expression in maintenance formula: "${formula}"`);
  }

  try {
    // Execute safe mathematical evaluation
    const result = new Function(`return (${expression})`)();
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      throw new Error('Mathematical evaluation did not result in a valid number.');
    }
    return Number(Number(result).toFixed(2));
  } catch (err: any) {
    throw new Error(`Invalid mathematical syntax in formula: ${err.message}`);
  }
}
