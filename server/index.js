require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors({
    origin: 'http://localhost:3000', // 替換為您的前端 URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Liao13572468@',
    database: 'meter_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 測試數據庫連接
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed: ' + err.message);
    } else {
        console.log('Successfully connected to the database.');
        connection.release();
    }
});

// 確保上傳目錄存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

console.log('Upload directory:', uploadDir);

// 文件上傳配置
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("只支持上傳 jpg、jpeg 或 png 格式的圖片"));
    }
}).single('photo');

// 設置靜態文件服務
app.use('/uploads', express.static(uploadDir));

// 身份驗證中間件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// 角色權限中間件
const authorize = (roles = []) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        next();
    };
};

// 用戶登錄
app.post('/login', async (req, res) => {
    console.log('Login attempt:', req.body.username);
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [req.body.username]);
        console.log('Users found:', users.length);
        if (users.length > 0) {
            const user = users[0];
            const isMatch = await bcrypt.compare(req.body.password, user.password);
            console.log('Password match:', isMatch);
            if (isMatch) {
                const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET);
                res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
            } else {
                res.status(400).send('Invalid credentials');
            }
        } else {
            res.status(400).send('User not found');
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send(error.message);
    }
});

// 獲取校區列表
app.get('/campuses', async (req, res) => {
    try {
        const [campuses] = await pool.query('SELECT * FROM campuses');
        console.log('Sending campuses:', campuses);
        res.json(campuses);
    } catch (error) {
        console.error('Error fetching campuses:', error);
        res.status(500).send(error.message);
    }
});

// 获取指定校区的位置种类
app.get('/location-types/:campusId', async (req, res) => {
    try {
        const { campusId } = req.params;
        const [locationTypes] = await pool.query('SELECT * FROM location_types WHERE campus_id = ?', [campusId]);
        res.json(locationTypes);
    } catch (error) {
        console.error('Error fetching location types:', error);
        res.status(500).send(error.message);
    }
});

// 更新獲取電表列表的 API
app.get('/meters/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;

        let meterNumbers = [];
        let locationData;

        if (type === 'location') {
            // 根据 locationTypeId 获取电表编号
            const [locationTypes] = await pool.query('SELECT * FROM location_types WHERE id = ?', [id]);
            if (locationTypes.length === 0) {
                return res.status(404).send('Location type not found');
            }

            locationData = locationTypes[0];
            meterNumbers = locationData.meter_numbers.split(',');
        } else if (type === 'campus') {
            // 根据 campusId 获取所有 locationTypes 的电表编号
            const [locations] = await pool.query('SELECT * FROM location_types WHERE campus_id = ?', [id]);
            if (locations.length === 0) {
                return res.status(404).send('Campus not found');
            }

            locationData = locations;
            meterNumbers = locations.flatMap(location => location.meter_numbers.split(','));
        } else {
            return res.status(400).send('Invalid type');
        }

        // 查询电表信息
        const query = `
            SELECT *, 
            CASE 
                WHEN meter_type = 'digital' THEN '數位式'
                WHEN meter_type = 'mechanical' THEN '機械式'
                ELSE '未設定'
            END as meter_type_display,
            CASE 
                WHEN meter_type = 'digital' THEN
                    CASE 
                        WHEN brand = '1' THEN '施耐德'
                        WHEN brand = '2' THEN '其他'
                        ELSE brand
                    END
                WHEN meter_type = 'mechanical' THEN
                    CASE 
                        WHEN ct_value = '1' THEN '有裝電比值'
                        WHEN ct_value = '2' THEN '沒有'
                        ELSE ct_value
                    END
                ELSE '未設定'
            END as type_specific_info
            FROM meters
            WHERE meter_number IN (?)
        `;

        // 确保 meterNumbers 是一个有效的数组，并去重
        const uniqueMeterNumbers = [...new Set(meterNumbers)];
        const [meters] = await pool.query(query, [uniqueMeterNumbers]);

        // 处理可能的 NULL 值
        const processedMeters = meters.map(meter => ({
            ...meter,
            meter_type_display: meter.meter_type_display || '未設定',
            type_specific_info: meter.type_specific_info || '未設定'
        }));

        res.json({
            locationData,
            meters: processedMeters
        });
    } catch (error) {
        console.error('Error fetching meters:', error);
        res.status(500).send(error.message);
    }
});

