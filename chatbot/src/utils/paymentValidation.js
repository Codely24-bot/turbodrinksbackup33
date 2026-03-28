/**
 * Validates if a payment amount is valid
 * @param {number} value - The amount to validate
 * @param {number} remaining - The remaining balance of the sale
 * @param {string} method - The payment method
 * @returns {boolean}
 */
export const validatePaymentAmount = (value, remaining, method) => {
  if (value <= 0) return false;
  
  // For non-cash methods, usually you can't pay more than remaining
  // But for split payments logic, we often just check if it makes sense number-wise
  if (method !== 'dinheiro' && value > (remaining + 0.01)) {
    // return false; // Strict validation: forbid overpaying on card
    // Relaxed for UX: allow, will result in negative remaining which UI handles
  }
  return true;
};

/**
 * Validates the remaining balance for finalization
 * @param {number} remaining 
 * @returns {boolean}
 */
export const validateRemainingValue = (remaining) => {
  // Allow small float point discrepancies
  return Math.abs(remaining) < 0.01;
};

/**
 * Validates input string for currency
 * @param {string} value 
 * @returns {boolean}
 */
export const validatePaymentInput = (value) => {
  const regex = /^\d*\.?\d{0,2}$/;
  return regex.test(value);
};

/**
 * Generates warning messages based on payment state
 * @param {number} remaining 
 * @param {number} change 
 * @param {Array} payments 
 * @returns {Array} warnings
 */
export const generatePaymentWarnings = (remaining, change, payments) => {
  const warnings = [];
  
  if (remaining > 0) {
    warnings.push(`Faltam R$ ${remaining.toFixed(2)} para quitar a venda.`);
  }
  
  if (change > 0) {
    const hasCash = payments.some(p => p.method === 'dinheiro');
    if (!hasCash) {
      warnings.push("Troco gerado sem pagamento em dinheiro. Verifique os valores.");
    }
  }

  return warnings;
};

/**
 * Validates if a client is selected when credit payment is present
 * @param {string} clientId - The selected client ID
 * @param {boolean} hasCreditPayment - Whether there is a credit payment
 * @returns {string|null} - Error message or null
 */
export const validateClientForCredit = (clientId, hasCreditPayment) => {
  if (hasCreditPayment && !clientId) {
    return "Selecione um cliente para pagamento fiado.";
  }
  return null;
};

/**
 * Checks if there are any clients available
 * @param {Array} clients - Array of client objects
 * @returns {boolean}
 */
export const validateClientExists = (clients) => {
  return Array.isArray(clients) && clients.length > 0;
};

/**
 * Validates delivery fields
 * @param {Object} deliveryData 
 * @returns {Object} validation result
 */
export const validateDeliveryFields = (deliveryData) => {
  const errors = {};
  const { motoboy_id, endereco, numero, bairro } = deliveryData;

  if (!motoboy_id) errors.motoboy_id = "Selecione um motoboy para delivery";
  if (!endereco || !endereco.trim()) errors.endereco = "Preencha o endereço de entrega";
  if (!numero || !numero.trim()) errors.numero = "Preencha o número da entrega";
  if (!bairro || !bairro.trim()) errors.bairro = "Preencha o bairro da entrega";

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Builds formatted address string
 * @param {string} endereco 
 * @param {string} numero 
 * @param {string} complemento 
 * @param {string} bairro 
 * @returns {string} Formatted address
 */
export const buildDeliveryAddress = (endereco, numero, complemento, bairro) => {
  const parts = [
    endereco ? `${endereco}` : '',
    numero ? `${numero}` : '',
    complemento ? `${complemento}` : '',
    bairro ? `- ${bairro}` : ''
  ];
  
  return parts.filter(Boolean).join(', ');
};