import { Hero } from "@/components/Hero";
import { About } from "@/components/About";
import { FeaturedProperties } from "@/components/FeaturedProperties";
import { LocationsSection } from "@/components/LocationsSection";
import { ServicesSection } from "@/components/ServicesSection";
import { WhyChooseSection } from "@/components/WhyChooseSection";
import { ContactSection } from "@/components/ContactSection";

export default function HomePage() {
  return (
    <main id="main">
      <Hero />
      <About />
      <FeaturedProperties />
      <LocationsSection />
      <ServicesSection />
      <WhyChooseSection />
      <ContactSection />
    </main>
  );
}
