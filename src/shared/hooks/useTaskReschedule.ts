import { useCallback } from 'react';
import { useState } from 'react';
import { TaskService } from '../../services/TaskService';

export const useTaskReschedule = (
  taskService: TaskService,
  cb?: () => Promise<void>,
) => {
  const [requestOnGoing, setRequestOnGoing] = useState(false);
  const [error, setError] = useState('');

  const onTaskReschedule = useCallback(
    async (taskId: string, rescheduledTime: Date, userId: string | null) => {
      setError('');
      setRequestOnGoing(true);
      try {
        await taskService.updateTaskDueDate(taskId, rescheduledTime, userId);

        if (cb) {
          await cb();
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setRequestOnGoing(false);
      }
    },
    [cb, taskService],
  );

  return {
    requestOnGoing,
    error,
    onTaskReschedule,
  };
};
