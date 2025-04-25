import {QuickSQLiteConnection} from 'react-native-quick-sqlite';
import {TaskScheduleTypeEnum, TimeOfDay} from '../../types'; // Assuming Task type definition

interface NewTaskData {
  title: string;
  description: string | null;
  schedule: TaskScheduleTypeEnum;
  timeOfDay: TimeOfDay | null;
  shouldBeScored: number; // 0 or 1
}

export class TaskRepository {
  private db: QuickSQLiteConnection;

  constructor(database: QuickSQLiteConnection) {
    this.db = database;
  }

  async addTask(taskData: NewTaskData): Promise<any> {
    // Return type could be more specific
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
      const result = this.db.execute(sql, params);
      console.log('[DB Repo] Task INSERT successful:', result);
      return result;
    } catch (error: any) {
      console.error('[DB Repo] Failed to INSERT task:', error);
      // Re-throw or handle error appropriately for the caller
      throw new Error(
        `Failed to save the task: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
