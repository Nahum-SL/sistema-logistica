const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
// 10 persona natural, 15/16/17 otros, 20 persona jurídica.
const VALID_PREFIXES = ["10", "15", "16", "17", "20"];

/**
 * Valida un RUC peruano: 11 dígitos, prefijo válido y dígito verificador (módulo 11).
 */
export function isValidRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) return false;
  if (!VALID_PREFIXES.includes(ruc.slice(0, 2))) return false;

  const sum = WEIGHTS.reduce(
    (acc, weight, i) => acc + weight * Number(ruc[i]),
    0,
  );
  const checkDigit = (11 - (sum % 11)) % 10;

  return checkDigit === Number(ruc[10]);
}