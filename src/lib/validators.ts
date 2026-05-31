export function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;

  return true;
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
