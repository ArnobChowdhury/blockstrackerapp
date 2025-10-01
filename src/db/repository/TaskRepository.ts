import { NitroSQLiteConnection, QueryResult } from 'react-native-nitro-sqlite';
import uuid from 'react-native-uuid';
import dayjs from 'dayjs';

import {
  TaskScheduleTypeEnum,
  TimeOfDay,
  TaskCompletionStatusEnum,
} from '../../types';
import type { Task, NewTaskData } from '../../types';

export class TaskRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  private _transformRowToTask(row: any): Task {
    return {
      id: row.id as string,
      title: row.title as string,
      isActive: (row.is_active === 1) as boolean,
      description: row.description as string | null,
      schedule: row.schedule as TaskScheduleTypeEnum,
      dueDate: row.due_date as string | null,
      timeOfDay: row.time_of_day as TimeOfDay | null,
      completionStatus: row.completion_status as TaskCompletionStatusEnum,
      shouldBeScored: (row.should_be_scored === 1) as boolean,
      score: row.score as number | null,
      createdAt: row.created_at as string,
      modifiedAt: row.modified_at as string,
      repetitiveTaskTemplateId: row.repetitive_task_template_id as
        | string
        | null,
      spaceId: row.space_id as string | null,
      userId: row.user_id as string | null,
    };
  }

  async getTaskById(taskId: string): Promise<Task | null> {
    const task = await this._getActiveTasksByCondition('id = ?', [taskId]);
    if (task) {
      return task[0];
    }
    return null;
  }

  /**
   * Creates a new task with a generated UUID.
   * @param taskData The data for the new task.
   * @param userId The ID of the user creating the task, or null for anonymous.
   * @returns The UUID of the newly created task.
   */
  async createTask(
    taskData: NewTaskData,
    userId: string | null,
  ): Promise<Task> {
    const newId = uuid.v4() as string;
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO tasks (
        id, title, description, schedule, due_date, time_of_day, repetitive_task_template_id,
        should_be_scored, created_at, modified_at, space_id, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;
    `;

    const params = [
      newId,
      taskData.title,
      taskData.description,
      taskData.schedule,
      taskData.dueDate?.toISOString(),
      taskData.timeOfDay,
      taskData.repetitiveTaskTemplateId,
      taskData.shouldBeScored,
      now,
      now,
      taskData.spaceId,
      userId,
    ];

    console.log('[DB Repo] Attempting to INSERT Task:', { sql, params });

    try {
      const resultSet = await this.db.executeAsync(sql, params);
      console.log('[DB Repo] Task INSERT successful for id:', newId);
      if (resultSet.rows && resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        if (row) {
          return this._transformRowToTask(row);
        }
      }

      throw new Error('Failed to create task: no rows returned.');
    } catch (error: any) {
      console.error('[DB Repo] Failed to INSERT task:', error);
      throw new Error(
        `Failed to save the task: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async updateTaskById(
    taskId: string,
    taskData: NewTaskData,
    userId: string | null,
  ): Promise<Task | null> {
    const now = new Date().toISOString();
    let sql = `
      UPDATE tasks
      SET
        title = ?,
        description = ?,
        schedule = ?,
        due_date = ?,
        time_of_day = ?,
        should_be_scored = ?,
        modified_at = ?,
        space_id = ?
      WHERE id = ?
    `;

    const params = [
      taskData.title,
      taskData.description,
      taskData.schedule,
      taskData.dueDate?.toISOString(),
      taskData.timeOfDay,
      taskData.shouldBeScored,
      now,
      taskData.spaceId,
      taskId,
    ];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    } else {
      sql += ' AND user_id IS NULL';
    }
    sql += ' RETURNING *;';

    console.log('[DB Repo] Attempting to UPDATE Task:', { sql, params });

    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      console.log('[DB Repo] Task UPDATE successful:', resultSet);
      if (resultSet.rows && resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        if (row) {
          return this._transformRowToTask(row);
        }
      }
      return null;
    } catch (error: any) {
      console.error('[DB Repo] Failed to UPDATE task:', error);
      throw new Error(
        `Failed to update task: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async getAllOverdueTasks(): Promise<Task[]> {
    const todayStart = dayjs().startOf('day');

    return this._getActiveTasksByCondition(
      'due_date < ? AND completion_status = ?',
      [todayStart.toISOString(), TaskCompletionStatusEnum.INCOMPLETE],
    );
  }

  async getCountOfTasksOverdue(): Promise<number> {
    const todayStart = dayjs().startOf('day');

    const sql = `
      SELECT COUNT(*) as count
      FROM tasks
      WHERE due_date < ? AND completion_status = ? AND is_active = ?;
    `;

    const params = [
      todayStart.toISOString(),
      TaskCompletionStatusEnum.INCOMPLETE,
      1,
    ];

    console.log('[DB Repo] Attempting to SELECT count of overdue tasks:', {
      sql,
      params,
    });
    try {
      const result = await this.db.executeAsync(sql, params);
      const count = result.rows?.item(0)?.count ?? 0;
      return count as number;
    } catch (error: any) {
      console.error(
        '[DB Repo] Failed to SELECT count of overdue tasks:',
        error,
      );
      throw new Error(
        `Failed to fetch count of overdue tasks: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async _countActiveTasksByCondition(
    conditionSql: string,
    conditionParams: any[],
  ): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count
      FROM tasks
      WHERE ${conditionSql} AND is_active = ?;
    `;
    const params = [...conditionParams, 1];

    console.log('[DB Repo] Attempting to SELECT count of active tasks:', {
      sql,
      params,
    });

    try {
      const result = await this.db.executeAsync(sql, params);
      const count = result.rows?.item(0)?.count ?? 0;
      return count as number;
    } catch (error: any) {
      console.error('[DB Repo] Failed to SELECT count of active tasks:', error);
      throw new Error(
        `Failed to fetch count of active tasks: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async countAllActiveTasksByCategory() {
    const sql = 'schedule = ? AND completion_status = ?';
    const countUnscheduledTasks = await this._countActiveTasksByCondition(sql, [
      TaskScheduleTypeEnum.Unscheduled,
      TaskCompletionStatusEnum.INCOMPLETE,
    ]);

    const countOnceTasks = await this._countActiveTasksByCondition(sql, [
      TaskScheduleTypeEnum.Once,
      TaskCompletionStatusEnum.INCOMPLETE,
    ]);
    return {
      [TaskScheduleTypeEnum.Unscheduled]: countUnscheduledTasks,
      [TaskScheduleTypeEnum.Once]: countOnceTasks,
    };
  }

  async countActiveTasksBySpaceId(spaceId: string) {
    const sql = 'schedule = ? AND completion_status = ? AND space_id = ?';
    const countUnscheduledTasks = await this._countActiveTasksByCondition(sql, [
      TaskScheduleTypeEnum.Unscheduled,
      TaskCompletionStatusEnum.INCOMPLETE,
      spaceId,
    ]);

    const countOnceTasks = await this._countActiveTasksByCondition(sql, [
      TaskScheduleTypeEnum.Once,
      TaskCompletionStatusEnum.INCOMPLETE,
      spaceId,
    ]);
    return {
      [TaskScheduleTypeEnum.Unscheduled]: countUnscheduledTasks,
      [TaskScheduleTypeEnum.Once]: countOnceTasks,
    };
  }

  async bulkFailTasks(taskIds: string[]): Promise<QueryResult> {
    if (taskIds.length === 0) {
      console.log('[DB Repo] bulkFailTasks called with no task IDs. Skipping.');
      return { rowsAffected: 0, insertId: undefined, rows: undefined };
    }

    const now = new Date().toISOString();
    const placeholders = taskIds.map(() => '?').join(', ');
    const sql = `
      UPDATE tasks
      SET
        completion_status = ?,
        modified_at = ?
      WHERE id IN (${placeholders});
    `;

    const params = [TaskCompletionStatusEnum.FAILED, now, ...taskIds];

    console.log('[DB Repo] Attempting to bulk fail tasks:', { sql, params });

    try {
      const result = await this.db.executeAsync(sql, params);
      console.log('[DB Repo] Bulk fail tasks successful:', result);
      return result;
    } catch (error: any) {
      console.error('[DB Repo] Failed to bulk fail tasks:', error);
      throw new Error(
        `Failed to bulk fail tasks: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async failAllOverdueTasksAtOnce(): Promise<QueryResult> {
    const now = new Date().toISOString();
    const todayStart = dayjs().startOf('day').toISOString();

    const sql = `
      UPDATE tasks
      SET
        completion_status = ?,
        modified_at = ?
        WHERE due_date < ? AND completion_status = ? AND is_active = ?;
    `;

    const params = [
      TaskCompletionStatusEnum.FAILED,
      now,
      todayStart,
      TaskCompletionStatusEnum.INCOMPLETE,
      1,
    ];

    console.log('[DB Repo] Attempting to fail all overdue tasks at once:', {
      sql,
      params,
    });

    try {
      const result = await this.db.executeAsync(sql, params);
      console.log(
        '[DB Repo] Failed all overdue tasks at once successful:',
        result,
      );
      return result;
    } catch (error: any) {
      console.error(
        '[DB Repo] Failed to fail all overdue tasks at once:',
        error,
      );
      throw new Error(
        `Failed to fail all overdue tasks at once: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async getAllActiveUnscheduledTasks(): Promise<Task[]> {
    return this._getActiveTasksByCondition(
      'schedule = ? AND completion_status = ?',
      [TaskScheduleTypeEnum.Unscheduled, TaskCompletionStatusEnum.INCOMPLETE],
    );
  }

  async getAllActiveOnceTasks(): Promise<Task[]> {
    return this._getActiveTasksByCondition(
      'schedule = ? AND completion_status = ?',
      [TaskScheduleTypeEnum.Once, TaskCompletionStatusEnum.INCOMPLETE],
    );
  }

  async getActiveUnscheduledTasksBySpace(spaceId: string): Promise<Task[]> {
    return this._getActiveTasksByCondition(
      'schedule = ? AND completion_status = ? AND space_id = ?',
      [
        TaskScheduleTypeEnum.Unscheduled,
        TaskCompletionStatusEnum.INCOMPLETE,
        spaceId,
      ],
    );
  }

  async getActiveOnceTasksBySpace(spaceId: string): Promise<Task[]> {
    return this._getActiveTasksByCondition(
      'schedule = ? AND completion_status = ? AND space_id = ?',
      [TaskScheduleTypeEnum.Once, TaskCompletionStatusEnum.INCOMPLETE, spaceId],
    );
  }

  async getAllActiveTasks(): Promise<Task[]> {
    return this._getActiveTasksByCondition(); // no condition
  }

  async getActiveTasksByRepetitiveTaskTemplateId(
    templateId: string,
    days: number = 91,
  ): Promise<Task[]> {
    const startDate = dayjs()
      .subtract(days - 1, 'day')
      .startOf('day')
      .toISOString();
    console.log(
      `[DB Repo] Fetching tasks for templateId: ${templateId} from date: ${startDate} (last ${days} days)`,
    );
    return this._getActiveTasksByCondition(
      'repetitive_task_template_id = ? AND due_date >= ?',
      [templateId, startDate],
    );
  }

  private async _getActiveTasksByCondition(
    additionalConditionSql = '',
    additionalConditionParams: any[] = [],
  ): Promise<Task[]> {
    const baseWhereClauses = ['is_active = ?'];
    const baseParams: any[] = [1];

    const allWhereClauses = [...baseWhereClauses];
    const allParams = [...baseParams];

    if (additionalConditionSql) {
      allWhereClauses.push(additionalConditionSql);
      allParams.push(...additionalConditionParams);
    }

    const sql = `
      SELECT
        id, title, description, schedule, time_of_day, should_be_scored, score, space_id,
        repetitive_task_template_id, created_at, modified_at, is_active, due_date, completion_status
      FROM tasks
      WHERE ${allWhereClauses.join(' AND ')}
      ORDER BY created_at DESC;
    `;

    console.log('[DB Repo] Attempting to SELECT tasks:', {
      sql,
      params: allParams,
    });

    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, allParams);
      console.log(
        '[DB Repo] SELECT successful, rows found:',
        resultSet.rows?.length,
      );

      const tasks: Task[] = [];

      if (resultSet.rows) {
        for (let i = 0; i < resultSet.rows.length; i++) {
          const task = resultSet.rows.item(i);
          if (task) {
            tasks.push(this._transformRowToTask(task));
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

  async getTasksForDate(date: Date): Promise<Task[]> {
    const dateString = dayjs(date).format('YYYY-MM-DD');
    const sql = `
      SELECT
        id, title, description, schedule, due_date, time_of_day, repetitive_task_template_id,
        should_be_scored, score, created_at, modified_at, is_active, completion_status, space_id
      FROM tasks
      WHERE DATE(due_date, 'localtime') = ?
      ORDER BY
        CASE time_of_day
          WHEN '${TimeOfDay.Morning}' THEN 1
          WHEN '${TimeOfDay.Afternoon}' THEN 2
          WHEN '${TimeOfDay.Evening}' THEN 3
          WHEN '${TimeOfDay.Night}' THEN 4
          ELSE 5 -- For null or other values, they appear last or in their own 'Any Time' group
        END,
        created_at DESC;
    `;
    const params = [dateString];

    console.log(
      `[DB Repo] Attempting to SELECT tasks for date: ${dateString}`,
      {
        sql,
      },
    );
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      console.log(
        `[DB Repo] SELECT tasks for ${dateString} successful, rows found:`,
        resultSet.rows?.length,
      );

      const tasks: Task[] = [];
      if (resultSet.rows) {
        for (let i = 0; i < resultSet.rows.length; i++) {
          const row = resultSet.rows.item(i);
          if (row) {
            tasks.push(this._transformRowToTask(row));
          }
        }
      }
      return tasks;
    } catch (error: any) {
      console.error(
        `[DB Repo] Failed to SELECT tasks for date ${dateString}:`,
        error,
      );
      throw new Error(
        `Failed to retrieve tasks for date ${dateString}: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async updateTaskCompletionStatus(
    taskId: string,
    status: TaskCompletionStatusEnum,
    userId: string | null,
    score?: number | null,
  ): Promise<Task | null> {
    const now = new Date().toISOString();
    let sql = `
      UPDATE tasks
      SET
        completion_status = ?,
        score = ?,
        modified_at = ?
      WHERE id = ?
    `;
    const params: any[] = [
      status,
      score === undefined ? null : score, // Handle undefined score as null
      now,
      taskId,
    ];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    } else {
      sql += ' AND user_id IS NULL';
    }
    sql += ' RETURNING *;';

    console.log(
      '[DB Repo] Attempting to UPDATE task completion_status and score:',
      {
        sql,
        params,
      },
    );

    try {
      const resultSet = await this.db.executeAsync(sql, params);
      if (resultSet.rows && resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        if (row) {
          return this._transformRowToTask(row);
        }
      }
      return null;
    } catch (error: any) {
      console.error(
        '[DB Repo] Failed to UPDATE task completion_status:',
        error,
      );
      throw new Error(
        `Failed to update task completion_status and score: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async updateTaskDueDate(
    taskId: string,
    dueDate: Date,
    userId: string | null,
  ): Promise<Task | null> {
    console.log(
      `[DB Repo] Attempting to update due date for task ID: ${taskId} to ${dueDate.toISOString()}`,
    );
    try {
      const now = new Date().toISOString();

      let sql = `
        UPDATE tasks
        SET
          due_date = ?,
          schedule = CASE
                       WHEN schedule = '${TaskScheduleTypeEnum.Unscheduled}' THEN '${TaskScheduleTypeEnum.Once}'
                       ELSE schedule
                     END,
          modified_at = ?
        WHERE id = ?
      `;
      const params: any[] = [dueDate.toISOString(), now, taskId];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      } else {
        sql += ' AND user_id IS NULL';
      }
      sql += ' RETURNING *;';

      console.log('[DB Repo] Attempting to UPDATE task:', {
        sql,
        params,
      });

      const resultSet = await this.db.executeAsync(sql, params);
      if (resultSet.rows && resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        if (row) {
          return this._transformRowToTask(row);
        }
      }
      return null;
    } catch (error: any) {
      console.error('[DB Repo] Failed to UPDATE task:', error);
      throw new Error(
        `Failed to update task: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
