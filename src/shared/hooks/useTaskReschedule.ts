import { useCallback } from 'react';
import { useState } from 'react';
import { TaskService } from '../../services/TaskService';

export const useTaskReschedule = (
  taskService: TaskService,
  isLoggedIn: boolean,
  cb?: () => Promise<void>,
) => {
  const [requestOnGoing, setRequestOnGoing] = useState(false);
  const [error, setError] = useState('');

  const onTaskReschedule = useCallback(
    async (taskId: string, rescheduledTime: Date) => {
      setError('');
      setRequestOnGoing(true);
      try {
        await taskService.updateTaskDueDate(
          taskId,
          rescheduledTime,
          isLoggedIn,
        );

        if (cb) {
          await cb();
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setRequestOnGoing(false);
      }
    },
    [cb, taskService, isLoggedIn],
  );

  return {
    requestOnGoing,
    error,
    onTaskReschedule,
  };
};
