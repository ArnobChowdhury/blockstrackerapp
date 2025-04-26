import {NitroSQLiteConnection, QueryResult} from 'react-native-nitro-sqlite';
import {TaskScheduleTypeEnum, TimeOfDay} from '../../types';

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

interface NewTaskData {
  title: string;
  description: string | null;
  schedule: TaskScheduleTypeEnum;
  timeOfDay: TimeOfDay | null;
  shouldBeScored: number;
}

export class TaskRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  async addTask(taskData: NewTaskData): Promise<QueryResult> {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO tasks (
        title, description, schedule, time_of_day, should_be_scored, created_at, modified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    const params = [
      taskData.title,
      taskData.description,
      taskData.schedule,
      taskData.timeOfDay,
      taskData.shouldBeScored,
      now,
      now,
    ];

    console.log('[DB Repo] Attempting to INSERT Task:', {sql, params});

    try {
      const result: QueryResult = await this.db.executeAsync(sql, params);
      console.log('[DB Repo] Task INSERT successful:', result);

      return result;
    } catch (error: any) {
      console.error('[DB Repo] Failed to INSERT task:', error);
      throw new Error(
        `Failed to save the task: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async getAllActiveUnscheduledTasks(): Promise<Task[]> {
    const sql = `
      SELECT
        id, title, description, schedule, time_of_day, should_be_scored, created_at, modified_at, is_active
      FROM tasks
      WHERE schedule = ? AND is_active = 1
      ORDER BY created_at DESC; -- Order by creation date, newest first
    `;
    const params: any[] = [TaskScheduleTypeEnum.Unscheduled];

    console.log('[DB Repo] Attempting to SELECT all active tasks:', {sql});
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      console.log(
        '[DB Repo] SELECT successful, rows found:',
        resultSet.rows?.length,
      );

      const tasks: Task[] = [];

      if (resultSet.rows) {
        for (let i = 0; i < resultSet.rows.length; i++) {
          const task = resultSet.rows.item(i);
          if (task) {
            const transformedTask: Task = {
              id: task.id as number,
              title: task.title as string,
              isActive: (task.is_active === 1) as boolean,
              description: task.description as string | null,
              schedule: task.schedule as TaskScheduleTypeEnum,
              timeOfDay: task.time_of_day as TimeOfDay | null,
              shouldBeScored: (task.should_be_scored === 1) as boolean,
              createdAt: task.created_at as string,
              modifiedAt: task.modified_at as string,
            };

            tasks.push(transformedTask);
          }
        }
      }

      return tasks;
    } catch (error: any) {
      console.error('[DB Repo] Failed to SELECT tasks:', error);
      throw new Error(
        `Failed to retrieve tasks: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
