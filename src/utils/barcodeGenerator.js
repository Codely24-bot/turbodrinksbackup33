import { supabase } from '@/lib/customSupabaseClient';

/**
 * Generates a random 13-digit EAN-13 barcode with valid check digit.
 * EAN-13 Check Digit Calculation:
 * 1. Sum the digits at even-numbered positions (2, 4, 6, 8, 10, 12).
 * 2. Multiply the result by 3.
 * 3. Add the sum of digits at odd-numbered positions (1, 3, 5, 7, 9, 11).
 * 4. Find the remainder when the total is divided by 10.
 * 5. If the remainder is 0, the check digit is 0.
 * 6. If the remainder is not 0, subtract the remainder from 10.
 */
export const generateBarcode = () => {
  let digits = '';
  // Generate first 12 digits
  for (let i = 0; i < 12; i++) {
    digits += Math.floor(Math.random() * 10);
  }

  let sumOdd = 0; // Positions 1, 3, 5, 7, 9, 11
  let sumEven = 0; // Positions 2, 4, 6, 8, 10, 12

  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i]);
    // i is 0-indexed. i=0 is Position 1 (Odd). i=1 is Position 2 (Even).
    if (i % 2 === 0) {
      sumOdd += digit;
    } else {
      sumEven += digit;
    }
  }

  const total = sumOdd + (sumEven * 3);
  const remainder = total % 10;
  const checkDigit = remainder === 0 ? 0 : 10 - remainder;

  return digits + checkDigit;
};

/**
 * Validates that code is exactly 13 digits.
 */
export const validateBarcode = (code) => {
  return /^\d{13}$/.test(code);
};

/**
 * Checks if the barcode already exists for the user in the database.
 * Matches against 'codigo' column in 'produtos' table.
 */
export const checkBarcodeExists = async (code, userId) => {
  if (!code || !userId) return false;
  
  const { data, error } = await supabase
    .from('produtos')
    .select('id')
    .eq('user_id', userId)
    .eq('codigo', code)
    .maybeSingle();

  if (error) {
    console.error('Error checking barcode existence:', error);
    // In case of error, we assume it doesn't exist to avoid blocking, 
    // or we could throw. Returning false allows flow to proceed.
    return false;
  }

  return !!data;
};