import { createContext, useContext, useState, type ReactNode } from "react";

type Ctx = { query: string; setQuery: (q: string) => void };
const SearchContext = createContext<Ctx>({ query: "", setQuery: () => {} });

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return <SearchContext.Provider value={{ query, setQuery }}>{children}</SearchContext.Provider>;
}

export const useSearch = () => useContext(SearchContext);