// 更新獲取電表列表的 API
/*
app.get('/meters-by-location/:locationTypeId', async (req, res) => {
    try {
        const { locationTypeId } = req.params;
        const [locationType] = await pool.query('SELECT * FROM location_types WHERE id = ?', [locationTypeId]);
        
        if (locationType.length === 0) {
            return res.status(404).send('Location type not found');
        }

        const meterNumbers = locationType[0].meter_numbers.split(',');
        
        const query = `
            SELECT *, 
            CASE 
                WHEN meter_type = 'digital' THEN '數位式'
                WHEN meter_type = 'mechanical' THEN '機械式'
                ELSE '未設定'
            END as meter_type_display,
            CASE 
                WHEN meter_type = 'digital' THEN
                    CASE 
                        WHEN brand = '1' THEN '施耐德'
                        WHEN brand = '2' THEN '其他'
                        ELSE brand
                    END
                WHEN meter_type = 'mechanical' THEN
                    CASE 
                        WHEN ct_value = '1' THEN '有裝電比值'
                        WHEN ct_value = '2' THEN '沒有'
                        ELSE ct_value
                    END
                ELSE '未設定'
            END as type_specific_info
            FROM meters
            WHERE meter_number IN (?)
        `;

        const [meters] = await pool.query(query, [meterNumbers]);
        
        // 處理可能的 NULL 值
        const processedMeters = meters.map(meter => ({
            ...meter,
            meter_type_display: meter.meter_type_display || '未設定',
            type_specific_info: meter.type_specific_info || '未設定'
        }));

        res.json({
            locationType: locationType[0],
            meters: processedMeters
        });
    } catch (error) {
        console.error('Error fetching meters by location type:', error);
        res.status(500).send(error.message);
    }
});
*/

// 獲取電表列表（更新為包含最新讀數信息）
app.get('/meters', async (req, res) => {
    try {
        const [digitalMeters] = await pool.query(`
            SELECT *, 'digital' as meter_type, 
            CASE 
                WHEN brand = '1' THEN '施耐德'
                WHEN brand = '2' THEN '其他'
                ELSE brand
            END as brand_name
            FROM digital_meters
        `);
        const [mechanicalMeters] = await pool.query(`
            SELECT *, 'mechanical' as meter_type,
            CASE 
                WHEN ct_value = '1' THEN '有裝電比值'
                WHEN ct_value = '2' THEN '沒有'
                ELSE ct_value
            END as ct_value_name
            FROM mechanical_meters
        `);
        const allMeters = [...digitalMeters, ...mechanicalMeters];
        res.json(allMeters);
    } catch (error) {
        console.error('Error fetching meters:', error);
        res.status(500).send(error.message);
    }
});

// 獲取特定電表的歷史記錄
app.get('/meter-history/:meterType/:meterId', async (req, res) => {
    try {
        const { meterType, meterId } = req.params;
        let tableName = 'meter_readings_history';
        
        const [history] = await pool.query(
            `SELECT * FROM ${tableName} WHERE meter_id = ? ORDER BY reading_time DESC LIMIT 10`,
            [meterId]
        );
        res.json(history);
    } catch (error) {
        console.error('Error fetching meter history:', error);
        res.status(500).send(error.message);
    }
});

// 更新電表讀數
app.post('/update-meter-reading', function(req, res) {
    upload(req, res, async function (err) {
        if (err) {
            return res.status(500).json({ error: 'File upload error', details: err.message });
        }

        try {
            let { meter_id, reading_value } = req.body;
            let photo_url = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : null;

            // 從 meters 表獲取電表信息
            const [meterInfo] = await pool.query('SELECT * FROM meters WHERE meter_number = ?', [meter_id]);
            if (meterInfo.length === 0) {
                return res.status(404).send('Meter not found');
            }

            const currentMeter = meterInfo[0];
            const lastReadingValue = currentMeter.current_reading || 0;
            const difference = reading_value - lastReadingValue;

            // 使用從數據庫獲取的 meter_type
            const meter_type = currentMeter.meter_type;

            const updateQuery = `
                UPDATE meters SET 
                last_reading = current_reading,
                last_reading_time = current_reading_time,
                current_reading = ?,
                current_reading_time = NOW(),
                photo_url = ?,
                difference = ?
                WHERE meter_number = ?
            `;
            await pool.query(updateQuery, [reading_value, photo_url, difference, meter_id]);

            const historyQuery = `
                INSERT INTO meter_readings_history 
                (meter_id, reading_value, reading_time, photo_url, difference, meter_type) 
                VALUES (?, ?, NOW(), ?, ?, ?)
            `;
            await pool.query(historyQuery, [meter_id, reading_value, photo_url, difference, meter_type]);

            res.status(200).send('Meter reading updated and history saved successfully');
        } catch (error) {
            console.error('Error updating meter reading:', error);
            res.status(500).send(error.message);
        }
    });
});

