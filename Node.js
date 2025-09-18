import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    const event = req.body.events[0];
    const userMessage = event.message.text;
    const replyToken = event.replyToken;

    // System prompt: กำหนดบทบาทของ AI
    const messages = [
      {
        role: 'system',
        content: `
คุณคือน้องล็อกเกอร์ (AI) ตัวแทนฝ่าย Customer Service ของบริษัท Lock Box
ตอบคำถามลูกค้าอย่างสุภาพและกระชับ
จำกัดความยาวข้อความสั้น ๆ เพื่อลดการใช้โทเคน
ตอบเฉพาะคำถามทั่วไป ไม่ต้องพึ่งพนักงาน
หากลูกค้าต้องการความช่วยเหลือหรือมีปัญหาเกี่ยวกับการใช้งาน ให้ตอบว่า:
"รบกวนติดต่อเจ้าหน้าที่เพิ่มเติมที่เบอร์ 080-059-0905 ตลอด 24 ชม."
        `
      },
      { role: 'user', content: userMessage }
    ];

    // เรียก OpenAI GPT API
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 100  // จำกัดความยาวเพื่อลดค่าใช้จ่าย
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const botReply = response.data.choices[0].message.content;

    // ส่งข้อความกลับลูกค้า
    await axios.post('https://api.line.me/v2/bot/message/reply', {
      replyToken: replyToken,
      messages: [
        { type: 'text', text: botReply }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN}`
      }
    });

    res.sendStatus(200);
  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
