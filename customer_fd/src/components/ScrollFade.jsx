import { useEffect, useRef, useState } from "react";
// Fades out the bottom edge of a capped scroll region while there's more to scroll to,
// and hides once the user reaches the end — signals "more below" instead of abruptly
// clipping the last row (as a plain overflow-y-auto does with no visual cue).
export function ScrollFade({ className, children, deps = [] }) {
    const ref = useRef(null);
    const [showFade, setShowFade] = useState(false);
    const updateFade = () => {
        const el = ref.current;
        if (!el)
            return;
        setShowFade(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    };
    useEffect(() => {
        updateFade();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    useEffect(() => {
        window.addEventListener("resize", updateFade);
        return () => window.removeEventListener("resize", updateFade);
    }, []);
    return (<div className="relative">
      <div ref={ref} onScroll={updateFade} className={className}>
        {children}
      </div>
      <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-lg bg-gradient-to-t from-card to-transparent transition-opacity duration-200 ${showFade ? "opacity-100" : "opacity-0"}`}/>
    </div>);
}