// 更新歷史電表讀數
app.put('/update-meter-reading/:meterId/:readingId', authenticateToken, authorize(['data_manager', 'reader']), async (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            return res.status(500).json({ error: 'File upload error', details: err.message });
        }

        const { meterId, readingId } = req.params;
        const { new_reading_value, meter_type } = req.body;
        const userRole = req.user.role;
        let photo_url = null;

        if (req.file) {
            photo_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const tableName = 'meters';
            const historyTableName = 'meter_readings_history';

            // 獲取原始讀數
            const [originalReading] = await conn.query(`SELECT * FROM ${historyTableName} WHERE id = ?`, [readingId]);
            if (originalReading.length === 0) {
                throw new Error('原始讀數不存在');
            }

            const newValue = parseFloat(new_reading_value);

            // 查找前一條讀數
            const [previousReading] = await conn.query(
                `SELECT * FROM ${historyTableName} WHERE meter_id = ? AND reading_time < ? ORDER BY reading_time DESC LIMIT 1`,
                [meterId, originalReading[0].reading_time]
            );

            let difference;
            if (previousReading.length === 0) {
                // 如果是第一條記錄，差額就是新值本身
                difference = newValue;
            } else {
                // 如果不是第一條記錄，差額應該是新值減去前一條讀數
                difference = newValue - parseFloat(previousReading[0].reading_value);
            }

            // 更新當前讀數
            await conn.query(
                `UPDATE ${historyTableName} SET reading_value = ?, difference = ?, photo_url = COALESCE(?, photo_url) WHERE id = ?`,
                [newValue, difference, photo_url, readingId]
            );

            // 獲取所有後續讀數
            const [subsequentReadings] = await conn.query(
                `SELECT * FROM ${historyTableName} WHERE meter_id = ? AND reading_time > ? ORDER BY reading_time ASC`,
                [meterId, originalReading[0].reading_time]
            );

            // 更新後續讀數的差額
            let previousValue = newValue;
            for (const reading of subsequentReadings) {
                const newDifference = reading.reading_value - previousValue;
                await conn.query(
                    `UPDATE ${historyTableName} SET difference = ? WHERE id = ?`,
                    [newDifference, reading.id]
                );
                previousValue = reading.reading_value;
            }

            // 更新最新的電表讀數（如果修改的是最新讀數）
            if (subsequentReadings.length === 0) {
                await conn.query(
                    `UPDATE ${tableName} SET current_reading = ? WHERE meter_number = ?`,
                    [newValue, meterId]
                );
            }

            await conn.commit();
            res.status(200).json({ message: '讀數更新成功' });
        } catch (error) {
            await conn.rollback();
            console.error('Error updating meter reading history:', error);
            res.status(500).json({ message: '更新失敗', error: error.message });
        } finally {
            conn.release();
        }
    });
});

// 獲取電表歷史記錄
app.get('/meter-history/:meterId', async (req, res) => {
    try {
        const { meterId } = req.params;
        
        const [history] = await pool.query(
            `SELECT * FROM meter_readings_history
            WHERE meter_id = ? 
            ORDER BY reading_time DESC 
            LIMIT 10`,
            [meterId]
        );
        res.json(history);
    } catch (error) {
        console.error('Error fetching meter history:', error);
        res.status(500).send(error.message);
    }
});

