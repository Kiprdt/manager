import { useState } from 'react';
import { useCategories, useCreateCategory } from '../../api/categories';
import styles from './CategoryPicker.module.css';

const PALETTE = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff2d55', '#00c7be', '#5856d6', '#ff3b30'];

export function CategoryPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { data: categories = [] } = useCategories();
  const createCat = useCreateCategory();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const add = () => {
    const n = name.trim();
    if (!n) return;
    createCat.mutate(
      { name: n, color: PALETTE[categories.length % PALETTE.length] },
      { onSuccess: (c) => onChange(c.id) },
    );
    setName('');
    setAdding(false);
  };

  return (
    <div className={styles.row}>
      <button
        className={`${styles.chip} ${!value ? styles.on : ''}`}
        onClick={() => onChange(null)}
      >
        Без зоны
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          className={`${styles.chip} ${value === c.id ? styles.on : ''}`}
          style={value === c.id ? { background: c.color, color: '#fff', borderColor: c.color } : { color: c.color }}
          onClick={() => onChange(c.id)}
        >
          <span className={styles.dot} style={{ background: c.color }} />
          {c.name}
        </button>
      ))}
      {adding ? (
        <input
          autoFocus
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
            if (e.key === 'Escape') setAdding(false);
          }}
          onBlur={add}
          placeholder="Название зоны"
        />
      ) : (
        <button className={styles.addBtn} onClick={() => setAdding(true)}>
          ＋
        </button>
      )}
    </div>
  );
}
