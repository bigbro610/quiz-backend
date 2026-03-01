const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// 【关键修复】增强CORS配置，解决跨域问题
app.use(cors({
  origin: '*', // 允许所有来源（生产环境可指定你的前端域名）
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Access-Control-Allow-Origin']
}));

// 解析JSON请求体（增加大小限制）
app.use(express.json({ limit: '1mb' }));
// 解析URL编码请求体
app.use(express.urlencoded({ extended: true }));

// 数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // 增加连接超时配置
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

// 数据库表初始化
async function initDb() {
  try {
    // 如需重置表结构，取消下面注释，Push后再注释
    // await pool.query('DROP TABLE IF EXISTS ranking_list'); 

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ranking_list (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        score INT NOT NULL,
        is_public BOOLEAN DEFAULT FALSE, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ [DB] 数据库表已就绪（含 is_public 字段）");
  } catch (err) {
    console.error("❌ [DB] 初始化失败:", err.message);
  }
}
initDb();

// 提交分数接口 - 增加详细日志
app.post('/submit', async (req, res) => {
  // 打印接收到的所有数据（排查是否收到请求）
  console.log("📥 收到提交请求：", {
    body: req.body,
    headers: req.headers,
    ip: req.ip
  });

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
    const result = await pool.query(
      'INSERT INTO ranking_list (user_id, score, is_public) VALUES ($1, $2, $3) RETURNING *',
      [user_id.trim(), parseInt(score), publicStatus]
    );
    console.log("✅ 数据插入成功：", result.rows[0]);
    res.json({ 
      success: true, 
      message: publicStatus ? "上榜成功" : "后台记录成功",
      data: result.rows[0]
    });
  } catch (err) {
    console.error("❌ 插入数据库失败:", err.message);
    res.status(500).json({ 
      success: false, 
      error: "服务器错误：" + err.message 
    });
  }
});

// 获取排行榜接口
app.get('/ranking', async (req, res) => {
  console.log("📥 收到排行榜请求");
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

// 健康检查接口（用于测试后端是否在线）
app.get('/health', (req, res) => {
  console.log("📥 收到健康检查请求");
  res.status(200).json({ 
    status: "alive", 
    time: new Date().toISOString(),
    dbConnected: pool._connected // 数据库连接状态
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
