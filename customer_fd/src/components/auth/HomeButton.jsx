import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

// Lets a user stuck on the login/register form bail out to the landing
// page without hitting the browser back button.
export function HomeButton() {
    return (<Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="icon" className="absolute left-4 top-4 text-muted-foreground hover:text-foreground">
          <Link to="/" aria-label="Go to homepage">
            <Home className="h-5 w-5"/>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Back to home</TooltipContent>
    </Tooltip>);
}
