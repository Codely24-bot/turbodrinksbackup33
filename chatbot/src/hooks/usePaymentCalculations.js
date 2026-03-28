import { useMemo } from 'react';

/**
 * Hook to handle payment calculations
 * Updated to prioritize fixed amounts for discount and surcharge
 * @param {number} subtotal - The subtotal of the sale
 * @param {number} discount - Discount value (Fixed amount in R$)
 * @param {string} discountType - Deprecated/Fixed to 'fixed' in this context
 * @param {number} surcharge - Surcharge value (Fixed amount in R$)
 * @param {string} surchargeType - Deprecated/Fixed to 'fixed' in this context
 * @param {number} numPeople - Number of people to split the bill
 * @param {Array} payments - Array of payment objects { id, method, value }
 */
export const usePaymentCalculations = ({
  subtotal = 0,
  discount = 0,
  discountType = 'fixed',
  surcharge = 0,
  surchargeType = 'fixed',
  numPeople = 1,
  payments = []
}) => {

  const calculations = useMemo(() => {
    // 1. Calculate Discount Amount (Fixed R$)
    // We prioritize fixed amount as per new requirements
    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = subtotal * (discount / 100);
    } else {
      discountAmount = discount;
    }

    // 2. Calculate Surcharge Amount (Fixed R$)
    let surchargeAmount = 0;
    if (surchargeType === 'percent') {
      surchargeAmount = subtotal * (surcharge / 100);
    } else {
      surchargeAmount = surcharge;
    }

    // 3. Calculate Total Sale Amount
    // Total = Subtotal - Discount + Surcharge
    const total = Math.max(0, subtotal - discountAmount + surchargeAmount);

    // 4. Calculate Total Paid
    const totalPaid = payments.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);

    // 5. Calculate Remaining
    let remaining = Math.max(0, total - totalPaid);

    // 6. Calculate Change (Troco)
    const change = Math.max(0, totalPaid - total);

    // 7. Calculate Per Person
    const perPerson = numPeople > 0 ? total / numPeople : total;

    return {
      subtotal,
      discountAmount,
      surchargeAmount,
      total,
      totalPaid,
      remaining,
      change,
      perPerson
    };
  }, [subtotal, discount, discountType, surcharge, surchargeType, numPeople, payments]);

  return calculations;
};

// Utility functions exported for direct use if needed outside hook context
export const calculateTotal = (subtotal, discountAmount, surchargeAmount) => {
  return Math.max(0, subtotal - discountAmount + surchargeAmount);
};

export const validatePaymentCompletion = (remaining) => {
  return remaining <= 0.01; // tolerance for float precision
};

/**
 * Validates if the payment configuration with client is valid
 * @param {Array} payments - List of current payments
 * @param {Object} selectedClient - The selected client object
 * @returns {Object} - { valid: boolean, error: string | null }
 */
export const validatePaymentWithClient = (payments, selectedClient) => {
  const hasFiado = payments.some(p => p.method === 'fiado');
  
  if (hasFiado && !selectedClient) {
    return { 
      valid: false, 
      error: 'Pagamento fiado requer um cliente selecionado.' 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Validates delivery specific data
 * @param {string} tipo_venda 
 * @param {string} motoboy_id 
 * @param {string} endereco 
 * @param {string} numero 
 * @param {string} bairro 
 * @returns {Object} { isValid: boolean, errors: Object }
 */
export const validateDeliveryData = (tipo_venda, motoboy_id, endereco, numero, bairro) => {
  if (tipo_venda !== 'delivery') {
    return { isValid: true, errors: {} };
  }

  const errors = {};
  
  if (!motoboy_id) errors.motoboy_id = "Selecione um motoboy para delivery";
  if (!endereco || endereco.trim() === '') errors.endereco = "Preencha o endereço de entrega";
  if (!numero || numero.trim() === '') errors.numero = "Preencha o número da entrega";
  if (!bairro || bairro.trim() === '') errors.bairro = "Preencha o bairro da entrega";

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};