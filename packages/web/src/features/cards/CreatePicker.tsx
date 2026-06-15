import { useCreateTask } from '../../api/tasks';
import { useCreateTimeBlock } from '../../api/timeblocks';
import { useUiStore } from '../../store/ui-store';
import { Modal } from '../../components/Modal';
import styles from './CreatePicker.module.css';

export function CreatePicker() {
  const { creatorOpen, creatorDate, closeCreator, openTask, openEvent } = useUiStore();
  const createTask = useCreateTask();
  const createBlock = useCreateTimeBlock();

  const pending = createTask.isPending || createBlock.isPending;

  const makeTask = () => {
    // Если время не задано (контекст дня/месяца — полночь), создаём задачу «на весь день»
    const allDay = !!creatorDate && creatorDate.getHours() === 0 && creatorDate.getMinutes() === 0;
    createTask.mutate(
      {
        title: 'Новая задача',
        ...(creatorDate ? { dueAt: creatorDate, dueAllDay: allDay } : {}),
      },
      { onSuccess: (task) => openTask(task.id) },
    );
  };

  const makeEvent = () => {
    const start = creatorDate ?? new Date();
    const end = new Date(start.valueOf() + 60 * 60 * 1000);
    createBlock.mutate(
      { title: 'Новое мероприятие', startAt: start, endAt: end },
      { onSuccess: (block) => openEvent(block.id) },
    );
  };

  return (
    <Modal open={creatorOpen} onClose={closeCreator}>
      <div className={styles.picker}>
        <h3 className={styles.title}>Что создать?</h3>
        <div className={styles.options}>
          <button className={styles.option} onClick={makeEvent} disabled={pending}>
            <span className={styles.icon} style={{ background: 'rgba(0,122,255,0.12)', color: '#007aff' }}>
              📅
            </span>
            <span className={styles.optText}>
              <span className={styles.optTitle}>Мероприятие</span>
              <span className={styles.optDesc}>Событие в календаре с участниками</span>
            </span>
          </button>
          <button className={styles.option} onClick={makeTask} disabled={pending}>
            <span className={styles.icon} style={{ background: 'rgba(52,199,89,0.14)', color: '#34c759' }}>
              ✓
            </span>
            <span className={styles.optText}>
              <span className={styles.optTitle}>Задача</span>
              <span className={styles.optDesc}>Дело с дедлайном и подзадачами</span>
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
