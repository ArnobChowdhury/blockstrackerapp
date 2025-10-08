// Version 1: Initial schema based on Prisma models of the electron app
export const V1_SCHEMA = `
  -- Enable foreign key constraints enforcement
  PRAGMA foreign_keys = ON;


  -- =============================================
  -- Users Table
  -- =============================================
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    deleted_at TEXT -- Nullable for soft deletes
  );


  -- =============================================
  -- Spaces Table (Equivalent to Space model)
  -- =============================================
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    user_id TEXT, -- Optional, for logged-in users
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(name, user_id) -- A user cannot have two spaces with the same name
  );

  -- =============================================
  -- Tags Table (Equivalent to Tag model)
  -- =============================================
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    user_id TEXT, -- Optional, for logged-in users
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(name, user_id) -- A user cannot have two tags with the same name
  );

  -- =============================================
  -- Repetitive Task Templates Table
  -- (Equivalent to RepetitiveTaskTemplate model)
  -- =============================================
  CREATE TABLE IF NOT EXISTS repetitive_task_templates (
    id TEXT PRIMARY KEY,
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
    space_id TEXT, -- Optional
    user_id TEXT, -- Optional, for logged-in users
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  -- Index for foreign key
  CREATE INDEX IF NOT EXISTS idx_rep_task_templates_space_id ON repetitive_task_templates(space_id);

  -- =============================================
  -- Tasks Table (Equivalent to Task model)
  -- =============================================
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
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
    repetitive_task_template_id TEXT, -- Foreign key column (optional)
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    space_id TEXT, -- Optional
    user_id TEXT, -- Optional, for logged-in users
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL,
    FOREIGN KEY (repetitive_task_template_id) REFERENCES repetitive_task_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
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
    task_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
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
    repetitive_task_template_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (repetitive_task_template_id, tag_id),
    FOREIGN KEY (repetitive_task_template_id) REFERENCES repetitive_task_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );
  -- Indexes for join table foreign keys
  CREATE INDEX IF NOT EXISTS idx_rep_task_templates_tags_template_id ON repetitive_task_templates_tags(repetitive_task_template_id);
  CREATE INDEX IF NOT EXISTS idx_rep_task_templates_tags_tag_id ON repetitive_task_templates_tags(tag_id);

  -- =============================================
  -- Outbox Table for Syncing Operations
  -- =============================================
  CREATE TABLE IF NOT EXISTS pending_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,        -- The user this operation belongs to
    operation_type TEXT NOT NULL, -- 'create', 'update', 'delete'
    entity_type TEXT NOT NULL,    -- 'task', 'space', 'tag', 'repetitive_task_template'
    entity_id TEXT NOT NULL,      -- The UUID of the entity that was changed
    payload TEXT NOT NULL,        -- A JSON string of the full object to be sent to the server
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'failed'
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  -- Index for fetching pending operations efficiently
  CREATE INDEX IF NOT EXISTS idx_pending_operations_status ON pending_operations(status);
  CREATE INDEX IF NOT EXISTS idx_pending_operations_user_id ON pending_operations(user_id);

  -- =============================================
  -- Settings Table for app metadata
  -- =============================================
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  -- Set initial schema version
  PRAGMA user_version = 1;
`;
