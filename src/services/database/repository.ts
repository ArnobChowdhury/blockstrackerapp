import { NitroSQLiteConnection, QueryResult } from 'react-native-nitro-sqlite';
import {
  TaskScheduleTypeEnum,
  TimeOfDay,
  DaysInAWeek,
  TaskCompletionStatusEnum,
} from '../../types';
import type { Task, RepetitiveTaskTemplate, Space } from '../../types';

import dayjs, { Dayjs } from 'dayjs';

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
    return this._getActiveTasksByCondition('schedule = ?', [
      TaskScheduleTypeEnum.Unscheduled,
    ]);
  }

  async getAllActiveOnceTasks(): Promise<Task[]> {
    return this._getActiveTasksByCondition('schedule = ?', [
      TaskScheduleTypeEnum.Once,
    ]);
  }

  async getAllActiveTasks(): Promise<Task[]> {
    return this._getActiveTasksByCondition(); // no condition
  }

  private async _getActiveTasksByCondition(
    additionalConditionSql = '',
    additionalConditionParams: any[] = [],
  ): Promise<Task[]> {
    const baseWhereClauses = ['is_active = ?', 'completion_status = ?'];
    const baseParams: any[] = [1, TaskCompletionStatusEnum.INCOMPLETE];

    const allWhereClauses = [...baseWhereClauses];
    const allParams = [...baseParams];

    if (additionalConditionSql) {
      allWhereClauses.push(additionalConditionSql);
      allParams.push(...additionalConditionParams);
    }

    const sql = `
      SELECT
        id, title, description, schedule, time_of_day, should_be_scored,
        created_at, modified_at, is_active, due_date, completion_status
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
            const transformedTask: Task = {
              id: task.id as number,
              title: task.title as string,
              isActive: (task.is_active === 1) as boolean,
              description: task.description as string | null,
              schedule: task.schedule as TaskScheduleTypeEnum,
              dueDate: task.due_date as string | null,
              timeOfDay: task.time_of_day as TimeOfDay | null,
              completionStatus:
                task.completion_status as TaskCompletionStatusEnum,
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

  // todo logic need to be re-checked. Especially, we need completion_status of the task.
  async getTasksForToday(): Promise<Task[]> {
    const sql = `
      SELECT
        id, title, description, schedule, due_date, time_of_day,
        should_be_scored, created_at, modified_at, is_active, completion_status
      FROM tasks
      WHERE DATE(due_date) = DATE('now', 'localtime')
        AND completion_status IN ('${TaskCompletionStatusEnum.INCOMPLETE}', '${TaskCompletionStatusEnum.COMPLETE}')
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

    console.log('[DB Repo] Attempting to SELECT tasks for today:', { sql });
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql); // No params for this query
      console.log(
        '[DB Repo] SELECT tasks for today successful, rows found:',
        resultSet.rows?.length,
      );

      const tasks: Task[] = [];
      if (resultSet.rows) {
        for (let i = 0; i < resultSet.rows.length; i++) {
          const row = resultSet.rows.item(i);
          if (row) {
            tasks.push({
              id: row.id as number,
              title: row.title as string,
              isActive: (row.is_active === 1) as boolean,
              description: row.description as string | null,
              schedule: row.schedule as TaskScheduleTypeEnum,
              dueDate: row.due_date as string | null,
              timeOfDay: row.time_of_day as TimeOfDay | null,
              shouldBeScored: (row.should_be_scored === 1) as boolean,
              completionStatus:
                row.completion_status as TaskCompletionStatusEnum,
              createdAt: row.created_at as string,
              modifiedAt: row.modified_at as string,
            });
          }
        }
      }
      return tasks;
    } catch (error: any) {
      console.error('[DB Repo] Failed to SELECT tasks for today:', error);
      throw new Error(
        `Failed to retrieve tasks for today: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async updateTaskCompletionStatus(
    taskId: number,
    status: TaskCompletionStatusEnum,
    score?: number | null,
  ): Promise<QueryResult> {
    const sql = `
      UPDATE tasks
      SET
        completion_status = ?,
        score = ?,
        modified_at = ?
      WHERE id = ?;
    `;
    const params = [
      status,
      score === undefined ? null : score, // Handle undefined score as null
      new Date().toISOString(),
      taskId,
    ];
    console.log(
      '[DB Repo] Attempting to UPDATE task completion_status and score:',
      {
        sql,
        params,
      },
    );

    try {
      const result = await this.db.executeAsync(sql, params);
      console.log(
        `[DB Repo] Task ${taskId} completion_status updated to ${status} and score to ${
          score === undefined ? null : score
        }. Result:`,
        result,
      );
      return result;
    } catch (error: any) {
      console.error(
        `[DB Repo] Failed to UPDATE task ${taskId} completion_status to ${status} and score to ${
          score === undefined ? null : score
        }:`,
        error,
      );
      throw new Error(
        `Failed to update task completion_status and score: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async updateTaskDueDate(taskId: number, dueDate: Date): Promise<QueryResult> {
    console.log(
      `[DB Repo] Attempting to update due date for task ID: ${taskId} to ${dueDate.toISOString()}`,
    );
    try {
      const getTaskSql = 'SELECT schedule FROM tasks WHERE id = ?;';
      const getTaskParams = [taskId];
      console.log('[DB Repo] Fetching task to check schedule:', {
        sql: getTaskSql,
        params: getTaskParams,
      });

      const taskResult: QueryResult = await this.db.executeAsync(
        getTaskSql,
        getTaskParams,
      );

      if (!taskResult.rows || taskResult.rows.length === 0) {
        throw new Error(`Task with ID ${taskId} not found.`);
      }

      const currentSchedule = taskResult.rows.item(0)
        ?.schedule as TaskScheduleTypeEnum;
      console.log(
        `[DB Repo] Current schedule for task ${taskId}: ${currentSchedule}`,
      );

      const now = new Date().toISOString();

      const scheduleToSet =
        currentSchedule === TaskScheduleTypeEnum.Unscheduled
          ? TaskScheduleTypeEnum.Once
          : currentSchedule;

      const updateSql =
        'UPDATE tasks SET due_date = ?, schedule = ?, modified_at = ? WHERE id = ?;';
      const updateParams = [dueDate.toISOString(), scheduleToSet, now, taskId];

      console.log('[DB Repo] Attempting to UPDATE task:', {
        sql: updateSql,
        params: updateParams,
      });

      const result = await this.db.executeAsync(updateSql, updateParams);
      console.log('[DB Repo] Task UPDATE successful:', result);
      return result;
    } catch (error: any) {
      console.error('[DB Repo] Failed to UPDATE task:', error);
      throw new Error(
        `Failed to update task: ${error.message || 'Unknown error'}`,
      );
    }
  }
}

interface NewRepetitiveTaskTemplateData {
  title: string;
  description?: string;
  schedule: TaskScheduleTypeEnum;
  timeOfDay: TimeOfDay | null;
  days: DaysInAWeek[];
  shouldBeScored: number;
  space: Space | null;
}

export class RepetitiveTaskTemplateRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  async addRepetitiveTaskTemplate(
    repetitiveTaskTemplateData: NewRepetitiveTaskTemplateData,
  ): Promise<QueryResult> {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO repetitive_task_templates (
        title, description, schedule, time_of_day, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        should_be_scored, created_at, modified_at, space_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const params = [
      repetitiveTaskTemplateData.title,
      repetitiveTaskTemplateData.description,
      repetitiveTaskTemplateData.schedule,
      repetitiveTaskTemplateData.timeOfDay,
      repetitiveTaskTemplateData.days.includes(DaysInAWeek.Monday) ? 1 : 0,
      repetitiveTaskTemplateData.days.includes(DaysInAWeek.Tuesday) ? 1 : 0,
      repetitiveTaskTemplateData.days.includes(DaysInAWeek.Wednesday) ? 1 : 0,
      repetitiveTaskTemplateData.days.includes(DaysInAWeek.Thursday) ? 1 : 0,
      repetitiveTaskTemplateData.days.includes(DaysInAWeek.Friday) ? 1 : 0,
      repetitiveTaskTemplateData.days.includes(DaysInAWeek.Saturday) ? 1 : 0,
      repetitiveTaskTemplateData.days.includes(DaysInAWeek.Sunday) ? 1 : 0,
      repetitiveTaskTemplateData.shouldBeScored,
      now,
      now,
      repetitiveTaskTemplateData.space
        ? repetitiveTaskTemplateData.space.id
        : null,
    ];

    console.log('[DB Repo] Attempting to INSERT Repetitive Task Template:', {
      sql,
      params,
    });

    try {
      const result: QueryResult = await this.db.executeAsync(sql, params);
      console.log(
        '[DB Repo] Repetitive Task Template INSERT successful:',
        result,
      );

      return result;
    } catch (error: any) {
      console.error(
        '[DB Repo] Failed to INSERT Repetitive Task Template:',
        error,
      );
      throw new Error(
        `Failed to save the Repetitive Task Template: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  private async _getAllActiveRepetitiveTaskTemplatesBySchedule(
    schedule:
      | TaskScheduleTypeEnum.Daily
      | TaskScheduleTypeEnum.SpecificDaysInAWeek,
  ): Promise<RepetitiveTaskTemplate[]> {
    const sql = `
      SELECT
        id, title, description, schedule, time_of_day, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        created_at, modified_at, is_active, should_be_scored, last_date_of_task_generation, space_id
      FROM repetitive_task_templates
      WHERE schedule = ? AND is_active = 1
      ORDER BY created_at DESC;
    `;
    const params: any[] = [schedule];

    console.log(
      '[DB Repo] Attempting to SELECT all active repetitive task templates:',
      { sql },
    );
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      console.log(
        '[DB Repo] SELECT successful, rows found:',
        resultSet.rows?.length,
      );

      const repetitiveTaskTemplates: RepetitiveTaskTemplate[] = [];

      if (resultSet.rows) {
        for (let i = 0; i < resultSet.rows.length; i++) {
          const repetitiveTaskTemplate = resultSet.rows.item(i);
          if (repetitiveTaskTemplate) {
            const transformedRepetitiveTaskTemplate: RepetitiveTaskTemplate = {
              id: repetitiveTaskTemplate.id as number,
              title: repetitiveTaskTemplate.title as string,
              isActive: (repetitiveTaskTemplate.is_active === 1) as boolean,
              description: repetitiveTaskTemplate.description as string | null,
              schedule: repetitiveTaskTemplate.schedule as TaskScheduleTypeEnum,
              priority: repetitiveTaskTemplate.priority as number,
              shouldBeScored: (repetitiveTaskTemplate.should_be_scored ===
                1) as boolean,
              monday: (repetitiveTaskTemplate.monday === 1) as boolean | null,
              tuesday: (repetitiveTaskTemplate.tuesday === 1) as boolean | null,
              wednesday: (repetitiveTaskTemplate.wednesday === 1) as
                | boolean
                | null,
              thursday: (repetitiveTaskTemplate.thursday === 1) as
                | boolean
                | null,
              friday: (repetitiveTaskTemplate.friday === 1) as boolean | null,
              saturday: (repetitiveTaskTemplate.saturday === 1) as
                | boolean
                | null,
              sunday: (repetitiveTaskTemplate.sunday === 1) as boolean | null,
              timeOfDay: repetitiveTaskTemplate.time_of_day as TimeOfDay | null,
              lastDateOfTaskGeneration:
                repetitiveTaskTemplate.last_date_of_task_generation as
                  | string
                  | null,
              createdAt: repetitiveTaskTemplate.created_at as string,
              modifiedAt: repetitiveTaskTemplate.modified_at as string,
              spaceId: repetitiveTaskTemplate.space_id as number | null,
            };

            repetitiveTaskTemplates.push(transformedRepetitiveTaskTemplate);
          }
        }
      }

      return repetitiveTaskTemplates;
    } catch (error: any) {
      console.error(
        '[DB Repo] Failed to SELECT all active repetitive task templates:',
        error,
      );
      throw new Error(
        `Failed to get all active repetitive task templates: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async getAllActiveDailyRepetitiveTaskTemplates(): Promise<
    RepetitiveTaskTemplate[]
  > {
    return this._getAllActiveRepetitiveTaskTemplatesBySchedule(
      TaskScheduleTypeEnum.Daily,
    );
  }

  async getAllActiveSpecificDaysInAWeekRepetitiveTaskTemplates(): Promise<
    RepetitiveTaskTemplate[]
  > {
    return this._getAllActiveRepetitiveTaskTemplatesBySchedule(
      TaskScheduleTypeEnum.SpecificDaysInAWeek,
    );
  }

  async updateLastDateOfTaskGeneration(
    templateId: number,
    lastDate: string,
  ): Promise<QueryResult> {
    const sql =
      'UPDATE repetitive_task_templates SET last_date_of_task_generation = ?, modified_at = ? WHERE id = ?;';
    const params = [lastDate, new Date().toISOString(), templateId];
    console.log(
      '[DB Repo] Attempting to UPDATE repetitive_task_template last_date_of_task_generation:',
      { sql, params },
    );

    try {
      const result = await this.db.executeAsync(sql, params);
      console.log(
        '[DB Repo] RepetitiveTaskTemplate last_date_of_task_generation UPDATE successful:',
        result,
      );
      return result;
    } catch (error: any) {
      console.error(
        '[DB Repo] Failed to UPDATE repetitive_task_template last_date_of_task_generation:',
        error,
      );
      throw new Error(
        `Failed to update repetitive_task_template last_date_of_task_generation: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async generateDueRepetitiveTasks(
    taskRepository: TaskRepository,
  ): Promise<void> {
    const todayStart = dayjs().startOf('day');
    const todayStartAsString = todayStart.toISOString();

    const fetchTemplatesSql = `
      SELECT
        id, title, description, schedule, time_of_day, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        created_at, modified_at, is_active, should_be_scored, last_date_of_task_generation, space_id
      FROM repetitive_task_templates
      WHERE is_active = 1 AND (
        (DATE(last_date_of_task_generation, 'localtime') < DATE('now', 'localtime')) OR
        last_date_of_task_generation IS NULL
      )
    `;

    console.log(
      '[DB Repo] Attempting to SELECT due repetitive task templates:',
      { sql: fetchTemplatesSql },
    );
    let dueRepetitiveTaskTemplates: RepetitiveTaskTemplate[] = [];
    try {
      const resultSet: QueryResult = await this.db.executeAsync(
        fetchTemplatesSql,
      );
      if (resultSet.rows) {
        for (let i = 0; i < resultSet.rows.length; i++) {
          const rtt = resultSet.rows.item(i);
          if (rtt) {
            dueRepetitiveTaskTemplates.push({
              id: rtt.id as number,
              title: rtt.title as string,
              isActive: (rtt.is_active === 1) as boolean,
              description: rtt.description as string | null,
              schedule: rtt.schedule as TaskScheduleTypeEnum,
              priority: rtt.priority as number,
              shouldBeScored: (rtt.should_be_scored === 1) as boolean,
              monday: (rtt.monday === 1) as boolean | null,
              tuesday: (rtt.tuesday === 1) as boolean | null,
              wednesday: (rtt.wednesday === 1) as boolean | null,
              thursday: (rtt.thursday === 1) as boolean | null,
              friday: (rtt.friday === 1) as boolean | null,
              saturday: (rtt.saturday === 1) as boolean | null,
              sunday: (rtt.sunday === 1) as boolean | null,
              timeOfDay: rtt.time_of_day as TimeOfDay | null,
              lastDateOfTaskGeneration: rtt.last_date_of_task_generation as
                | string
                | null,
              createdAt: rtt.created_at as string,
              modifiedAt: rtt.modified_at as string,
              spaceId: rtt.space_id as number | null,
            });
          }
        }
      }
    } catch (error: any) {
      console.error(
        '[DB Repo] Failed to SELECT due repetitive task templates:',
        error,
      );
      throw new Error(
        `Failed to retrieve due repetitive task templates: ${
          error.message || 'Unknown error'
        }`,
      );
    }

    for (const template of dueRepetitiveTaskTemplates) {
      let lastGenDateOrCreatedAt: Dayjs | string =
        template.lastDateOfTaskGeneration || template.createdAt;

      if (!template.lastDateOfTaskGeneration) {
        const templateCreationDate = dayjs(template.createdAt)
          .startOf('day')
          .toISOString();
        if (templateCreationDate === todayStartAsString) {
          lastGenDateOrCreatedAt = todayStart.subtract(1, 'day');
        }
      }

      const daysToGenerate = todayStart.diff(
        dayjs(lastGenDateOrCreatedAt).startOf('day'),
        'day',
      );

      for (let i = 0; i < daysToGenerate; i++) {
        const targetDueDate = dayjs(lastGenDateOrCreatedAt)
          .startOf('day')
          .add(i + 1, 'day');
        const dayOfWeekLowercase = targetDueDate
          .format('dddd')
          .toLowerCase() as keyof RepetitiveTaskTemplate;

        let shouldGenerateTask = false;
        if (template.schedule === TaskScheduleTypeEnum.Daily) {
          shouldGenerateTask = true;
        } else if (
          template.schedule === TaskScheduleTypeEnum.SpecificDaysInAWeek
        ) {
          shouldGenerateTask = !!template[dayOfWeekLowercase];
        }

        if (shouldGenerateTask) {
          const newTaskData: NewTaskData = {
            title: template.title,
            description: template.description || undefined,
            schedule: template.schedule,
            dueDate: targetDueDate.toDate(),
            timeOfDay: template.timeOfDay,
            shouldBeScored: template.shouldBeScored ? 1 : 0,
            space: template.spaceId
              ? ({ id: template.spaceId } as Space)
              : null,
          };

          try {
            await taskRepository.addTask(newTaskData);
            await this.updateLastDateOfTaskGeneration(
              template.id,
              targetDueDate.toISOString(),
            );
          } catch (error) {
            console.error(
              `[DB Repo] Error processing template ${
                template.id
              } for date ${targetDueDate.toISOString()}:`,
              error,
            );
          }
        }
      }
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
