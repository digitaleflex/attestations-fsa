-- Fix HTML-encoded apostrophes in names
-- sanitizeInput was encoding ' to &#x27; before storing in DB
-- This migration restores proper apostrophes

-- Fix User names
UPDATE "User"
SET name = REPLACE(name, '&#x27;', '''')
WHERE name LIKE '%&#x27;%';

-- Fix Attestation fullNames
UPDATE "Attestation"
SET "fullName" = REPLACE("fullName", '&#x27;', '''')
WHERE "fullName" LIKE '%&#x27;%';

-- Fix Admin names (if any)
UPDATE "Admin"
SET name = REPLACE(name, '&#x27;', '''')
WHERE name LIKE '%&#x27;%';

-- Fix InternshipRequest fullNames (if any)
UPDATE "InternshipRequest"
SET "fullName" = REPLACE("fullName", '&#x27;', '''')
WHERE "fullName" LIKE '%&#x27;%';
