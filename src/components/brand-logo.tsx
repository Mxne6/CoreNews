export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={className} aria-label="CoreNews" role="img">
      <picture>
        <source media="(prefers-color-scheme: light)" srcSet="/brand/corenews-logo-a-light.svg" />
        <img
          src="/brand/corenews-logo-a-dark.svg"
          alt="CoreNews"
          className="h-8 w-auto select-none"
          draggable={false}
        />
      </picture>
    </span>
  );
}