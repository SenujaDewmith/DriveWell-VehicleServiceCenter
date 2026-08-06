import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/landing/hero.jpg";
export function Hero() {
    const navigate = useNavigate();
    return (<section className="relative h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-secondary/80"/>
      </div>
      <div className="relative z-10 container mx-auto px-4 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-primary-foreground mb-6">
          Premium Vehicle Care, Simplified
        </h1>
        <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
          Book online, track your service in real-time, and enjoy transparent pricing with digital invoices
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="bg-cta text-cta-foreground hover:bg-cta/90 text-lg px-8 py-6" onClick={() => navigate("/book")}>
            Book a Service
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-6 bg-background/10 backdrop-blur-sm border-primary-foreground/30 text-primary-foreground hover:bg-background/20" onClick={() => navigate("/services")}>
            View Packages
          </Button>
        </div>
      </div>
    </section>);
}
