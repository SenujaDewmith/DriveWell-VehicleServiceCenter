import { Hero, FeaturesSection, FeaturedPackages, HowItWorksSection, TestimonialsSection, CtaSection, } from "@/components/landing";
export default function Landing() {
    return (<div className="min-h-screen">
      <Hero />
      <FeaturesSection />
      <FeaturedPackages />
      <HowItWorksSection />
      <TestimonialsSection />
      <CtaSection />
    </div>);
}
