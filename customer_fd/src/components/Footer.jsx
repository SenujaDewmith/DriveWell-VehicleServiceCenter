import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useContactPhone } from "@/hooks/useContactPhone";
export function Footer() {
    const contactPhone = useContactPhone();
    return (<footer className="border-t border-border bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
              <Logo theme="dark" className="h-8"/>
            </div>
            <p className="text-sm text-secondary-foreground/80">
              Modern vehicle service station with online booking and transparent tracking.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/services" className="hover:text-cta transition-colors">Services</Link></li>
              <li><Link to="/login" className="hover:text-cta transition-colors">Login</Link></li>
              <li><Link to="/dashboard" className="hover:text-cta transition-colors">Dashboard</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Support</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-cta transition-colors">About Us</Link></li>
              <li><Link to="/faq" className="hover:text-cta transition-colors">FAQ</Link></li>
              {contactPhone && (
                <li>
                  <a href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`} className="hover:text-cta transition-colors">
                    Call us: {contactPhone}
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/terms" className="hover:text-cta transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-secondary-foreground/20 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} DriveWell. All rights reserved.</p>
        </div>
      </div>
    </footer>);
}
