
// Pre-defined color palettes using standard Tailwind classes
// We define full strings to ensure PurgeCSS/JIT does not strip them
const COLOR_PALETTES = [
    { name: 'blue', bg: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-900', hex: '#3b82f6' },
    { name: 'emerald', bg: 'bg-emerald-100', border: 'border-emerald-200', text: 'text-emerald-900', hex: '#10b981' },
    { name: 'violet', bg: 'bg-violet-100', border: 'border-violet-200', text: 'text-violet-900', hex: '#8b5cf6' },
    { name: 'amber', bg: 'bg-amber-100', border: 'border-amber-200', text: 'text-amber-900', hex: '#f59e0b' },
    { name: 'rose', bg: 'bg-rose-100', border: 'border-rose-200', text: 'text-rose-900', hex: '#f43f5e' },
    { name: 'cyan', bg: 'bg-cyan-100', border: 'border-cyan-200', text: 'text-cyan-900', hex: '#06b6d4' },
    { name: 'fuchsia', bg: 'bg-fuchsia-100', border: 'border-fuchsia-200', text: 'text-fuchsia-900', hex: '#d946ef' },
    { name: 'lime', bg: 'bg-lime-100', border: 'border-lime-200', text: 'text-lime-900', hex: '#84cc16' },
    { name: 'indigo', bg: 'bg-indigo-100', border: 'border-indigo-200', text: 'text-indigo-900', hex: '#6366f1' },
    { name: 'orange', bg: 'bg-orange-100', border: 'border-orange-200', text: 'text-orange-900', hex: '#f97316' },
    { name: 'teal', bg: 'bg-teal-100', border: 'border-teal-200', text: 'text-teal-900', hex: '#14b8a6' },
    { name: 'sky', bg: 'bg-sky-100', border: 'border-sky-200', text: 'text-sky-900', hex: '#0ea5e9' },
];

/**
 * Generates a consistent color palette for a given string (e.g. Department Name).
 * Uses a hash function to map the string to an index in the palette array.
 */
export const getDepartmentStyle = (dept: string) => {
    if (!dept) return COLOR_PALETTES[0];

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < dept.length; i++) {
        hash = dept.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % COLOR_PALETTES.length;
    return COLOR_PALETTES[index];
};

/**
 * Returns just the combined Tailwind classes for the header
 */
export const getDepartmentHeaderClass = (dept: string): string => {
    const style = getDepartmentStyle(dept);
    return `${style.bg} ${style.border} ${style.text}`;
};
