import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";
import { feedbackService, type Testimonial } from "@/services/feedback.service";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    feedbackService
      .getPublicTestimonials()
      .then(({ testimonials }) => {
        if (!cancelled) setTestimonials(testimonials);
      })
      .catch(() => {
        // Non-critical marketing content — fail silently and just hide the section.
        if (!cancelled) setTestimonials([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Still loading: show skeletons. Loaded with nothing to show: hide the section
  // entirely rather than display an empty/placeholder state on a public page.
  if (testimonials !== null && testimonials.length === 0) return null;

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-4">What Our Customers Say</h2>
        <p className="text-center text-muted-foreground mb-12 text-lg">
          Trusted by thousands of satisfied customers
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials === null
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-2">
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))
            : testimonials.map((testimonial) => (
                <Card key={testimonial.feedback_id} className="border-2">
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="h-12 w-12 rounded-full bg-cta flex items-center justify-center text-cta-foreground font-semibold">
                        {initialsOf(testimonial.display_name)}
                      </div>
                      <div>
                        <p className="font-semibold">{testimonial.display_name}</p>
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
