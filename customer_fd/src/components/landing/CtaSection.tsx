import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-gradient-to-r from-secondary to-accent text-secondary-foreground">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl font-bold mb-4">Ready to Experience Premium Care?</h2>
        <p className="text-xl mb-8 opacity-90">
          Join thousands of satisfied customers and give your vehicle the care it deserves
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-cta text-cta-foreground hover:bg-cta/90 text-lg px-8 py-6"
            onClick={() => navigate("/register")}
          >
            Sign Up Now
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 text-black dark:text-white py-6 border-secondary-foreground/30 hover:bg-secondary-foreground/10"
            onClick={() => navigate("/services")}
          >
            Explore Services
          </Button>
        </div>
      </div>
    </section>
  );
}
