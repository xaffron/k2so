'use strict'

//set up constants.
const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')

// persistent storage:
// 1 key for every user code storing their handles and swgoh-timezone
// 1 key for every day of the week marking flash events

var kv = require('beepboop-persist')({
  project_id: process.env.BEEPBOOP_PROJECT_ID,
  token: process.env.BEEPBOOP_TOKEN
})

// constants for Slack test channels.
const OFFICERS_PRIVATE = 'G2B6KC10S'
const SANDBOX = 'G2BHD8H0F'
const BOT_REMINDERS = 'G5UJ1K5FT'

// list of officers.
const officers = ['U2A3YP9MH','eoa',-15,
                   'U2B6M7MSR','schwefumbler',-4,
                   'U4FA4LE5N','alphonsis',-7,
                   'U2BB4L4HY','ajuntapaul',-5,
                   'U2AFRRVL1','bluemoose',-5,
                   'U2A6642T1','yer.reklaw',-7]

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})

//TODO:  Update help text.
var HELP_TEXT = `
I will respond to the following messages:
\`help\` - to see this message.
\`enroll\` - to, well, enroll.
\`thanks\` - to demonstrate a simple response.
\`<type-any-other-text>\` - to demonstrate a random emoticon response, some of the time :wink:.
\`attachment\` - to see a Slack attachment message.
`
//*********************************************
// Setup different handlers for messages
//*********************************************

// response to the user typing "help"
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  msg.say(HELP_TEXT)
})

// User enrolling.
slapp
  .message('enroll', 'direct_mention', (msg, text) => {
  msg.say('You are user ' + msg.body.event.user);
  let words = msg.body.event.text.split(' ');
  if (words.length<5) {
    msg.say('Invalid command.  Correct syntax is \'enroll @user user timezone\', e.g. enroll @whopper whopper +5');
  } else {
    msg.say('Enrolling user @' + words[3] + ' (' + words[2].substring(2,11) +') at timezone UTC '+ words[4] +
          '.  If this was done in error, please use \'unenroll @username\' to remove.');
    kv.set(words[2].substring(2,11), [words[3],words[4]], function (err) {
       // living dangerously
    })
  }
})

//  User unenrolling.
slapp
  .message('unenroll', 'direct_mention', (msg, text) => {
  msg.say('You are user ' + msg.body.event.user);
  let words = msg.body.event.text.split(' ');
  if (words.length<2) {
    msg.say('Invalid command.  Correct syntax is \'unenroll @user\', e.g. enroll @whopper');
  } else {
    msg.say('Unenrolling user ' + words[1] + ' (' + words[1].substring(2,11) + ').');
    kv.del(words[1].substring(2,11), function (err) {
       // living dangerously
    })
  }
})

//  KV listing.
slapp
  .message('list', 'direct_mention', (msg, text) => {
  msg.say('You are user ' + msg.body.event.user);
  kv.list(function (err, keys) {
    console.log(keys);
    for (let key in keys) {
        kv.get(key, function (err, val) {
          msg.say(key+': ' + val);
        })
    }
  })
 })

slapp.message('wipe', 'direct_mention', (msg)=> {
 kv.del('a key', function (err) {
  // handle error :)
 })
 kv.get('a key', function (err, val) {
    // handle error :)
    // val should be 'the key, is water'
    msg.say(val+' is the value after deletion');
 })
})

slapp.message('flashevent on', 'direct_mention', (msg)=> {
 
 kv.get('a key', function (err, val) {
    // handle error :)
    // val should be 'the key, is water'
    msg.say('Flash event is ' + val +' for today.');
 })
})
/*
slapp.message('flashevent_on', 'direct_mention', (msg)=> {
 kv.set('a key', 'the key, is water', function (err) {
  // living dangerously
 })
 kv.get('a key', function (err, val) {
    // handle error :)
    // val should be 'the key, is water'
    msg.say(val);
 })
 kv.list(function (err, keys) {
   // handle error :)
   // keys should be ['a key']
   console.log(keys);
 })
*/
  //let result = kv.get("TESTEST", (err, val)=> {
     // check for err
  //  msg.say(err)
  //  msg.say(val)
  //  msg.say(process.env.BEEPBOOP_PROJECT_ID)
  //  msg.say(process.env.BEEPBOOP_TOKEN)
  //   msg.say('ERROR getting from kv');
  //msg.say('Captain, '+result);
