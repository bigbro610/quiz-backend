const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const https = require('https'); // 原生模块，无需安装

const app = express();

// 1. 基础配置
app.use(cors());
app.use(express.json());

// 2. 数据库连接
// 务必在 Render 后台 Environment 变量中添加 DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } 
});

// 3. 自动初始化数据库表
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ranking_list (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        score INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ 数据库表 [ranking_list] 已就绪");
  } catch (err) {
    console.error("❌ 数据库初始化失败:", err.message);
  }
}
initDb();

// 4. API 路由
// [健康检查接口] 用于自唤醒和 Render 检测
app.get('/health', (req, res) => res.send('OK'));

// [提交分数]
app.post('/submit', async (req, res) => {
  const { user_id, score } = req.body;
  if (!user_id || score === undefined) {
    return res.status(400).json({ success: false, error: "ID或分数不能为空" });
  }
  try {
    await pool.query(
      'INSERT INTO ranking_list (user_id, score) VALUES ($1, $2)',
      [user_id, parseInt(score)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("提交失败:", err.message);
    res.status(500).json({ success: false, error: "数据库写入失败" });
  }
});

// [获取排行榜]
app.get('/ranking', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, score FROM ranking_list ORDER BY score DESC, created_at ASC LIMIT 10'
    );
    res.json(result.rows);
  } catch (err) {
    console.error("获取排行榜失败:", err.message);
    res.status(500).json([]);
  }
});

// 5. --- 方案一：自运行防止休眠功能 ---
const SELF_URL = "https://quiz-backend-1-lrmy.onrender.com/health";

// 每 14 分钟请求一次自己，防止 Render 进入休眠
setInterval(() => {
  https.get(SELF_URL, (res) => {
    console.log(`💓 自唤醒成功 (状态码: ${res.statusCode}) - ${new Date().toLocaleTimeString()}`);
  }).on('error', (err) => {
    console.error("❌ 自唤醒失败:", err.message);
  });
}, 14 * 60 * 1000); 
// -----------------------------------

// 6. 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 后端已启动: http://localhost:${PORT}`);
  console.log(`💓 已开启自唤醒模式，每 14 分钟将请求一次: ${SELF_URL}`);
});
