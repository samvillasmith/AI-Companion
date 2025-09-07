"use client";

import { useState, useEffect, type ChangeEventHandler } from "react";
import { Search } from "lucide-react";
import { Input } from "./ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "../hooks/use-debounce";
import qs from "query-string";

export const SearchInput = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categoryId = searchParams.get("categoryId");
  const name = searchParams.get("name");

  const [value, setValue] = useState(name || "");
  const debouncedValue = useDebounce<string>(value, 500);

  const onChange: ChangeEventHandler<HTMLInputElement> = (e) => setValue(e.target.value);

  useEffect(() => {
    const query = { name: debouncedValue, categoryId };
    const url = qs.stringifyUrl({ url: window.location.pathname, query }, { skipEmptyString: true, skipNull: true });
    router.push(url);
  }, [debouncedValue, router, categoryId]);

  return (
    <div className="relative w-full max-w-7xl mx-auto group">
      <div className="relative rounded-xl bg-muted/40 backdrop-blur-sm ring-1 ring-border transition-shadow group-focus-within:shadow-[0_0_0_1px_rgba(99,102,241,0.20)]">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={onChange}
          value={value}
          placeholder="Search companions, categories…"
          className="h-12 pl-11 pr-4 rounded-xl border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 shadow-none"
        />
        {/* gradient underline on focus — pastel in light, brighter in dark */}
        <span
          aria-hidden
          className="
            pointer-events-none absolute inset-x-2 bottom-1 h-px
            bg-gradient-to-r from-sky-500/20 via-indigo-500/35 to-fuchsia-500/20
            opacity-0 group-focus-within:opacity-100 transition-opacity
            dark:from-sky-500/0 dark:via-indigo-500/55 dark:to-fuchsia-500/0
          "
        />
      </div>
    </div>
  );
};
