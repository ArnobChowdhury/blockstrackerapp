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
  id: string;
  title: string;
  isActive: boolean;
  description: string | null;
  schedule: TaskScheduleTypeEnum;
  dueDate: string | null;
  timeOfDay: TimeOfDay | null;
  shouldBeScored: boolean;
  score: number | null;
  completionStatus: TaskCompletionStatusEnum;
  createdAt: string;
  modifiedAt: string;
  repetitiveTaskTemplateId: string | null;
  spaceId: string | null;
}

export interface RepetitiveTaskTemplate {
  id: string;
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
  spaceId: string | null;
}

export interface Space {
  id: string;
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

export interface NewTaskData {
  title: string;
  description?: string;
  schedule: TaskScheduleTypeEnum;
  dueDate?: Date;
  timeOfDay: TimeOfDay | null;
  repetitiveTaskTemplateId?: string;
  shouldBeScored: number;
  spaceId: string | null;
}

export interface NewRepetitiveTaskTemplateData {
  title: string;
  description?: string;
  schedule: TaskScheduleTypeEnum;
  timeOfDay: TimeOfDay | null;
  days: DaysInAWeek[];
  shouldBeScored: number;
  spaceId: string | null;
}
