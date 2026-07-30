import { useLocation } from "react-router-dom";
import { BookNowFab } from "@/components/BookNowFab";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
// Auth pages run their own focused layout (brand side panel, no nav/footer)
// so visitors aren't tempted away from signing in/up.
const NO_CHROME_ROUTES = ["/login", "/register"];
export function Layout({ children }) {
    const location = useLocation();
    const showChrome = !NO_CHROME_ROUTES.includes(location.pathname);
    return (<div className="min-h-screen flex flex-col bg-background">
      {showChrome && <Navbar />}

      <main className="flex-1">{children}</main>

      {showChrome && (<>
          <BookNowFab />
          <Footer />
        </>)}
    </div>);
}
