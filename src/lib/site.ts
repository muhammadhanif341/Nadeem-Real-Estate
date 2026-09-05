export const siteConfig = {
  name: "Nadeem",
  fullName: "Nadeem Real Estate Consultant",
  tagline: "Real Estate Consultant",
  description:
    "Nadeem Real Estate Consultant helps clients buy, sell, and invest in property with professional guidance, market expertise, and personalized service.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nadeemrealestate.com",
  phone: "+92 333 9357378",
  whatsappPhone: "+923339357378",
  email: "contact@nadeemrealestate.com",
  officeHours: {
    weekdays: "Mon – Fri: 9:00 AM – 6:00 PM",
    saturday: "Sat: 10:00 AM – 4:00 PM",
  },
  address: {
    line1: "123 Business Avenue, Suite 400",
    line2: "Metropolis City, ST 00000",
  },
  stats: [
    { value: "15+", label: "Years of Experience" },
    { value: "500+", label: "Properties Closed" },
    { value: "98%", label: "Client Satisfaction" },
  ],
  nav: [
    { label: "Home", href: "/#home" },
    { label: "About", href: "/#about" },
    { label: "Properties", href: "/properties" },
    { label: "Services", href: "/#services" },
    { label: "Contact", href: "/#contact" },
  ],
};
