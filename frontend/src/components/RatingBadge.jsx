export default function RatingBadge({ rating }) {
  if (rating == null) return <span className="text-gray-400 dark:text-gray-500">—</span>;

  const r = Number(rating);
  let label, colorClass;
  if (r >= 80) {
    label = "Strong Buy";
    colorClass = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  } else if (r >= 60) {
    label = "Buy";
    colorClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  } else if (r >= 40) {
    label = "Hold";
    colorClass = "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  } else {
    label = "Watch";
    colorClass = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}
    >
      <span className="font-mono">{r.toFixed(1)}</span>
      <span>{label}</span>
    </span>
  );
}
