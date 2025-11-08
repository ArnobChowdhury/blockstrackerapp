import { NitroSQLiteConnection, QueryResult } from 'react-native-nitro-sqlite';
import uuid from 'react-native-uuid';
import {
  TaskScheduleTypeEnum,
  TimeOfDay,
  DaysInAWeek,
  RepetitiveTaskTemplate,
  NewRepetitiveTaskTemplateData,
} from '../../types';

export class RepetitiveTaskTemplateRepository {
  private db: NitroSQLiteConnection;

  constructor(database: NitroSQLiteConnection) {
    this.db = database;
  }

  async createRepetitiveTaskTemplate(
    repetitiveTaskTemplateData: NewRepetitiveTaskTemplateData,
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate> {
    const newId = uuid.v4() as string;
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO repetitive_task_templates (
        id, title, description, schedule, time_of_day, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        should_be_scored, created_at, modified_at, space_id, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;
    `;

    const params = [
      newId,
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
      repetitiveTaskTemplateData.spaceId,
      userId,
    ];

    console.log('[DB Repo] Attempting to INSERT Repetitive Task Template:', {
      sql,
      params,
    });

    try {
      const resultSet = await this.db.executeAsync(sql, params);
      console.log(
        '[DB Repo] Repetitive Task Template INSERT successful for id:',
        newId,
      );
      if (resultSet.rows && resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        return this._transformRowToTemplate(row);
      }
      throw new Error(
        'Failed to create repetitive task template: no rows returned.',
      );
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

  private _transformRowToTemplate(row: any): RepetitiveTaskTemplate {
    return {
      id: row.id as string,
      title: row.title as string,
      isActive: (row.is_active === 1) as boolean,
      description: row.description as string | null,
      schedule: row.schedule as TaskScheduleTypeEnum,
      priority: row.priority as number,
      timeOfDay: row.time_of_day as TimeOfDay | null,
      shouldBeScored: (row.should_be_scored === 1) as boolean,
      lastDateOfTaskGeneration: row.last_date_of_task_generation as
        | string
        | null,
      monday: (row.monday === 1) as boolean | null,
      tuesday: (row.tuesday === 1) as boolean | null,
      wednesday: (row.wednesday === 1) as boolean | null,
      thursday: (row.thursday === 1) as boolean | null,
      friday: (row.friday === 1) as boolean | null,
      saturday: (row.saturday === 1) as boolean | null,
      sunday: (row.sunday === 1) as boolean | null,
      createdAt: row.created_at as string,
      modifiedAt: row.modified_at as string,
      spaceId: row.space_id as string | null,
      userId: row.user_id as string | null,
    };
  }

  async getRepetitiveTaskTemplateById(
    templateId: string,
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate | null> {
    let sql = `
      SELECT
        id, title, description, schedule, time_of_day, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        created_at, modified_at, is_active, should_be_scored, last_date_of_task_generation, space_id, user_id
      FROM repetitive_task_templates
      WHERE id = ?
    `;
    const params: any[] = [templateId];

    if (userId) {
      sql += ' AND user_id = ?;';
      params.push(userId);
    } else {
      sql += ' AND user_id IS NULL;';
    }

    console.log(
      '[DB Repo] Attempting to SELECT repetitive task template by id:',
      {
        sql,
        params,
      },
    );

    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      console.log(
        '[DB Repo] SELECT successful, rows found:',
        resultSet.rows?.length,
      );

      if (resultSet.rows) {
        const row = resultSet.rows.item(0);

        if (row) {
          return this._transformRowToTemplate(row);
        }
      }

      return null;
    } catch (error: any) {
      console.error(
        '[DB Repo] Failed to SELECT repetitive task template by id:',
        error,
      );
      throw new Error(
        `Failed to get the Repetitive Task Template by id: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async updateRepetitiveTaskTemplateById(
    templateId: string,
    repetitiveTaskTemplateData: NewRepetitiveTaskTemplateData,
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate | null> {
    const now = new Date().toISOString();
    let sql = `
      UPDATE repetitive_task_templates
      SET
        title = ?,
        description = ?,
        schedule = ?,
        time_of_day = ?,
        monday = ?,
        tuesday = ?,
        wednesday = ?,
        thursday = ?,
        friday = ?,
        saturday = ?,
        sunday = ?,
        should_be_scored = ?,
        modified_at = ?,
        space_id = ?
      WHERE id = ?
    `;

    const params: any[] = [
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
      repetitiveTaskTemplateData.spaceId,
      templateId,
    ];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    } else {
      sql += ' AND user_id IS NULL';
    }
    sql += ' RETURNING *;';

    console.log(
      '[DB Repo] Attempting to UPDATE repetitive task template by id:',
      {
        sql,
        params,
      },
    );

    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      if (resultSet.rows && resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        return this._transformRowToTemplate(row);
      }
      return null;
    } catch (error: any) {
      console.error(
        '[DB Repo] Failed to UPDATE repetitive task template by id:',
        error,
      );
      throw new Error(
        `Failed to update the Repetitive Task Template by id: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  private async _getAllActiveRepetitiveTaskTemplatesByCondition(
    userId: string | null,
    additionalConditionSql = '',
    additionalConditionParams: any[] = [],
  ): Promise<RepetitiveTaskTemplate[]> {
    const baseWhereClauses = ['is_active = ?'];
    const baseParams: any[] = [1];

    const allWhereClauses = [...baseWhereClauses];
    const allParams = [...baseParams];

    if (additionalConditionSql) {
      allWhereClauses.push(additionalConditionSql);
      allParams.push(...additionalConditionParams);
    }

    if (userId) {
      allWhereClauses.push('user_id = ?');
      allParams.push(userId);
    } else {
      allWhereClauses.push('user_id IS NULL');
    }

    const sql = `
      SELECT
        id, title, description, schedule, time_of_day, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        created_at, modified_at, is_active, should_be_scored, last_date_of_task_generation, space_id, user_id
      FROM repetitive_task_templates
      WHERE ${allWhereClauses.join(' AND ')}
      ORDER BY created_at DESC;
    `;

    console.log(
      '[DB Repo] Attempting to SELECT all active repetitive task templates:',
      { sql, params: allParams },
    );
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, allParams);
      console.log(
        '[DB Repo] SELECT successful, rows found:',
        resultSet.rows?.length,
      );

      const repetitiveTaskTemplates: RepetitiveTaskTemplate[] = [];

      if (resultSet.rows) {
        for (let i = 0; i < resultSet.rows.length; i++) {
          const repetitiveTaskTemplate = resultSet.rows.item(i);
          if (repetitiveTaskTemplate) {
            repetitiveTaskTemplates.push(
              this._transformRowToTemplate(repetitiveTaskTemplate),
            );
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

  async getAllActiveDailyRepetitiveTaskTemplates(
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate[]> {
    return this._getAllActiveRepetitiveTaskTemplatesByCondition(
      userId,
      'schedule = ?',
      [TaskScheduleTypeEnum.Daily],
    );
  }

  async getAllActiveSpecificDaysInAWeekRepetitiveTaskTemplates(
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate[]> {
    return this._getAllActiveRepetitiveTaskTemplatesByCondition(
      userId,
      'schedule = ?',
      [TaskScheduleTypeEnum.SpecificDaysInAWeek],
    );
  }

  async getActiveDailyRepetitiveTaskTemplatesBySpace(
    userId: string | null,
    spaceId: string,
  ): Promise<RepetitiveTaskTemplate[]> {
    return this._getAllActiveRepetitiveTaskTemplatesByCondition(
      userId,
      'schedule = ? AND space_id = ?',
      [TaskScheduleTypeEnum.Daily, spaceId],
    );
  }

  async getActiveSpecificDaysInAWeekRepetitiveTaskTemplatesBySpace(
    userId: string | null,
    spaceId: string,
  ): Promise<RepetitiveTaskTemplate[]> {
    return this._getAllActiveRepetitiveTaskTemplatesByCondition(
      userId,
      'schedule = ? AND space_id = ?',
      [TaskScheduleTypeEnum.SpecificDaysInAWeek, spaceId],
    );
  }

  async _countActiveTasksByCondition(
    userId: string | null,
    conditionSql: string,
    conditionParams: any[],
  ): Promise<number> {
    let sql = `
      SELECT COUNT(*) as count
      FROM repetitive_task_templates
      WHERE ${conditionSql} AND is_active = ?
    `;
    let params = [...conditionParams, 1];

    if (userId) {
      sql += ' AND user_id = ?;';
      params.push(userId);
    } else {
      sql += ' AND user_id IS NULL;';
    }

    console.log('[DB Repo] Attempting to SELECT count of active tasks:', {
      sql,
      params,
    });

    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      console.log(
        '[DB Repo] SELECT count of active tasks successful:',
        resultSet,
      );

      return resultSet.rows?.item(0)?.count as number;
    } catch (error: any) {
      console.error('[DB Repo] Failed to SELECT count of active tasks:', error);
      throw new Error(
        `Failed to get count of active tasks: ${
          error.message || 'Unknown error'
        }`,
      );
    }
  }

  async countAllActiveRepetitiveTasksByCategory(userId: string | null) {
    const whereClause = 'schedule = ?';

    const countOfDailyTasks = await this._countActiveTasksByCondition(
      userId,
      whereClause,
      [TaskScheduleTypeEnum.Daily],
    );
    const countOfSpecificDaysInAWeekTasks =
      await this._countActiveTasksByCondition(userId, whereClause, [
        TaskScheduleTypeEnum.SpecificDaysInAWeek,
      ]);

    return {
      [TaskScheduleTypeEnum.SpecificDaysInAWeek]:
        countOfSpecificDaysInAWeekTasks,
      [TaskScheduleTypeEnum.Daily]: countOfDailyTasks,
    };
  }

  async countActiveRepetitiveTasksBySpaceId(
    spaceId: string,
    userId: string | null,
  ) {
    const whereClause = 'schedule = ? AND space_id = ?';

    const countOfDailyTasks = await this._countActiveTasksByCondition(
      userId,
      whereClause,
      [TaskScheduleTypeEnum.Daily, spaceId],
    );

    const countOfSpecificDaysInAWeekTasks =
      await this._countActiveTasksByCondition(userId, whereClause, [
        TaskScheduleTypeEnum.SpecificDaysInAWeek,
        spaceId,
      ]);

    return {
      [TaskScheduleTypeEnum.SpecificDaysInAWeek]:
        countOfSpecificDaysInAWeekTasks,
      [TaskScheduleTypeEnum.Daily]: countOfDailyTasks,
    };
  }

  async updateLastDateOfTaskGeneration(
    templateId: string,
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

  async getDueRepetitiveTaskTemplates(
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate[]> {
    let sql = `
      SELECT
        id, title, description, schedule, time_of_day, monday, tuesday, wednesday, thursday, friday, saturday, sunday, priority,
        created_at, modified_at, is_active, should_be_scored, last_date_of_task_generation, space_id, user_id
      FROM repetitive_task_templates
      WHERE is_active = 1 AND (
        (DATE(last_date_of_task_generation, 'localtime') < DATE('now', 'localtime')) OR 
        last_date_of_task_generation IS NULL
      )
    `;
    const params: any[] = [];

    if (userId) {
      sql += ' AND user_id = ?;';
      params.push(userId);
    } else {
      sql += ' AND user_id IS NULL;';
    }

    console.log(
      '[DB Repo] Attempting to SELECT due repetitive task templates:',
      { sql, params },
    );
    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);
      const dueTemplates: RepetitiveTaskTemplate[] = [];
      if (resultSet.rows) {
        for (let i = 0; i < resultSet.rows.length; i++) {
          const rtt = resultSet.rows.item(i);
          if (rtt) {
            dueTemplates.push(this._transformRowToTemplate(rtt));
          }
        }
      }
      return dueTemplates;
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
  }

  async stopRepetitiveTask(
    repetitiveTaskId: string,
    userId: string | null,
  ): Promise<RepetitiveTaskTemplate | null> {
    const now = new Date().toISOString();
    let sql = `
      UPDATE repetitive_task_templates
      SET is_active = 0, modified_at = ?
      WHERE id = ?
    `;
    const params = [now, repetitiveTaskId];

    if (userId) {
      sql += ' AND user_id = ? ';
      params.push(userId);
    } else {
      sql += ' AND user_id IS NULL ';
    }
    sql += 'RETURNING *;';

    console.log('[DB Repo] Attempting to stop repetitive task:', {
      sql,
      params,
    });

    try {
      const resultSet: QueryResult = await this.db.executeAsync(sql, params);

      if (resultSet.rows && resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        return this._transformRowToTemplate(row);
      }

      return null;
    } catch (error: any) {
      console.error('[DB Repo] Failed to stop repetitive task:', error);
      throw new Error(
        `Failed to stop repetitive task: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async upsertMany(templates: RepetitiveTaskTemplate[]): Promise<void> {
    if (templates.length === 0) {
      return;
    }

    console.log(
      `[DB Repo] UPSERTING ${templates.length} repetitive task templates within a transaction.`,
    );

    const sql = `
      INSERT INTO repetitive_task_templates (
        id, title, description, schedule, time_of_day, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        should_be_scored, is_active, priority, last_date_of_task_generation,
        created_at, modified_at, space_id, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        schedule = excluded.schedule,
        time_of_day = excluded.time_of_day,
        monday = excluded.monday,
        tuesday = excluded.tuesday,
        wednesday = excluded.wednesday,
        thursday = excluded.thursday,
        friday = excluded.friday,
        saturday = excluded.saturday,
        sunday = excluded.sunday,
        should_be_scored = excluded.should_be_scored,
        is_active = excluded.is_active,
        priority = excluded.priority,
        last_date_of_task_generation = excluded.last_date_of_task_generation,
        modified_at = excluded.modified_at,
        space_id = excluded.space_id
      WHERE excluded.modified_at > repetitive_task_templates.modified_at;
    `;

    for (const template of templates) {
      const params = [
        template.id,
        template.title,
        template.description,
        template.schedule,
        template.timeOfDay,
        template.monday ? 1 : 0,
        template.tuesday ? 1 : 0,
        template.wednesday ? 1 : 0,
        template.thursday ? 1 : 0,
        template.friday ? 1 : 0,
        template.saturday ? 1 : 0,
        template.sunday ? 1 : 0,
        template.shouldBeScored ? 1 : 0,
        template.isActive ? 1 : 0,
        template.priority,
        template.lastDateOfTaskGeneration,
        template.createdAt,
        template.modifiedAt,
        template.spaceId,
        template.userId,
      ];
      await this.db.executeAsync(sql, params);
    }
  }
}
