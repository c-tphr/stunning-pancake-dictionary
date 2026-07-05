import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'outline' | 'text';

interface ButtonProps {
  variant?: Variant;
  /** Renders as a router Link when provided. */
  to?: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  to,
  type = 'button',
  onClick,
  disabled,
  className,
  children,
}: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');
  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
