import { STATUS_LABELS, STATUS_MESSAGES } from "./whatsappTemplates.js";
import { sendOrderStatusUpdate } from "./whatsappBot.js";

export { STATUS_LABELS, STATUS_MESSAGES };

export const sendWhatsAppUpdate = async (order, status) => {
  const result = await sendOrderStatusUpdate(order, status);

  if (!result.ok) {
    console.error("[whatsapp-error]", result.error);
  }

  return result;
};
