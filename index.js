'use strict';

const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const request = require('request');
require('date-utils');

/*************************************************************************/
/* Confidential information
/*************************************************************************/
const LINE_CHANNEL_ACCESS_TOKEN = '3xoDGJ8KgOVxVsyS4/XJwYqXOemYOX2b3mDioaOgnMv2jc2vkZcuGBnSzrehcK+sYXWEXgwraDP4DDvm6uiez8PChvb77gEAAtndU93wGwLN+LnsqVlLnQQN8ybt6wIquvnU/xFiobFIY5IOFLjclQdB04t89/1O/w1cDnyilFU=';    // LINE Botのアクセストークン
const LINE_CHANNEL_SECRET = '8df5f91ca99d59fdf5be9877edb547a6';          // LINE BotのChannel Secret
const DOCOMO_API_KEY = '4450394e564d796730344a7757733044345237396b544d6f43314538694236442f4d775449696d42444d38';               // docomoAPI用：APIキー
const GURUNAVI_API_KEY = 'e439bdcc53f4e5a8d0a777656e3e26c3';             // ぐるなびAPI用：APIキー
/*************************************************************************/

const PORT = process.env.PORT || 3000;
const LINE_MESSAGE_MAX_LENGTH = 2000;

const NEW_LINE = '\n';
const GURUNAVI_LUNCH_HOUR = 13;
const GURUNAVI_DRINKING_HOUR = 17;

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};

const app = express();

app.post('/webhook', line.middleware(config), (req, res) => {

  // 先行してLINE側にステータスコード200を返す
  res.sendStatus(200);

  console.log(req.body.events);
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => {
      console.log('event processed.');
    });
});

const client = new line.Client(config);

function handleEvent(event) {

  console.log('handleEvent()');

  if (event.type !== 'message') {
    return Promise.resolve(null);
  }

  if ((event.message.type !== 'text') && (event.message.type !== 'location')) {
    return Promise.resolve(null);
  }

  let message = '';

  /***** type：text *****/
  const text = (event.message.type === 'text') ? event.message.text : '';
  if (text == '天気') {
    // 天気予報
    checkWeatherForecast(event.source.userId);

    message = 'ちょっと待ってね';

  } else if (text.endsWith('を調べて')) {
    // Wiki検索
    const length = 'を調べて'.length;
    const word = text.slice(0, -length);
    lookUpWords(event.source.userId, word);

    message = 'ちょっと待ってね';

  } else if (text.startsWith('言語解析 ')) {
    // 言語解析
    const length = '言語解析 '.length;
    const sentence = text.slice(length);
    analysisSentence(event.source.userId, sentence);

    message = 'ちょっと待ってね';

  } else if (text == 'ヘルプ') {
    // ヘルプ
    message = '有効キーワード' + NEW_LINE;
    message += '・天気' + NEW_LINE;
    message += '　→天気を調べるよ' + NEW_LINE;
    message += '・[単語]を調べて' + NEW_LINE;
    message += '　→Wikiで単語を調べるよ' + NEW_LINE;
    message += '・言語解析 [文章]' + NEW_LINE;
    message += '　→文章を解析するよ' + NEW_LINE;
    message += '　　スペースを忘れずにね' + NEW_LINE;
    message += '・[位置情報]' + NEW_LINE;
    message += '　→ぐるなびでお店を調べるよ' + NEW_LINE;
    message += '　　' + GURUNAVI_LUNCH_HOUR + ':00まではランチ' + NEW_LINE;
    message += '　　' + GURUNAVI_LUNCH_HOUR + ':00-' + GURUNAVI_DRINKING_HOUR + ':00はカフェ' + NEW_LINE;
    message += '　　' + GURUNAVI_DRINKING_HOUR + ':00以降は居酒屋' + NEW_LINE;
    message += 'その他は、おうむ返しするよ！';

  } else if (text != '') {
    // おうむ返し
    message = text;
  }

  /***** type：location *****/
  const latitude = (event.message.type === 'location') ? event.message.latitude : '';
  const longitude = (event.message.type === 'location') ? event.message.longitude : '';
  if ((latitude != '') && (longitude != '')) {
    // ぐるなび検索
    gurunaviSearch(event.source.userId, latitude, longitude);

    message = 'ちょっと待ってね';
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: message
  });
}

