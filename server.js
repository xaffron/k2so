'use strict'

const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')
var officers = ['U2A3YP9MH','eoa',-5,
                   'U2B6M7MSR','schwefumbler',-6,
                   'U4FA4LE5N','alphonsis',-7,
                   'XXX','bluemoose',-4,
                   'YYY','yer.reklaw',-8]

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})

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

// "Conversation" flow that tracks state - kicks off when user says hi, hello or hey
slapp
  .message('enroll', ['direct_mention', 'direct_message'], (msg, text) => {
    msg.say({
        as_user: true,
        text: 'Initiating enrollment sequence for user ' + msg.body.event.user
      })
      // sends next event from user to this route, passing along state
      .route('how-are-you', { greeting: text })
  })
  .route('how-are-you', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''

    // user may not have typed text as their next action, ask again and re-route
    if (!text) {
      return msg
        .say("Whoops, I'm still waiting to hear how you're doing.")
        .say('How are you?')
        .route('how-are-you', state)
    }

    // add their response to state
    state.status = text

    msg
      .say(`Ok then. What's your favorite color?`)
      .route('color', state)
  })
  .route('color', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''

    // user may not have typed text as their next action, ask again and re-route
    if (!text) {
      return msg
        .say("I'm eagerly awaiting to hear your favorite color.")
        .route('color', state)
    }

    // add their response to state
    state.color = text

    msg
      .say('Thanks for sharing.')
      .say(`Here's what you've told me so far: \`\`\`${JSON.stringify(state)}\`\`\``)
    // At this point, since we don't route anywhere, the "conversation" is over
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

// Catch-all for any other responses not handled above
/*
slapp.message('.*', ['direct_mention', 'direct_message'], (msg) => {
  // respond only 40% of the time
  if (Math.random() < 0.4) {
    msg.say([':wave:', ':pray:', ':raised_hands:'])
  }
})
*/


slapp.message('.*', 'mention', (msg) => {
  let dice = Math.random();
  let answer = 'Goodbye.';
  if (dice > 0.9) {
    answer='I\'ll be there for you. The captain said I had to.';
  } else if (dice > 0.7) {
    answer='The captain says you\'re a friend. I will not kill you.';
  } else if (dice > 0.6) {
    answer='There were a lot of explosions for two people blending in.';
  } else if (dice > 0.5) {
    answer='Congratulations, you\'re being rescued.';
  } else if (dice > 0.4) {
    answer='Why do you get a blaster and I don\'t?';
  } else if (dice > 0.3) {
    answer='I find that answer vague and unconvincing.';
  } else if (dice > 0.2) {
    answer='I\'m not very optimistic about our odds.';
  } else if (dice > 0.1) {
    answer='Quiet!  And there\'s a fresh one if you mouth off again.';
  } else {
    answer='Goodbye.';
  };

  msg.say({
      as_user: true,
      text: answer
    });
})

slapp.message('.*', ['direct_message', 'direct_mention', 'mention', 'ambient'], (msg) => {
  if (msg.body.event.channel=="G5UJ1K5FT" && msg.body.event.text.indexOf("chime")>=0) {
    for (i=0;i<10;i+=3) {
      let usrID = officers[i];
      let uName = '@'+ officers[i+1];
      let offset = officers[i+2];
      let dt = new Date(Date.now()+3600000*offset);
      let hr = dt.getHours();
      let answer = uName + ' Captain, it is ' + hr + '00 hours.';
      if (hr==11 || hr==15 || hr==17 || hr==19 || hr==20 || hr==22) {
        answer += '  If there were a flash event today, you would need to report to duty immediately.';
      }
//        link_names: true,
      msg.say({
        channel: 'G2BHD8H0F',
        as_user: true,
        text: answer
      });
    }
  }
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
