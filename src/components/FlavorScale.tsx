import { Flame, Droplet } from "lucide-react";

interface ScaleProps {
  value: 1 | 2 | 3 | 4 | 5;
  type: "spice" | "sweet";
  label?: boolean;
}

export function FlavorScale({ value, type, label = false }: ScaleProps) {
  const Icon = type === "spice" ? Flame : Droplet;
  const activeClass = type === "spice" ? "text-primary fill-primary/30" : "text-accent fill-accent/30";

  return (
    <div className="inline-flex items-center gap-1">
      {label && (
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {type === "spice" ? "Heat" : "Sweet"}
        </span>
      )}
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          className={`h-3.5 w-3.5 transition-colors ${i <= value ? activeClass : "text-muted-foreground/30"}`}
          strokeWidth={2}
        />
      ))}
    </div>
  );
}
