const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.ACCESS_TOKEN,
  channelSecret: process.env.SECRET_KEY
};



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
    res.json({test:'hook'});
    console.log('pass');
  }
