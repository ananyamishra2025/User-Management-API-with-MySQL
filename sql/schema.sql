-- Database Schema for User Management API (MySQL)

CREATE DATABASE IF NOT EXISTS `user_management_db`
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE `user_management_db`;

-- Drop table if exists during hard reset
-- DROP TABLE IF EXISTS `users`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('Admin', 'User', 'Cyber-Unit', 'Android', 'Humanoid-Core') NOT NULL DEFAULT 'User',
  `status` ENUM('Active', 'Inactive', 'Synchronized', 'Quarantined') NOT NULL DEFAULT 'Active',
  `biometric_id` VARCHAR(100) UNIQUE,
  `avatar_url` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`),
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial Seed Data
INSERT INTO `users` (`username`, `email`, `full_name`, `role`, `status`, `biometric_id`) VALUES
('nexus_prime', 'nexus.prime@cyber.io', 'Nexus Prime Unit 01', 'Humanoid-Core', 'Synchronized', 'BIO-9901-NX'),
('cyber_sentry', 'sentry.v2@cyber.io', 'Aria Vance', 'Cyber-Unit', 'Active', 'BIO-4412-AV'),
('synth_admin', 'admin.sys@cyber.io', 'Kaelen Thorne', 'Admin', 'Active', 'BIO-1002-KT'),
('droid_vector', 'vector.droid@cyber.io', 'Vector-7 Droid', 'Android', 'Active', 'BIO-8821-VD'),
('user_solaris', 'solaris@cyber.io', 'Elena Rostova', 'User', 'Inactive', 'BIO-3309-ER')
ON DUPLICATE KEY UPDATE `updated_at` = CURRENT_TIMESTAMP;
