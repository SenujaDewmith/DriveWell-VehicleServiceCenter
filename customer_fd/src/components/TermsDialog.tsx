import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TERMS_EFFECTIVE_DATE, TERMS_SECTIONS, TERMS_VERSION } from "@/lib/terms";
import { CheckCircle, ScrollText } from "lucide-react";

interface TermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When provided, the dialog shows an "I Agree" action so reading the terms
  // flows directly into accepting them (ticking the consent checkbox).
  onAgree?: () => void;
}

export function TermsDialog({ open, onOpenChange, onAgree }: TermsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-cta" />
            Terms & Conditions
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className="font-mono text-[10px]">v{TERMS_VERSION}</Badge>
            Effective {TERMS_EFFECTIVE_DATE}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(55vh,24rem)]">
          <div className="space-y-5 p-6 text-sm">
            {TERMS_SECTIONS.map((section, idx) => (
              <section key={section.title}>
                <h4 className="mb-2 font-semibold text-foreground">
                  {idx + 1}. {section.title}
                </h4>
                <ul className="space-y-1.5">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-2 text-muted-foreground">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cta" aria-hidden />
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 border-t p-4 sm:justify-between sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onAgree && (
            <Button className="bg-cta text-cta-foreground hover:bg-cta/90" onClick={onAgree}>
              <CheckCircle className="mr-2 h-4 w-4" />
              I Agree
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
