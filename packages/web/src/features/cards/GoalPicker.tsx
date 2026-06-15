import { useGoals } from '../../api/goals';
import styles from './Card.module.css';

export function GoalPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { data: goals = [] } = useGoals();
  return (
    <select className={styles.select} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— без цели —</option>
      {goals.map((g) => (
        <option key={g.id} value={g.id}>
          {g.title}
        </option>
      ))}
    </select>
  );
}
