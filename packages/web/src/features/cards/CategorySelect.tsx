import { useCategories } from '../../api/categories';

// Компактный выпадающий список зон/категорий для форм.
export function CategorySelect({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  const { data: categories = [] } = useCategories();
  return (
    <select className={className} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— зона —</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
