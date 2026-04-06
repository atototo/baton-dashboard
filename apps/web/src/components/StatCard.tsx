interface StatCardProps {
  label: string;
  value: number;
  color?: string;
  icon?: string;
  trend?: "up" | "down" | "neutral";
  highlight?: boolean;
  subtitle?: string;
}

export function StatCard({
  label,
  value,
  color = "text-gray-900",
  icon,
  trend,
  highlight,
  subtitle
}: StatCardProps) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : null;
  const trendColor = trend === "up" ? "text-red-500" : trend === "down" ? "text-green-500" : "";

  return (
    <div className={`bg-white rounded-lg border p-4 transition-all ${
      highlight
        ? "border-orange-300 shadow-md ring-2 ring-orange-100"
        : "border-gray-200 hover:border-gray-300"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            {trendIcon && (
              <span className={`text-lg font-bold ${trendColor}`}>
                {trendIcon}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <span className="text-2xl opacity-60">{icon}</span>
        )}
      </div>
    </div>
  );
}
