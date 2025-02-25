-- 創建 campuses 表
CREATE TABLE campuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- 創建 digital_meters 表
CREATE TABLE digital_meters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meter_number VARCHAR(50) NOT NULL UNIQUE,
    location VARCHAR(100),
    campus_id INT,
    brand ENUM('1', '2') COMMENT '1: 施耐德, 2: 其他',
    display_unit SET('Wh', 'VAh', 'VARh'),
    last_reading DECIMAL(10, 2),
    last_reading_time DATETIME,
    current_reading DECIMAL(10, 2),
    current_reading_time DATETIME,
    difference DECIMAL(10, 2),
    photo_url VARCHAR(255),
    FOREIGN KEY (campus_id) REFERENCES campuses(id)
);

-- 創建 mechanical_meters 表
CREATE TABLE mechanical_meters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meter_number VARCHAR(50) NOT NULL UNIQUE,
    location VARCHAR(100),
    campus_id INT,
    ct_value ENUM('1', '2') COMMENT '1: 有裝電比值, 2: 沒有',
    wiring_method VARCHAR(100),
    last_reading DECIMAL(10, 2),
    last_reading_time DATETIME,
    current_reading DECIMAL(10, 2),
    current_reading_time DATETIME,
    difference DECIMAL(10, 2),
    photo_url VARCHAR(255),
    FOREIGN KEY (campus_id) REFERENCES campuses(id)
);

-- 創建 digital_meter_readings_history 表
CREATE TABLE digital_meter_readings_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meter_id VARCHAR(50),
    reading_value DECIMAL(10, 2) NOT NULL,
    reading_time DATETIME NOT NULL,
    photo_url VARCHAR(255),
    difference DECIMAL(10, 2),
    brand ENUM('1', '2'),
    display_unit SET('Wh', 'VAh', 'VARh'),
    FOREIGN KEY (meter_id) REFERENCES digital_meters(meter_number)
);

-- 創建 mechanical_meter_readings_history 表
CREATE TABLE mechanical_meter_readings_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meter_id VARCHAR(50),
    reading_value DECIMAL(10, 2) NOT NULL,
    reading_time DATETIME NOT NULL,
    photo_url VARCHAR(255),
    difference DECIMAL(10, 2),
    ct_value ENUM('1', '2'),
    wiring_method VARCHAR(100),
    FOREIGN KEY (meter_id) REFERENCES mechanical_meters(meter_number)
);

-- 創建 users 表
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'data_manager', 'reader') NOT NULL
);