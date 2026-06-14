export default function FieldRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-xs text-gray-400 font-medium">{label}</label>
      {children}
    </div>
  );
}
