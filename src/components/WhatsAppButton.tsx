import { MessageCircle } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { siteConfig } from "@/lib/site";

export function WhatsAppButton({
  listingName,
  listingUrl,
  variant = "solid",
}: {
  listingName?: string;
  listingUrl?: string;
  variant?: "solid" | "light";
}) {
  const href = buildWhatsAppLink({
    phone: siteConfig.whatsappPhone,
    listingName,
    listingUrl,
  });

  const styles =
    variant === "solid"
      ? "border-[#25D366] bg-[#25D366] text-white hover:bg-[#1ebe57]"
      : "border-text-inverse/40 bg-transparent text-text-inverse hover:border-text-inverse hover:bg-text-inverse/[0.08]";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex w-full items-center justify-center gap-2 rounded-sm border-[1.5px] px-8 py-4 text-base font-semibold transition-all hover:-translate-y-0.5 ${styles}`}
    >
      <MessageCircle size={19} aria-hidden="true" />
      {listingName ? "Inquire on WhatsApp" : "Chat on WhatsApp"}
    </a>
  );
}
