import { NitroSQLiteConnection, QueryResult } from 'react-native-nitro-sqlite';
import { TaskScheduleTypeEnum, TimeOfDay } from '../../types';
import type { Task, Space } from '../../types';

interface NewTaskData {
  title: string;
  description?: string;
  schedule: TaskScheduleTypeEnum;
  dueDate?: Date;
  timeOfDay: TimeOfDay | null;
  shouldBeScored: number;
  space: Space | null;
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
        title, description, schedule, due_date, time_of_day,
        should_be_scored, created_at, modified_at, space_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const params = [
      taskData.title,
      taskData.description,
      taskData.schedule,
      taskData.dueDate?.toISOString(),
      taskData.timeOfDay,
      taskData.shouldBeScored,
      now,
      now,
      taskData.space ? taskData.space.id : null,
    ];

    console.log('[DB Repo] Attempting to INSERT Task:', { sql, params });

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

    console.log('[DB Repo] Attempting to SELECT all active tasks:', { sql });
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

export class SpaceRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  async getAllSpaces(): Promise<Space[]> {
    const sql = `
      SELECT id, name, created_at, modified_at FROM spaces;
    `;

    console.log('[DB Repo] Attempting to SELECT all spaces:', { sql });
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql);
      console.log(
        '[DB Repo] SELECT successful, rows found:',
        resultSet.rows?.length,
      );

      const spaces: Space[] = [];

      if (resultSet.rows) {
        for (let i = 0; i < resultSet.rows.length; i++) {
          const space = resultSet.rows.item(i);
          if (space) {
            const transformedSpace: Space = {
              id: space.id as number,
              name: space.name as string,
              createdAt: space.created_at as string,
              modifiedAt: space.modified_at as string,
            };

            spaces.push(transformedSpace);
          }
        }
      }

      return spaces;
    } catch (error: any) {
      console.error('[DB Repo] Failed to SELECT spaces:', error);
      throw new Error(
        `Failed to retrieve spaces: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async addSpace(name: string): Promise<QueryResult> {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO spaces (
        name, created_at, modified_at
      ) VALUES (?, ?, ?);
    `;

    const params = [name, now, now];

    console.log('[DB Repo] Attempting to INSERT Space:', { sql, params });

    try {
      const result: QueryResult = await this.db.executeAsync(sql, params);
      console.log('[DB Repo] Space INSERT successful:', result);

      return result;
    } catch (error: any) {
      console.error('[DB Repo] Failed to INSERT space:', error);
      throw new Error(
        `Failed to save the space: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
