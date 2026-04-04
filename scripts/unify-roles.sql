-- Convert all roles to lowercase to match Better Auth requirements
-- This ensures consistency across the DB and application code

-- Update User roles
UPDATE "User" SET role = LOWER(role);

-- Update Admin roles (legacy table)
UPDATE "Admin" SET role = LOWER(role);

-- Update ChatMessage senderRoles
-- Using @ts-ignore in code, but the table is likely "ChatMessage"
UPDATE "ChatMessage" SET "senderRole" = LOWER("senderRole");
