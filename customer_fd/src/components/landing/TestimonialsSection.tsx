import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Star } from "lucide-react";

type Testimonial = {
  name: string;
  rating: number;
  comment: string;
  avatar: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Sarah Johnson",
    rating: 5,
    comment: "Incredible service! The online booking made it so easy, and my car has never looked better. Highly recommend!",
    avatar: "SJ",
  },
  {
    name: "Michael Chen",
    rating: 5,
    comment: "Love the real-time tracking feature. I could see exactly what was being done to my car. Very transparent and professional.",
    avatar: "MC",
  },
  {
    name: "Emily Rodriguez",
    rating: 5,
    comment: "The premium detailing package was worth every penny. My 5-year-old car looks brand new. Amazing attention to detail!",
    avatar: "ER",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-4">What Our Customers Say</h2>
        <p className="text-center text-muted-foreground mb-12 text-lg">
          Trusted by thousands of satisfied customers
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {TESTIMONIALS.map((testimonial) => (
            <Card key={testimonial.name} className="border-2">
              <CardHeader>
                <div className="flex items-center gap-4 mb-3">
                  <div className="h-12 w-12 rounded-full bg-cta flex items-center justify-center text-cta-foreground font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <div className="flex gap-1">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-cta text-cta" />
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground italic">"{testimonial.comment}"</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
