import { useCallback } from 'react';
import { useState } from 'react';
import { TaskRepository } from '../../services/database/repository';

export const useTaskReschedule = (
  taskRepository: TaskRepository | null,
  cb?: () => void,
) => {
  const [requestOnGoing, setRequestOnGoing] = useState(false);
  const [error, setError] = useState('');

  const onTaskReschedule = useCallback(
    async (taskId: number, rescheduledTime: Date) => {
      console.time('useTaskReschedule');
      if (!taskRepository) {
        setError('Database service not ready.');
        return;
      }

      setError('');
      setRequestOnGoing(true);
      try {
        await taskRepository?.updateTaskDueDate(taskId, rescheduledTime);

        if (cb) {
          cb();
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setRequestOnGoing(false);
      }
    },
    [cb, taskRepository],
  );

  return {
    requestOnGoing,
    error,
    onTaskReschedule,
  };
};
