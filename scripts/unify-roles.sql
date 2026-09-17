-- Convert all roles to lowercase to match Better Auth requirements
-- This ensures consistency across the DB and application code

-- Update User roles
UPDATE "User" SET role = LOWER(role);
