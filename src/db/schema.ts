// Version 1: Initial schema based on Prisma models of the electron app
export const V1_SCHEMA = `
  -- Enable foreign key constraints enforcement
  PRAGMA foreign_keys = ON;


  -- =============================================
  -- Spaces Table (Equivalent to Space model)
  -- =============================================
  CREATE TABLE IF NOT EXISTS spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL
  );

  -- =============================================
  -- Tags Table (Equivalent to Tag model)
  -- =============================================
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- Assuming tag names should be unique
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL
  );

  -- =============================================
  -- Repetitive Task Templates Table
  -- (Equivalent to RepetitiveTaskTemplate model)
  -- =============================================
  CREATE TABLE IF NOT EXISTS repetitive_task_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_active INTEGER NOT NULL DEFAULT 1, -- Boolean: 1 for true, 0 for false
    title TEXT NOT NULL,
    description TEXT, -- Optional
    schedule TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 3,
    should_be_scored INTEGER DEFAULT 0, -- Optional Boolean: 1 for true, 0 for false, NULL if not set
    monday INTEGER DEFAULT 0,    -- Optional Boolean
    tuesday INTEGER DEFAULT 0,   -- Optional Boolean
    wednesday INTEGER DEFAULT 0, -- Optional Boolean
    thursday INTEGER DEFAULT 0,  -- Optional Boolean
    friday INTEGER DEFAULT 0,    -- Optional Boolean
    saturday INTEGER DEFAULT 0,  -- Optional Boolean
    sunday INTEGER DEFAULT 0,    -- Optional Boolean
    time_of_day TEXT, -- Optional
    last_date_of_task_generation TEXT, -- Optional DateTime (ISO String)
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    space_id INTEGER, -- Foreign key column (optional)
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL -- Or CASCADE/RESTRICT depending on desired behavior
  );
  -- Index for foreign key
  CREATE INDEX IF NOT EXISTS idx_rep_task_templates_space_id ON repetitive_task_templates(space_id);

  -- =============================================
  -- Tasks Table (Equivalent to Task model)
  -- =============================================
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_active INTEGER NOT NULL DEFAULT 1, -- Boolean
    title TEXT NOT NULL,
    description TEXT, -- Optional
    schedule TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 3,
    completion_status TEXT NOT NULL DEFAULT 'INCOMPLETE',
    due_date TEXT, -- Optional DateTime (ISO String)
    should_be_scored INTEGER, -- Optional Boolean
    score INTEGER, -- Optional
    time_of_day TEXT, -- Optional
    repetitive_task_template_id INTEGER, -- Foreign key column (optional)
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    space_id INTEGER, -- Foreign key column (optional)
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL, -- Or CASCADE/RESTRICT
    FOREIGN KEY (repetitive_task_template_id) REFERENCES repetitive_task_templates(id) ON DELETE CASCADE, -- Matches Prisma schema
    UNIQUE (repetitive_task_template_id, due_date) -- Matches Prisma @@unique
  );
  -- Indexes for foreign keys and potentially filtered columns
  CREATE INDEX IF NOT EXISTS idx_tasks_space_id ON tasks(space_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_rep_template_id ON tasks(repetitive_task_template_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_tasks_completion_status ON tasks(completion_status);

  -- =============================================
  -- Join Table for Tasks and Tags (Many-to-Many)
  -- =============================================
  CREATE TABLE IF NOT EXISTS tasks_tags (
    task_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (task_id, tag_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE, -- If task deleted, remove association
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE   -- If tag deleted, remove association
  );
  -- Indexes for join table foreign keys
  CREATE INDEX IF NOT EXISTS idx_tasks_tags_task_id ON tasks_tags(task_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_tags_tag_id ON tasks_tags(tag_id);


  -- =============================================
  -- Join Table for Repetitive Task Templates and Tags (Many-to-Many)
  -- =============================================
  CREATE TABLE IF NOT EXISTS repetitive_task_templates_tags (
    repetitive_task_template_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (repetitive_task_template_id, tag_id),
    FOREIGN KEY (repetitive_task_template_id) REFERENCES repetitive_task_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );
  -- Indexes for join table foreign keys
  CREATE INDEX IF NOT EXISTS idx_rep_task_templates_tags_template_id ON repetitive_task_templates_tags(repetitive_task_template_id);
  CREATE INDEX IF NOT EXISTS idx_rep_task_templates_tags_tag_id ON repetitive_task_templates_tags(tag_id);

  -- Set initial schema version
  PRAGMA user_version = 1;
`;
