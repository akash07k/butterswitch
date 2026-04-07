import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS class names intelligently.
 *
 * Combines clsx (conditional classes) with tailwind-merge
 * (deduplicates and resolves Tailwind class conflicts).
 *
 * @example
 * ```ts
 * cn("px-4 py-2", isActive && "bg-primary", "px-6")
 * // => "py-2 px-6 bg-primary" (px-4 overridden by px-6)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
