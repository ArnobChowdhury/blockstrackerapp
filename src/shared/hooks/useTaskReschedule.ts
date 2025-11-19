import { useCallback } from 'react';
import { useState } from 'react';
import { Task, TaskScheduleTypeEnum } from '../../types';
import { TaskService } from '../../services/TaskService';
import { RepetitiveTaskTemplateService } from '../../services/RepetitiveTaskTemplateService';
import { useAppContext } from '../contexts/useAppContext';
import { getNextIterationDateForRepetitiveTask } from '../utils';
import dayjs from 'dayjs';

export const useTaskReschedule = (
  taskService: TaskService,
  repetitiveTaskTemplateService: RepetitiveTaskTemplateService,
  cb?: () => Promise<void>,
) => {
  const [requestOnGoing, setRequestOnGoing] = useState(false);
  const { user, showSnackbar } = useAppContext();
  const [datePickerStartDate, setDatePickerStartDate] = useState<
    Date | undefined
  >();
  const [datePickerEndDate, setDatePickerEndDate] = useState<
    Date | undefined
  >();
  const [taskIdToBeRescheduled, setTaskIdToBeRescheduled] = useState<
    string | null
  >(null);

  const [selectedDateForTaskReschedule, setSelectedDateForTaskReschedule] =
    useState<Date>();

  const resetTaskRescheduling = useCallback(() => {
    setTaskIdToBeRescheduled(null);
    setSelectedDateForTaskReschedule(undefined);
    setDatePickerEndDate(undefined);
  }, []);

  const onTaskReschedule = useCallback(
    async (params: { date: Date | undefined }) => {
      if (!taskIdToBeRescheduled || !params.date) {
        showSnackbar(
          'An error occurred while rescheduling the task. Please try again.',
        );
        return;
      }
      setRequestOnGoing(true);

      try {
        await taskService.updateTaskDueDate(
          taskIdToBeRescheduled,
          dayjs(params.date).startOf('day').toDate(),
          user && user.id,
        );

        if (cb) {
          await cb();
        }
        resetTaskRescheduling();
      } catch (err: any) {
        showSnackbar(err.message);
      } finally {
        setRequestOnGoing(false);
      }
    },
    [
      cb,
      resetTaskRescheduling,
      showSnackbar,
      taskIdToBeRescheduled,
      taskService,
      user,
    ],
  );

  const handleRescheduleIconTap = async (task: Task) => {
    setSelectedDateForTaskReschedule(new Date(task.dueDate as string));
    setTaskIdToBeRescheduled(task.id);

    if (
      task.schedule !== TaskScheduleTypeEnum.SpecificDaysInAWeek ||
      !task.repetitiveTaskTemplateId
    ) {
      return;
    }

    const repetitiveTaskTemplate =
      await repetitiveTaskTemplateService.getRepetitiveTaskTemplateById(
        task.repetitiveTaskTemplateId,
        user && user.id,
      );

    if (!repetitiveTaskTemplate) {
      return;
    }
    const nextIterationDate = getNextIterationDateForRepetitiveTask(
      repetitiveTaskTemplate,
      dayjs(task.dueDate as string),
    );

    if (!nextIterationDate) {
      return;
    }

    setDatePickerStartDate(dayjs().startOf('day').toDate());
    setDatePickerEndDate(
      nextIterationDate.subtract(1, 'day').startOf('day').toDate(),
    );
  };

  return {
    requestOnGoing,
    taskIdToBeRescheduled,
    handleRescheduleIconTap,
    datePickerStartDate,
    datePickerEndDate,
    onTaskReschedule,
    isDatePickerVisible: !!taskIdToBeRescheduled,
    selectedDateForTaskReschedule,
    resetTaskRescheduling,
  };
};
