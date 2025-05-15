import { useState } from 'react';
import { TaskCompletionStatusEnum } from '../../types';
import { TaskRepository } from '/home/sami/Work/BlockstrackerApp/src/services/database/repository';

export const useToggleTaskCompletionStatus = (
  taskRepository: TaskRepository | null,
  cb?: () => Promise<void>,
) => {
  const [requestOnGoing, setRequestOnGoing] = useState(false);
  const [error, setError] = useState('');

  const onToggleTaskCompletionStatus = async (
    id: number,
    status: TaskCompletionStatusEnum,
  ) => {
    if (!taskRepository) {
      setError('Database service not ready.');
      return;
    }

    setError('');
    setRequestOnGoing(true);
    try {
      await taskRepository.updateTaskCompletionStatus(id, status);

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
