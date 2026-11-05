import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Pills. Primary is glossy black lacquer (white porcelain in dark mode), secondary a white pill with a soft
 * shadow. Hover lifts by a pixel, press scales down a touch: CSS transforms only, so it works before hydration.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "pill-primary",
  secondary: "pill-secondary",
  ghost: "text-ink hover:bg-ink/[0.06]",
  quiet: "glass-well text-ink hover:bg-ink/[0.08]",
  danger: "pill-secondary !text-bad",
};

const SIZES: Record<ButtonSize, string> = {
  // sm is 36 px tall; an invisible ::after extends the hit area to 44 px for touch.
  sm: "h-9 gap-1.5 px-4 text-small after:absolute after:-inset-1 after:content-['']",
  md: "h-11 gap-2 px-5 text-[0.9375rem]",
  lg: "h-[3.25rem] gap-2.5 px-7 text-base",
};

export const BUTTON_BASE =
  "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-full font-semibold tracking-[0.01em] outline-none transition-[transform,background,box-shadow,color,opacity] duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.97] active:duration-100 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--focus)] motion-reduce:hover:translate-y-0";

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(BUTTON_BASE, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Icon after the label instead of before it. */
  trailingIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, children, icon, trailingIcon, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
      {trailingIcon}
    </button>
  );
});

type LinkButtonProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  transitionTypes?: string[];
  prefetch?: boolean;
  onClick?: () => void;
  "data-testid"?: string;
};

export function LinkButton({ href, variant = "secondary", size = "md", className, children, icon, trailingIcon, transitionTypes, prefetch, onClick, ...rest }: LinkButtonProps) {
  return (
    <Link href={href} transitionTypes={transitionTypes} prefetch={prefetch} onClick={onClick} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
      {trailingIcon}
    </Link>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  children: ReactNode;
  active?: boolean;
  /** "plain" sits on glass; "raised" is a small white pill. */
  tone?: "plain" | "raised";
  size?: "sm" | "md";
};

/** Round icon-only button with an accessible name; 40 px (44 px hit area). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, children, active, tone = "plain", size = "md", type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full text-ink outline-none transition-[transform,background,box-shadow,color] duration-200 ease-out active:scale-[0.92] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] after:absolute after:-inset-0.5 after:content-['']",
        size === "md" ? "h-10 w-10" : "h-9 w-9",
        tone === "raised" ? "pill-secondary" : "hover:bg-ink/[0.07]",
        active && "bg-ink text-on-ink hover:bg-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
