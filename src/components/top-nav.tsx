"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { CATEGORY_ORDER, getCategoryHref, getCategoryLabel } from "@/lib/ui/categories";

const NAV_ITEMS = CATEGORY_ORDER.map((slug) => ({
  href: getCategoryHref(slug),
  label: getCategoryLabel(slug),
}));

function isActive(pathname: string, href: string): boolean {
  return pathname === href;
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="fixed left-4 right-4 top-4 z-40">
      <div className="content-container rounded-2xl border border-white/10 bg-[rgba(11,18,32,0.72)] shadow-[0_14px_40px_rgba(2,6,23,0.55)] backdrop-blur-xl">
        <nav className="flex flex-wrap items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          <Link
            href="/"
            aria-label="返回 CoreNews 首页"
            className="group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
          >
            <BrandLogo className="transition duration-200 ease-out group-hover:brightness-110" />
          </Link>
          <div className="h-5 w-px bg-white/15" aria-hidden />
          <div className="flex flex-wrap items-center gap-1.5 text-sm sm:text-[0.95rem]">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  scroll={false}
                  className={[
                    "group relative rounded-md px-3 py-1.5 text-slate-300 transition-colors duration-200 ease-out",
                    "hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70",
                    active ? "text-white" : "",
                  ].join(" ")}
                >
                  {item.label}
                  <span
                    className={[
                      "absolute bottom-0 left-3 right-3 h-px origin-left bg-gradient-to-r from-blue-400 to-violet-400 transition-transform duration-200 ease-out",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    ].join(" ")}
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}

