const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// 增强CORS配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Access-Control-Allow-Origin']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

// 测试数据库连接
async function testDbConnection() {
  try {
    const client = await pool.connect();
    console.log("✅ 数据库连接成功！");
    client.release();
  } catch (err) {
    console.error("❌ 数据库连接失败：", err.message);
  }
}
testDbConnection();

// 初始化数据库表（新增action_log表记录用户行为）
async function initDb() {
  try {
    // 1. 排行榜表（原有）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ranking_list (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        score INT NOT NULL,
        is_public BOOLEAN DEFAULT FALSE, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action_type VARCHAR(20) DEFAULT 'submit_rank' -- 新增：标记操作类型
      );
    `);

    // 2. 操作日志表（新增：记录开始/完成答卷行为）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS action_log (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        action_type VARCHAR(20) NOT NULL, -- start_quiz/finish_quiz/submit_rank
        mode VARCHAR(10), -- brief/full（仅start_quiz有）
        score INT, -- 分数（仅finish_quiz/submit_rank有）
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ [DB] 数据库表初始化完成（含操作日志表）");
  } catch (err) {
    console.error("❌ [DB] 初始化失败:", err.message);
  }
}
initDb();

// 【新增接口】上报用户操作（开始答卷/完成答卷）
app.post('/report-action', async (req, res) => {
  console.log("📥 收到用户操作上报：", req.body);
  
  const { user_id, action, mode, score } = req.body;

  // 校验必填参数
  if (!user_id || !action) {
    console.error("❌ 操作上报参数错误：user_id或action为空");
    return res.status(400).json({ 
      success: false, 
      error: "ID和操作类型不能为空" 
    });
  }

  // 校验操作类型
  const validActions = ['start_quiz', 'finish_quiz'];
  if (!validActions.includes(action)) {
    console.error("❌ 无效的操作类型：", action);
    return res.status(400).json({ 
      success: false, 
      error: "操作类型只能是start_quiz/finish_quiz" 
    });
  }

  try {
    // 插入操作日志表
    const result = await pool.query(
      `INSERT INTO action_log (user_id, action_type, mode, score) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id.trim(), action, mode || null, score || null]
    );

    console.log("✅ 操作日志记录成功：", result.rows[0]);
    res.json({ 
      success: true, 
      message: `【${action}】操作记录成功`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error("❌ 记录操作日志失败:", err.message);
    res.status(500).json({ 
      success: false, 
      error: "服务器错误：" + err.message 
    });
  }
});

// 原有提交上榜接口（仅处理手动上榜）
app.post('/submit', async (req, res) => {
  console.log("📥 收到手动上榜请求：", req.body);

  const { user_id, score, is_public } = req.body;
  const publicStatus = is_public || false;

  // 严格校验参数
  if (!user_id || user_id.trim() === '') {
    console.error("❌ 参数错误：user_id为空");
    return res.status(400).json({ 
      success: false, 
      error: "ID不能为空" 
    });
  }
  if (score === undefined || isNaN(score) || score < 0 || score > 100) {
    console.error("❌ 参数错误：score无效，值为：", score);
    return res.status(400).json({ 
      success: false, 
      error: "分数必须是0-100之间的数字" 
    });
  }

  try {
    // 插入排行榜表（标记为手动上榜）
    const result = await pool.query(
      `INSERT INTO ranking_list (user_id, score, is_public, action_type) 
       VALUES ($1, $2, $3, 'submit_rank') RETURNING *`,
      [user_id.trim(), parseInt(score), publicStatus]
    );

    // 同时记录到操作日志表
    await pool.query(
      `INSERT INTO action_log (user_id, action_type, score) 
       VALUES ($1, 'submit_rank', $2)`,
      [user_id.trim(), parseInt(score)]
    );

    console.log("✅ 手动上榜成功：", result.rows[0]);
    res.json({ 
      success: true, 
      message: publicStatus ? "上榜成功" : "后台记录成功",
      data: result.rows[0]
    });
  } catch (err) {
    console.error("❌ 手动上榜失败:", err.message);
    res.status(500).json({ 
      success: false, 
      error: "服务器错误：" + err.message 
    });
  }
});

// 获取排行榜接口（仅返回公开数据）
app.get('/ranking', async (req, res) => {
  console.log("📥 收到排行榜查询请求（仅获取数据，不提交）");
  try {
    const result = await pool.query(`
      SELECT user_id, MAX(score) as score 
      FROM ranking_list 
      WHERE is_public = TRUE 
      GROUP BY user_id 
      ORDER BY score DESC, MIN(created_at) ASC 
      LIMIT 10
    `);
    console.log("✅ 返回排行榜数据：", result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 获取排行榜失败:", err.message);
    res.status(500).json([]);
  }
});

// 健康检查接口
app.get('/health', (req, res) => {
  console.log("📥 收到健康检查请求");
  res.status(200).json({ 
    status: "alive", 
    time: new Date().toISOString(),
    dbConnected: pool._connected
  });
});

// 处理404
app.use((req, res) => {
  console.error("❌ 404：", req.path);
  res.status(404).json({ success: false, error: "接口不存在" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 访问地址：https://quiz-backend-1-lrmy.onrender.com`);
});
