-- Drop existing table to recreate with all types
DROP TABLE IF EXISTS json_logic_test CASCADE;

-- Test table with ALL supported field types
CREATE TABLE json_logic_test (
  -- UUID
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- String types
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  description TEXT,
  code CHAR(10),
  
  -- Integer types
  age INTEGER,
  rating SMALLINT,
  views BIGINT,
  
  -- Decimal types
  score DECIMAL(10,2),
  price NUMERIC(12,4),
  percentage REAL,
  average DOUBLE PRECISION,
  
  -- Boolean
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN,
  
  -- Date/Time types
  birth_date DATE,
  start_time TIME,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  duration INTERVAL,
  
  -- Array types - VARCHAR
  tags VARCHAR(50)[],
  categories TEXT[],
  
  -- Array types - Numeric
  scores INTEGER[],
  ratings SMALLINT[],
  amounts DECIMAL(10,2)[],
  
  -- JSONB
  metadata JSONB,
  settings JSONB,
  profile JSONB,
  
  -- Computed/Generated (PostgreSQL 12+)
  full_name VARCHAR(200) GENERATED ALWAYS AS (name || ' User') STORED,
  
  -- Enum type (need to create first)
  status VARCHAR(20) DEFAULT 'pending',
  priority VARCHAR(10) DEFAULT 'medium'
);

-- Create index for array operations
CREATE INDEX IF NOT EXISTS idx_tags ON json_logic_test USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_metadata ON json_logic_test USING GIN(metadata);

-- Truncate table to ensure clean state
TRUNCATE TABLE json_logic_test;

-- Insert comprehensive test data
INSERT INTO json_logic_test (
  id, name, email, description, code,
  age, rating, views, score, price, percentage, average,
  is_active, is_verified,
  birth_date, start_time, created_at, updated_at, duration,
  tags, categories, scores, ratings, amounts,
  metadata, settings, profile,
  status, priority
) VALUES 
-- User 1: Active VIP user
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'John Doe', 'john@example.com', 'A premium test user', 'USR001    ',
  30, 5, 1000000, 95.50, 199.9999, 0.95, 4.567890123,
  true, true,
  '1994-05-15', '09:30:00', '2024-01-15 10:30:00', '2024-12-15 22:00:00+07', '1 year 2 months',
  ARRAY['vip', 'premium', 'active', 'verified'],
  ARRAY['tech', 'gaming'],
  ARRAY[100, 95, 88, 92],
  ARRAY[5, 5, 4, 5]::SMALLINT[],
  ARRAY[199.99, 299.99, 399.99]::DECIMAL(10,2)[],
  '{"level": 10, "rank": "gold", "achievements": ["first_login", "top_player"]}',
  '{"theme": "dark", "notifications": {"email": true, "push": true}}',
  '{"bio": "Developer", "social": {"twitter": "@john"}}',
  'active', 'high'
),
-- User 2: Standard user
(
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'Jane Smith', 'jane@example.com', 'Another test user', 'USR002    ',
  25, 4, 500000, 88.00, 99.5000, 0.75, 3.456789012,
  true, false,
  '1999-08-20', '14:00:00', '2024-02-20 14:00:00', '2024-12-14 18:30:00+07', '6 months',
  ARRAY['standard', 'active', 'new'],
  ARRAY['lifestyle', 'travel'],
  ARRAY[75, 80, 85, 78],
  ARRAY[4, 4, 3, 4]::SMALLINT[],
  ARRAY[49.99, 59.99]::DECIMAL(10,2)[],
  '{"level": 5, "rank": "silver", "achievements": ["first_login"]}',
  '{"theme": "light", "notifications": {"email": true, "push": false}}',
  '{"bio": "Designer", "social": {"instagram": "@jane"}}',
  'active', 'medium'
),
-- User 3: Inactive user
(
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'Bob Wilson', 'bob@example.com', 'Inactive old user', 'USR003    ',
  45, 3, 100000, 72.30, 29.9900, 0.50, 2.345678901,
  false, true,
  '1979-12-01', '18:30:00', '2023-06-10 08:00:00', NULL, '2 years 3 months',
  ARRAY['standard', 'inactive', 'legacy'],
  ARRAY['business'],
  ARRAY[50, 60, 70, 55],
  ARRAY[3, 3, 2, 3]::SMALLINT[],
  ARRAY[19.99]::DECIMAL(10,2)[],
  '{"level": 3, "rank": "bronze", "achievements": []}',
  '{"theme": "dark", "notifications": {"email": false, "push": false}}',
  '{"bio": "Manager", "social": {}}',
  'inactive', 'low'
),
-- User 4: VIP with NULL email
(
  'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  'Alice Brown', NULL, 'VIP user without email', 'USR004    ',
  35, 5, 2000000, 100.00, 499.9999, 1.00, 5.000000000,
  true, true,
  '1989-03-10', '06:00:00', '2024-03-01 06:00:00', '2024-12-15 22:50:00+07', '3 years',
  ARRAY['vip', 'gold', 'premium', 'verified', 'top'],
  ARRAY['tech', 'business', 'education'],
  ARRAY[100, 100, 100, 100],
  ARRAY[5, 5, 5, 5]::SMALLINT[],
  ARRAY[999.99, 1499.99, 2999.99]::DECIMAL(10,2)[],
  '{"level": 20, "rank": "platinum", "achievements": ["first_login", "top_player", "whale"]}',
  '{"theme": "auto", "notifications": {"email": true, "push": true, "sms": true}}',
  '{"bio": "CEO", "social": {"linkedin": "/alice", "twitter": "@alice"}}',
  'active', 'critical'
),
-- User 5: New pending user
(
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
  'Charlie Davis', 'charlie@example.com', 'Brand new user', 'USR005    ',
  20, 1, 100, 50.00, 0.0000, 0.10, 1.000000000,
  true, false,
  '2004-07-22', '12:00:00', NOW(), NOW(), '0 days',
  ARRAY['new', 'trial'],
  ARRAY['general']::TEXT[],
  ARRAY[50],
  ARRAY[1]::SMALLINT[],
  ARRAY[9.99]::DECIMAL(10,2)[],
  '{"level": 1, "rank": "none", "achievements": []}',
  '{"theme": "light", "notifications": {"email": true}}',
  '{}',
  'pending', 'low'
);

-- Separate table for JOIN testing
DROP TABLE IF EXISTS posts;
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES json_logic_test(id),
  title VARCHAR(100),
  content TEXT,
  published BOOLEAN DEFAULT false
);

INSERT INTO posts (user_id, title, content, published) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'John First Post', 'Hello world', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'John Second Post', 'Another post', true),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Jane Draft', 'Draft content', false);

