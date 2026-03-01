const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('大帝的后端正在待命！'));

app.post('/submit-score', (req, res) => {
    const { userId, score, mode } = req.body;
    const log = `[${new Date().toLocaleString()}] ID: ${userId}, 分数: ${score}, 模式: ${mode}\n`;
    
    // 在 Render 的 Logs 窗口里直接打印出来，方便你看
    console.log("新提交记录 >>", log);
    
    res.status(200).json({ message: "数据已成功送达大帝手中！" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`服务已启动`));
