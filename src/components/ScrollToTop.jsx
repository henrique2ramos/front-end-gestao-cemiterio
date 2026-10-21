import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export default function ScrollToTop() {
    const { pathname } = useLocation();
    const action = useNavigationType();
    const previousPathname = useRef(pathname);

    useEffect(() => {
        if (pathname !== previousPathname.current && action !== 'POP') {
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: 'instant'
            });
        }

        previousPathname.current = pathname;
    }, [pathname, action]);

    return null;
}