const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const https = require('https');

const app = express();
// 增强CORS配置，避免跨域问题
app.use(cors({
  origin: '*', // 生产环境可改为你的前端域名：https://bigbro610.github.io
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// 连接 Render 自带的 PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // 增加连接配置，避免超时/断连
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000
});

// 测试数据库连接（关键：确保连接成功）
async function testDbConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ 数据库连接成功');
    client.release();
  } catch (err) {
    console.error('❌ 数据库连接失败：', err.message);
    // 连接失败时重试
    setTimeout(testDbConnection, 5000);
  }
}

// 初始化分数表（等待数据库连接成功后执行）
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
    console.log('✅ 数据表初始化成功（或已存在）');
  } catch (err) {
    console.error('❌ 表初始化失败：', err.message);
  }
}

// 1. 提交分数接口（增加日志+规范响应）
app.post('/submit', async (req, res) => {
  // 打印收到的参数，方便排查
  console.log('📥 收到提交请求：', req.body);
  const { user_id, score } = req.body;

  // 校验参数
  if (!user_id || score === undefined || isNaN(score)) {
    console.error('❌ 参数错误：user_id=', user_id, 'score=', score);
    return res.status(400).json({ 
      success: false, 
      error: '参数错误：user_id不能为空，score必须是数字' 
    });
  }

  try {
    const result = await pool.query(
      'INSERT INTO scores (user_id, score) VALUES ($1, $2) RETURNING *',
      [user_id, parseInt(score)] // 强制转数字，避免前端传字符串
    );
    console.log('✅ 数据插入成功：', result.rows[0]);
    res.status(201).json({ // 用201表示创建成功，更规范
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ 插入数据失败：', err.message);
    res.status(500).json({ 
      success: false, 
      error: '数据库插入失败：' + err.message 
    });
  }
});

// 2. 获取排行榜接口（增加日志+优化排序）
app.get('/ranking', async (req, res) => {
  console.log('📥 收到排行榜请求');
  try {
    const result = await pool.query(
      'SELECT user_id, score FROM scores ORDER BY score DESC, created_at ASC LIMIT 100'
    );
    console.log('✅ 返回排行榜数据：', result.rows.length, '条');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ 查询排行榜失败：', err.message);
    res.status(500).json([]);
  }
});

// 3. 健康检查+防休眠：每10分钟自己访问自己
app.get('/health', (req, res) => {
  res.send('ok');
});

const selfUrl = 'https://da-di-quizhou-duan.onrender.com/health';
function keepAlive() {
  https.get(selfUrl, (res) => {
    console.log(`💓 防休眠心跳：${new Date()}，状态码：${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`💔 防休眠心跳失败：${new Date()}，错误：${err.message}`);
  });
}

// 启动流程（关键：先等数据库连接+表初始化，再启动服务）
async function startServer() {
  try {
    // 1. 测试数据库连接
    await testDbConnection();
    // 2. 初始化数据表
    await initTable();
    // 3. 启动服务
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 服务已启动，端口：${PORT}`);
    });
    // 4. 启动防休眠
    keepAlive();
    setInterval(keepAlive, 600000);
  } catch (err) {
    console.error('❌ 服务启动失败：', err.message);
    process.exit(1);
  }
}

// 执行启动流程
startServer();
