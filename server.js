// ... 其他引用不变
const { createClient } = require('@supabase/supabase-js');

// 请确保这里的 URL 是以 https:// 开头的完整网址
const supabaseUrl = 'https://mdthmoexabreuxadolwo.supabase.co'; 
const supabaseKey = 'sb_publishable_ghU7PVKZ9N6YP2kmKYQj1g_kbSvAxs3';
const supabase = createClient(supabaseUrl, supabaseKey);

app.post('/submit-score', async (req, res) => {
    const { userId, score, mode } = req.body;
    
    // 调试：看看收到的数据
    console.log("准备存入 Supabase:", { userId, score, mode });

    // 关键修正：确保 score 转成了数字（如果你的数据库字段是 int8）
    const numericScore = parseInt(score);

    const { data, error } = await supabase
        .from('quiz_results') // ⚠️ 检查：你在 Supabase 建立的表名是不是叫这个？
        .insert([
            { 
                user_id: userId, // ⚠️ 检查：Supabase 里的列名是 user_id 还是 userId？
                score: numericScore, 
                mode: mode 
            }
        ]);

    if (error) {
        // 这一步最关键，如果失败，Render 日志会打印出原因
        console.error("Supabase 报错详情:", error.message, error.details);
        return res.status(500).json({ error: error.message });
    }

    console.log("✅ 成功同步到 Supabase");
    res.status(200).json({ message: "OK" });
});
