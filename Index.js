// index.js
import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';

const app = express();

// จำเป็นต้องเก็บ raw body เพื่อใช้ตรวจสอบ x-line-signature
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf; // เก็บไว้ใช้ตรวจสอบ signature
  }
}));

const PORT = process.env.PORT || 3000;
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!LINE_ACCESS_TOKEN || !LINE_CHANNEL_SECRET || !OPENAI_API_KEY) {
  console.warn('Warning: Missing environment variables. Please set LINE_ACCESS_TOKEN, LINE_CHANNEL_SECRET and OPENAI_API_KEY');
}

app.get('/', (req, res) => res.send('LINE GPT Bot is running 🚀'));

// ฟังก์ชันตรวจสอบ signature จาก LINE
function verifyLineSignature(signature, rawBody) {
  if (!signature || !rawBody) return false;
  const hmac = crypto.createHmac('sha256', LINE_CHANNEL_SECRET);
  hmac.update(rawBody);
  const digest = hmac.digest('base64');
  return signature === digest;
}

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-line-signature'];
  if (!verifyLineSignature(signature, req.rawBody)) {
    console.warn('Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  const events = req.body.events || [];
  // ตอบ 200 ทันทีให้ LINE (LINE ต้องการ 200 response)
  res.sendStatus(200);

  // ประมวลผล event แบบ async (เราได้ส่ง 200 แล้ว)
  for (const event of events) {
    try {
      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text;

        // เรียก OpenAI Chat Completions
        const aiResp = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini', // ปรับตามสิทธิ์ของคุณได้
            messages: [{ role: 'user', content: userMessage }],
            max_tokens: 800
          },
          {
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30s
          }
        );

        const replyText = aiResp.data?.choices?.[0]?.message?.content?.trim() || 'ขออภัย ระบบไม่สามารถสร้างคำตอบได้ในขณะนี้';

        // ส่งคำตอบกลับผู้ใช้ผ่าน Reply API
        await axios.post(
          'https://api.line.me/v2/bot/message/reply',
          {
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: replyText }]
          },
          {
            headers: {
              Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } else {
        // กรณีอื่น ๆ (follow, join, postback) สามารถเพิ่มการรองรับได้
        console.log('Unhandled event type:', event.type);
      }
    } catch (err) {
      console.error('Event processing error:', err.response?.data || err.message || err);
      // พยายามส่ง fallback reply หากเป็นไปได้
      try {
        if (event.replyToken) {
          await axios.post(
            'https://api.line.me/v2/bot/message/reply',
            {
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: 'ขออภัย เกิดข้อผิดพลาด ลองอีกครั้งภายหลัง' }]
            },
            {
              headers: {
                Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );
        }
      } catch (e) {
        console.error('Failed to send fallback reply:', e.response?.data || e.message || e);
      }
    }
  }
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));