const checkWeatherForecast = async (userId) => {

  //情報提供元：ライブドアの天気API
  //http://weather.livedoor.com/weather_hacks/webservice

  console.log('checkWeatherForecast()');

  const city = '130010';  // 東京
  const url = 'http://weather.livedoor.com/forecast/webservice/json/v1?city=' + city;
  const res = await axios.get(url);
  const item = res.data;

  let message = '';

  // タイトル
  const title = item.title;
  message = '[' + title + ']' + NEW_LINE;

  // 今日、明日、明後日の天気
  const today = item.forecasts[0];
  const tomorrow = item.forecasts[1];
  const dayAfterTomorrow = item.forecasts[2];
  if (today) {
    message += today.dateLabel + '　：' + today.telop + NEW_LINE;
  }
  if (tomorrow) {
    message += tomorrow.dateLabel + '　：' + tomorrow.telop + NEW_LINE;
  }
  if (dayAfterTomorrow) {
    message += dayAfterTomorrow.dateLabel + '：' + dayAfterTomorrow.telop + NEW_LINE;
  }

  // 天気概況文
  //message += NEW_LINE;
  //message += item.description.text + NEW_LINE;

  // URL
  message += NEW_LINE;
  message += item.link;

  console.log('message=' + NEW_LINE);
  console.log(message);

  await client.pushMessage(userId, {
    type: 'text',
    text: message
  });
}

const lookUpWords = async (userId, word) => {

  //情報提供元：MediaWikiのAPI
  //https://www.mediawiki.org/wiki/API:Main_page/ja

  console.log('lookUpWords()');

  const options = {
    url: 'https://ja.wikipedia.org/w/api.php',
    qs: {
      format: 'json',
      action: 'query',
      redirects: 1,
      list: 'search',
      srsearch: word,
      srlimit: 3,           // 検索結果の最大取得件数
      prop: 'extracts',
      exchars: 200,         // 説明文の最大文字列長
      explaintext: 1,
    }
  };

  request(options, function(err, response, result) {

    let message = '';

    if(!err && response.statusCode == 200) {
      const json = JSON.parse(result);
      const search = json.query.search;
      const wikiURL = 'https://ja.wikipedia.org/wiki/';

      const mainTitle = '[検索結果]' + NEW_LINE;
      message = mainTitle;

      Object.keys(search).some(function(key) {
        if (key == -1) {
          message = 'ごめんなさい。' + NEW_LINE;
          message += '該当ワードはありません。';
          return true;
        }

        const item = search[key];
        if (item.title && item.snippet) {
          let itemMessage = '';

          if (message != mainTitle) {
            itemMessage = NEW_LINE;
            itemMessage += NEW_LINE;
          }

          const title =  item.title;
          let summary = item.snippet;
          summary = summary.replace(/<span class="searchmatch">/g, '');
          summary = summary.replace(/<\/span>/g , '');

          // ワード
          itemMessage += '◆' + title + 'とは' + NEW_LINE;

          // 説明文
          itemMessage += summary + NEW_LINE;

          // URL
          itemMessage += NEW_LINE;
          itemMessage += encodeURI(wikiURL + title);

          if ((message.length + itemMessage.length) > LINE_MESSAGE_MAX_LENGTH) {
            return true;
          }

          message += itemMessage;
        }
      });

      if (message == mainTitle) {
        message = 'ごめんなさい。' + NEW_LINE;
        message += '該当ワードはありません。';
      }

      console.log('message=' + NEW_LINE);
      console.log(message);

    } else {
      message = 'ごめんなさい。' + NEW_LINE;
      message += 'エラーが発生しました。';
      console.log('error!');
      console.log('err:' + err + ', response.statusCode:' + response.statusCode);
    }

    client.pushMessage(userId, {
      type: 'text',
      text: message
    });
  }).setMaxListeners(10);
}

