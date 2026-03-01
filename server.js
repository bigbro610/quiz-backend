const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

// 必须配置 CORS，否则 GitHub Pages 的前端无法访问这里
app.use(cors());
app.use(express.json());

// 根目录访问提示（防止你打开链接看到 Cannot GET /）
app.get('/', (req, res) => {
    res.send('🚀 大帝的后端服务正在运行中...');
});

// 接收分数的核心接口
app.post('/submit-score', (req, res) => {
    const { userId, score, mode } = req.body;
    
    // 格式化日志内容
    const logEntry = `[${new Date().toLocaleString()}] ID: ${userId} | 分数: ${score} | 模式: ${mode}\n`;

    // 将结果写入本地文件 results.txt
    // 注意：Render 的免费磁盘是临时的，重启后文件会清空。
    // 但你可以在 Render 的日志控制台（Logs）里实时看到这些打印信息。
    fs.appendFile(path.join(__dirname, 'results.txt'), logEntry, (err) => {
        if (err) {
            console.error("写入失败:", err);
            return res.status(500).json({ status: "error", message: "服务器写入失败" });
        }
        console.log("✅ 收到新纪录:", logEntry);
        res.status(200).json({ status: "success", message: "太棒了！你的数据已成功传送给大帝。" });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