// 新增電表
app.post('/meters', authenticateToken, authorize(['data_manager', 'admin']), async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { meter_number, location, campus_id } = req.body;
        console.log(req.body);
        // 檢查電表號是否已存在
        const [existingMeter] = await conn.query('SELECT * FROM meters WHERE meter_number = ?', [meter_number]);
        if (existingMeter.length > 0) {
            await conn.rollback();
            return res.status(409).send('Meter number already exists');
        }

        // 檢查位置是否存在
        let [existingLocation] = await conn.query('SELECT * FROM location_types WHERE name = ? AND campus_id = ?', [location, campus_id]);
        let locationTypeId;

        if (existingLocation.length === 0) {
            // 如果位置不存在，創建新位置
            const [result] = await conn.query('INSERT INTO location_types (name, campus_id) VALUES (?, ?)', [location, campus_id]);
            locationTypeId = result.insertId;
        } else {
            locationTypeId = existingLocation[0].id;
        }

        // 添加新電表
        await conn.query('INSERT INTO meters (meter_number, location, campus_id) VALUES (?, ?, ?)', [meter_number, location, campus_id]);

        // 更新 location_types 表中的 meter_numbers
        const [updatedLocation] = await conn.query('SELECT meter_numbers FROM location_types WHERE id = ?', [locationTypeId]);
        let meterNumbers = updatedLocation[0].meter_numbers ? updatedLocation[0].meter_numbers.split(',') : [];
        meterNumbers.push(meter_number);
        await conn.query('UPDATE location_types SET meter_numbers = ? WHERE id = ?', [meterNumbers.join(','), locationTypeId]);

        await conn.commit();
        res.status(201).send('Meter added successfully');
    } catch (error) {
        await conn.rollback();
        console.error('Error adding meter:', error);
        res.status(500).send(error.message);
    } finally {
        conn.release();
    }
});

// 刪除電表
app.delete('/meters/:id', authenticateToken, authorize(['data_manager', 'admin']), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const { id } = req.params;
        console.log(req.params);

        // 获取要删除的电表的信息
        const [meterToDelete] = await conn.query('SELECT * FROM meters WHERE id = ?', [id]);
        if (meterToDelete.length === 0) {
            await conn.rollback();
            return res.status(404).send('Meter not found');
        }

        const locationName = meterToDelete[0].location; // 获取location
        const meterNumber = meterToDelete[0].meter_number; // 获取meter_number
        console.log(locationName);
        console.log(meterNumber);

        // 删除电表的读数历史
        await conn.query('DELETE FROM meter_readings_history WHERE meter_id = ?', [meterNumber]);

        // 删除电表
        await conn.query('DELETE FROM meters WHERE id = ?', [id]);

        // 更新 location_types 表
        if (locationName) {
            const [locationData] = await conn.query('SELECT meter_numbers FROM location_types WHERE name = ?', [locationName]);
            if (locationData.length > 0) {
                let meterNumbers = locationData[0].meter_numbers ? locationData[0].meter_numbers.split(',') : [];
                meterNumbers = meterNumbers.filter(number => number !== meterNumber);

                if (meterNumbers.length === 0) {
                    // 如果 meter_numbers 为空，则删除 location_types 中的记录
                    await conn.query('DELETE FROM location_types WHERE name = ?', [locationName]);
                } else {
                    // 更新剩余的 meter_numbers
                    await conn.query('UPDATE location_types SET meter_numbers = ? WHERE name = ?', [meterNumbers.join(','), locationName]);
                }
            }
        }

        await conn.commit();
        res.status(200).send('Meter and related location types deleted successfully');
    } catch (error) {
        if (conn) await conn.rollback();
        console.error('Error deleting meter:', error);
        res.status(500).send(error.message);
    } finally {
        if (conn) conn.release();
    }
});
// 删除校区
app.delete('/campuses/:id', authenticateToken, authorize(['data_manager', 'admin']), async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const { id } = req.params;
        console.log(req.params);

        // 删除引用该校区的 location_types 记录
        await conn.query('DELETE FROM location_types WHERE campus_id = ?', [id]);

        // 获取该校区的所有电表ID
        const [meters] = await conn.query('SELECT meter_number FROM meters WHERE campus_id = ?', [id]);
        const meterNumbers = meters.map(meter => meter.meter_number);
        console.log(meterNumbers);

        if (meterNumbers.length > 0) {
            // 删除电表的读数历史
            await conn.query('DELETE FROM meter_readings_history WHERE meter_id IN (?)', [meterNumbers]);

            // 删除电表
            await conn.query('DELETE FROM meters WHERE campus_id = ?', [id]);
        }

        // 删除校区
        const result = await conn.query('DELETE FROM campuses WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).send('Campus not found');
        }

        await conn.commit();
        res.status(200).send('Campus and all associated meters deleted successfully');
    } catch (error) {
        if (conn) await conn.rollback();
        console.error('Error deleting campus:', error);
        res.status(500).send(error.message);
    } finally {
        if (conn) conn.release();
    }
});

