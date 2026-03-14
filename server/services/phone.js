const onlyDigits = (value = "") => String(value).replace(/\D/g, "");

export const normalizePhone = (value = "") => {
  let digits = onlyDigits(value);

  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length > 11) {
    digits = digits.slice(-11);
  }

  return digits;
};

export const toWhatsAppChatId = (value = "") => {
  const localPhone = normalizePhone(value);

  if (!localPhone) {
    return "";
  }

  return `55${localPhone}@c.us`;
};

export const phonesMatch = (left, right) => normalizePhone(left) === normalizePhone(right);
