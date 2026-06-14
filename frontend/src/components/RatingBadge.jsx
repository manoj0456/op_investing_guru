export default function RatingBadge({ rating }) {
  const r = rating ?? 0;
  let color, label;
  if (r >= 80) { color = "bg-green-600 text-green-100"; label = "Strong Buy"; }
  else if (r >= 60) { color = "bg-yellow-500 text-yellow-100"; label = "Buy"; }
  else if (r >= 40) { color = "bg-orange-500 text-orange-100"; label = "Hold"; }
  else { color = "bg-red-600 text-red-100"; label = "Watch"; }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {r} <span className="opacity-80">· {label}</span>
    </span>
  );
}
