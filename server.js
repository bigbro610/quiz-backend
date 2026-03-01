const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// 1. 配置跨域 (匹配你的前端需求)
app.use(cors());
app.use(express.json());

// 2. 数据库连接池
// 请确保在 Render 后台环境变量中设置了 DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Render 连接数据库必须开启 SSL
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

// 4. [POST] 提交分数接口 - 对应前端 submitToRanking()
app.post('/submit', async (req, res) => {
  const { user_id, score } = req.body;

  if (!user_id || score === undefined) {
    return res.status(400).json({ success: false, error: "ID或分数不能为空" });
  }

  try {
    // 插入数据
    await pool.query(
      'INSERT INTO ranking_list (user_id, score) VALUES ($1, $2)',
      [user_id, parseInt(score)]
    );
    
    console.log(`📥 新纪录: ${user_id} 提交了 ${score} 分`);
    res.json({ success: true });
  } catch (err) {
    console.error("提交失败:", err.message);
    res.status(500).json({ success: false, error: "数据库写入失败" });
  }
});

// 5. [GET] 获取排行榜接口 - 对应前端 loadRanking()
app.get('/ranking', async (req, res) => {
  try {
    // 获取前 10 名，按分数降序，分数相同按时间升序（先达到的排前面）
    const result = await pool.query(
      'SELECT user_id, score FROM ranking_list ORDER BY score DESC, created_at ASC LIMIT 10'
    );
    res.json(result.rows);
  } catch (err) {
    console.error("获取排行榜失败:", err.message);
    res.status(500).json([]);
  }
});

// 6. 健康检查接口
app.get('/health', (req, res) => res.send('Server is running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动: http://localhost:${PORT}`);
});
