'use strict'

// K2SO: Snarky droid/bot for SWGOH flash event notifications.
// This bot listens on a certain channel for a Slack reminder with a certain keyword,
// then iterates through a list of enrolled members, adjusts for their registered timezones,
// and sends PM reminders at fixed hours of the day.

//set up constants.
const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')
const DEBUG=false
const CHIME_KEYWORD = 'chime'

// constants for Slack test channels.
const OFFICERS_PRIVATE = 'G2B6KC10S'
const SANDBOX = 'G2BHD8H0F'
const BOT_REMINDERS = 'G5UJ1K5FT'
const GAME_EVENTS = 'C55NYKC10'

// list of officers.
const officers = [
  'U2A3YP9MH','eoa',-5,
  'U2B6M7MSR','schwefumbler',-4,
  'U4FA4LE5N','alphonsis',-7,
  'U2BB4L4HY','ajuntapaul',-5,
  'U2AFRRVL1','bluemoose',-5,
  'U2A6642T1','yer.reklaw',-7,
  'U4U5MRWGJ','blackvseries',4,
  'U2AKRH076','tanga',-5,
  'U2AC1PF29','jonosmol',-6,
  'U4V71QBN2','humy',4,
  'U2PV0FRM1','walkingdeadmann',-6,
  'U509E4CF9','joucii',3,
  'U58E503HV','ewokfam',1,
  'U2B697UFQ','hazqrd',-4,
  'U6ATMTSGH','scruffylookinghersh',-4,
  'U2C7PDX8R','meerkat',-5
                 ]

//const officers = ['U2A3YP9MH','eoa',-5]

// persistent storage:
// 1 key for every user code storing their handles and swgoh-timezone
// 1 key for every day of the week marking flash events

var kv = require('beepboop-persist')({
  project_id: process.env.BEEPBOOP_PROJECT_ID,
  token: process.env.BEEPBOOP_TOKEN
})

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
\`enroll\` - to enroll a member for notifications (not yet functional).
\`unenroll\` - to unenroll a member (not yet functional).
\`flashevent\` - to toggle my flash event notifications for today.
\`list\` - to list my weekly schedule and enrolled members.
\`forceflashevent\` - to toggle flash events for another weekday.
\`rawerase\` - to erase corrupt or garbage entries.
\`thanks\` - to demonstrate a simple response.
\`<type-any-other-text>\` - to get a random comment from me.
\`attachment\` - to see a Slack attachment message.
`
//*********************************************
// Setup different handlers for messages
//*********************************************

// response to the user typing "help"
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  msg.say(HELP_TEXT)
})

