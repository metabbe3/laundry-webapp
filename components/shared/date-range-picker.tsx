"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DATE_RANGE_PRESETS, getDateRangePreset } from "@/lib/constants";
import type { DateRangePreset } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}

export function DateRangePicker({ from, to, onFromChange, onToChange }: DateRangePickerProps) {
  const { t } = useTranslation();

  const activePreset = DATE_RANGE_PRESETS.find((p) => {
    if (p.key === "custom") return false;
    const range = getDateRangePreset(p.key);
    return range.from === from && range.to === to;
  });

  function applyPreset(key: DateRangePreset) {
    if (key === "custom") return;
    const range = getDateRangePreset(key);
    onFromChange(range.from);
    onToChange(range.to);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {DATE_RANGE_PRESETS.map((p) => {
          const isActive = p.key === "custom"
            ? !activePreset
            : activePreset?.key === p.key;
          return (
            <Button
              key={p.key}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => applyPreset(p.key)}
            >
              {t(p.labelKey)}
            </Button>
          );
        })}
      </div>
      {!activePreset && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="w-full sm:w-[150px]" />
          <span className="text-muted-foreground text-sm">{t("common.to")}</span>
          <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="w-full sm:w-[150px]" />
        </div>
      )}
    </div>
  );
}