const analysisSentence = async (userId, sentence) => {

  //情報提供元：docomoのAPI
  //https://dev.smt.docomo.ne.jp
  //https://dev.smt.docomo.ne.jp/?p=docs.api.page&api_name=language_analysis&p_name=api_2#tag01

  console.log('analysisSentence()');

  const headers = {
    'Content-Type': 'application/json'
  }

  const strRequestId = Math.random().toString(36).slice(-8);
  const body = {
    request_id: strRequestId,
    sentence: sentence
  }

  const options = {
    url: 'https://api.apigw.smt.docomo.ne.jp/gooLanguageAnalysis/v1/entity',
    method: 'POST',
    qs: {
      APIKEY: DOCOMO_API_KEY
    },
    headers: headers,
    body: JSON.stringify(body)
  };

  request(options, function(err, response, result) {
    let message = '';

    if(!err && response.statusCode == 200) {
      const json = JSON.parse(result);

      if (json.request_id != strRequestId) {
        message = 'ごめんなさい。' + NEW_LINE;
        message += '解析できませんでした。';
      } else {
        const list = json.ne_list;

        const title = '[解析結果]' + NEW_LINE;
        message = title;

        Object.keys(list).some(function(key) {
          if (message != title) {
            message += NEW_LINE;
          }

          const item = list[key]
          const word = item[0];
          const type = item[1];
          message += type + '：' + word;
        });

        if (message == title) {
          message = 'ごめんなさい。' + NEW_LINE;
          message += '解析結果はありません。';
        }

        console.log('message=' + NEW_LINE);
        console.log(message);
      }

    } else {
      message = 'ごめんなさい。' + NEW_LINE;
      message += 'エラーが発生しました。';
      console.log('error!');
      console.log('err:' + err + ', response.statusCode:' + response.statusCode);
    }

    client.pushMessage(userId, {
      type: 'text',
      text: message
    });
  }).setMaxListeners(10);
}

const gurunaviSearch = async (userId, latitude, longitude) => {

  //情報提供元：ぐるなびのAPI
  //https://api.gnavi.co.jp/api/
  //https://api.gnavi.co.jp/api/manual/

  console.log('gurunaviSearch()');

  const url = 'https://api.gnavi.co.jp/RestSearchAPI/20150630/';
  const format = 'json';
  const range = 1;              // 緯度/経度からの検索範囲(半径)。1は、300m
  const hit_per_page = 3;       // 検索結果の最大取得件数

  let options;
  const nowHour = new Date().toFormat("HH24");
  if (nowHour < GURUNAVI_LUNCH_HOUR) {
    // ランチ検索
    options = {
      url: url,
      qs: {
        keyid: GURUNAVI_API_KEY,
        format: format,
        latitude: latitude,
        longitude: longitude,
        range: range,
        hit_per_page: hit_per_page,
        lunch: 1    // ランチ営業有無　0:絞込みなし(デフォルト)、1：絞込みあり
      }
    };
  } else {
    let category;
    if (nowHour < GURUNAVI_DRINKING_HOUR) {
      // 大業態「カフェ・スイーツ」で検索
      category = 'RSFST18000';
    } else {
      // 大業態「居酒屋」で検索
      category = 'RSFST09000';
    }

    options = {
      url: url,
      qs: {
        keyid: GURUNAVI_API_KEY,
        format: format,
        category_l: category,   // 大業態コード
        latitude: latitude,
        longitude: longitude,
        range: range,
        hit_per_page: hit_per_page
      }
    };
  }

  request(options, function(err, response, result) {
    let message = '';

    if(!err && response.statusCode == 200) {
      const json = JSON.parse(result);

      if (json.rest) {
        const list = json.rest;

        const title = '[検索結果]' + NEW_LINE;
        message = title;

        let number = 1;
        Object.keys(list).some(function(key) {
          if (message != title) {
            message += NEW_LINE;
          }

          const item = list[key];

          const name = item.name;
          if (name) {
            message += 'No.' + number + NEW_LINE;
            message += '◆店舗名：' + NEW_LINE;
            message += name + NEW_LINE;

            let opentime = item.opentime;
            if (opentime && (typeof opentime == 'string')) {
              message += '◆営業時間：' + NEW_LINE;
              opentime = opentime.replace(/<BR>/g, NEW_LINE);
              message += opentime + NEW_LINE;
            }

            let holiday = item.holiday;
            if (holiday && (typeof holiday == 'string')) {
              message += '◆休業日：' + NEW_LINE;
              holiday = holiday.replace(/<BR>/g, NEW_LINE);
              message += holiday + NEW_LINE;
            }

            const url = item.url_mobile;
            if (url) {
              message += url + NEW_LINE;
            }

            number++;
          }
        });

        if (message == title) {
          message = 'ごめんなさい。' + NEW_LINE;
          message += '検索結果はありません。';
        }

        console.log('message=' + NEW_LINE);
        console.log(message);

      } else {
        message = 'ごめんなさい。' + NEW_LINE;
        message += '検索結果はありません。';
      }

    } else {
      message = 'ごめんなさい。' + NEW_LINE;
      message += 'エラーが発生しました。';
      console.log('error!');
      console.log('err:' + err + ', response.statusCode:' + response.statusCode);
    }

    client.pushMessage(userId, {
      type: 'text',
      text: message
    });
  }).setMaxListeners(10);
}

app.listen(PORT);
console.log(`Server running at ${PORT}`);