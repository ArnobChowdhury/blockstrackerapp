import { useState } from 'react';
import { TaskCompletionStatusEnum } from '../../types';
import { TaskService } from '../../services/TaskService';
import { useAppContext } from '../contexts/useAppContext';

export const useToggleTaskCompletionStatus = (
  taskService: TaskService,
  cb?: () => Promise<void>,
) => {
  const [requestOnGoing, setRequestOnGoing] = useState(false);
  const { showSnackbar } = useAppContext();

  const onToggleTaskCompletionStatus = async (
    id: string,
    status: TaskCompletionStatusEnum,
    userId: string | null,
    taskScore?: number | null,
  ) => {
    setRequestOnGoing(true);
    try {
      await taskService.updateTaskCompletionStatus(
        id,
        status,
        userId,
        taskScore,
      );

      if (cb) {
        cb();
      }
    } catch (err: any) {
      showSnackbar(err.message);
    } finally {
      setRequestOnGoing(false);
    }
  };

  return {
    requestOnGoing,
    onToggleTaskCompletionStatus,
  };
};
