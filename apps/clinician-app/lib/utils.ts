type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | Record<string, boolean | null | undefined>
  | ClassValue[];

function flattenClassValue(input: ClassValue, output: string[]) {
  if (!input) return;

  if (typeof input === 'string' || typeof input === 'number') {
    output.push(String(input));
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      flattenClassValue(item, output);
    }
    return;
  }

  if (typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      if (value) output.push(key);
    }
  }
}

export function cn(...inputs: ClassValue[]) {
  const output: string[] = [];

  for (const input of inputs) {
    flattenClassValue(input, output);
  }

  return output.join(' ');
}
