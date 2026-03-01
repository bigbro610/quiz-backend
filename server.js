const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cors = require('cors');
const app = express();

// 替换为你自己的 Supabase 信息
const supabaseUrl = 'sb_publishable_ghU7PVKZ9N6YP2kmKYQj1g_kbSvAxs3。';
const supabaseKey = 'sb_secret_FmoFpSaXyaCFY7XOh7yrCg_zM_-lDCA';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// 接口 A：保存分数
app.post('/submit-score', async (req, res) => {
    const { userId, score, mode } = req.body;
    
    // 向数据库插入一行数据
    const { data, error } = await supabase
        .from('quiz_results')
        .insert([{ user_id: userId, score: parseInt(score), mode: mode }]);

    if (error) {
        return res.status(500).json({ message: "存入数据库失败" });
    }
    res.status(200).json({ message: "数据已永久保存到云端排行榜！" });
});

// 接口 B：获取排行榜（前10名）
app.get('/leaderboard', async (req, res) => {
    const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .order('score', { ascending: false }) // 按分数倒序排
        .limit(10);
    
    if (error) return res.status(500).send(error);
    res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running...'));
