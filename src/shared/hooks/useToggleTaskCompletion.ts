import { useState } from 'react';
import { TaskCompletionStatusEnum } from '../../types';
import { TaskRepository } from '../../db/repository';

export const useToggleTaskCompletionStatus = (
  taskRepository: TaskRepository | null,
  cb?: () => Promise<void>,
) => {
  const [requestOnGoing, setRequestOnGoing] = useState(false);
  const [error, setError] = useState('');

  const onToggleTaskCompletionStatus = async (
    id: string,
    status: TaskCompletionStatusEnum,
    taskScore?: number | null,
  ) => {
    if (!taskRepository) {
      setError('Database service not ready.');
      return;
    }

    setError('');
    setRequestOnGoing(true);
    try {
      await taskRepository.updateTaskCompletionStatus(id, status, taskScore);

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
