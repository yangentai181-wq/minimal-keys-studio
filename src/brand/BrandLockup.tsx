import identity from "./identity.json";

export interface BrandLockupProps {
  size?: "compact" | "standard";
  tagline?: string;
  className?: string;
}

export function BrandLockup({
  size = "standard",
  tagline,
  className = "",
}: BrandLockupProps) {
  const compact = size === "compact";

  return (
    <div className={`flex items-center ${compact ? "gap-2" : "gap-3"} ${className}`.trim()}>
      <img
        src={`${import.meta.env.BASE_URL}${identity.iconPath}`}
        alt={identity.productName}
        className={compact ? "h-8 w-8 rounded-lg" : "h-12 w-12 rounded-xl shadow-sm"}
      />
      <div className="min-w-0">
        <p className={compact ? "truncate text-base font-semibold" : "truncate text-xl font-bold text-base-content"}>
          {identity.productName}
        </p>
        {tagline && <p className="truncate text-xs font-semibold text-base-content/55">{tagline}</p>}
      </div>
    </div>
  );
}
