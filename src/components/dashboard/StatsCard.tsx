interface StatsCardProps {
  title: string;
  value: number;
  borderColor: string;
  textColor: string;
  bgColor: string;
}

export function StatsCard({ title, value, borderColor, textColor, bgColor }: StatsCardProps) {
  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm border-l-4 ${borderColor}`}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`text-4xl font-bold mt-2 ${textColor}`}>{value}</p>
      <div className={`mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
        заявок
      </div>
    </div>
  );
}
