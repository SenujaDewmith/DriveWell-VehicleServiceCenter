import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  // When provided, typing text that doesn't exactly match any existing option
  // surfaces a "+ Create '<text>'" row — the same inline-create pattern used
  // by Notion/Linear/GitHub labels, so adding a new option and picking it are
  // the same action instead of a separate form.
  onCreateOption?: (label: string) => void;
  createLabel?: (search: string) => string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  className,
  onCreateOption,
  createLabel = (search) => `Create "${search}"`,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.value === value);

  const trimmedSearch = search.trim();
  const filtered = trimmedSearch
    ? options.filter((o) => o.label.toLowerCase().includes(trimmedSearch.toLowerCase()))
    : options;
  const exactMatchExists = options.some((o) => o.label.toLowerCase() === trimmedSearch.toLowerCase());
  const showCreate = !!onCreateOption && trimmedSearch.length > 0 && !exactMatchExists;

  const closeAndReset = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            {filtered.length === 0 && !showCreate && <CommandEmpty>{emptyText}</CommandEmpty>}
            <CommandGroup>
              {filtered.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  disabled={option.disabled}
                  onSelect={() => {
                    if (option.disabled) return;
                    onValueChange(option.value === value ? "" : option.value);
                    closeAndReset();
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")}
                  />
                  {option.label}
                  {option.disabled && <span className="ml-auto text-xs text-muted-foreground">Added</span>}
                </CommandItem>
              ))}
              {showCreate && (
                <CommandItem
                  value={`__create__${trimmedSearch}`}
                  onSelect={() => {
                    onCreateOption!(trimmedSearch);
                    closeAndReset();
                  }}
                  className="text-accent"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createLabel(trimmedSearch)}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
