import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './AutocompleteInput.module.css';

export default function AutocompleteInput({ name, value, options = [], onChange, placeholder, required = false, ariaLabel }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const rootRef = useRef(null);

    const filteredOptions = useMemo(() => {
        const query = String(value || '').trim().toLocaleLowerCase('pt-BR');
        return [...new Set(options.map(option => String(option ?? '')).filter(Boolean))]
            .filter(option => !query || option.toLocaleLowerCase('pt-BR').includes(query));
    }, [options, value]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const closeOnOutsideClick = (event) => {
            if (!rootRef.current?.contains(event.target)) setIsOpen(false);
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, [isOpen]);

    const selectOption = (option) => {
        onChange(option);
        setIsOpen(false);
        setActiveIndex(-1);
    };

    const handleKeyDown = (event) => {
        if (event.key === 'ArrowDown' && filteredOptions.length) {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex(index => Math.min(index + 1, filteredOptions.length - 1));
        } else if (event.key === 'ArrowUp' && filteredOptions.length) {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex(index => Math.max(index - 1, 0));
        } else if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
            event.preventDefault();
            selectOption(filteredOptions[activeIndex]);
        } else if (event.key === 'Escape') {
            setIsOpen(false);
            setActiveIndex(-1);
        }
    };

    return (
        <div className={styles.autocomplete} ref={rootRef}>
            <input
                type="text"
                name={name}
                required={required}
                autoComplete="off"
                role="combobox"
                aria-label={ariaLabel}
                aria-autocomplete="list"
                aria-expanded={isOpen && filteredOptions.length > 0}
                value={value || ''}
                placeholder={placeholder}
                onFocus={() => setIsOpen(true)}
                onChange={(event) => {
                    onChange(event.target.value);
                    setActiveIndex(-1);
                    setIsOpen(true);
                }}
                onKeyDown={handleKeyDown}
            />
            {isOpen && filteredOptions.length > 0 && (
                <ul className={styles.options} role="listbox">
                    {filteredOptions.map((option, index) => (
                        <li
                            key={option}
                            role="option"
                            aria-selected={index === activeIndex}
                            className={index === activeIndex ? styles.activeOption : undefined}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectOption(option)}
                        >
                            {option}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
