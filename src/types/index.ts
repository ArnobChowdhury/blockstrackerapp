export enum TaskScheduleTypeEnum {
  Unscheduled = 'Unscheduled',
  Once = 'Once',
  Daily = 'Daily',
  SpecificDaysInAWeek = 'Specific Days in a Week',
}

export enum TimeOfDay {
  Morning = 'morning',
  Afternoon = 'afternoon',
  Evening = 'evening',
  Night = 'night',
}

export enum TaskCompletionStatusEnum {
  INCOMPLETE = 'INCOMPLETE',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
}

export interface Task {
  id: number;
  title: string;
  isActive: boolean;
  description: string | null;
  schedule: TaskScheduleTypeEnum;
  dueDate: string | null;
  timeOfDay: TimeOfDay | null;
  shouldBeScored: boolean;
  completionStatus: TaskCompletionStatusEnum;
  createdAt: string;
  modifiedAt: string;
  repetitiveTaskTemplateId: number | null;
}

export interface RepetitiveTaskTemplate {
  id: number;
  isActive: boolean;
  title: string;
  description: string | null;
  schedule: TaskScheduleTypeEnum;
  priority: number;
  shouldBeScored: boolean;
  monday: boolean | null;
  tuesday: boolean | null;
  wednesday: boolean | null;
  thursday: boolean | null;
  friday: boolean | null;
  saturday: boolean | null;
  sunday: boolean | null;
  timeOfDay: TimeOfDay | null;
  lastDateOfTaskGeneration: string | null;
  createdAt: string;
  modifiedAt: string;
  spaceId: number | null;
}

export interface Space {
  id: number;
  name: string;
  createdAt: string;
  modifiedAt: string;
}

export enum DaysInAWeek {
  Sunday = 'sunday',
  Monday = 'monday',
  Tuesday = 'tuesday',
  Wednesday = 'wednesday',
  Thursday = 'thursday',
  Friday = 'friday',
  Saturday = 'saturday',
}