// 更新電表信息
app.put('/meters/:meter_number', authenticateToken, authorize(['data_manager', 'admin']), async (req, res) => {
    try {
        const { meter_number } = req.params;
        const { meter_type, brand, display_unit, ct_value, wiring_method } = req.body;
        
        let updateQuery, updateValues;
        if (meter_type === 'digital') {
            updateQuery = `
                UPDATE meters 
                SET meter_type = ?, brand = ?, display_unit = ?
                WHERE meter_number = ?
            `;
            updateValues = [meter_type, brand, display_unit, meter_number];
        } else {
            updateQuery = `
                UPDATE meters 
                SET meter_type = ?, ct_value = ?, wiring_method = ?
                WHERE meter_number = ?
            `;
            updateValues = [meter_type, ct_value, wiring_method, meter_number];
        }
        
        const [result] = await pool.query(updateQuery, updateValues);
        
        if (result.affectedRows === 0) {
            return res.status(404).send('Meter not found');
        }
        res.status(200).send('Meter updated successfully');
    } catch (error) {
        console.error('Error updating meter:', error);
        res.status(500).send(error.message);
    }
});

// 新增校區
app.post('/campuses', authenticateToken, authorize(['data_manager', 'admin']), async (req, res) => {
    try {
        const { name } = req.body;
        const [existingCampus] = await pool.query('SELECT * FROM campuses WHERE name = ?', [name]);
        if (existingCampus.length > 0) {
            return res.status(409).send('Campus already exists');
        }
        await pool.query('INSERT INTO campuses (name) VALUES (?)', [name]);
        res.status(201).send('Campus added successfully');
    } catch (error) {
        console.error('Error adding campus:', error);
        res.status(500).send(error.message);
    }
});

// 用戶管理 (只有 admin 可以)
app.post('/users', authenticateToken, authorize(['admin']), async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // 驗證輸入
        if (!username || !password || !role) {
            return res.status(400).json({ message: '用戶名、密碼和角色都是必填項' });
        }

        // 檢查用戶名是否已存在
        const [existingUser] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            return res.status(409).json({ message: '用戶名已存在' });
        }

        // 驗證角色
        const validRoles = ['admin', 'data_manager', 'reader'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: '無效的角色' });
        }

        // 加密密碼
        const hashedPassword = await bcrypt.hash(password, 10);

        // 插入新用戶
        await pool.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );

        res.status(201).json({ message: '用戶創建成功' });
    } catch (error) {
        console.error('創建用戶時出錯:', error);
        res.status(500).json({ message: '服務器錯誤', error: error.message });
    }
});

// 獲取所有用戶列表 (只有 admin 可以)
app.get('/users', authenticateToken, authorize(['admin']), async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, username, role FROM users');
        res.json(users);
    } catch (error) {
        console.error('獲取用戶列表時出錯:', error);
        res.status(500).json({ message: '服務器錯誤', error: error.message });
    }
});

// 刪除用戶 (只有 admin 可以)
app.delete('/users/:id', authenticateToken, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: '用戶不存在' });
        }
        res.json({ message: '用戶刪除成功' });
    } catch (error) {
        console.error('刪除用戶時出錯:', error);
        res.status(500).json({ message: '服務器錯誤', error: error.message });
    }
});

// 更新用戶信息 (只有 admin 可以)
app.put('/users/:id', authenticateToken, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { username, role, password } = req.body;

        // 檢查用戶是否存在
        const [existingUser] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        if (existingUser.length === 0) {
            return res.status(404).json({ message: '用戶不存在' });
        }

        // 準備更新數據
        const updates = {};
        if (username) updates.username = username;
        if (role) updates.role = role;
        if (password) {
            updates.password = await bcrypt.hash(password, 10);
        }

        // 如果沒有要更新的數據，返回錯誤
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: '沒有提供要更新的數據' });
        }

        // 執行更新
        await pool.query('UPDATE users SET ? WHERE id = ?', [updates, id]);

        res.json({ message: '用戶信息更新成功' });
    } catch (error) {
        console.error('更新用戶信息時出錯:', error);
        res.status(500).json({ message: '服務器錯誤', error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.get('/test-bcrypt', async (req, res) => {
    const password = '123456789';
    const hashedPassword = await bcrypt.hash(password, 10);
    const isMatch = await bcrypt.compare(password, hashedPassword);
    res.json({ hashedPassword, isMatch });
  });

