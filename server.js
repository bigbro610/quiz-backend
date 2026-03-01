const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const https = require('https');

const app = express();

// 1. 基础中间件
app.use(cors());
app.use(express.json());

// 2. 数据库连接配置
// 确保已经在 Render 环境变量中设置了 DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // 必须开启，否则 Render 的数据库连接会拒绝请求
  }
});

// 3. 数据库表初始化 (自动创建)
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
    console.log("✅ [DB] 数据库表 ranking_list 已就绪");
  } catch (err) {
    console.error("❌ [DB] 数据库初始化失败:", err.message);
  }
}
initDb();

// 4. API 路由
// [健康检查接口]
app.get('/health', (req, res) => {
  res.status(200).send('Server is alive');
});

// [提交分数接口] - 增加了详细日志打印
app.post('/submit', async (req, res) => {
  const { user_id, score } = req.body;
  
  // 日志：记录收到的原始数据
  console.log(`📩 [收到提交] 用户: ${user_id || '未知'}, 分数: ${score}`);

  if (!user_id || score === undefined) {
    console.log("⚠️ [提交失败] 数据不完整: Missing user_id or score");
    return res.status(400).json({ success: false, error: "ID或分数不能为空" });
  }

  try {
    // 插入数据库
    const result = await pool.query(
      'INSERT INTO ranking_list (user_id, score) VALUES ($1, $2) RETURNING *',
      [user_id, parseInt(score)]
    );
    
    // 日志：确认数据库写入成功
    console.log(`✅ [写入成功] ID: ${result.rows[0].id}, 用户: ${result.rows[0].user_id}`);
    res.json({ success: true });
  } catch (err) {
    // 日志：打印具体的数据库错误
    console.error("❌ [数据库错误]:", err.message);
    res.status(500).json({ success: false, error: "数据库写入失败: " + err.message });
  }
});
// [临时删除接口] - 访问一次即可删除指定的 ID
app.get('/delete-test', async (req, res) => {
  const targetId = '试运行2'; // <--- 把这里改成你想删掉的那个名字
  try {
    await pool.query('DELETE FROM ranking_list WHERE user_id = $1', [targetId]);
    console.log(`🗑️ [手动清理] 已尝试删除用户: ${targetId}`);
    res.send(`用户 ${targetId} 的记录（如果存在）已被清理！`);
  } catch (err) {
    res.status(500).send("删除失败: " + err.message);
  }
});
// [获取排行榜接口] - 已修改：同名合并，只取最高分
app.get('/ranking', async (req, res) => {
  try {
    // 使用 GROUP BY 聚合同一个 user_id 的数据，取 MAX(score) 作为展示分数
    // MIN(created_at) 可以保证如果两人最高分相同，先考出这个分数的人排前面
    const result = await pool.query(`
      SELECT user_id, MAX(score) as score 
      FROM ranking_list 
      GROUP BY user_id 
      ORDER BY score DESC, MIN(created_at) ASC 
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ [获取排行失败]:", err.message);
    res.status(500).json([]);
  }
});

// 5. 防止 Render 休眠的心跳功能 (方案一)
const SELF_URL = "https://quiz-backend-1-lrmy.onrender.com/health";

setInterval(() => {
  https.get(SELF_URL, (res) => {
    if (res.statusCode === 200) {
      console.log(`💓 [心跳] 自唤醒成功 - ${new Date().toLocaleTimeString()}`);
    }
  }).on('error', (err) => {
    console.error("❌ [心跳失败]:", err.message);
  });
}, 14 * 60 * 1000); // 14分钟一次

// 6. 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`-----------------------------------------`);
  console.log(`🚀 服务已在端口 ${PORT} 启动`);
  console.log(`🔗 监控地址: ${SELF_URL}`);
  console.log(`🛠️ 请确保 Render 环境变量 DATABASE_URL 已配置`);
  console.log(`-----------------------------------------`);
});