//})

// Can use a regex as well
slapp.message(/^(thanks|thank you)/i, ['mention', 'direct_message'], (msg) => {
  // You can provide a list of responses, and a random one will be chosen
  // You can also include slack emoji in your responses
  msg.say([
    "You're welcome :smile:",
    'You bet',
    ':+1: Of course',
    'Anytime :sun_with_face: :full_moon_with_face:'
  ])
})

// demonstrate returning an attachment...
slapp.message('attachment', ['mention', 'direct_message'], (msg) => {
  msg.say({
    text: 'Check out this amazing attachment! :confetti_ball: ',
    attachments: [{
      text: 'Slapp is a robust open source library that sits on top of the Slack APIs',
      title: 'Slapp Library - Open Source',
      image_url: 'https://storage.googleapis.com/beepboophq/_assets/bot-1.22f6fb.png',
      title_link: 'https://beepboophq.com/',
      color: '#7CD197'
    }]
  })
})

slapp.message('chime', ['direct_message', 'direct_mention', 'mention', 'ambient'], (msg) => {
  //if (msg.body.event.channel==BOT_REMINDERS && msg.body.event.text.indexOf("chime")>=0) {
    //for (let i=0;i<officers.length;i+=3) {
    var i=0;
      let tempFLASH='';
      let usrID = officers[i];
      let uName = '@'+ officers[i+1];
      let offset = officers[i+2];
      let dt = new Date(Date.now()+3600000*offset);
      let hr = dt.getHours();
      let answer = 'Captain ' + uName + ':';
//      if (hr==11 || hr==15 || hr==19 || hr==20 || hr==22) {
        tempFLASH=kv.get('17', function (err, val) {
          // check for err
          console.log('ERROR fetching from kv');
        })
//      }
        answer += '  your SWGOH date/time is ' +dt.toLocaleString()+ '(day '+ dt.getDate() +' hour ' +hr+ '). '+tempFLASH;
        msg.say({
          channel: SANDBOX,
          link_names: true,
          as_user: true,
          text: answer
        });
      //}
    //}
  //}
})

// Catch-all for any other responses not handled above
/*
slapp.message('.*', ['direct_mention', 'direct_message'], (msg) => {
  // respond only 40% of the time
  if (Math.random() < 0.4) {
    msg.say([':wave:', ':pray:', ':raised_hands:'])
  }
})
*/

slapp.message('.*', ['mention', 'direct_message'], (msg) => {
  let dice = Math.random();
  let answer = '';
  if (dice > 0.9) {
    answer='I\'ll be there for you. The captain said I had to.';
  } else if (dice > 0.8) {
    answer='There\'s a problem on the horizon: There is no horizon.';
  } else if (dice > 0.7) {
    answer='The captain says you\'re a friend. I will not kill you.';
  } else if (dice > 0.6) {
    answer='There were a lot of explosions for two people blending in.';
  } else if (dice > 0.5) {
    answer='Congratulations, you\'re being rescued.';
  } else if (dice > 0.4) {
    answer='I’d really rather not. The odds of the Coruscant Underworld Police showing up are one in 93 million.';
  } else if (dice > 0.3) {
    answer='I find that answer vague and unconvincing.';
  } else if (dice > 0.2) {
    answer='I\'m not very optimistic about our odds.';
  } else if (dice > 0.1) {
    answer='Quiet!  And there\'s a fresh one if you mouth off again.';
  } else {
    answer='I\'m capable of running my own diagnostics, thank you very much.';
  };

  msg.say({
      as_user: true,
      text: answer
    });
})


// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
})
