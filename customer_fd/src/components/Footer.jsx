import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
export function Footer() {
    return (<footer className="border-t border-border bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
              <li><a href="#" className="hover:text-cta transition-colors">Contact</a></li>
              <li><Link to="/faq" className="hover:text-cta transition-colors">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-cta transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-cta transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-secondary-foreground/20 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} DriveWell. All rights reserved.</p>
        </div>
      </div>
    </footer>);
}
