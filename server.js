const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 3. 数据库表初始化 (已加入自动重置逻辑)
async function initDb() {
  try {
    // 【如果你想彻底清空旧表结构，请取消下面这行的注释，Push一次后再注释掉它】
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

// [提交分数接口] - 支持静默记录和手动上榜
app.post('/submit', async (req, res) => {
  const { user_id, score, is_public } = req.body;
  const publicStatus = is_public || false; // 默认不上榜

  if (!user_id || score === undefined) {
    return res.status(400).json({ success: false, error: "ID或分数不能为空" });
  }

  try {
    const result = await pool.query(
      'INSERT INTO ranking_list (user_id, score, is_public) VALUES ($1, $2, $3) RETURNING *',
      [user_id, parseInt(score), publicStatus]
    );
    res.json({ success: true, message: publicStatus ? "上榜成功" : "后台记录成功" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// [获取排行榜接口] - 只筛选公开且最高的分数
app.get('/ranking', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT user_id, MAX(score) as score 
      FROM ranking_list 
      WHERE is_public = TRUE 
      GROUP BY user_id 
      ORDER BY score DESC, MIN(created_at) ASC 
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.get('/health', (req, res) => res.status(200).send('Alive'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on ${PORT}`));
