-- AppSheet genera InscripcionID con formato "<student>|<disciplina>|<dia>"
-- (hasta 43+ chars), que no cabe en VARCHAR(36).
ALTER TABLE enrollments MODIFY COLUMN id VARCHAR(100) NOT NULL;