//  User unenrolling.
slapp
  .message('unenroll', 'direct_mention', (msg, text) => {
  msg.say('You are user ' + msg.body.event.user);
  let words = msg.body.event.text.split(' ');
  if (words.length<3) {
    msg.say('Invalid command.  Correct syntax is \'unenroll @user\', e.g. enroll @whopper');
  } else {
    msg.say('Unenrolling user ' + words[2] + ' (' + words[2].substring(2,11) + ').');
    kv.del(words[2].substring(2,11), function (err) {
       // living dangerously
    })
  }
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

//  KV listing.
slapp
  .message('list', 'direct_mention', (msg, text) => {
  msg.say('You are user ' + msg.body.event.user);
  kv.list(function (err, keys) {
    console.log(keys);
    for (let key of keys) {
        console.log('Key: '+key);
        kv.get(key, function (err, val) {
          msg.say(key+': ' + val);
        })
    }
  })
})

//  Entry erasing.
slapp
  .message('rawerase', 'direct_mention', (msg, text) => {
  msg.say('You are user ' + msg.body.event.user);
  let words = msg.body.event.text.split(' ');
  if (words.length<3) {
    msg.say('Invalid command.  Correct syntax is \'erase entry\', e.g. erase WEFSBDLFK');
  } else {
    msg.say('Erasing garbage entry ' + words[2] + '.');
    kv.del(words[2], function (err) {
       // living dangerously
    })
  }
})

//  Entry erasing.
slapp
  .message('forceflashevent', 'direct_mention', (msg, text) => {
  let words = msg.body.event.text.split(' ');
  if (words.length<3) {
    msg.say('Invalid command.  Correct syntax is \'forceflashevent 0|1|2|3|4|5|6\', e.g. forceflashevent 3');
  } else {
    msg.say('Forced Flash Event on for day ' + words[2] + ' of week.');
    kv.set(words[2], true, function (err) {
       // living dangerously
    })
  }
})

//  Flash Event Flag.
slapp
  .message('flashevent', 'direct_mention', (msg)=> {
  let words = msg.body.event.text.split(' ');
  let command ='';
  if (words.length<3) {
    msg.say('Invalid command.  Correct syntax is \'flashevent on|off');
  } else if (words[2]=='on') {
    command='on';
  } else if (words[2]=='off'){
    command='off';
  } else {
    msg.say('Invalid command.  Correct syntax is \'flashevent on|off');
  }
    for (let i=0;i<officers.length;i+=3) {
      let usrID = officers[i];
      if (msg.body.event.user!=usrID) continue;
      let uName = '@'+ officers[i+1];
      let offset = officers[i+2];
      let dt = new Date(Date.now()+3600000*offset);
      let hr = dt.getHours();
      let dow = dt.getDay();
      let answer = 'Captain ' + uName + ':' +
          '  your SWGOH DOW is ' + dow + ' (Sunday is 0) and your time is ' +dt.toLocaleString()+ '(day '+ dt.getDate() +' hour ' +hr+ '). Flash Event is now ';
      if (command=='on') {
        answer += command;
        kv.set(dow, true, function (err) {
          // living dangerously
        })
      } else if (command=='off') {
        answer += command;
        kv.set(dow, false, function (err) {
          // living dangerously
        })
      } else {
        answer = 'Invalid command.  Correct syntax is \'flashevent on|off';
      }
      msg.say({
        link_names: true,
        as_user: true,
        text: answer
      });
    }
})

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

slapp.message(CHIME_KEYWORD, ['direct_message', 'direct_mention', 'mention', 'ambient'], (msg) => {
  if (msg.body.event.channel==BOT_REMINDERS && msg.body.event.text.indexOf(CHIME_KEYWORD)>=0) {
    for (let i=0;i<officers.length;i+=3) {
      let tempFLASH='OFF.';
      let usrID = officers[i];
      let uName = '@'+ officers[i+1];
      let offset = officers[i+2];
      let dt = new Date(Date.now()+3600000*offset);
      let dow = dt.getDay();
      let hr = dt.getHours();
      let answer = '';
      kv.get(dow, function (err, val) {
        console.log(val);
        if (val) {
          tempFLASH='ON.';
        }

        if (DEBUG) {
          answer = uName + ':' +
            '  your SWGOH DOW is ' + dow + ' (Sunday is 0) and your time is ' +dt.toLocaleString()+ '(day '+ dt.getDate() +' hour ' +hr+ '). Today\'s Flash Event is ' + tempFLASH;;
          msg.say({
            channel: SANDBOX,
            link_names: true,
            as_user: true,
            text: answer
          });
        }
        
        if (val) {
          if (hr==11 || hr==15 || hr==19 || hr==20 || hr==22) {
            let dice = Math.random();
            if (dice > 0.75) {
              answer = uName + ':' + 'Your Flash Event is active now. I\'ve got a bad feeling about…';
            } else if (dice > 0.5) {
              answer = uName + ':' + 'Your Flash Event is active now. I\'m not very optimistic about our odds.';
            } else if (dice > 0.25) {
              answer = uName + ':' + 'Your Flash Event is active now. You are being reminded. Please do not resist.';
            } else {
              answer = uName + ':' + 'There is a 97.6% chance of failure, but your Flash Event is active now.';
            }

            msg.say({
              channel: usrID,
              link_names: true,
              as_user: true,
              text: answer
            });   
          }
        }
        
      })
    }
  }
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
  // Prevent feedback loops in direct messages
  if (msg.isBot()) {
    return;
  }
  let dice = Math.random();
  let answer = '';
  if (dice > 0.95) {
    answer='I\'ll be there for you. The captain said I had to.';
  } else if (dice > 0.9) {
    answer='There\'s a problem on the horizon: There is no horizon.';
  } else if (dice > 0.85) {
    answer='That is a bad idea.  I think so, and so does Cassian. What do I know?  My specialty is just strategic analysis.';
  } else if (dice > 0.8) {
    answer='Doesn\'t sound so bad to me.';
  } else if (dice > 0.75) {
    answer='Not me... I can survive in space.';
  } else if (dice > 0.7) {
    answer='Did you know that wasn\'t me?';
  } else if (dice > 0.65) {
    answer='I\'ve got a bad feeling about…';
  } else if (dice > 0.6) {
    answer='Your behavior is continually unexpected.';
  } else if (dice > 0.55) {
    answer='You are being reminded. Please do not resist.';
  } else if (dice > 0.5) {
    answer='I can blend in. I\'m an Imperial droid.';
  } else if (dice > 0.45) {
    answer='The captain says you\'re a friend. I will not kill you.';
  } else if (dice > 0.4) {
    answer='There were a lot of explosions for two people blending in.';
  } else if (dice > 0.35) {
    answer='Congratulations, you\'re being rescued.';
  } else if (dice > 0.3) {
    answer='I’d really rather not. The odds of the Coruscant Underworld Police showing up are one in 93 million.';
  } else if (dice > 0.25) {
    answer='I find that answer vague and unconvincing.';
  } else if (dice > 0.2) {
    answer='I\'m not very optimistic about our odds.';
  } else if (dice > 0.15) {
    answer='Quiet!  And there\'s a fresh one if you mouth off again.';
  } else if (dice > 0.1) {
    answer='There you are. I\'m standing by as you requested.';
  } else if (dice > 0.05) {
    answer='Would you like to know the probablility of not getting the gear you want? It\'s high. It\'s very high.';
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
