const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

// 连接 Render 自带的 PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 初始化分数表
async function initTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        score INT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('数据表初始化成功');
  } catch (err) {
    console.error('表初始化失败', err);
  }
}
initTable();

// 1. 提交分数接口
app.post('/submit', async (req, res) => {
  const { user_id, score } = req.body;
  try {
    await pool.query(
      'INSERT INTO scores (user_id, score) VALUES ($1, $2)',
      [user_id, score]
    );
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 2. 获取排行榜接口（从高到低）
app.get('/ranking', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, score FROM scores ORDER BY score DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

// 3. 健康检查+防休眠：每10分钟自己访问自己
app.get('/health', (req, res) => {
  res.send('ok');
});

const selfUrl = 'https://da-di-quizhou-duan.onrender.com/health';
function keepAlive() {
  https.get(selfUrl, (res) => {
    console.log(`防休眠心跳：${new Date()}，状态码：${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`防休眠心跳失败：${new Date()}，错误：${err.message}`);
  });
}
// 每10分钟执行一次（600000毫秒）
setInterval(keepAlive, 600000);
// 启动时立刻执行一次
keepAlive();

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务已启动，端口：${PORT}`);
});
