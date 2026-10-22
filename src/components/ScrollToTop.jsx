import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export default function ScrollToTop() {
    const location = useLocation();
    const { pathname, search } = location;
    const action = useNavigationType();

    useEffect(() => {
        if (location.state?.scrollToMap) return;

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
