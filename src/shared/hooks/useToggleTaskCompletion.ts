import { useState } from 'react';
import { TaskCompletionStatusEnum } from '../../types';
import { TaskService } from '../../services/TaskService';

export const useToggleTaskCompletionStatus = (
  taskService: TaskService,
  isLoggedIn: boolean,
  cb?: () => Promise<void>,
) => {
  const [requestOnGoing, setRequestOnGoing] = useState(false);
  const [error, setError] = useState('');

  const onToggleTaskCompletionStatus = async (
    id: string,
    status: TaskCompletionStatusEnum,
    taskScore?: number | null,
  ) => {
    setError('');
    setRequestOnGoing(true);
    try {
      await taskService.updateTaskCompletionStatus(
        id,
        status,
        isLoggedIn,
        taskScore,
      );

      if (cb) {
        cb();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRequestOnGoing(false);
    }
  };

  return {
    requestOnGoing,
    error,
    onToggleTaskCompletionStatus,
  };
};
