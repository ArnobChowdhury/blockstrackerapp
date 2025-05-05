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

export interface Task {
  id: number;
  title: string;
  isActive: boolean;
  description: string | null;
  schedule: TaskScheduleTypeEnum;
  timeOfDay: TimeOfDay | null;
  shouldBeScored: boolean;
  createdAt: string;
  modifiedAt: string;
}

export interface Space {
  id: number;
  name: string;
  createdAt: string;
  modifiedAt: string;
}
