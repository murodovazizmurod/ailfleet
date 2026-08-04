import { ReactNode } from "react";
import Link from "next/link";

const VARIANTS = {
  primary:
    "bg-[#a3e635] text-[#0b0f14] hover:bg-[#bef264] focus-visible:outline-[#a3e635] shadow-sm",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-100",
  danger: "bg-[#dc2626] text-[#ffffff] hover:bg-[#ef4444] shadow-sm",
  ghost: "text-slate-600 hover:bg-slate-100",
} as const;

type Variant = keyof typeof VARIANTS;

const BASE =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50";

export function Button({
  variant = "primary",
  type = "button",
  children,
  ...rest
}: {
  variant?: Variant;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`${BASE} ${VARIANTS[variant]}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]}`}>
      {children}
    </Link>
  );
}
