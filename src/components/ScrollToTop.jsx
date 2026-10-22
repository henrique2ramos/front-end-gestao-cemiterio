import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export default function ScrollToTop() {
    const location = useLocation();
    const { pathname, search } = location;
    const action = useNavigationType();
    const previousUrl = useRef({ pathname, search });

    useEffect(() => {
        const sameUrl = previousUrl.current.pathname === pathname && previousUrl.current.search === search;
        previousUrl.current = { pathname, search };

        if (location.state?.scrollToMap) return;
        if (sameUrl) return;

        if (action !== "POP") {
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: "instant"
            });
        }
    }, [pathname, search, action, location.state]);

    return null;
}
