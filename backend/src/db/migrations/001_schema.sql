CREATE TABLE users (
  id VARCHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL,
  code VARCHAR(50) NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  photo_url VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'activo',
  can_view_students TINYINT(1) NOT NULL DEFAULT 0,
  can_manage_news TINYINT(1) NOT NULL DEFAULT 0,
  can_manage_attendance TINYINT(1) NOT NULL DEFAULT 0,
  can_manage_schedules TINYINT(1) NOT NULL DEFAULT 0,
  can_administer_users TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grades (
  id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  level VARCHAR(100) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'activo',
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_grades_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE schedules (
  id VARCHAR(36) NOT NULL,
  day VARCHAR(20) NOT NULL,
  start_time VARCHAR(10) NULL,
  end_time VARCHAR(10) NULL,
  classroom VARCHAR(100) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'activo',
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
  code VARCHAR(50) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  grade_id INT NOT NULL,
  group_name VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  photo_url VARCHAR(500) NULL,
  source_status VARCHAR(50) NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (code),
  KEY idx_students_grade (grade_id),
  CONSTRAINT fk_students_grade FOREIGN KEY (grade_id) REFERENCES grades (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE enrollments (
  id VARCHAR(100) NOT NULL,
  student_code VARCHAR(50) NOT NULL,
  discipline_code VARCHAR(100) NOT NULL,
  day VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'activo',
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_enrollments_student_discipline_day (student_code, discipline_code, day),
  CONSTRAINT fk_enrollments_student FOREIGN KEY (student_code) REFERENCES students (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE assignments (
  id VARCHAR(36) NOT NULL,
  teacher_id VARCHAR(36) NOT NULL,
  teacher_email VARCHAR(255) NULL,
  discipline_code VARCHAR(100) NOT NULL,
  grade_id INT NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'activo',
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_assignments_teacher (teacher_id),
  KEY idx_assignments_grade (grade_id),
  CONSTRAINT fk_assignments_teacher FOREIGN KEY (teacher_id) REFERENCES users (id),
  CONSTRAINT fk_assignments_grade FOREIGN KEY (grade_id) REFERENCES grades (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE assignment_schedules (
  assignment_id VARCHAR(36) NOT NULL,
  schedule_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (assignment_id, schedule_id),
  KEY idx_assignment_schedules_schedule (schedule_id),
  CONSTRAINT fk_as_schedule_assignment FOREIGN KEY (assignment_id) REFERENCES assignments (id) ON DELETE CASCADE,
  CONSTRAINT fk_as_schedule_schedule FOREIGN KEY (schedule_id) REFERENCES schedules (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance (
  id VARCHAR(100) NOT NULL,
  session_id VARCHAR(250) NOT NULL,
  student_code VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  registered_at DATETIME NULL,
  registered_by_type VARCHAR(20) NULL,
  registered_by_id VARCHAR(36) NULL,
  observation TEXT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_attendance_session_student (session_id, student_code),
  KEY idx_attendance_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stays (
  id VARCHAR(36) NOT NULL,
  assignment_id VARCHAR(36) NOT NULL,
  schedule_id VARCHAR(36) NOT NULL,
  student_code VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  supervisor_id VARCHAR(36) NULL,
  created_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_stays_assignment_schedule_student_date (assignment_id, schedule_id, student_code, date),
  KEY idx_stays_assignment (assignment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reports (
  id VARCHAR(36) NOT NULL,
  categoria VARCHAR(20) NOT NULL,
  descripcion TEXT NOT NULL,
  pagina VARCHAR(200) NULL,
  usuario_id VARCHAR(36) NULL,
  tipo_usuario VARCHAR(20) NULL,
  correo VARCHAR(255) NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'nuevo',
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NULL,
  user_type VARCHAR(20) NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NULL,
  details TEXT NULL,
  created_at DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sync_state (
  sync_id VARCHAR(50) NOT NULL,
  proceso VARCHAR(100) NULL,
  page_token VARCHAR(255) NULL,
  channel_id VARCHAR(255) NULL,
  resource_id VARCHAR(255) NULL,
  expiration_at VARCHAR(50) NULL,
  last_run_at DATETIME NULL,
  estado VARCHAR(20) NULL,
  detalles TEXT NULL,
  updated_at DATETIME NULL,
  PRIMARY KEY (sync_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE demographics (
  code VARCHAR(50) NOT NULL,
  first_name VARCHAR(255) NOT NULL DEFAULT '',
  middle_name VARCHAR(255) NOT NULL DEFAULT '',
  last_name VARCHAR(255) NOT NULL DEFAULT '',
  full_name VARCHAR(500) NOT NULL DEFAULT '',
  grade VARCHAR(100) NOT NULL DEFAULT '',
  homeroom VARCHAR(100) NULL,
  student_email VARCHAR(255) NULL,
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_routes (
  demographic_code VARCHAR(50) NOT NULL,
  column_key VARCHAR(50) NOT NULL,
  day VARCHAR(20) NOT NULL,
  hour_label VARCHAR(20) NOT NULL,
  sort_key VARCHAR(20) NOT NULL,
  PRIMARY KEY (demographic_code, column_key),
  KEY idx_student_routes_code (demographic_code),
  CONSTRAINT fk_student_routes_demographic FOREIGN KEY (demographic_code) REFERENCES demographics (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;