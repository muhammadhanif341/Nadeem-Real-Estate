/**
 * Builds a wa.me deep link pre-filled with a message about a specific
 * listing — no SDK, no API key, matches how leads already reach agents
 * directly. Upgrade path (automation/CRM sync) is the WhatsApp Business
 * Platform via Twilio, wired in separately once that's actually needed.
 */
export function buildWhatsAppLink(params: {
  phone: string;
  listingName?: string;
  listingUrl?: string;
}): string {
  const { phone, listingName, listingUrl } = params;
  const digitsOnly = phone.replace(/[^\d]/g, "");

  const message = listingName
    ? `Hi Nadeem, I'm interested in "${listingName}"${
        listingUrl ? ` (${listingUrl})` : ""
      }. Could you share more details?`
    : "Hi Nadeem, I'd like to book a consultation.";

  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}
