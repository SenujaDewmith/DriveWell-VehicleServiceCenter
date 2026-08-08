import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import headerImage from "@/assets/about/header.jpg";
import heroImage from "@/assets/landing/hero.jpg";
import storyImage from "@/assets/about/story.jpg";
import garageImage from "@/assets/landing/step-04-garage.jpg";

const slides = [headerImage, heroImage, storyImage, garageImage];
const SLIDE_INTERVAL_MS = 5000;

export function Hero() {
    const navigate = useNavigate();
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % slides.length);
        }, SLIDE_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    return (<section className="relative h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        {slides.map((slide, index) => (<div key={slide} className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${index === activeSlide ? "opacity-100 dark:opacity-80" : "opacity-0"}`} style={{ backgroundImage: `url(${slide})` }}/>))}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/60 to-secondary/80"/>
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
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {slides.map((_, index) => (<button key={index} type="button" onClick={() => setActiveSlide(index)} aria-label={`Go to slide ${index + 1}`} className={`h-2 rounded-full transition-all duration-300 ${index === activeSlide ? "w-8 bg-primary-foreground" : "w-2 bg-primary-foreground/40"}`}/>))}
      </div>
    </section>);
}
