import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';

interface SearchBoxProps {
  size?: 'hero' | 'compact';
  defaultValue?: string;
  autoFocus?: boolean;
}

/** The smart search box: hanzi, pinyin, or English — detection happens in the API. */
export default function SearchBox({ size = 'hero', defaultValue = '', autoFocus }: SearchBoxProps) {
  const [value, setValue] = useState(defaultValue);
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form className={`search-box search-box-${size}`} role="search" onSubmit={handleSubmit}>
      <input
        type="search"
        className="search-input"
        placeholder={size === 'hero' ? '汉字 · pinyin · English' : 'Search…'}
        aria-label="Search the dictionary by Chinese characters, pinyin, or English"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus={autoFocus}
        spellCheck={false}
        autoComplete="off"
      />
      {size === 'hero' && (
        <Button variant="primary" type="submit">
          Search
        </Button>
      )}
    </form>
  );
}
