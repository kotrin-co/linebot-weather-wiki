const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const line = require('@line/bot-sdk');

const LINE_CHANNEL_ACCESS_TOKEN = '3xoDGJ8KgOVxVsyS4/XJwYqXOemYOX2b3mDioaOgnMv2jc2vkZcuGBnSzrehcK+sYXWEXgwraDP4DDvm6uiez8PChvb77gEAAtndU93wGwLN+LnsqVlLnQQN8ybt6wIquvnU/xFiobFIY5IOFLjclQdB04t89/1O/w1cDnyilFU=';    // LINE Botのアクセストークン
const LINE_CHANNEL_SECRET = '8df5f91ca99d59fdf5be9877edb547a6';          // LINE BotのChannel Secret

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .get('/g/',(req,res) => res.json({method:"こんにちはgetさん"}))
  .post('/p/',(req,res) => res.json({method:"こんにちはpostさん"}))
  .post('/hook/',line.middleware(config),(req,res) => lineBot(req,res))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))

  const lineBot = (req,res) => {
    res.status(200).end();
    const events = req.body.events;
    const promises = [];
    for (let i=0,l=events.length;i<l;i++){
      const ev = events[i];
      promises.push(
        echoman(ev)
        );
    }
    Promise.all(promises).then(console.log('pass @@@@'));
  }

  const echoman = async (ev) => {
    const pro = await client.getProfile(ev.source.userId);
    return client.replyMessage(ev.replyToken,{
      type:"text",
      text:`${pro.displayName}さん、今「${ev.message.text}」って言いました？${ev.message.text.length}文字`
    })
  }
