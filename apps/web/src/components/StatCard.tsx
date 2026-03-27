interface StatCardProps {
  label: string;
  value: number;
  color?: string;
}

export function StatCard({ label, value, color = "text-gray-900" }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
